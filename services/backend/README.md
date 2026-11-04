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

The archive allows roughly 2–3 requests per second per client; the defaults (`NEARDATA_RPS=2`, `SCAN_CONCURRENCY=2`) stay under that and back off on 429. A backfill from the factory deploy (~6 000 blocks) takes under an hour; following the head is real time.

Environment (all optional, see `src/config.ts`): `NEAR_NETWORK`, `FACTORY_ID`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `START_BLOCK`, `SCAN_CONCURRENCY`, `SNAPSHOT_INTERVAL_MS`, `PORT`, `CORS_ORIGIN`, `KEEPER_ACCOUNT_ID`, `KEEPER_PRIVATE_KEY`, `LOG_LEVEL`.

## Deploy

```bash
docker build -f services/backend/Dockerfile -t nolossmeme-backend .
docker run -p 8787:8787 -v nolossmeme-data:/data nolossmeme-backend
```

Point the web app at it with `VITE_INDEXER_URL=https://your-host`. Without it the app keeps working from contract views alone.
