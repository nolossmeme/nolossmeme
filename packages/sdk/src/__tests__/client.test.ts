import { describe, expect, it, vi } from "vitest";

import { NoLossMemeClient } from "../client.js";

describe("NoLossMemeClient", () => {
  it("routes views to the right contracts and parses bigints", async () => {
    const callFunction = vi.fn(({ contractId, method }: { contractId: string; method: string }) => {
      if (method === "get_launch_cost") return Promise.resolve("3209050000000000000000000");
      if (method === "get_st_near_price") return Promise.resolve("3198752259237337050198977");
      if (method === "get_meme_count") return Promise.resolve(1);
      return Promise.resolve({ contractId, method });
    });
    const client = new NoLossMemeClient("testnet", { callFunction });

    expect(await client.getLaunchCost()).toBe(3_209_050_000_000_000_000_000_000n);
    expect(await client.getStNearPrice()).toBe(3_198_752_259_237_337_050_198_977n);
    expect(await client.getMemeCount()).toBe(1);
    await client.getPoolState("dogn.nolossmeme.testnet");
    expect(callFunction).toHaveBeenLastCalledWith({
      contractId: "dogn.nolossmeme.testnet",
      method: "get_state",
      args: {},
    });
    expect(callFunction.mock.calls[0]?.[0].contractId).toBe("factory.nolossmeme.testnet");
  });

  it("throws on empty results", async () => {
    const client = new NoLossMemeClient("testnet", {
      callFunction: () => Promise.resolve(undefined),
    });
    await expect(client.getMemeCount()).rejects.toThrow(/returned nothing/);
  });
});
