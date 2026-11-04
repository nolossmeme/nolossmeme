/**
 * Keeper: permissionless draw trigger.
 *
 * Lists pools from the factory, checks each one's epoch and calls `draw` where due.
 * Anyone can run this; the account only needs gas. Configure with environment variables:
 *   NEAR_NETWORK        testnet | mainnet (default testnet)
 *   FACTORY_ID          override the factory account
 *   KEEPER_ACCOUNT_ID   account that signs `draw`
 *   KEEPER_PRIVATE_KEY  its private key (ed25519:...)
 *   DRY_RUN=1           decide only, do not send
 */
import {
  NETWORKS,
  NoLossMemeClient,
  formatMeme,
  formatNear,
  type Draw,
  type NetworkId,
} from "@nolossmeme/sdk";
import { Account, JsonRpcProvider, teraToGas, type KeyPairString } from "near-api-js";

import { decide } from "./decide.js";

const networkId = (process.env.NEAR_NETWORK as NetworkId | undefined) ?? "testnet";
const config = {
  ...NETWORKS[networkId],
  factory: process.env.FACTORY_ID ?? NETWORKS[networkId].factory,
};
const dryRun = process.env.DRY_RUN === "1";

async function main(): Promise<void> {
  const client = new NoLossMemeClient(config);
  const memes = await client.getMemes(0, 100);
  console.log(
    `[keeper] ${networkId} factory=${config.factory} pools=${memes.length} dryRun=${dryRun}`,
  );

  let signer: Account | undefined;
  if (!dryRun) {
    const accountId = process.env.KEEPER_ACCOUNT_ID;
    const privateKey = process.env.KEEPER_PRIVATE_KEY as KeyPairString | undefined;
    if (!accountId || !privateKey)
      throw new Error("KEEPER_ACCOUNT_ID and KEEPER_PRIVATE_KEY are required");
    signer = new Account(accountId, new JsonRpcProvider({ url: config.rpcUrl }), privateKey);
  }

  let failures = 0;
  for (const meme of memes) {
    const pool = meme.account_id;
    try {
      const state = await client.getPoolState(pool);
      const decision = decide(state);
      if (!decision.draw) {
        console.log(`[keeper] ${pool}: skip (${decision.reason})`);
        continue;
      }
      if (!signer) {
        console.log(`[keeper] ${pool}: would draw epoch #${state.epoch_index}`);
        continue;
      }
      const draw = await signer.callFunction<Draw>({
        contractId: pool,
        methodName: "draw",
        args: {},
        gas: teraToGas("300"),
        deposit: 0n,
      });
      console.log(
        `[keeper] ${pool}: drew epoch #${draw.epoch} winner=${draw.winner ?? "none"} jackpot=${formatMeme(draw.jackpot, 0)} ${meme.symbol} yield=${formatNear(draw.yield_near, 6)} Ⓝ`,
      );
    } catch (e) {
      failures += 1;
      console.error(`[keeper] ${pool}: failed`, e instanceof Error ? e.message : e);
    }
  }
  if (failures > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
