import { describe, expect, it } from "vitest";

import { ONE_MEME, ONE_NEAR } from "../format.js";
import {
  emissionFor,
  floorPrice,
  secondsUntilDraw,
  splitEmission,
  streakBonusBps,
  winChance,
} from "../tokenomics.js";

const params = {
  initial_emission: (1000n * ONE_MEME).toString(),
  halving_every: 30,
  jackpot_bps: 7000,
  streak_step_bps: 1000,
  max_streak_bonus_bps: 5000,
};

describe("tokenomics mirrors the contract", () => {
  it("halves emission on schedule", () => {
    expect(emissionFor(params, 0)).toBe(1000n * ONE_MEME);
    expect(emissionFor(params, 29)).toBe(1000n * ONE_MEME);
    expect(emissionFor(params, 30)).toBe(500n * ONE_MEME);
    expect(emissionFor(params, 30 * 128)).toBe(0n);
  });

  it("splits jackpot and community share", () => {
    const s = splitEmission(params, 0, 3);
    expect(s.jackpot).toBe(700n * ONE_MEME);
    expect(s.perCheckin).toBe(100n * ONE_MEME);
    expect(splitEmission(params, 0, 0).perCheckin).toBe(0n);
  });

  it("computes floor price and caps the streak bonus", () => {
    expect(floorPrice(ONE_NEAR, 2n * ONE_MEME)).toBe(ONE_NEAR / 2n);
    expect(floorPrice(ONE_NEAR, 0n)).toBe(0n);
    expect(streakBonusBps(params, 3)).toBe(3000);
    expect(streakBonusBps(params, 9)).toBe(5000);
  });

  it("derives countdown and win chance", () => {
    expect(secondsUntilDraw({ next_draw_at: "10000000000", current_time: "4000000000" })).toBe(6);
    expect(secondsUntilDraw({ next_draw_at: "1", current_time: "5" })).toBe(0);
    expect(winChance(25n, 100n)).toBeCloseTo(0.25);
    expect(winChance(0n, 100n)).toBe(0);
  });
});
