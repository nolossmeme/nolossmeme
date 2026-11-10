import { describe, expect, it } from "vitest";

import { openDb } from "../src/db/client.js";
import { Store } from "../src/db/store.js";
import type { LakeBlock, NearData } from "../src/indexer/neardata.js";
import { BlockNotFound } from "../src/indexer/neardata.js";
import { Scanner } from "../src/indexer/scanner.js";
import type { TxApi } from "../src/indexer/txapi.js";

const FACTORY = "factory.nolossmeme.testnet";
const POOL = "dogn.factory.nolossmeme.testnet";

/** Heights the fake transactions API reports per watched account (105 is a skipped height). */
const TOUCHED: Record<string, number[]> = {
  [POOL]: [103, 105],
  [FACTORY]: [107],
};

function fakeBlock(height: number, withDeposit: boolean): LakeBlock {
  const logs = withDeposit
    ? [
        "deposit 1000000000000000000000000 yoctoNEAR from alice.testnet -> 300000000000000000000000 stNEAR shares",
      ]
    : [];
  return {
    block: { header: { height, timestamp: height * 1e9, hash: `h${height}` } },
    shards: [
      {
        shard_id: 0,
        chunk: { transactions: [] },
        receipt_execution_outcomes: withDeposit
          ? [
              {
                receipt: {
                  receipt_id: `r${height}`,
                  predecessor_id: POOL,
                  receiver_id: POOL,
                  receipt: {
                    Action: {
                      signer_id: POOL,
                      actions: [
                        {
                          FunctionCall: {
                            method_name: "on_deposit",
                            args: "e30=",
                            deposit: "0",
                            gas: 1,
                          },
                        },
                      ],
                    },
                  },
                },
                execution_outcome: {
                  id: `r${height}`,
                  outcome: {
                    executor_id: POOL,
                    logs,
                    status: { SuccessValue: "" },
                    receipt_ids: [],
                  },
                },
              },
            ]
          : [],
      },
    ],
  };
}

describe("Scanner sparse mode", () => {
  it("fetches only blocks the tx api says touched our accounts, and tolerates gaps", async () => {
    const fetched: number[] = [];
    const data = {
      lastFinalHeight: () => Promise.resolve(110),
      block: (h: number) => {
        fetched.push(h);
        if (h === 105) return Promise.reject(new BlockNotFound(h));
        return Promise.resolve(fakeBlock(h, h === 103));
      },
    } as unknown as NearData;
    const asked: string[][] = [];
    const txApi = {
      touchedHeights: (accounts: string[], from: number, to: number) => {
        asked.push(accounts);
        const hs = accounts.flatMap((a) => TOUCHED[a] ?? []).filter((h) => h >= from && h <= to);
        return Promise.resolve(hs.toSorted((a, b) => a - b));
      },
    } as unknown as TxApi;
    const client = {
      getMemes: () =>
        Promise.resolve([
          {
            slug: "dogn",
            account_id: POOL,
            creator: "a",
            name: "D",
            symbol: "DOGN",
            icon: null,
            created_at: "1",
            params: {},
          },
        ]),
    } as never;
    const store = new Store(await openDb(":memory:"));
    const scanner = new Scanner(data, store, client, txApi, FACTORY, {
      startBlock: 100,
      concurrency: 2,
      sparse: true,
    });
    await scanner.refreshRegistry();
    const stored = await scanner.indexRange(100, 110);
    expect(asked).toEqual([[FACTORY, POOL]]);
    expect(fetched.toSorted((a, b) => a - b)).toEqual([103, 105, 107]);
    expect(stored).toBe(1);
    expect(await store.getCursor()).toBe(110);
    expect((await store.listEvents({ kind: "deposit" }))[0]).toMatchObject({
      account: "alice.testnet",
      blockHeight: 103,
    });
  });
});
