import { formatMeme, formatNear, nsToDate, type MemeInfo } from "@nolossmeme/sdk";
import { Link } from "react-router-dom";

import { usePoolState } from "../hooks/usePool";
import { Countdown } from "./Countdown";
import { MemeIcon } from "./MemeIcon";

export function MemeCard({ meme }: { meme: MemeInfo }) {
  const { data: state } = usePoolState(meme.account_id);
  return (
    <Link
      to={`/m/${meme.slug}`}
      className="card p-5 flex flex-col gap-4 transition hover:-translate-y-0.5 hover:border-lime/40"
    >
      <div className="flex items-center gap-3">
        <MemeIcon icon={meme.icon} symbol={meme.symbol} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{meme.name}</div>
          <div className="text-xs text-muted font-mono">${meme.symbol}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="kicker">Next draw</div>
          <Countdown
            targetMs={state ? nsToDate(state.next_draw_at).getTime() : undefined}
            dueLabel="Due now"
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="kicker">Locked</dt>
          <dd className="font-mono">{state ? `${formatNear(state.total_principal, 1)} Ⓝ` : "…"}</dd>
        </div>
        <div>
          <dt className="kicker">Floor</dt>
          <dd className="font-mono text-lime">
            {state ? `${formatNear(state.floor_price, 6)} Ⓝ` : "…"}
          </dd>
        </div>
        <div>
          <dt className="kicker">Jackpot</dt>
          <dd className="font-mono">
            {state
              ? `${formatMeme((BigInt(state.emission_now) * BigInt(state.params.jackpot_bps)) / 10_000n, 0)}`
              : "…"}
          </dd>
        </div>
      </dl>
      <div className="text-xs text-muted flex justify-between">
        <span>{state?.depositors ?? "…"} depositors</span>
        <span>{state?.draws ?? "…"} draws</span>
      </div>
    </Link>
  );
}
