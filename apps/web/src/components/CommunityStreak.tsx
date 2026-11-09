import type { PoolState } from "@nolossmeme/sdk";

/** Today's check-ins against the community target, the running streak and the high score. */
export function CommunityStreak({ state }: { state: PoolState }) {
  if (state.checkin_target === undefined) return null;
  const target = state.checkin_target;
  const done = state.checkins_this_epoch;
  const pct = Math.min(100, Math.round((done / target) * 100));
  const hit = done >= target;
  return (
    <section className="card glow-top p-5 grid gap-4 sm:grid-cols-[1.6fr_1fr_1fr] sm:items-end">
      <div>
        <div className="kicker">Community check-ins this epoch</div>
        <div className="mt-2 font-mono text-2xl font-semibold">
          {done} / {target}
        </div>
        <div
          className="mt-3 h-2 rounded-full bg-border overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={done}
          aria-label="Community check-ins"
        >
          <div className="h-full bg-lime" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {hit
            ? "Target reached: the community share mints at the next draw."
            : `${target - done} more to go, or the community share burns and the streak resets.`}
        </p>
      </div>
      <div>
        <div className="kicker">Community streak</div>
        <div className="mt-2 font-mono text-2xl font-semibold">
          🔥 {state.community_streak ?? 0}
        </div>
      </div>
      <div>
        <div className="kicker">High score</div>
        <div className="mt-2 font-mono text-2xl font-semibold text-lime">
          🏆 {state.best_streak ?? 0}
        </div>
      </div>
    </section>
  );
}
