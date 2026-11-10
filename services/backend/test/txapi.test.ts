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
const RECEIPTS: Record<string, number[]> = {
  mid: [1_050, 1_051, 1_053],
  old: [995, 999, 1_000],
};

describe("TxApi.touchedHeights", () => {
  it("pages back past the lookback and returns receipt heights inside the range", async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const path = new URL(input).pathname;
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      calls.push({ path, body });
      if (path === "/v0/account") return json(PAGES[(body.resume_token as string) ?? "first"]);
      const hashes = body.tx_hashes as string[];
      return json({
        transactions: hashes.map((h) => {
          const [tx, ...rx] = RECEIPTS[h]!;
          return {
            execution_outcome: { block_height: tx },
            receipts: rx.map((b) => ({ execution_outcome: { block_height: b } })),
          };
        }),
      });
    };
    const api = new TxApi("https://tx.example", { rps: 100, fetchImpl });
    expect(await api.touchedHeights(["pool"], 1_000, 1_100)).toEqual([1_000, 1_050, 1_051, 1_053]);
    // stopped paging once the oldest tx predates the lookback window
    expect(calls.filter((c) => c.path === "/v0/account")).toHaveLength(2);
    expect(calls.at(-1)!.body.tx_hashes).toEqual(["mid", "old"]);
  });

  it("maps HTTP 429 to RateLimited", async () => {
    const api = new TxApi("https://tx.example", {
      rps: 100,
      fetchImpl: () => json({}, 429),
    });
    await expect(api.touchedHeights(["pool"], 1, 2)).rejects.toBeInstanceOf(RateLimited);
  });
});
