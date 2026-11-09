import { serve } from "@hono/node-server";
import { NoLossMemeClient } from "@nolossmeme/sdk";

import { createApp } from "./api/app.js";
import { createFaucet } from "./api/faucet.js";
import { loadConfig } from "./config.js";
import { openDb, type Db } from "./db/client.js";
import { Store } from "./db/store.js";
import { NearData } from "./indexer/neardata.js";
import { Rpc } from "./indexer/rpc.js";
import { Scanner } from "./indexer/scanner.js";
import { startKeeperJob } from "./jobs/keeper.js";
import { startSnapshotJob } from "./jobs/snapshots.js";
import { startSponsorJob } from "./jobs/sponsor.js";
import { log, setLogLevel } from "./log.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  setLogLevel(cfg.LOG_LEVEL);
  const db = await openDb(cfg.DATABASE_URL, cfg.DATABASE_AUTH_TOKEN);
  const store = new Store(db);
  const client = new NoLossMemeClient(cfg.network);
  // Jobs read and write over their own endpoint; see JOBS_RPC_URL.
  const jobsClient = new NoLossMemeClient({ ...cfg.network, rpcUrl: cfg.jobsRpcUrl });
  const data = new NearData(cfg.neardataUrl, { rps: cfg.NEARDATA_RPS });

  const roles = new Set(
    cfg.ROLE === "all" ? ["api", "scanner", "jobs"] : cfg.ROLE.split(",").map((r) => r.trim()),
  );
  let head: number | null = null;
  const headTracker = setInterval(
    () =>
      void data
        .lastFinalHeight()
        .then((h) => (head = h))
        .catch(() => undefined),
    10_000,
  );
  const scanner = new Scanner(
    data,
    store,
    client,
    new Rpc(cfg.rpcUrls, { rps: cfg.RPC_RPS }),
    cfg.network.factory,
    {
      startBlock: cfg.START_BLOCK,
      concurrency: cfg.SCAN_CONCURRENCY,
      sparse: cfg.SPARSE_SCAN,
      rpcConcurrency: cfg.RPC_CONCURRENCY,
    },
  );

  const stopSnapshots = roles.has("jobs")
    ? startSnapshotJob(store, jobsClient, cfg.SNAPSHOT_INTERVAL_MS, () => head)
    : () => undefined;
  const stopKeeper =
    roles.has("jobs") && cfg.KEEPER_ACCOUNT_ID && cfg.KEEPER_PRIVATE_KEY
      ? startKeeperJob(
          store,
          jobsClient,
          cfg.jobsRpcUrl,
          cfg.KEEPER_ACCOUNT_ID,
          cfg.KEEPER_PRIVATE_KEY,
          cfg.KEEPER_INTERVAL_MS,
        )
      : () => undefined;
  const stopSponsor =
    roles.has("jobs") &&
    cfg.NEAR_NETWORK === "testnet" &&
    cfg.SPONSOR_ACCOUNT_ID &&
    cfg.SPONSOR_PRIVATE_KEY
      ? startSponsorJob(store, jobsClient, {
          rpcUrl: cfg.jobsRpcUrl,
          accountId: cfg.SPONSOR_ACCOUNT_ID,
          privateKey: cfg.SPONSOR_PRIVATE_KEY,
          amountYocto: BigInt(Math.round(cfg.SPONSOR_AMOUNT_NEAR * 1_000_000)) * 10n ** 18n,
          intervalMs: cfg.SPONSOR_INTERVAL_HOURS * 3_600_000,
        })
      : () => undefined;

  const faucet =
    cfg.FAUCET_ACCOUNT_ID && cfg.FAUCET_PRIVATE_KEY && cfg.TURNSTILE_SECRET_KEY
      ? await buildFaucet(
          db,
          cfg.jobsRpcUrl,
          cfg.FAUCET_ACCOUNT_ID,
          cfg.FAUCET_PRIVATE_KEY,
          cfg.TURNSTILE_SECRET_KEY,
          cfg.FAUCET_AMOUNT_NEAR,
          cfg.FAUCET_COOLDOWN_HOURS,
        )
      : undefined;
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

  const shutdown = () => {
    log.info("shutting down");
    scanner.stop();
    stopSnapshots();
    stopKeeper();
    stopSponsor();
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
