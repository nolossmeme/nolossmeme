/**
 * Testnet faucet: one small NEAR grant per account per day, gated by Cloudflare Turnstile so a
 * script cannot drain it. Only mounted when `FAUCET_ACCOUNT_ID`, `FAUCET_PRIVATE_KEY` and
 * `TURNSTILE_SECRET_KEY` are configured.
 */
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { Db } from "../db/client.js";
import { log } from "../log.js";

export interface FaucetDeps {
  db: Db;
  amountYocto: bigint;
  cooldownMs: number;
  turnstileSecret: string;
  /** When set, tokens solved on any other hostname are refused. */
  turnstileHostname?: string;
  /** Sends `amount` yocto to `accountId`; returns the transaction hash. */
  send: (accountId: string, amount: bigint) => Promise<string>;
  /** Looks the account up on chain. */
  accountExists: (accountId: string) => Promise<boolean>;
  /** Grants allowed across all accounts per rolling 24 h (a paid captcha farm cannot drain it). */
  dailyCap?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const DAY_MS = 86_400_000;

const Body = z.object({
  account_id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/, "invalid account id"),
  token: z.string().min(10).max(4096),
});

export const FAUCET_SCHEMA = `CREATE TABLE IF NOT EXISTS faucet_claims (
  account_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  tx_hash TEXT NOT NULL
)`;

export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | undefined,
  fetchImpl: typeof fetch = fetch,
  hostname?: string,
): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { success?: boolean; hostname?: string };
  return body.success === true && (!hostname || body.hostname === hostname);
}

export function createFaucet(deps: FaucetDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? Date.now;
  // Accounts and IPs with a claim being processed. The DB check alone is racy: N parallel
  // requests would all pass it before the first one records its claim.
  const busy = new Set<string>();

  app.get("/", (c) =>
    c.json({ amount: deps.amountYocto.toString(), cooldown_ms: deps.cooldownMs }),
  );

  app.post("/", async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: "account_id and token are required" }, 400);
    const { account_id, token } = parsed.data;
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    if (
      !(await verifyTurnstile(
        deps.turnstileSecret,
        token,
        ip === "unknown" ? undefined : ip,
        deps.fetchImpl,
        deps.turnstileHostname,
      ))
    ) {
      return c.json({ error: "turnstile verification failed" }, 403);
    }
    const keys = [`a:${account_id}`, `i:${ip}`];
    if (keys.some((k) => busy.has(k)))
      return c.json({ error: "a claim is already being processed" }, 429);
    keys.forEach((k) => busy.add(k));
    try {
      return await grant(c, account_id, ip);
    } finally {
      keys.forEach((k) => busy.delete(k));
    }
  });

  const grant = async (c: Context, account_id: string, ip: string): Promise<Response> => {
    const since = now() - deps.cooldownMs;
    const recent = await deps.db.execute({
      sql: "SELECT claimed_at FROM faucet_claims WHERE (account_id = ? OR ip = ?) AND claimed_at > ? ORDER BY claimed_at DESC LIMIT 1",
      args: [account_id, ip, since],
    });
    const last = recent.rows[0]?.["claimed_at"];
    if (last !== undefined && last !== null) {
      const retryAt = Number(last) + deps.cooldownMs;
      return c.json({ error: "already claimed recently", retry_at: retryAt }, 429);
    }
    if (deps.dailyCap !== undefined) {
      const day = await deps.db.execute({
        sql: "SELECT COUNT(*) AS n FROM faucet_claims WHERE claimed_at > ?",
        args: [now() - DAY_MS],
      });
      if (Number(day.rows[0]?.["n"] ?? 0) >= deps.dailyCap)
        return c.json({ error: "the faucet hit its daily limit, try again tomorrow" }, 429);
    }
    if (!(await deps.accountExists(account_id)))
      return c.json({ error: "account does not exist on testnet" }, 404);

    // Record the claim before sending: a send that times out after broadcasting must still
    // count. It is removed only when the send fails outright.
    const claimedAt = now();
    await deps.db.execute({
      sql: "INSERT INTO faucet_claims (account_id, ip, claimed_at, tx_hash) VALUES (?, ?, ?, '')",
      args: [account_id, ip, claimedAt],
    });
    let txHash: string;
    try {
      txHash = await deps.send(account_id, deps.amountYocto);
    } catch (e) {
      log.error("faucet send failed", { account_id, error: String(e) });
      if (!/timeout|timed out/i.test(String(e)))
        await deps.db.execute({
          sql: "DELETE FROM faucet_claims WHERE account_id = ? AND claimed_at = ? AND tx_hash = ''",
          args: [account_id, claimedAt],
        });
      return c.json({ error: "transfer failed, try again later" }, 502);
    }
    await deps.db.execute({
      sql: "UPDATE faucet_claims SET tx_hash = ? WHERE account_id = ? AND claimed_at = ?",
      args: [txHash, account_id, claimedAt],
    });
    log.info("faucet grant", { account_id, amount: deps.amountYocto.toString(), txHash });
    return c.json({ ok: true, amount: deps.amountYocto.toString(), tx_hash: txHash });
  };

  return app;
}
