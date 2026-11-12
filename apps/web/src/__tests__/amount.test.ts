import { describe, expect, it } from "vitest";

import { decimalInput } from "../lib/amount";
import { buildPositionCall } from "../lib/positionCall";

const base = {
  pool: "p.testnet",
  asNear: false,
  principal: 10n ** 24n,
  memeBalance: 10n ** 18n,
  minDeposit: 10n ** 24n,
  registered: true,
};

describe("amount input", () => {
  it("accepts decimals, maps the comma, refuses the rest", () => {
    expect(decimalInput("1,5")).toBe("1.5");
    expect(decimalInput(".")).toBe(".");
    expect(decimalInput("1e3")).toBeNull();
    expect(decimalInput("1.2.")).toBeNull();
    expect(decimalInput("-1")).toBeNull();
  });

  it("never throws on half-typed amounts", () => {
    for (const amount of [".", "1.", "0.0000000000000000000000001"])
      for (const tab of ["deposit", "withdraw", "redeem", "sponsor"] as const)
        expect(() => buildPositionCall({ ...base, tab, amount })).not.toThrow();
    expect(buildPositionCall({ ...base, tab: "deposit", amount: "" })).toBeNull();
    expect(buildPositionCall({ ...base, tab: "withdraw", amount: "" })?.label).toBe("Withdraw");
  });
});
