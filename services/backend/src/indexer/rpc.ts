/** JSON-RPC helpers. `touchedAccounts` is the cheap pre-filter for sparse scanning. */
import { RateLimited, RateLimiter } from "./neardata.js";

export class UnknownBlock extends Error {
  constructor(public readonly height: number) {
    super(`unknown block ${height}`);
  }
}

interface RpcResponse<T> {
  result?: T;
  error?: { name?: string; cause?: { name?: string }; message?: string };
}

interface Endpoint {
  url: string;
  limiter: RateLimiter;
  /** Epoch ms until which this endpoint is skipped after a 429. */
  cooldownUntil: number;
}

/** Never honour a Retry-After longer than this; other endpoints can serve meanwhile. */
const MAX_COOLDOWN_MS = 120_000;
const MAX_WAIT_MS = 10_000;

/** JSON-RPC over one or more endpoints, round robin, each with its own rate limit. */
export class Rpc {
  private readonly endpoints: Endpoint[];
  private readonly fetchImpl: typeof fetch;
  private next = 0;

  constructor(urls: string | string[], opts: { rps?: number; fetchImpl?: typeof fetch } = {}) {
    const list = Array.isArray(urls) ? urls : [urls];
    if (list.length === 0) throw new Error("at least one rpc url is required");
    this.endpoints = list.map((url) => ({
      url,
      limiter: new RateLimiter(opts.rps ?? 2),
      cooldownUntil: 0,
    }));
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get size(): number {
    return this.endpoints.length;
  }

  /** Next endpoint in rotation that is not cooling down; if all are, the one that frees up first. */
  private pick(): Endpoint {
    const now = Date.now();
    for (let i = 0; i < this.endpoints.length; i++) {
      const ep = this.endpoints[this.next++ % this.endpoints.length]!;
      if (ep.cooldownUntil <= now) return ep;
    }
    return this.endpoints.reduce(
      (a, b) => (a.cooldownUntil <= b.cooldownUntil ? a : b),
      this.endpoints[0]!,
    );
  }

  private async call<T>(method: string, params: unknown): Promise<T> {
    const ep = this.pick();
    const wait = ep.cooldownUntil - Date.now();
    if (wait > 0) throw new RateLimited(Math.min(wait, MAX_WAIT_MS));
    await ep.limiter.take();
    const res = await this.fetchImpl(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "nlm", method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      const cooldown = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2_000, MAX_COOLDOWN_MS);
      ep.cooldownUntil = Date.now() + cooldown;
      // Another endpoint may be free right away; the caller retries after a short wait.
      throw new RateLimited(this.endpoints.length > 1 ? 50 : Math.min(cooldown, MAX_WAIT_MS));
    }
    // Skipped heights come back as HTTP 422 with an UNKNOWN_BLOCK error body, so read the body first.
    const body = (await res.json().catch(() => null)) as RpcResponse<T> | null;
    if (!body) throw new Error(`${method}: HTTP ${res.status} with no JSON body`);
    if (body.error) {
      const name = body.error.cause?.name ?? body.error.name ?? "";
      if (name === "UNKNOWN_BLOCK")
        throw new UnknownBlock((params as { block_id: number }).block_id);
      throw new Error(`${method}: ${body.error.message ?? name}`);
    }
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
    if (body.result === undefined) throw new Error(`${method}: empty result`);
    return body.result;
  }

  /** Account ids whose account or state was touched in the block. Throws `UnknownBlock` for skipped heights. */
  async touchedAccounts(height: number): Promise<Set<string>> {
    const r = await this.call<{ changes: { type: string; account_id: string }[] }>(
      "EXPERIMENTAL_changes_in_block",
      { block_id: height },
    );
    return new Set(r.changes.map((c) => c.account_id));
  }
}
