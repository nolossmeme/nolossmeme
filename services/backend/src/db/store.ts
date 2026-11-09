/** All reads and writes in one place; the API and jobs never touch SQL directly. */
import type { MemeInfo, PoolState } from "@nolossmeme/sdk";

import type { Row, Value } from "@libsql/client";

import type { Db } from "./client.js";
import type { IndexedEvent } from "../indexer/events.js";

/** libsql values are string | number | bigint | ArrayBuffer | null; our columns are text or integers. */
function text(v: Value): string {
  if (typeof v === "string") return v;
  if (typeof v === "bigint" || typeof v === "number") return v.toString();
  return "";
}
const textOrNull = (v: Value): string | null => (v === null ? null : text(v));
const col = (row: Row, name: string): Value => row[name] as Value;

export interface SnapshotRow {
  pool: string;
  taken_at: number;
  block_height: number | null;
  total_principal: string;
  treasury_near: string;
  total_supply: string;
  floor_price: string;
  st_near_price: string;
  depositors: number;
  draws: number;
  epoch_index: number;
}

export class Store {
  constructor(private readonly db: Db) {}

  // ---- cursor

  async getCursor(): Promise<number | null> {
    const r = await this.db.execute("SELECT height FROM cursor WHERE id = 1");
    return r.rows[0] ? Number(col(r.rows[0], "height")) : null;
  }

  async setCursor(height: number): Promise<void> {
    await this.db.execute({
      sql: "INSERT INTO cursor (id, height, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET height = excluded.height, updated_at = excluded.updated_at",
      args: [height, Date.now()],
    });
  }

  // ---- pools

  async upsertPool(m: MemeInfo): Promise<void> {
    await this.db.execute({
      sql: `INSERT INTO pools (account_id, slug, name, symbol, icon, creator, created_at, params)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(account_id) DO UPDATE SET name = excluded.name, symbol = excluded.symbol, icon = excluded.icon`,
      args: [
        m.account_id,
        m.slug,
        m.name,
        m.symbol,
        m.icon,
        m.creator,
        Number(BigInt(m.created_at) / 1_000_000n),
        JSON.stringify(m.params),
      ],
    });
  }

  async listPools(): Promise<MemeInfo[]> {
    const r = await this.db.execute("SELECT * FROM pools ORDER BY created_at ASC");
    return r.rows.map((row) => ({
      account_id: text(col(row, "account_id")),
      slug: text(col(row, "slug")),
      name: text(col(row, "name")),
      symbol: text(col(row, "symbol")),
      icon: textOrNull(col(row, "icon")),
      creator: text(col(row, "creator")),
      created_at: (BigInt(Number(col(row, "created_at"))) * 1_000_000n).toString(),
      params: JSON.parse(text(col(row, "params"))) as MemeInfo["params"],
    }));
  }

  // ---- events

  async insertEvents(events: IndexedEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const stmts = events.map((e) => ({
      sql: `INSERT OR IGNORE INTO events (id, block_height, block_timestamp, tx_hash, receipt_id, contract, kind, account, amount, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.id,
        e.blockHeight,
        e.blockTimestamp,
        e.txHash,
        e.receiptId,
        e.contract,
        e.kind,
        e.account,
        e.amount,
        JSON.stringify(e.data),
      ],
    }));
    const results = await this.db.batch(stmts, "write");
    return results.reduce((n, r) => n + r.rowsAffected, 0);
  }

  async listEvents(filter: {
    contract?: string;
    account?: string;
    kind?: string;
    limit?: number;
    before?: number;
  }): Promise<IndexedEvent[]> {
    const where: string[] = [];
    const args: (string | number)[] = [];
    const add = (clause: string, value: string | number) => {
      where.push(clause);
      args.push(value);
    };
    if (filter.contract) add("contract = ?", filter.contract);
    if (filter.account) add("account = ?", filter.account);
    if (filter.kind) add("kind = ?", filter.kind);
    if (filter.before) add("block_height < ?", filter.before);
    const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
    const sql = `SELECT * FROM events ${whereSql} ORDER BY block_height DESC, id DESC LIMIT ?`;
    args.push(Math.min(filter.limit ?? 50, 500));
    const r = await this.db.execute({ sql, args });
    return r.rows.map((row) => ({
      id: text(col(row, "id")),
      blockHeight: Number(col(row, "block_height")),
      blockTimestamp: Number(col(row, "block_timestamp")),
      txHash: textOrNull(col(row, "tx_hash")),
      receiptId: text(col(row, "receipt_id")),
      contract: text(col(row, "contract")),
      kind: text(col(row, "kind")) as IndexedEvent["kind"],
      account: textOrNull(col(row, "account")),
      amount: textOrNull(col(row, "amount")),
      data: JSON.parse(text(col(row, "data"))) as Record<string, unknown>,
    }));
  }

  async countEvents(): Promise<Record<string, number>> {
    const r = await this.db.execute("SELECT kind, COUNT(*) AS n FROM events GROUP BY kind");
    return Object.fromEntries(r.rows.map((row) => [text(col(row, "kind")), Number(col(row, "n"))]));
  }

  // ---- snapshots

  async insertSnapshot(pool: string, s: PoolState, blockHeight: number | null): Promise<void> {
    await this.db.execute({
      sql: `INSERT OR REPLACE INTO snapshots (pool, taken_at, block_height, total_principal, treasury_near, total_supply, floor_price, st_near_price, depositors, draws, epoch_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        pool,
        Date.now(),
        blockHeight,
        s.total_principal,
        s.treasury_near,
        s.total_supply,
        s.floor_price,
        s.st_near_price,
        s.depositors,
        s.draws,
        s.epoch_index,
      ],
    });
  }

  async listSnapshots(pool: string, sinceMs: number, limit = 2_000): Promise<SnapshotRow[]> {
    const r = await this.db.execute({
      sql: "SELECT * FROM snapshots WHERE pool = ? AND taken_at >= ? ORDER BY taken_at ASC LIMIT ?",
      args: [pool, sinceMs, limit],
    });
    return r.rows.map((row) => ({
      pool: text(col(row, "pool")),
      taken_at: Number(col(row, "taken_at")),
      block_height: row["block_height"] === null ? null : Number(col(row, "block_height")),
      total_principal: text(col(row, "total_principal")),
      treasury_near: text(col(row, "treasury_near")),
      total_supply: text(col(row, "total_supply")),
      floor_price: text(col(row, "floor_price")),
      st_near_price: text(col(row, "st_near_price")),
      depositors: Number(col(row, "depositors")),
      draws: Number(col(row, "draws")),
      epoch_index: Number(col(row, "epoch_index")),
    }));
  }

  async latestSnapshots(): Promise<SnapshotRow[]> {
    const r = await this.db.execute(
      "SELECT s.* FROM snapshots s JOIN (SELECT pool, MAX(taken_at) AS t FROM snapshots GROUP BY pool) m ON m.pool = s.pool AND m.t = s.taken_at",
    );
    return r.rows.map((row) => ({
      pool: text(col(row, "pool")),
      taken_at: Number(col(row, "taken_at")),
      block_height: row["block_height"] === null ? null : Number(col(row, "block_height")),
      total_principal: text(col(row, "total_principal")),
      treasury_near: text(col(row, "treasury_near")),
      total_supply: text(col(row, "total_supply")),
      floor_price: text(col(row, "floor_price")),
      st_near_price: text(col(row, "st_near_price")),
      depositors: Number(col(row, "depositors")),
      draws: Number(col(row, "draws")),
      epoch_index: Number(col(row, "epoch_index")),
    }));
  }
}
