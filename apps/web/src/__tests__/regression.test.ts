/** Regression layer for the web app; run with `vitest -t regression`. */
import { ONE_MEME, ONE_NEAR } from "@nolossmeme/sdk";
import { describe, expect, it } from "vitest";

import { formatCountdown } from "../hooks/useCountdown";
import { project } from "../lib/projection";

const params = {
  epoch_length_ns: "3600000000000",
  initial_emission: (10n * ONE_MEME).toString(),
  halving_every: 24,
  jackpot_bps: 7000,
};

describe("regression", () => {
  /** Hourly pools produced no daily points because `day` was never an integer; the last epoch is always emitted. */
  it("regression projection emits points for hourly epochs", () => {
    const pts = project({
      params,
      tvlNear: 100,
      apyBps: 900,
      checkinRate: 0.5,
      depositors: 4,
      days: 2,
    });
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts.at(-1)!.epoch).toBe(47);
    expect(pts.at(-1)!.treasuryNear).toBeGreaterThan(0n);
    expect(pts.at(-1)!.treasuryNear < ONE_NEAR).toBe(true);
  });

  /** Countdown rendered negative values when the chain clock was ahead of the browser. */
  it("regression countdown never shows negative time", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(90061)).toBe("1d 01:01:01");
  });
});
