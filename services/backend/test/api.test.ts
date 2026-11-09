import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/app.js";
import { openDb } from "../src/db/client.js";
import { Store } from "../src/db/store.js";

describe("API", () => {
  it("serves health, stats and activity", async () => {
    const store = new Store(await openDb(":memory:"));
    await store.setCursor(42);
    await store.insertEvents([
      {
        id: "r:0",
        blockHeight: 42,
        blockTimestamp: 1,
        txHash: null,
        receiptId: "r",
        contract: "p",
        kind: "deposit",
        account: "alice",
        amount: "5",
        data: {},
      },
    ]);
    const app = createApp({ store, corsOrigin: "*", head: () => 50, startedAt: Date.now() });

    const health: unknown = await (await app.request("/health")).json();
    expect(health).toMatchObject({ ok: true, cursor: 42, head: 50, behind: 8 });

    const stats: unknown = await (await app.request("/stats")).json();
    expect(stats).toMatchObject({ pools: 0, events: { deposit: 1 }, cursor: 42 });

    const activity = (await (await app.request("/pools/p/activity?limit=10")).json()) as unknown[];
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ kind: "deposit", amount: "5" });

    expect((await app.request("/activity?kind=nope")).status).toBe(400);
    const cors = await app.request("/pools", {
      headers: { Origin: "https://nolossmeme.github.io" },
    });
    expect(cors.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("allows a list of origins", async () => {
    const store = new Store(await openDb(":memory:"));
    const app = createApp({
      store,
      corsOrigin: "https://app.nolossmeme.fun, https://nolossmeme.fun",
      head: () => null,
      startedAt: Date.now(),
    });
    const ok = await app.request("/health", { headers: { Origin: "https://app.nolossmeme.fun" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.nolossmeme.fun");
    const no = await app.request("/health", { headers: { Origin: "https://evil.example" } });
    expect(no.headers.get("access-control-allow-origin")).toBeNull();
  });
});
