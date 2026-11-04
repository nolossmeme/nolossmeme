import { serve } from "@hono/node-server";
import { NoLossMemeClient } from "@nolossmeme/sdk";

import { createApp } from "./api/app.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db/client.js";
import { Store } from "./db/store.js";
import { NearData } from "./indexer/neardata.js";
import { Rpc } from "./indexer/rpc.js";
import { Scanner } from "./indexer/scanner.js";
import { startKeeperJob } from "./jobs/keeper.js";
import { startSnapshotJob } from "./jobs/snapshots.js";
import { log, setLogLevel } from "./log.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  setLogLevel(cfg.LOG_LEVEL);
  const db = await openDb(cfg.DATABASE_URL, cfg.DATABASE_AUTH_TOKEN);
  const store = new Store(db);
  const client = new NoLossMemeClient(cfg.network);
  const data = new NearData(cfg.neardataUrl, { rps: cfg.NEARDATA_RPS });

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
    new Rpc(cfg.rpcUrl, { rps: cfg.RPC_RPS }),
    cfg.network.factory,
    {
      startBlock: cfg.START_BLOCK,
      concurrency: cfg.SCAN_CONCURRENCY,
      sparse: cfg.SPARSE_SCAN,
      rpcConcurrency: cfg.RPC_CONCURRENCY,
    },
  );

  const stopSnapshots = startSnapshotJob(store, client, cfg.SNAPSHOT_INTERVAL_MS, () => head);
  const stopKeeper =
    cfg.KEEPER_ACCOUNT_ID && cfg.KEEPER_PRIVATE_KEY
      ? startKeeperJob(
          store,
          client,
          cfg.rpcUrl,
          cfg.KEEPER_ACCOUNT_ID,
          cfg.KEEPER_PRIVATE_KEY,
          cfg.KEEPER_INTERVAL_MS,
        )
      : () => undefined;

  const app = createApp({
    store,
    corsOrigin: cfg.CORS_ORIGIN,
    head: () => head,
    startedAt: Date.now(),
  });
  const server = serve({ fetch: app.fetch, port: cfg.PORT }, (info) =>
    log.info("api listening", {
      port: info.port,
      network: cfg.NEAR_NETWORK,
      factory: cfg.network.factory,
    }),
  );

  const shutdown = () => {
    log.info("shutting down");
    scanner.stop();
    stopSnapshots();
    stopKeeper();
    clearInterval(headTracker);
    server.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await scanner.run();
}

main().catch((e: unknown) => {
  log.error("fatal", { error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  process.exit(1);
});
