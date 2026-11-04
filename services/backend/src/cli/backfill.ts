/** One-off: index a block range and exit. `pnpm --filter @nolossmeme/backend backfill <from> <to>` */
import { NoLossMemeClient } from "@nolossmeme/sdk";

import { loadConfig } from "../config.js";
import { openDb } from "../db/client.js";
import { Store } from "../db/store.js";
import { NearData } from "../indexer/neardata.js";
import { Rpc } from "../indexer/rpc.js";
import { Scanner } from "../indexer/scanner.js";
import { log, setLogLevel } from "../log.js";

const [fromArg, toArg] = process.argv.slice(2);
const cfg = loadConfig();
setLogLevel(cfg.LOG_LEVEL);
const db = await openDb(cfg.DATABASE_URL, cfg.DATABASE_AUTH_TOKEN);
const store = new Store(db);
const data = new NearData(cfg.neardataUrl, { rps: cfg.NEARDATA_RPS });
const scanner = new Scanner(
  data,
  store,
  new NoLossMemeClient(cfg.network),
  new Rpc(cfg.rpcUrl, { rps: cfg.RPC_RPS }),
  cfg.network.factory,
  {
    startBlock: cfg.START_BLOCK,
    concurrency: cfg.SCAN_CONCURRENCY,
    sparse: cfg.SPARSE_SCAN,
    rpcConcurrency: cfg.RPC_CONCURRENCY,
  },
);
await scanner.refreshRegistry();
const from = Number(fromArg ?? cfg.START_BLOCK);
const to = Number(toArg ?? (await data.lastFinalHeight()));
log.info("backfill", { from, to });
const stored = await scanner.indexRange(from, to);
log.info("backfill done", { stored });
db.close();
