/** JSON-RPC helpers. `changesInBlock` is the cheap pre-filter for sparse scanning. */

export class UnknownBlock extends Error {
  constructor(public readonly height: number) {
    super(`unknown block ${height}`);
  }
}

interface RpcResponse<T> {
  result?: T;
  error?: { name?: string; cause?: { name?: string }; message?: string };
}

export class Rpc {
  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, params: unknown): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "nlm", method, params }),
    });
    if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
    const body = (await res.json()) as RpcResponse<T>;
    if (body.error) {
      const name = body.error.cause?.name ?? body.error.name ?? "";
      if (name === "UNKNOWN_BLOCK")
        throw new UnknownBlock((params as { block_id: number }).block_id);
      throw new Error(`${method}: ${body.error.message ?? name}`);
    }
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
