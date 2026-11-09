import { describe, expect, it } from "vitest";

import * as actions from "../actions.js";
import { STORAGE_COST } from "../config.js";
import { parseNear } from "../format.js";

const POOL = "dogn.nolossmeme.testnet";

describe("actions", () => {
  it("adds the storage fee for a first deposit only", () => {
    const first = actions.deposit(POOL, parseNear("1"), false);
    const again = actions.deposit(POOL, parseNear("1"), true);
    expect(BigInt(first.actions[0]!.params.deposit)).toBe(parseNear("1") + STORAGE_COST);
    expect(BigInt(again.actions[0]!.params.deposit)).toBe(parseNear("1"));
    expect(first.receiverId).toBe(POOL);
    expect(first.actions[0]!.params.methodName).toBe("deposit");
  });

  it("encodes optional amounts as null", () => {
    expect(actions.withdraw(POOL).actions[0]!.params.args).toEqual({ amount: null });
    expect(actions.withdraw(POOL, 5n).actions[0]!.params.args).toEqual({ amount: "5" });
    expect(actions.withdrawNear(POOL, undefined, 7n).actions[0]!.params.args).toEqual({
      amount: null,
      min_near: "7",
    });
  });

  it("fundTreasury attaches the sponsored amount", () => {
    const tx = actions.fundTreasury(POOL, parseNear("2"));
    expect(tx.actions[0]!.params.methodName).toBe("fund_treasury");
    expect(tx.actions[0]!.params.deposit).toBe(parseNear("2").toString());
  });

  it("redeem attaches exactly one yocto", () => {
    expect(actions.redeem(POOL, 10n).actions[0]!.params.deposit).toBe("1");
  });

  it("createMeme attaches the launch cost and forwards params", () => {
    const tx = actions.createMeme(
      "nolossmeme.testnet",
      {
        slug: "pepn",
        name: "Pepe of NEAR",
        symbol: "PEPN",
        params: {
          epoch_length_ns: "86400000000000",
          initial_emission: "1000000000000000000000",
          halving_every: 30,
          jackpot_bps: 7000,
          streak_step_bps: 1000,
          max_streak_bonus_bps: 5000,
          min_deposit: "100000000000000000000000",
        },
      },
      parseNear("3.5"),
    );
    expect(tx.actions[0]!.params.deposit).toBe(parseNear("3.5").toString());
    expect(tx.actions[0]!.params.args).toMatchObject({ slug: "pepn", icon: null });
  });

  it("validates slugs like the factory", () => {
    expect(actions.validateSlug("pepn")).toBeNull();
    expect(actions.validateSlug("a")).toMatch(/2-32/);
    expect(actions.validateSlug("Bad Slug")).toMatch(/a-z/);
    expect(actions.validateSlug("-x")).toMatch(/start or end/);
  });
});
