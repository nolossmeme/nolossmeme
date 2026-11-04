/** Periodic `get_state` per pool, the time series the contracts do not keep themselves. */
import type { NoLossMemeClient } from "@nolossmeme/sdk";

import type { Store } from "../db/store.js";
import { log } from "../log.js";

export async function takeSnapshots(
  store: Store,
  client: NoLossMemeClient,
  blockHeight: number | null,
): Promise<number> {
  const pools = await store.listPools();
  let n = 0;
  for (const p of pools) {
    try {
      const state = await client.getPoolState(p.account_id);
      await store.insertSnapshot(p.account_id, state, blockHeight);
      n += 1;
    } catch (e) {
      log.warn("snapshot failed", { pool: p.account_id, error: String(e) });
    }
  }
  return n;
}

export function startSnapshotJob(
  store: Store,
  client: NoLossMemeClient,
  intervalMs: number,
  head: () => number | null,
): () => void {
  const tick = () =>
    void takeSnapshots(store, client, head()).then((n) => log.debug("snapshots taken", { n }));
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
