/** Optional draw worker: same rules as `tools/keeper`, but long-running and not dependent on GitHub cron. */
import type { Draw, NoLossMemeClient } from "@nolossmeme/sdk";
import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";

import type { Store } from "../db/store.js";
import { log } from "../log.js";

export function shouldDraw(s: {
  current_time: string;
  next_draw_at: string;
  draw_in_progress: boolean;
  in_flight: number;
}): boolean {
  return (
    !s.draw_in_progress && s.in_flight === 0 && BigInt(s.next_draw_at) <= BigInt(s.current_time)
  );
}

export function startKeeperJob(
  store: Store,
  client: NoLossMemeClient,
  rpcUrl: string,
  accountId: string,
  privateKey: string,
  intervalMs: number,
): () => void {
  const signer = new Account(
    accountId,
    new JsonRpcProvider({ url: rpcUrl }),
    privateKey as KeyPairString,
  );
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const p of await store.listPools()) {
        const state = await client.getPoolState(p.account_id);
        if (!shouldDraw(state)) continue;
        const draw = await signer.callFunction<Draw>({
          contractId: p.account_id,
          methodName: "draw",
          args: {},
          gas: teraToGas("300"),
          deposit: 0n,
        });
        log.info("draw sent", {
          pool: p.account_id,
          epoch: draw?.epoch ?? null,
          winner: draw?.winner ?? null,
        });
      }
    } catch (e) {
      log.error("keeper tick failed", { error: String(e) });
    } finally {
      busy = false;
    }
  };
  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(id);
}
