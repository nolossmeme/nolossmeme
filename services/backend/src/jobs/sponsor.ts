/**
 * Testnet yield subsidy. Testnet validators pay no staking rewards, so stNEAR never appreciates
 * and a pool's treasury would stay empty forever. This job stands in for the yield: every
 * interval it calls `fund_treasury` on each pool that supports it, from a dedicated account.
 * Everything it adds is public (`fund` events, `total_funded` in `get_state`) and the app labels
 * it as a subsidy. Never enable it on mainnet.
 */
import type { NoLossMemeClient } from "@nolossmeme/sdk";
import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";

import type { Store } from "../db/store.js";
import { log } from "../log.js";

export interface SponsorOptions {
  rpcUrl: string;
  accountId: string;
  privateKey: string;
  amountYocto: bigint;
  intervalMs: number;
}

/**
 * True when `sponsor` last funded `pool` at least `intervalMs` ago. The indexed `fund` event
 * survives restarts; `sent` covers the minutes before the indexer sees our own call.
 */
export async function isDue(
  store: Store,
  pool: string,
  sponsor: string,
  intervalMs: number,
  now: number,
  sent: ReadonlyMap<string, number>,
): Promise<boolean> {
  const [last] = await store.listEvents({
    contract: pool,
    account: sponsor,
    kind: "fund",
    limit: 1,
  });
  // ponytail: an indexer still backfilling sees no event, so a restart then can fund once early.
  return now - Math.max(last?.blockTimestamp ?? 0, sent.get(pool) ?? 0) >= intervalMs;
}

export function startSponsorJob(
  store: Store,
  client: NoLossMemeClient,
  o: SponsorOptions,
): () => void {
  const signer = new Account(
    o.accountId,
    new JsonRpcProvider({ url: o.rpcUrl }),
    o.privateKey as KeyPairString,
  );
  const sent = new Map<string, number>();
  const tick = async () => {
    for (const p of await store.listPools()) {
      try {
        if (!(await isDue(store, p.account_id, o.accountId, o.intervalMs, Date.now(), sent)))
          continue;
        const state = await client.getPoolState(p.account_id);
        if (state.total_funded === undefined) continue; // pool predates fund_treasury
        await signer.callFunction({
          contractId: p.account_id,
          methodName: "fund_treasury",
          args: {},
          gas: teraToGas("150"),
          deposit: o.amountYocto,
        });
        sent.set(p.account_id, Date.now());
        log.info("treasury subsidised", { pool: p.account_id, amount: o.amountYocto.toString() });
      } catch (e) {
        log.warn("subsidy failed", { pool: p.account_id, error: String(e).slice(0, 160) });
      }
    }
  };
  const first = setTimeout(() => void tick(), 60_000);
  // Check often; isDue keeps the real cadence across restarts.
  const id = setInterval(() => void tick(), Math.min(o.intervalMs, 3_600_000));
  return () => {
    clearTimeout(first);
    clearInterval(id);
  };
}
