import { describe, expect, it } from "vitest";

import { openDb } from "../src/db/client.js";
import { Store } from "../src/db/store.js";
import type { LakeBlock, NearData } from "../src/indexer/neardata.js";
import { RateLimited } from "../src/indexer/neardata.js";
import { Scanner } from "../src/indexer/scanner.js";
import type { TxApi } from "../src/indexer/txapi.js";

const FACTORY = "factory.nolossmeme.testnet";
const POOL = "dogn.factory.nolossmeme.testnet";

/** Heights the fake transactions API has receipts at, per watched account. */
const TOUCHED: Record<string, number[]> = {
  [POOL]: [103],
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
  it("indexes the tx api's receipts for our accounts without reading the archive", async () => {
    const data = {
      lastFinalHeight: () => Promise.resolve(110),
      block: () => Promise.reject(new Error("the archive must not be read in sparse mode")),
    } as unknown as NearData;
    const asked: string[][] = [];
    const txApi = {
      blocks: (accounts: string[], from: number, to: number) => {
        asked.push(accounts);
        const hs = accounts.flatMap((a) => TOUCHED[a] ?? []).filter((h) => h >= from && h <= to);
        return Promise.resolve(hs.toSorted((a, b) => a - b).map((h) => fakeBlock(h, h === 103)));
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
    expect(stored).toBe(1);
    expect(await store.getCursor()).toBe(110);
    expect((await store.listEvents({ kind: "deposit" }))[0]).toMatchObject({
      account: "alice.testnet",
      blockHeight: 103,
    });
  });
});

describe("Scanner sparse launch", () => {
  it("asks again for a pool launched inside the range", async () => {
    const NEW = "pepn.factory.nolossmeme.testnet";
    const launchLog = `EVENT_JSON:${JSON.stringify({ standard: "nolossmeme", version: "1.0.0", event: "launch", data: [{ slug: "pepn", account_id: NEW, creator: "bob.testnet", symbol: "PEPN", name: "P" }] })}`;
    const launch = fakeBlock(102, true);
    const r = launch.shards[0]!.receipt_execution_outcomes[0]!;
    r.receipt.receiver_id = FACTORY;
    r.execution_outcome.outcome.executor_id = FACTORY;
    r.execution_outcome.outcome.logs = [launchLog];
    const asked: string[][] = [];
    const txApi = {
      blocks: (accounts: string[]) => {
        asked.push(accounts);
        return Promise.resolve(accounts.includes(FACTORY) ? [launch] : []);
      },
    } as unknown as TxApi;
    const client = { getMemes: () => Promise.resolve([]) } as never;
    const store = new Store(await openDb(":memory:"));
    const scanner = new Scanner({} as NearData, store, client, txApi, FACTORY, {
      startBlock: 100,
      concurrency: 1,
      sparse: true,
    });
    await scanner.indexRange(100, 110);
    expect(asked).toEqual([[FACTORY], [NEW]]);
  });
});

describe("Scanner.run", () => {
  it("waits out a throttled head lookup instead of crashing", async () => {
    let headCalls = 0;
    const data = {
      lastFinalHeight: () =>
        ++headCalls === 1 ? Promise.reject(new RateLimited(1)) : Promise.resolve(160),
      block: () => Promise.reject(new Error("no candidates expected")),
    } as unknown as NearData;
    const store = new Store(await openDb(":memory:"));
    const client = { getMemes: () => Promise.resolve([]) } as never;
    const ref: { scanner?: Scanner } = {};
    const txApi = {
      blocks: () => {
        ref.scanner!.stop();
        return Promise.resolve([]);
      },
    } as unknown as TxApi;
    const scanner = new Scanner(data, store, client, txApi, FACTORY, {
      startBlock: 100,
      concurrency: 1,
      sparse: true,
    });
    ref.scanner = scanner;
    await scanner.run();
    expect(headCalls).toBe(2);
    expect(await store.getCursor()).toBe(130); // head 160 minus the 30-block lag
  });
});
