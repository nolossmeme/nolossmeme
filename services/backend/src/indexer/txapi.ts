/** FastNEAR transactions API: the receipts that touched our accounts, without reading every block. */
import { RateLimited, RateLimiter, type LakeBlock, type LakeReceiptOutcome } from "./neardata.js";

interface AccountTx {
  transaction_hash: string;
  tx_block_height: number;
}
/** A receipt outcome in NEAR Lake shape, plus where it executed. */
type Receipt = LakeReceiptOutcome & {
  execution_outcome: { block_height: number; block_timestamp: number; block_hash: string };
};
interface TxDetail {
  transaction: { hash: string; signer_id: string; receiver_id: string };
  receipts: Receipt[];
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

  /** Lake-shaped blocks in [from, to], oldest first, holding only the receipts of transactions
   *  that touched `accounts`. Each receipt is linked to its transaction hash. */
  async blocks(accounts: string[], from: number, to: number): Promise<LakeBlock[]> {
    const hashes = new Set<string>();
    for (const a of accounts)
      for (const h of await this.txHashes(a, from - LOOKBACK_BLOCKS, to)) hashes.add(h);
    const list = [...hashes];
    const byHeight = new Map<number, LakeBlock>();
    for (let i = 0; i < list.length; i += BATCH) {
      const { transactions } = await this.post<{ transactions: (TxDetail | null)[] }>(
        "/v0/transactions",
        { tx_hashes: list.slice(i, i + BATCH) },
      );
      for (const t of transactions) if (t) addReceipts(byHeight, t, from, to);
    }
    return [...byHeight.values()].sort((a, b) => a.block.header.height - b.block.header.height);
  }
}

function addReceipts(
  byHeight: Map<number, LakeBlock>,
  t: TxDetail,
  from: number,
  to: number,
): void {
  for (const r of t.receipts) {
    const {
      block_height: height,
      block_timestamp: timestamp,
      block_hash: hash,
    } = r.execution_outcome;
    if (height < from || height > to) continue;
    let block = byHeight.get(height);
    if (!block) {
      block = {
        block: { header: { height, timestamp, hash } },
        shards: [{ shard_id: 0, chunk: { transactions: [] }, receipt_execution_outcomes: [] }],
      };
      byHeight.set(height, block);
    }
    const shard = block.shards[0]!;
    shard.receipt_execution_outcomes.push(r);
    // A one-receipt "transaction" entry lets parseBlock map this receipt to its hash.
    shard.chunk!.transactions.push({
      transaction: t.transaction,
      outcome: { execution_outcome: { outcome: { receipt_ids: [r.receipt.receipt_id] } } },
    });
  }
}
