/** Idempotent schema. Kept as plain SQL so it works on local SQLite and Turso alike. */
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS cursor (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     height INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS pools (
     account_id TEXT PRIMARY KEY,
     slug TEXT NOT NULL,
     name TEXT NOT NULL,
     symbol TEXT NOT NULL,
     icon TEXT,
     creator TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     params TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     id TEXT PRIMARY KEY,
     block_height INTEGER NOT NULL,
     block_timestamp INTEGER NOT NULL,
     tx_hash TEXT,
     receipt_id TEXT NOT NULL,
     contract TEXT NOT NULL,
     kind TEXT NOT NULL,
     account TEXT,
     amount TEXT,
     data TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS events_contract_height ON events (contract, block_height DESC)`,
  `CREATE INDEX IF NOT EXISTS events_account_height ON events (account, block_height DESC)`,
  `CREATE INDEX IF NOT EXISTS events_kind_height ON events (kind, block_height DESC)`,
  `CREATE TABLE IF NOT EXISTS snapshots (
     pool TEXT NOT NULL,
     taken_at INTEGER NOT NULL,
     block_height INTEGER,
     total_principal TEXT NOT NULL,
     treasury_near TEXT NOT NULL,
     total_supply TEXT NOT NULL,
     floor_price TEXT NOT NULL,
     st_near_price TEXT NOT NULL,
     depositors INTEGER NOT NULL,
     draws INTEGER NOT NULL,
     epoch_index INTEGER NOT NULL,
     PRIMARY KEY (pool, taken_at)
   )`,
];
