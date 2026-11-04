# Backend: indexer, API, jobs

One process, three jobs:

| Part                        | What it does                                                                                                                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Indexer** (`src/indexer`) | Follows the chain through FastNEAR's free block archive (`neardata.xyz`, NEAR Lake format), keeps receipts to the factory and every pool, and turns NEP-141 events, callback return values and contract logs into typed events. Gap-tolerant, idempotent (`receipt_id:n` ids), resumes from a cursor. |
| **API** (`src/api`)         | Hono REST API: `/health`, `/stats`, `/pools`, `/pools/:id/activity`, `/pools/:id/draws`, `/pools/:id/series`, `/accounts/:id/activity`, `/activity`.                                                                                                                                                  |
| **Jobs** (`src/jobs`)       | `get_state` snapshots every 5 min (TVL / treasury / floor time series) and an optional keeper worker that calls `draw` when an epoch ends.                                                                                                                                                            |

Storage is libsql: a local SQLite file by default, a Turso URL + token in production.

## Run

```bash
pnpm --filter @nolossmeme/sdk build
pnpm --filter @nolossmeme/backend dev          # http://localhost:8787
pnpm --filter @nolossmeme/backend backfill 276200000   # one-off range, then exit
pnpm --filter @nolossmeme/backend test
```

Both upstreams throttle: the block archive at roughly 1 request per second sustained, the free RPC at about 2 per second for `EXPERIMENTAL_changes_in_block`. The defaults (`NEARDATA_RPS=1`, `SCAN_CONCURRENCY=1`, `RPC_RPS=2`, `RPC_CONCURRENCY=2`) stay under that and back off on 429. Sparse scanning asks the RPC which accounts a block touched and fetches only blocks that touched ours, so following the head costs about one RPC call per block (real time) and a backfill of the ~9 000 blocks since the factory deploy takes about an hour and a half.

`ROLE` splits the process for scaling or local work: `ROLE=api` serves reads only (safe next to a running backfill), `ROLE=scanner,jobs` indexes without HTTP; default `all`.

Environment (all optional, see `src/config.ts`): `NEAR_NETWORK`, `FACTORY_ID`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `START_BLOCK`, `SCAN_CONCURRENCY`, `SNAPSHOT_INTERVAL_MS`, `PORT`, `CORS_ORIGIN`, `KEEPER_ACCOUNT_ID`, `KEEPER_PRIVATE_KEY`, `LOG_LEVEL`.

## Deploy

```bash
docker build -f services/backend/Dockerfile -t nolossmeme-backend .
docker run -p 8787:8787 -v nolossmeme-data:/data nolossmeme-backend
```

Point the web app at it with `VITE_INDEXER_URL=https://your-host` (for the Pages build: repository variable `INDEXER_URL`). Without it the app keeps working from contract views alone.

Fly.io (one volume, one shared-cpu machine):

```bash
fly launch --config services/backend/fly.toml --dockerfile services/backend/Dockerfile --no-deploy
fly volumes create nolossmeme_data --size 1 --region sin
fly secrets set KEEPER_ACCOUNT_ID=keeper.nolossmeme.testnet KEEPER_PRIVATE_KEY=ed25519:...   # optional draw worker
fly deploy --config services/backend/fly.toml --dockerfile services/backend/Dockerfile
```

The indexer resumes from its cursor on restart; the first start backfills from `START_BLOCK` (sparse scan, a few minutes).
