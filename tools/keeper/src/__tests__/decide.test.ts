import { describe, expect, it } from "vitest";

import { decide } from "../decide.js";

const base = {
  current_time: "100000000000",
  next_draw_at: "100000000000",
  draw_in_progress: false,
  in_flight: 0,
};

describe("decide", () => {
  it("draws when the epoch is over and nothing is pending", () => {
    expect(decide(base)).toEqual({ draw: true });
  });
  it("waits for the epoch to end", () => {
    const d = decide({ ...base, next_draw_at: "160000000000" });
    expect(d).toMatchObject({ draw: false, reason: "epoch ends in 60s" });
  });
  it("respects contract locks", () => {
    expect(decide({ ...base, draw_in_progress: true })).toMatchObject({ draw: false });
    expect(decide({ ...base, in_flight: 2 })).toMatchObject({
      draw: false,
      reason: "2 withdrawals in flight",
    });
  });
});
