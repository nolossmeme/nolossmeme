/**
 * Transaction builders. They produce wallet-agnostic `ContractCall`s that any NEAR wallet
 * library (near-connect, wallet-selector, near-api-js `Account`) can sign.
 */
import { GAS, STORAGE_COST } from "./config.js";
import { tgas } from "./format.js";
import type { ContractCall, FunctionCallAction, LaunchParams } from "./types.js";

function call(
  receiverId: string,
  methodName: string,
  args: Record<string, unknown>,
  gasTgas: bigint,
  deposit: bigint,
): ContractCall {
  const action: FunctionCallAction = {
    type: "FunctionCall",
    params: { methodName, args, gas: tgas(gasTgas), deposit: deposit.toString() },
  };
  return { receiverId, actions: [action] };
}

/**
 * Deposit NEAR. Unregistered accounts pay `STORAGE_COST` once on top, so pass
 * `registered: false` for a first deposit and the fee is added to the attached amount.
 */
export function deposit(pool: string, yocto: bigint, registered: boolean): ContractCall {
  const attached = registered ? yocto : yocto + STORAGE_COST;
  return call(pool, "deposit", {}, GAS.deposit, attached);
}

/** Withdraw principal as stNEAR. Omit `yocto` to withdraw everything. */
export function withdraw(pool: string, yocto?: bigint): ContractCall {
  return call(
    pool,
    "withdraw",
    { amount: yocto === undefined ? null : yocto.toString() },
    GAS.withdraw,
    0n,
  );
}

/** Withdraw principal as NEAR via Meta Pool liquid unstake, guarded by `minNear`. */
export function withdrawNear(
  pool: string,
  yocto: bigint | undefined,
  minNear: bigint,
): ContractCall {
  return call(
    pool,
    "withdraw_near",
    { amount: yocto === undefined ? null : yocto.toString(), min_near: minNear.toString() },
    GAS.withdrawNear,
    0n,
  );
}

export function checkIn(pool: string): ContractCall {
  return call(pool, "check_in", {}, GAS.checkIn, 0n);
}

export function draw(pool: string): ContractCall {
  return call(pool, "draw", {}, GAS.draw, 0n);
}

/** Burn MEME for treasury stNEAR. Requires exactly 1 yocto. */
export function redeem(pool: string, yoctoMeme: bigint): ContractCall {
  return call(pool, "redeem", { amount: yoctoMeme.toString() }, GAS.redeem, 1n);
}

export interface CreateMemeInput {
  slug: string;
  name: string;
  symbol: string;
  icon?: string | null;
  params: LaunchParams;
}

/** Launch a pool through the factory. `launchCost` comes from `client.getLaunchCost()`. */
export function createMeme(
  factory: string,
  input: CreateMemeInput,
  launchCost: bigint,
): ContractCall {
  return call(
    factory,
    "create_meme",
    {
      slug: input.slug,
      name: input.name,
      symbol: input.symbol,
      icon: input.icon ?? null,
      params: input.params,
    },
    GAS.createMeme,
    launchCost,
  );
}

/** Register an account on the MEME token without depositing (e.g. to receive transfers). */
export function storageDeposit(pool: string, accountId?: string): ContractCall {
  return call(
    pool,
    "storage_deposit",
    { account_id: accountId ?? null },
    GAS.storageDeposit,
    STORAGE_COST,
  );
}

/** Validate a slug the way the factory does, returning an error message or null. */
export function validateSlug(slug: string): string | null {
  if (slug.length < 2 || slug.length > 32) return "slug must be 2-32 characters";
  if (!/^[a-z0-9_-]+$/.test(slug)) return "slug may only contain a-z, 0-9, - and _";
  if (slug.startsWith("-") || slug.endsWith("-")) return "slug may not start or end with -";
  return null;
}
