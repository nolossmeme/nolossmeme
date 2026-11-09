import { STAKING_MIN_DEPOSIT, parseMeme, parseNear } from "@nolossmeme/sdk";
import { describe, expect, it } from "vitest";

import { buildPositionCall, submitLabel, type PositionInput } from "../lib/positionCall";

const base: PositionInput = {
  pool: "dogn.streak.nolossmeme.testnet",
  tab: "deposit",
  amount: "",
  asNear: false,
  principal: parseNear("2"),
  memeBalance: parseMeme("100"),
  minDeposit: STAKING_MIN_DEPOSIT,
  registered: true,
};
const args = (i: Partial<PositionInput>) =>
  buildPositionCall({ ...base, ...i })?.call.actions[0]?.params;

describe("buildPositionCall", () => {
  it("refuses deposits and sponsoring under the minimum", () => {
    expect(buildPositionCall({ ...base, amount: "0.5" })).toBeNull();
    expect(buildPositionCall({ ...base, tab: "sponsor", amount: "0.5" })).toBeNull();
    expect(args({ amount: "1" })?.methodName).toBe("deposit");
    expect(args({ tab: "sponsor", amount: "2" })).toMatchObject({
      methodName: "fund_treasury",
      deposit: parseNear("2").toString(),
    });
  });

  it("withdraws everything when the amount is empty or too large", () => {
    expect(args({ tab: "withdraw" })?.args).toEqual({ amount: null });
    expect(args({ tab: "withdraw", amount: "5" })?.args).toEqual({ amount: null });
    expect(args({ tab: "withdraw", amount: "1" })?.args).toEqual({
      amount: parseNear("1").toString(),
    });
  });

  it("guards liquid unstake with a 97% minimum", () => {
    expect(args({ tab: "withdraw", asNear: true })?.args).toEqual({
      amount: null,
      min_near: ((parseNear("2") * 97n) / 100n).toString(),
    });
  });

  it("caps redeem at the balance and rejects zero", () => {
    expect(args({ tab: "redeem", amount: "1000" })?.args).toEqual({
      amount: parseMeme("100").toString(),
    });
    expect(buildPositionCall({ ...base, tab: "redeem", memeBalance: 0n })).toBeNull();
  });

  it("labels the button", () => {
    expect(submitLabel(true, true, "deposit")).toBe("Confirm in wallet…");
    expect(submitLabel(false, false, "redeem")).toBe("Connect wallet");
    expect(submitLabel(false, true, "sponsor")).toBe("Sponsor");
  });
});
