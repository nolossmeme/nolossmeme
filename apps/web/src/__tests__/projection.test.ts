import { ONE_MEME } from "@nolossmeme/sdk";
import { describe, expect, it } from "vitest";

import { project } from "../lib/projection";

const params = {
  epoch_length_ns: "86400000000000",
  initial_emission: (1000n * ONE_MEME).toString(),
  halving_every: 30,
  jackpot_bps: 7000,
};

describe("project", () => {
  it("grows treasury linearly and halves emission", () => {
    const pts = project({
      params,
      tvlNear: 10_000,
      apyBps: 900,
      checkinRate: 0.5,
      depositors: 100,
      days: 60,
    });
    expect(pts).toHaveLength(60);
    const d30 = pts[29]!;
    const d60 = pts[59]!;
    // 60 days of yield ~ 2x 30 days
    expect(Number(d60.treasuryNear) / Number(d30.treasuryNear)).toBeCloseTo(2, 1);
    // first 30 epochs mint 1000, next 30 mint 500 each
    expect(d30.supply).toBe(30n * 1000n * ONE_MEME);
    expect(d60.supply).toBe(45n * 1000n * ONE_MEME);
    // floor only goes up once emission halves below yield growth
    expect(d60.floor).toBeGreaterThan(d30.floor);
  });

  it("does not mint the community share when nobody checks in", () => {
    const pts = project({
      params,
      tvlNear: 100,
      apyBps: 900,
      checkinRate: 0,
      depositors: 10,
      days: 1,
    });
    expect(pts[0]!.supply).toBe(700n * ONE_MEME);
  });
});
