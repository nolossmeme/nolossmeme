import type { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createFaucet } from "../src/api/faucet.js";
import { openDb } from "../src/db/client.js";

async function faucet(
  turnstileOk = true,
  slowSend = false,
  dailyCap?: number,
  solvedOn = "app.example",
) {
  const db = await openDb(":memory:");
  const sent: [string, bigint][] = [];
  let clock = 1_000_000;
  const app = createFaucet({
    db,
    amountYocto: 10n ** 24n,
    cooldownMs: 3_600_000,
    turnstileSecret: "s",
    turnstileHostname: "app.example",
    send: async (to, amount) => {
      sent.push([to, amount]);
      if (slowSend) await new Promise((r) => setTimeout(r, 20));
      return "TXHASH";
    },
    ...(dailyCap === undefined ? {} : { dailyCap }),
    accountExists: (id) => Promise.resolve(id !== "ghost.testnet"),
    fetchImpl: () =>
      Promise.resolve(
        new Response(JSON.stringify({ success: turnstileOk, hostname: solvedOn }), { status: 200 }),
      ),
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

describe("faucet abuse", () => {
  it("grants once to parallel requests for the same account", async () => {
    const { app, sent } = await faucet(true, true);
    const ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"];
    const res = await Promise.all(
      ips.map(async (ip) => post(app, { account_id: "alice.testnet", token: "0.valid-token" }, ip)),
    );
    expect(res.filter((r) => r.status === 200)).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("stops at the daily cap", async () => {
    const { app } = await faucet(true, false, 2);
    const claim = (who: string, ip: string) =>
      post(app, { account_id: `${who}.testnet`, token: "0.valid-token" }, ip);
    expect((await claim("a", "1.1.1.1")).status).toBe(200);
    expect((await claim("b", "2.2.2.2")).status).toBe(200);
    expect((await claim("c", "3.3.3.3")).status).toBe(429);
  });

  it("refuses a token solved on another hostname", async () => {
    const { app, sent } = await faucet(true, false, undefined, "evil.example");
    const r = await post(app, { account_id: "alice.testnet", token: "0.valid-token" });
    expect(r.status).toBe(403);
    expect(sent).toHaveLength(0);
  });
});
