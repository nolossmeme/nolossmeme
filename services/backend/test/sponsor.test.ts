import { describe, expect, it } from "vitest";

import { openDb } from "../src/db/client.js";
import { Store } from "../src/db/store.js";
import { isDue } from "../src/jobs/sponsor.js";

const POOL = "dogn.fun.nolossmeme.testnet";
const SPONSOR = "sponsor.nolossmeme.testnet";
const HOUR = 3_600_000;

describe("isDue", () => {
  it("waits a full interval after the last funding, across restarts", async () => {
    const store = new Store(await openDb(":memory:"));
    const none = new Map<string, number>();
    expect(await isDue(store, POOL, SPONSOR, 12 * HOUR, 100 * HOUR, none)).toBe(true);

    await store.insertEvents([
      {
        id: "r1:0",
        blockHeight: 1,
        blockTimestamp: 95 * HOUR,
        txHash: null,
        receiptId: "r1",
        contract: POOL,
        kind: "fund",
        account: SPONSOR,
        amount: "1",
        data: {},
      },
    ]);
    expect(await isDue(store, POOL, SPONSOR, 12 * HOUR, 100 * HOUR, none)).toBe(false);
    expect(await isDue(store, POOL, SPONSOR, 12 * HOUR, 107 * HOUR, none)).toBe(true);
    // A call the indexer has not seen yet still counts.
    const sent = new Map([[POOL, 106 * HOUR]]);
    expect(await isDue(store, POOL, SPONSOR, 12 * HOUR, 107 * HOUR, sent)).toBe(false);
  });
});
