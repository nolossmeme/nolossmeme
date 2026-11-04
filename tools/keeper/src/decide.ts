import type { PoolState } from "@nolossmeme/sdk";

export type Decision = { draw: true } | { draw: false; reason: string };

/** Mirror of the `draw` preconditions, so we never pay gas for a call that will fail. */
export function decide(
  state: Pick<PoolState, "current_time" | "next_draw_at" | "draw_in_progress" | "in_flight">,
): Decision {
  if (state.draw_in_progress) return { draw: false, reason: "draw in progress" };
  if (state.in_flight > 0)
    return { draw: false, reason: `${state.in_flight} withdrawals in flight` };
  const wait = BigInt(state.next_draw_at) - BigInt(state.current_time);
  if (wait > 0n) return { draw: false, reason: `epoch ends in ${wait / 1_000_000_000n}s` };
  return { draw: true };
}
