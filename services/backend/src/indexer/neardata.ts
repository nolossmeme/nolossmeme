/** Minimal NEAR Lake (StreamerMessage) types and a fetcher for FastNEAR's neardata archive. */

export interface LakeBlock {
  block: { header: { height: number; timestamp: number; hash: string } };
  shards: LakeShard[];
}

export interface LakeShard {
  shard_id: number;
  chunk?: { transactions: LakeTransaction[] } | null;
  receipt_execution_outcomes: LakeReceiptOutcome[];
}

export interface LakeTransaction {
  transaction: { hash: string; signer_id: string; receiver_id: string };
  outcome: { execution_outcome: { outcome: { receipt_ids: string[] } } };
}

export interface LakeAction {
  FunctionCall?: { method_name: string; args: string; deposit: string; gas: number };
  Transfer?: { deposit: string };
}

export interface LakeReceiptOutcome {
  receipt: {
    receipt_id: string;
    predecessor_id: string;
    receiver_id: string;
    receipt: { Action?: { signer_id: string; actions: LakeAction[] } } | Record<string, unknown>;
  };
  execution_outcome: {
    id: string;
    outcome: {
      executor_id: string;
      logs: string[];
      status: { SuccessValue?: string; SuccessReceiptId?: string; Failure?: unknown };
      receipt_ids: string[];
    };
  };
}

export class BlockNotFound extends Error {
  constructor(public readonly height: number) {
    super(`block ${height} not found`);
  }
}

export class RateLimited extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`rate limited, retry after ${retryAfterMs}ms`);
  }
}

/** Simple token bucket: at most `rps` requests per second across all callers. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();
  constructor(private readonly rps: number) {
    this.tokens = rps;
  }
  async take(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.rps, this.tokens + ((now - this.last) / 1000) * this.rps);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((r) => setTimeout(r, Math.ceil(((1 - this.tokens) / this.rps) * 1000)));
    }
  }
}

export class NearData {
  private readonly limiter: RateLimiter;

  constructor(
    private readonly baseUrl: string,
    opts: { rps?: number; fetchImpl?: typeof fetch } = {},
  ) {
    this.limiter = new RateLimiter(opts.rps ?? 3);
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }
  private readonly fetchImpl: typeof fetch;

  private async get(path: string): Promise<Response> {
    await this.limiter.take();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      redirect: "follow",
      headers: { "user-agent": "nolossmeme-backend/0.1" },
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new RateLimited(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 5_000);
    }
    return res;
  }

  async lastFinalHeight(): Promise<number> {
    const res = await this.get("/v0/last_block/final");
    if (!res.ok) throw new Error(`last_block: HTTP ${res.status}`);
    const b = (await res.json()) as LakeBlock;
    return b.block.header.height;
  }

  /** Throws `BlockNotFound` for skipped heights (the chain has gaps), `RateLimited` on 429, other errors for transport problems. */
  async block(height: number): Promise<LakeBlock> {
    const res = await this.get(`/v0/block/${height}`);
    if (res.status === 404) throw new BlockNotFound(height);
    if (!res.ok) throw new Error(`block ${height}: HTTP ${res.status}`);
    const body = (await res.json()) as LakeBlock | null;
    if (!body || !body.block) throw new BlockNotFound(height);
    return body;
  }
}
