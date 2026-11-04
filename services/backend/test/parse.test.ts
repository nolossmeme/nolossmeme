import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { LakeBlock } from "../src/indexer/neardata.js";
import { launchedPools, parseBlock } from "../src/indexer/parse.js";

const blocks = JSON.parse(
  readFileSync(new URL("./fixtures/deposit-blocks.json", import.meta.url), "utf8"),
) as LakeBlock[];
const watch = {
  factory: "factory.nolossmeme.testnet",
  pools: new Set(["pepn.factory.nolossmeme.testnet", "dogn.factory.nolossmeme.testnet"]),
};

describe("parseBlock on recorded testnet blocks", () => {
  it("ignores the deposit intent receipt and records the callback as a deposit", () => {
    const first = parseBlock(blocks[0]!, watch);
    expect(first).toEqual([]); // `deposit` itself only forwards to Meta Pool; nothing to record yet
    const second = parseBlock(blocks[1]!, watch);
    const deposit = second.find((e) => e.kind === "deposit");
    expect(deposit).toMatchObject({
      contract: "pepn.factory.nolossmeme.testnet",
      account: "nolossmeme.testnet",
      amount: "1005000000000000000000000",
      blockHeight: 276215532,
    });
    expect(deposit!.data["shares"]).toMatch(/^\d+$/);
    expect(deposit!.id).toMatch(/^[A-Za-z0-9]+:0$/);
    expect(deposit!.blockTimestamp).toBeGreaterThan(1_700_000_000_000);
  });

  it("only watches configured accounts", () => {
    const none = parseBlock(blocks[1]!, { factory: "x.testnet", pools: new Set() });
    expect(none).toEqual([]);
  });
});

function receipt(
  receiver: string,
  method: string,
  logs: string[],
  ret?: unknown,
  predecessor = "alice.testnet",
  id = "r1",
): LakeBlock["shards"][number]["receipt_execution_outcomes"][number] {
  return {
    receipt: {
      receipt_id: id,
      predecessor_id: predecessor,
      receiver_id: receiver,
      receipt: {
        Action: {
          signer_id: predecessor,
          actions: [{ FunctionCall: { method_name: method, args: "e30=", deposit: "0", gas: 1 } }],
        },
      },
    },
    execution_outcome: {
      id,
      outcome: {
        executor_id: receiver,
        logs,
        status:
          ret === undefined
            ? { SuccessReceiptId: "x" }
            : { SuccessValue: Buffer.from(JSON.stringify(ret)).toString("base64") },
        receipt_ids: [],
      },
    },
  };
}
const synthetic = (receipts: ReturnType<typeof receipt>[]): LakeBlock => ({
  block: { header: { height: 1, timestamp: 1_700_000_000_000_000_000, hash: "h" } },
  shards: [{ shard_id: 0, chunk: { transactions: [] }, receipt_execution_outcomes: receipts }],
});
const pool = "dogn.factory.nolossmeme.testnet";

describe("parseBlock on synthetic receipts", () => {
  it("decodes draws from the callback return value", () => {
    const draw = {
      epoch: 3,
      winner: "bob.testnet",
      jackpot: "700000000000000000000",
      checkins: 2,
      minted: "1000000000000000000000",
    };
    const [e] = parseBlock(
      synthetic([receipt(pool, "on_draw_price", ["draw #3 ..."], draw, pool)]),
      watch,
    );
    expect(e).toMatchObject({
      kind: "draw",
      account: "bob.testnet",
      amount: "700000000000000000000",
      data: draw,
    });
  });

  it("records an aborted draw and never a failed receipt", () => {
    const aborted = receipt(
      pool,
      "on_draw_price",
      ["price lookup failed, draw aborted; call draw again"],
      null,
      pool,
    );
    expect(parseBlock(synthetic([aborted]), watch).map((e) => e.kind)).toEqual(["draw_aborted"]);
    const failed = {
      ...receipt(pool, "check_in", [], 1),
      execution_outcome: {
        id: "f",
        outcome: { executor_id: pool, logs: [], status: { Failure: {} }, receipt_ids: [] },
      },
    } as unknown as ReturnType<typeof receipt>;
    expect(parseBlock(synthetic([failed]), watch)).toEqual([]);
  });

  it("captures check-ins, vault movements, token events and launches", () => {
    const events = parseBlock(
      synthetic([
        receipt(pool, "check_in", [], 4, "alice.testnet", "a"),
        receipt(
          pool,
          "on_withdraw_done",
          [
            "withdraw 1000000000000000000000000 yoctoNEAR as 312000000000000000000000 stNEAR to alice.testnet",
          ],
          "312000000000000000000000",
          pool,
          "b",
        ),
        receipt(
          pool,
          "on_near_pulled",
          [
            "withdraw_near 996000000000000000000000 yoctoNEAR (fee 3000000000000000000000) to alice.testnet",
          ],
          "996000000000000000000000",
          pool,
          "c",
        ),
        receipt(
          pool,
          "on_redeem_done",
          ["redeem 150000000000000000000 MEME -> 1000000 stNEAR to alice.testnet"],
          "1000000",
          pool,
          "d",
        ),
        receipt(
          pool,
          "on_deposit",
          ["staking failed, refunding 500000000000000000000000 to alice.testnet"],
          "0",
          pool,
          "e",
        ),
        receipt(
          pool,
          "on_draw_price",
          [
            'EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_mint","data":[{"owner_id":"bob.testnet","amount":"7","memo":"jackpot"}]}',
          ],
          null,
          pool,
          "f",
        ),
        receipt(
          "factory.nolossmeme.testnet",
          "on_meme_created",
          ["launched WJK at wojak.factory.nolossmeme.testnet by carol.testnet"],
          { slug: "wojak", account_id: "wojak.factory.nolossmeme.testnet" },
          "factory.nolossmeme.testnet",
          "g",
        ),
      ]),
      watch,
    );
    expect(events.map((e) => [e.kind, e.account, e.amount])).toEqual([
      ["check_in", "alice.testnet", null],
      ["withdraw", "alice.testnet", "1000000000000000000000000"],
      ["withdraw_near", "alice.testnet", "996000000000000000000000"],
      ["redeem", "alice.testnet", "150000000000000000000"],
      ["deposit_refunded", "alice.testnet", "500000000000000000000000"],
      ["ft_mint", "bob.testnet", "7"],
      ["launch", "carol.testnet", null],
    ]);
    expect(events[0]!.data).toEqual({ streak: 4 });
    expect(events[2]!.data).toEqual({ fee: "3000000000000000000000" });
    expect(launchedPools(events)).toEqual(["wojak.factory.nolossmeme.testnet"]);
  });
});

describe("RateLimiter", async () => {
  const { RateLimiter } = await import("../src/indexer/neardata.js");
  it("spaces requests to the configured rate", async () => {
    const limiter = new RateLimiter(10);
    const t0 = Date.now();
    for (let i = 0; i < 15; i++) await limiter.take();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(400); // 10 instant, 5 more at 10/s
  });
});

describe("Rpc.touchedAccounts", async () => {
  const { Rpc, UnknownBlock } = await import("../src/indexer/rpc.js");
  const fake =
    (body: unknown): typeof fetch =>
    () =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it("returns the set of touched accounts", async () => {
    const rpc = new Rpc("http://rpc", {
      fetchImpl: fake({
        result: {
          changes: [
            { type: "account_touched", account_id: "a" },
            { type: "data_touched", account_id: "a" },
            { type: "account_touched", account_id: "b" },
          ],
        },
      }),
    });
    expect([...(await rpc.touchedAccounts(1))].sort()).toEqual(["a", "b"]);
  });
  it("maps unknown blocks to UnknownBlock", async () => {
    const rpc = new Rpc("http://rpc", {
      fetchImpl: fake({ error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_BLOCK" } } }),
    });
    await expect(rpc.touchedAccounts(5)).rejects.toBeInstanceOf(UnknownBlock);
  });
});

describe("parseBlock with nolossmeme events (contracts after #43)", () => {
  const ev = (event: string, data: Record<string, unknown>) =>
    `EVENT_JSON:${JSON.stringify({ standard: "nolossmeme", version: "1.0.0", event, data: [data] })}`;
  it("prefers structured events and does not double count with return values", () => {
    const draw = { epoch: 4, winner: "bob.testnet", jackpot: "700", checkins: 1, minted: "1000" };
    const events = parseBlock(
      synthetic([
        receipt(
          pool,
          "on_deposit",
          [ev("deposit", { account_id: "alice.testnet", amount: "1000", shares: "300" })],
          "1000",
          pool,
          "a",
        ),
        receipt(
          pool,
          "check_in",
          [ev("check_in", { account_id: "alice.testnet", streak: 3, epoch: 4 })],
          3,
          "alice.testnet",
          "b",
        ),
        receipt(pool, "on_draw_price", [ev("draw", draw)], draw, pool, "c"),
        receipt(
          pool,
          "on_near_pulled",
          [ev("withdraw_near", { account_id: "alice.testnet", amount: "990", fee: "10" })],
          "990",
          pool,
          "d",
        ),
        receipt(
          "factory.nolossmeme.testnet",
          "on_meme_created",
          [
            ev("launch", {
              slug: "wojak",
              account_id: "wojak.factory.nolossmeme.testnet",
              creator: "carol.testnet",
              symbol: "WJK",
              name: "Wojak",
            }),
          ],
          {},
          "factory.nolossmeme.testnet",
          "e",
        ),
      ]),
      watch,
    );
    expect(events.map((e) => [e.kind, e.account, e.amount])).toEqual([
      ["deposit", "alice.testnet", "1000"],
      ["check_in", "alice.testnet", null],
      ["draw", "bob.testnet", "700"],
      ["withdraw_near", "alice.testnet", "990"],
      ["launch", "carol.testnet", null],
    ]);
    expect(events[0]!.data).toEqual({ shares: "300", fee: null });
    expect(events[1]!.data).toEqual({ streak: 3, epoch: 4 });
    expect(events[3]!.data).toEqual({ shares: null, fee: "10" });
    expect(launchedPools(events)).toEqual(["wojak.factory.nolossmeme.testnet"]);
  });
});

describe("Rpc rotation", async () => {
  const { Rpc } = await import("../src/indexer/rpc.js");
  it("round-robins across endpoints", async () => {
    const hits: string[] = [];
    const fetchImpl: typeof fetch = (input) => {
      hits.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return Promise.resolve(
        new Response(JSON.stringify({ result: { changes: [] } }), { status: 200 }),
      );
    };
    const rpc = new Rpc(["http://a", "http://b", "http://c"], { rps: 100, fetchImpl });
    for (let h = 1; h <= 6; h++) await rpc.touchedAccounts(h);
    expect(hits).toEqual(["http://a", "http://b", "http://c", "http://a", "http://b", "http://c"]);
    expect(rpc.size).toBe(3);
  });
});
