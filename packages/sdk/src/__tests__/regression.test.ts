/** One test per bug found; names start with `regression` so `vitest -t regression` runs the layer. */
import { describe, expect, it } from "vitest";

import { STAKING_MIN_DEPOSIT } from "../config.js";
import { formatNear, parseNear } from "../format.js";
import { secondsUntilDraw } from "../tokenomics.js";

describe("regression", () => {
  /** A u128 * u128 product overflowed in a test helper; the SDK must never use Number for yocto. */
  it("regression keeps 24-decimal precision through parse and format", () => {
    const yocto = parseNear("123456.123456789012345678901234");
    expect(yocto.toString()).toBe("123456123456789012345678901234");
    expect(formatNear(yocto, 24)).toBe("123456.123456789012345678901234");
  });

  /** 2026-11-04: a 0.5 Ⓝ deposit was refunded by Meta Pool; the UI must use the staking floor. */
  it("regression staking minimum is one NEAR", () => {
    expect(STAKING_MIN_DEPOSIT).toBe(parseNear("1"));
    expect(parseNear("0.5") < STAKING_MIN_DEPOSIT).toBe(true);
  });

  /** `Date.now()` in render broke the react-hooks purity rule; countdown must come from chain time. */
  it("regression countdown is derived from chain timestamps only", () => {
    expect(secondsUntilDraw({ next_draw_at: "2000000000", current_time: "1000000000" })).toBe(1);
    expect(secondsUntilDraw({ next_draw_at: "1000000000", current_time: "2000000000" })).toBe(0);
  });
});
