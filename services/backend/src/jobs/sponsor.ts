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
  const tick = async () => {
    for (const p of await store.listPools()) {
      try {
        const state = await client.getPoolState(p.account_id);
        if (state.total_funded === undefined) continue; // pool predates fund_treasury
        await signer.callFunction({
          contractId: p.account_id,
          methodName: "fund_treasury",
          args: {},
          gas: teraToGas("150"),
          deposit: o.amountYocto,
        });
        log.info("treasury subsidised", { pool: p.account_id, amount: o.amountYocto.toString() });
      } catch (e) {
        log.warn("subsidy failed", { pool: p.account_id, error: String(e).slice(0, 160) });
      }
    }
  };
  const first = setTimeout(() => void tick(), 60_000);
  const id = setInterval(() => void tick(), o.intervalMs);
  return () => {
    clearTimeout(first);
    clearInterval(id);
  };
}
