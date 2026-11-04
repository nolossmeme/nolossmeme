import { describe, expect, it } from "vitest";

import { openDb } from "../src/db/client.js";
import { Store } from "../src/db/store.js";
import type { IndexedEvent } from "../src/indexer/events.js";

const ev = (
  id: string,
  height: number,
  kind: IndexedEvent["kind"],
  account: string | null,
  contract = "dogn.factory.nolossmeme.testnet",
): IndexedEvent => ({
  id,
  blockHeight: height,
  blockTimestamp: height * 1000,
  txHash: null,
  receiptId: id.split(":")[0]!,
  contract,
  kind,
  account,
  amount: "1",
  data: { n: height },
});

async function store() {
  return new Store(await openDb(":memory:"));
}

describe("Store", () => {
  it("keeps a cursor", async () => {
    const s = await store();
    expect(await s.getCursor()).toBeNull();
    await s.setCursor(10);
    await s.setCursor(11);
    expect(await s.getCursor()).toBe(11);
  });

  it("inserts events idempotently and filters them", async () => {
    const s = await store();
    const batch = [
      ev("r1:0", 5, "deposit", "alice"),
      ev("r2:0", 6, "check_in", "alice"),
      ev("r3:0", 7, "deposit", "bob", "pepn.factory.nolossmeme.testnet"),
    ];
    expect(await s.insertEvents(batch)).toBe(3);
    expect(await s.insertEvents(batch)).toBe(0);
    expect((await s.listEvents({ account: "alice" })).map((e) => e.id)).toEqual(["r2:0", "r1:0"]);
    expect(
      (await s.listEvents({ contract: "pepn.factory.nolossmeme.testnet" })).map((e) => e.id),
    ).toEqual(["r3:0"]);
    expect((await s.listEvents({ kind: "deposit", before: 7 })).map((e) => e.id)).toEqual(["r1:0"]);
    expect(await s.countEvents()).toEqual({ deposit: 2, check_in: 1 });
    expect((await s.listEvents({}))[0]!.data).toEqual({ n: 7 });
  });

  it("stores pools and snapshots", async () => {
    const s = await store();
    const meme = {
      slug: "dogn",
      account_id: "dogn.factory.nolossmeme.testnet",
      creator: "a",
      name: "Doge",
      symbol: "DOGN",
      icon: null,
      created_at: "1793800000000000000",
      params: {
        epoch_length_ns: "1",
        initial_emission: "1",
        halving_every: 1,
        jackpot_bps: 1,
        streak_step_bps: 1,
        max_streak_bonus_bps: 1,
        min_deposit: "1",
      },
    };
    await s.upsertPool(meme);
    await s.upsertPool({ ...meme, name: "Doge of NEAR" });
    const pools = await s.listPools();
    expect(pools).toHaveLength(1);
    expect(pools[0]!.name).toBe("Doge of NEAR");
    expect(pools[0]!.created_at).toBe("1793800000000000000");

    const state = {
      total_principal: "2",
      treasury_near: "0",
      total_supply: "0",
      floor_price: "0",
      st_near_price: "1",
      depositors: 2,
      draws: 0,
      epoch_index: 0,
    };
    await s.insertSnapshot(meme.account_id, state as never, 100);
    const rows = await s.listSnapshots(meme.account_id, 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total_principal: "2", depositors: 2, block_height: 100 });
    expect((await s.latestSnapshots())[0]!.pool).toBe(meme.account_id);
  });
});
