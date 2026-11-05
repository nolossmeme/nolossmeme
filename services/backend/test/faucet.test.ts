import type { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createFaucet } from "../src/api/faucet.js";
import { openDb } from "../src/db/client.js";

async function faucet(turnstileOk = true) {
  const db = await openDb(":memory:");
  const sent: [string, bigint][] = [];
  let clock = 1_000_000;
  const app = createFaucet({
    db,
    amountYocto: 10n ** 24n,
    cooldownMs: 3_600_000,
    turnstileSecret: "s",
    send: (to, amount) => {
      sent.push([to, amount]);
      return Promise.resolve("TXHASH");
    },
    accountExists: (id) => Promise.resolve(id !== "ghost.testnet"),
    fetchImpl: () =>
      Promise.resolve(new Response(JSON.stringify({ success: turnstileOk }), { status: 200 })),
    now: () => clock,
  });
  return { app, sent, tick: (ms: number) => (clock += ms) };
}

const post = (app: Hono, body: unknown, ip = "1.2.3.4") =>
  app.request("/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("faucet", () => {
  it("grants once per account per cooldown and records the claim", async () => {
    const { app, sent, tick } = await faucet();
    const r1 = await post(app, { account_id: "alice.testnet", token: "0.valid-token" });
    expect(r1.status).toBe(200);
    expect(sent).toEqual([["alice.testnet", 10n ** 24n]]);
    const r2 = await post(app, { account_id: "alice.testnet", token: "0.valid-token" });
    expect(r2.status).toBe(429);
    // same ip, other account: still blocked
    expect((await post(app, { account_id: "bob.testnet", token: "0.valid-token" })).status).toBe(
      429,
    );
    // other ip, other account: fine
    expect(
      (await post(app, { account_id: "bob.testnet", token: "0.valid-token" }, "5.6.7.8")).status,
    ).toBe(200);
    tick(3_600_001);
    expect((await post(app, { account_id: "alice.testnet", token: "0.valid-token" })).status).toBe(
      200,
    );
  });

  it("rejects bad input, failed turnstile and unknown accounts", async () => {
    const { app, sent } = await faucet();
    expect((await post(app, { account_id: "Not Valid!", token: "0.valid-token" })).status).toBe(
      400,
    );
    expect((await post(app, { account_id: "ghost.testnet", token: "0.valid-token" })).status).toBe(
      404,
    );
    const bad = await faucet(false);
    expect(
      (await post(bad.app, { account_id: "alice.testnet", token: "0.valid-token" })).status,
    ).toBe(403);
    expect(sent).toEqual([]);
    expect(await (await app.request("/")).json()).toMatchObject({
      amount: "1000000000000000000000000",
    });
  });
});
