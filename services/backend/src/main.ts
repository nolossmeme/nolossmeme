import { serve } from "@hono/node-server";
import { NoLossMemeClient } from "@nolossmeme/sdk";
import type { Hono } from "hono";

import { createApp } from "./api/app.js";
import { createFaucet } from "./api/faucet.js";
import { loadConfig, type Config } from "./config.js";
import { openDb, type Db } from "./db/client.js";
import { Store } from "./db/store.js";
import { NearData } from "./indexer/neardata.js";
import { Scanner } from "./indexer/scanner.js";
import { TxApi } from "./indexer/txapi.js";
import { startKeeperJob } from "./jobs/keeper.js";
import { startSnapshotJob } from "./jobs/snapshots.js";
import { startSponsorJob } from "./jobs/sponsor.js";
import { log, setLogLevel } from "./log.js";

type Stop = () => void;
const noop: Stop = () => undefined;
const yocto = (near: number): bigint => BigInt(Math.round(near * 1_000_000)) * 10n ** 18n;

function parseRoles(role: string): Set<string> {
  return new Set(
    role === "all" ? ["api", "scanner", "jobs"] : role.split(",").map((r) => r.trim()),
  );
}

/** Background jobs; each one is optional and returns its own stop function. */
function startJobs(
  cfg: Config,
  store: Store,
  jobsClient: NoLossMemeClient,
  head: () => number | null,
): Stop[] {
  const stops: Stop[] = [startSnapshotJob(store, jobsClient, cfg.SNAPSHOT_INTERVAL_MS, head)];
  if (cfg.KEEPER_ACCOUNT_ID && cfg.KEEPER_PRIVATE_KEY) {
    stops.push(
      startKeeperJob(
        store,
        jobsClient,
        cfg.jobsRpcUrl,
        cfg.KEEPER_ACCOUNT_ID,
        cfg.KEEPER_PRIVATE_KEY,
        cfg.KEEPER_INTERVAL_MS,
      ),
    );
  }
  // The yield subsidy only makes sense where staking pays nothing.
  if (cfg.NEAR_NETWORK === "testnet" && cfg.SPONSOR_ACCOUNT_ID && cfg.SPONSOR_PRIVATE_KEY) {
    stops.push(
      startSponsorJob(store, jobsClient, {
        rpcUrl: cfg.jobsRpcUrl,
        accountId: cfg.SPONSOR_ACCOUNT_ID,
        privateKey: cfg.SPONSOR_PRIVATE_KEY,
        amountYocto: yocto(cfg.SPONSOR_AMOUNT_NEAR),
        intervalMs: cfg.SPONSOR_INTERVAL_HOURS * 3_600_000,
      }),
    );
  }
  return stops;
}

async function maybeFaucet(cfg: Config, db: Db): Promise<Hono | undefined> {
  if (!cfg.FAUCET_ACCOUNT_ID || !cfg.FAUCET_PRIVATE_KEY || !cfg.TURNSTILE_SECRET_KEY)
    return undefined;
  return buildFaucet(
    db,
    cfg.jobsRpcUrl,
    cfg.FAUCET_ACCOUNT_ID,
    cfg.FAUCET_PRIVATE_KEY,
    cfg.TURNSTILE_SECRET_KEY,
    cfg.FAUCET_AMOUNT_NEAR,
    cfg.FAUCET_COOLDOWN_HOURS,
  );
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  setLogLevel(cfg.LOG_LEVEL);
  const db = await openDb(cfg.DATABASE_URL, cfg.DATABASE_AUTH_TOKEN);
  const store = new Store(db);
  const client = new NoLossMemeClient(cfg.network);
  // Jobs read and write over their own endpoint; see JOBS_RPC_URL.
  const jobsClient = new NoLossMemeClient({ ...cfg.network, rpcUrl: cfg.jobsRpcUrl });
  const data = new NearData(cfg.neardataUrl, { rps: cfg.NEARDATA_RPS, rpcUrl: cfg.rpcUrl });
  const roles = parseRoles(cfg.ROLE);

  let head: number | null = null;
  const trackHead = (): void => {
    data
      .lastFinalHeight()
      .then((h) => (head = h))
      .catch(() => undefined);
  };
  const headTracker = setInterval(trackHead, 10_000);

  const scanner = new Scanner(data, store, client, new TxApi(cfg.txApiUrl), cfg.network.factory, {
    startBlock: cfg.START_BLOCK,
    concurrency: cfg.SCAN_CONCURRENCY,
    sparse: cfg.SPARSE_SCAN,
  });
  const stops = roles.has("jobs") ? startJobs(cfg, store, jobsClient, () => head) : [noop];

  const faucet = await maybeFaucet(cfg, db);
  const app = createApp({
    store,
    corsOrigin: cfg.CORS_ORIGIN,
    head: () => head,
    startedAt: Date.now(),
    ...(faucet ? { faucet } : {}),
  });
  const server = roles.has("api")
    ? serve({ fetch: app.fetch, port: cfg.PORT }, (info) =>
        log.info("api listening", {
          port: info.port,
          network: cfg.NEAR_NETWORK,
          factory: cfg.network.factory,
          roles: [...roles],
        }),
      )
    : null;

  const shutdown = (): void => {
    log.info("shutting down");
    scanner.stop();
    for (const stop of stops) stop();
    clearInterval(headTracker);
    server?.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (roles.has("scanner")) await scanner.run();
  else log.info("scanner disabled in this role", { roles: [...roles] });
}

async function buildFaucet(
  db: Db,
  rpcUrl: string,
  accountId: string,
  privateKey: string,
  turnstileSecret: string,
  amountNear: number,
  cooldownHours: number,
) {
  const { Account, JsonRpcProvider } = await import("near-api-js");
  type KeyPairString = ConstructorParameters<typeof Account>[2];
  const provider = new JsonRpcProvider({ url: rpcUrl });
  const sender = new Account(accountId, provider, privateKey as KeyPairString);
  const amountYocto = BigInt(Math.round(amountNear * 1_000_000)) * 10n ** 18n;
  log.info("faucet enabled", { accountId, amountNear, cooldownHours });
  return createFaucet({
    db,
    amountYocto,
    cooldownMs: cooldownHours * 3_600_000,
    turnstileSecret,
    send: async (to, amount) => {
      const outcome = await sender.transfer({ receiverId: to, amount });
      return outcome.transaction.hash;
    },
    accountExists: async (id) => {
      try {
        await provider.viewAccount({ accountId: id });
        return true;
      } catch {
        return false;
      }
    },
  });
}

main().catch((e: unknown) => {
  log.error("fatal", { error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  process.exit(1);
});
