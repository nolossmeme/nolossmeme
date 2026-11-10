import { describe, expect, it } from "vitest";

import { RateLimited } from "../src/indexer/neardata.js";
import { LOOKBACK_BLOCKS, TxApi } from "../src/indexer/txapi.js";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

/** Two pages newest-first for `pool`; tx `old` started before the range but executes inside it. */
const PAGES: Record<string, { account_txs: unknown[]; resume_token: string | null }> = {
  first: {
    account_txs: [
      { transaction_hash: "late", tx_block_height: 2_000 },
      { transaction_hash: "mid", tx_block_height: 1_050 },
    ],
    resume_token: "next",
  },
  next: {
    account_txs: [
      { transaction_hash: "old", tx_block_height: 1_000 - LOOKBACK_BLOCKS + 5 },
      { transaction_hash: "ancient", tx_block_height: 10 },
    ],
    resume_token: "more",
  },
};
/** Receipt heights per transaction. */
const RECEIPTS: Record<string, number[]> = {
  mid: [1_050, 1_051, 1_053],
  old: [995, 999, 1_000],
};

const receipt = (tx: string, height: number) => ({
  receipt: { receipt_id: `${tx}@${height}`, predecessor_id: "a", receiver_id: "pool", receipt: {} },
  execution_outcome: {
    id: `${tx}@${height}`,
    block_height: height,
    block_timestamp: height * 1e9,
    block_hash: `b${height}`,
    outcome: { executor_id: "pool", logs: [], status: { SuccessValue: "" }, receipt_ids: [] },
  },
});

describe("TxApi.blocks", () => {
  it("pages back past the lookback and returns Lake blocks for receipts inside the range", async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const path = new URL(input).pathname;
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      calls.push({ path, body });
      if (path === "/v0/account") return json(PAGES[(body.resume_token as string) ?? "first"]);
      const hashes = body.tx_hashes as string[];
      return json({
        transactions: hashes.map((h) => ({
          transaction: { hash: h, signer_id: "a", receiver_id: "pool" },
          receipts: RECEIPTS[h]!.map((b) => receipt(h, b)),
        })),
      });
    };
    const api = new TxApi("https://tx.example", { rps: 100, fetchImpl });
    const blocks = await api.blocks(["pool"], 1_000, 1_100);
    expect(blocks.map((b) => b.block.header.height)).toEqual([1_000, 1_050, 1_051, 1_053]);
    // stopped paging once the oldest tx predates the lookback window
    expect(calls.filter((c) => c.path === "/v0/account")).toHaveLength(2);
    expect(calls.at(-1)!.body.tx_hashes).toEqual(["mid", "old"]);
    // every receipt carries its transaction hash for parseBlock
    const [shard] = blocks[0]!.shards;
    expect(shard!.chunk!.transactions[0]).toMatchObject({
      transaction: { hash: "old" },
      outcome: { execution_outcome: { outcome: { receipt_ids: ["old@1000"] } } },
    });
  });

  it("maps HTTP 429 to RateLimited", async () => {
    const api = new TxApi("https://tx.example", {
      rps: 100,
      fetchImpl: () => json({}, 429),
    });
    await expect(api.blocks(["pool"], 1, 2)).rejects.toBeInstanceOf(RateLimited);
  });
});
