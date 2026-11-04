/** Pure mirrors of the on-chain math, so the UI and the simulator agree with the contract. */
import { ONE_MEME, ONE_NEAR, toBigInt } from "./format.js";
import type { PoolParams, PoolState } from "./types.js";

/** MEME minted in `epoch` under the halving schedule (`meme-pool::math::emission_for`). */
export function emissionFor(
  params: Pick<PoolParams, "initial_emission" | "halving_every">,
  epoch: number,
): bigint {
  const halvings = Math.floor(epoch / Math.max(params.halving_every, 1));
  if (halvings >= 128) return 0n;
  return toBigInt(params.initial_emission) >> BigInt(halvings);
}

/** yocto NEAR per whole MEME. */
export function floorPrice(treasuryNear: bigint, totalSupply: bigint): bigint {
  if (totalSupply === 0n) return 0n;
  return (treasuryNear * ONE_MEME) / totalSupply;
}

export function sharesFromNear(near: bigint, price: bigint): bigint {
  return (near * ONE_NEAR) / price;
}

export function nearFromShares(shares: bigint, price: bigint): bigint {
  return (shares * price) / ONE_NEAR;
}

/** Jackpot and per-check-in reward for an epoch. */
export function splitEmission(
  params: Pick<PoolParams, "initial_emission" | "halving_every" | "jackpot_bps">,
  epoch: number,
  checkins: number,
): { emission: bigint; jackpot: bigint; perCheckin: bigint } {
  const emission = emissionFor(params, epoch);
  const jackpot = (emission * BigInt(params.jackpot_bps)) / 10_000n;
  const perCheckin = checkins > 0 ? (emission - jackpot) / BigInt(checkins) : 0n;
  return { emission, jackpot, perCheckin };
}

/** Streak bonus in bps, capped like the contract. */
export function streakBonusBps(
  params: Pick<PoolParams, "streak_step_bps" | "max_streak_bonus_bps">,
  streak: number,
): number {
  return Math.min(streak * params.streak_step_bps, params.max_streak_bonus_bps);
}

/** Seconds until the next draw may be called (0 when it is due). */
export function secondsUntilDraw(state: Pick<PoolState, "next_draw_at" | "current_time">): number {
  const diff = toBigInt(state.next_draw_at) - toBigInt(state.current_time);
  return diff <= 0n ? 0 : Number(diff / 1_000_000_000n);
}

/** A depositor's share of the tickets, 0..1, given their weight and the pool's total. */
export function winChance(weight: bigint, totalWeight: bigint): number {
  if (totalWeight <= 0n || weight <= 0n) return 0;
  return Number((weight * 1_000_000n) / totalWeight) / 1_000_000;
}
