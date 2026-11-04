/**
 * Offline projection of a pool: how supply, treasury and floor evolve over `days`
 * under an assumed TVL, staking APY and community check-in rate. Mirrors the contract's
 * emission and floor math via the SDK so the launch preview matches reality.
 */
import { ONE_NEAR, emissionFor, floorPrice, type LaunchParams } from "@nolossmeme/sdk";

export interface ProjectionInput {
  params: Pick<
    LaunchParams,
    "epoch_length_ns" | "initial_emission" | "halving_every" | "jackpot_bps"
  >;
  /** NEAR locked in the pool (whole NEAR). */
  tvlNear: number;
  /** Staking APY in bps (Meta Pool ~ 800-1000). */
  apyBps: number;
  /** Share of depositors checking in each epoch, 0..1. */
  checkinRate: number;
  depositors: number;
  days: number;
}

export interface ProjectionPoint {
  day: number;
  epoch: number;
  supply: bigint;
  treasuryNear: bigint;
  /** yocto NEAR per MEME */
  floor: bigint;
  jackpot: bigint;
}

export function project(input: ProjectionInput): ProjectionPoint[] {
  const epochSeconds = Number(BigInt(input.params.epoch_length_ns) / 1_000_000_000n);
  const epochsPerDay = 86_400 / Math.max(epochSeconds, 1);
  const totalEpochs = Math.floor(input.days * epochsPerDay);
  const tvl = BigInt(Math.round(input.tvlNear * 1_000_000)) * (ONE_NEAR / 1_000_000n);
  // yield per epoch = tvl * apy * epochSeconds / year
  const yieldPerEpoch =
    (tvl * BigInt(input.apyBps) * BigInt(epochSeconds)) / (10_000n * 31_536_000n);

  const points: ProjectionPoint[] = [];
  let supply = 0n;
  let treasury = 0n;
  for (let epoch = 0; epoch < totalEpochs; epoch++) {
    treasury += yieldPerEpoch;
    const emission = emissionFor(input.params, epoch);
    const jackpot = (emission * BigInt(input.params.jackpot_bps)) / 10_000n;
    const checkins = Math.round(input.depositors * input.checkinRate);
    const community =
      checkins > 0 ? ((emission - jackpot) / BigInt(checkins)) * BigInt(checkins) : 0n;
    supply += jackpot + community;
    const day = (epoch + 1) / epochsPerDay;
    if (Number.isInteger(day) || epoch === totalEpochs - 1) {
      points.push({
        day,
        epoch,
        supply,
        treasuryNear: treasury,
        floor: floorPrice(treasury, supply),
        jackpot,
      });
    }
  }
  return points;
}
