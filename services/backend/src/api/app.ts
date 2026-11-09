/** REST API over the store. All numbers that are yocto amounts stay strings. */
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Store } from "../db/store.js";
import type { IndexedEvent } from "../indexer/events.js";

export interface ApiDeps {
  store: Store;
  /** Optional sub-app mounted at /faucet. */
  faucet?: Hono;
  corsOrigin: string;
  head: () => number | null;
  startedAt: number;
}

const KINDS = new Set<IndexedEvent["kind"]>([
  "launch",
  "deposit",
  "deposit_refunded",
  "withdraw",
  "withdraw_near",
  "check_in",
  "draw",
  "draw_aborted",
  "redeem",
  "fund",
  "ft_mint",
  "ft_burn",
  "ft_transfer",
]);

function int(v: string | undefined, fallback: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}

export function createApp({ store, corsOrigin, head, startedAt, faucet }: ApiDeps): Hono {
  const app = new Hono();
  const origins = corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use("*", cors({ origin: origins.length === 1 ? origins[0]! : origins }));

  app.get("/", (c) =>
    c.json({
      name: "nolossmeme-backend",
      docs: [
        "/health",
        "/stats",
        "/pools",
        "/pools/:id/activity",
        "/pools/:id/series",
        "/pools/:id/draws",
        "/accounts/:id/activity",
        "/activity",
      ],
    }),
  );

  app.get("/health", async (c) => {
    const cursor = await store.getCursor();
    const h = head();
    return c.json({
      ok: true,
      cursor,
      head: h,
      behind: h !== null && cursor !== null ? h - cursor : null,
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  app.get("/stats", async (c) => {
    const [pools, latest, counts, cursor] = await Promise.all([
      store.listPools(),
      store.latestSnapshots(),
      store.countEvents(),
      store.getCursor(),
    ]);
    const sum = (k: "total_principal" | "treasury_near") =>
      latest.reduce((a, s) => a + BigInt(s[k]), 0n).toString();
    return c.json({
      pools: pools.length,
      total_principal: sum("total_principal"),
      treasury_near: sum("treasury_near"),
      depositors: latest.reduce((a, s) => a + s.depositors, 0),
      draws: latest.reduce((a, s) => a + s.draws, 0),
      events: counts,
      cursor,
    });
  });

  app.get("/pools", async (c) => {
    const [pools, latest] = await Promise.all([store.listPools(), store.latestSnapshots()]);
    const byPool = new Map(latest.map((s) => [s.pool, s]));
    return c.json(pools.map((p) => ({ ...p, snapshot: byPool.get(p.account_id) ?? null })));
  });

  app.get("/pools/:id/activity", async (c) => {
    const kind = c.req.query("kind");
    if (kind && !KINDS.has(kind as IndexedEvent["kind"]))
      return c.json({ error: "unknown kind" }, 400);
    const events = await store.listEvents({
      contract: c.req.param("id"),
      limit: int(c.req.query("limit"), 50, 500),
      before: int(c.req.query("before"), 0, Number.MAX_SAFE_INTEGER) || 0,
      ...(kind ? { kind } : {}),
    });
    return c.json(events);
  });

  app.get("/pools/:id/draws", async (c) =>
    c.json(
      await store.listEvents({
        contract: c.req.param("id"),
        kind: "draw",
        limit: int(c.req.query("limit"), 100, 500),
      }),
    ),
  );

  app.get("/pools/:id/series", async (c) => {
    const hours = int(c.req.query("hours"), 24 * 7, 24 * 365);
    return c.json(await store.listSnapshots(c.req.param("id"), Date.now() - hours * 3_600_000));
  });

  app.get("/accounts/:id/activity", async (c) =>
    c.json(
      await store.listEvents({
        account: c.req.param("id"),
        limit: int(c.req.query("limit"), 50, 500),
      }),
    ),
  );

  app.get("/activity", async (c) => {
    const kind = c.req.query("kind");
    if (kind && !KINDS.has(kind as IndexedEvent["kind"]))
      return c.json({ error: "unknown kind" }, 400);
    return c.json(
      await store.listEvents({
        limit: int(c.req.query("limit"), 50, 500),
        ...(kind ? { kind } : {}),
      }),
    );
  });

  if (faucet) app.route("/faucet", faucet);

  return app;
}
