import { describe, expect, it } from "vitest";

import { formatUsd, nearToUsd } from "../format";

describe("usd", () => {
  it("converts yoctoNEAR at a price", () => {
    expect(nearToUsd("2500000000000000000000000", 3.4)).toBeCloseTo(8.5);
    expect(nearToUsd(118_000_000_000_000_000_000n, 3.4)).toBeCloseTo(0.0004012);
  });

  it("formats dollars, keeping small values readable", () => {
    expect(formatUsd(1234.567)).toBe("$1,234.57");
    expect(formatUsd(0.42)).toBe("$0.42");
    expect(formatUsd(0.0004012)).toBe("$0.0004");
    expect(formatUsd(0)).toBe("$0");
  });
});
