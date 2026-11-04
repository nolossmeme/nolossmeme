import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { SCHEMA } from "./schema.js";

export type Db = Client;

export async function openDb(url: string, authToken?: string): Promise<Db> {
  if (url.startsWith("file:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }
  const db = createClient(authToken ? { url, authToken } : { url });
  for (const stmt of SCHEMA) await db.execute(stmt);
  return db;
}
