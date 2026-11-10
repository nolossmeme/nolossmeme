/** FastNEAR transactions API: which blocks touched an account, without asking about every block. */
import { RateLimited, RateLimiter } from "./neardata.js";

interface AccountTx {
  transaction_hash: string;
  tx_block_height: number;
}
interface Outcome {
  execution_outcome: { block_height: number };
}
interface TxDetail extends Outcome {
  receipts: Outcome[];
}

/** Receipts land in blocks after their transaction; look this far back for transactions still executing. */
export const LOOKBACK_BLOCKS = 100;
const BATCH = 20;

export class TxApi {
  private readonly limiter: RateLimiter;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    opts: { rps?: number; fetchImpl?: typeof fetch } = {},
  ) {
    this.limiter = new RateLimiter(opts.rps ?? 2);
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.limiter.take();
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "nolossmeme-backend/0.1" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw new RateLimited(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2_000);
    }
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Hashes of transactions involving `account` whose block is in [from, to]. */
  // ponytail: the API pages newest-first and ignores height bounds, so a backfill far
  // behind the head pages through newer history; fine for thousands of txs per account.
  private async txHashes(account: string, from: number, to: number): Promise<string[]> {
    const out: string[] = [];
    let resume: string | null | undefined;
    for (;;) {
      const page = await this.post<{ account_txs: AccountTx[]; resume_token?: string | null }>(
        "/v0/account",
        { account_id: account, ...(resume ? { resume_token: resume } : {}) },
      );
      for (const t of page.account_txs)
        if (t.tx_block_height >= from && t.tx_block_height <= to) out.push(t.transaction_hash);
      const oldest = page.account_txs.at(-1)?.tx_block_height;
      if (!page.resume_token || oldest === undefined || oldest < from) return out;
      resume = page.resume_token;
    }
  }

  /** Sorted heights in [from, to] where a transaction or receipt touching `accounts` executed. */
  async touchedHeights(accounts: string[], from: number, to: number): Promise<number[]> {
    const hashes = new Set<string>();
    for (const a of accounts)
      for (const h of await this.txHashes(a, from - LOOKBACK_BLOCKS, to)) hashes.add(h);
    const list = [...hashes];
    const heights = new Set<number>();
    for (let i = 0; i < list.length; i += BATCH) {
      const { transactions } = await this.post<{ transactions: (TxDetail | null)[] }>(
        "/v0/transactions",
        { tx_hashes: list.slice(i, i + BATCH) },
      );
      for (const o of transactions.flatMap((t) => (t ? [t, ...t.receipts] : []))) {
        const h = o.execution_outcome.block_height;
        if (h >= from && h <= to) heights.add(h);
      }
    }
    return [...heights].sort((a, b) => a - b);
  }
}
