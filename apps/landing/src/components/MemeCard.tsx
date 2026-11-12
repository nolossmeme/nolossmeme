import { MemeIcon } from "@nolossmeme/ui";
import {
  formatMeme,
  formatNear,
  nsToDate,
  plural,
  type MemeInfo,
  type PoolState,
} from "@nolossmeme/sdk";
import { useEffect, useState } from "react";

import { appLink } from "../lib/config";

function useCountdown(targetMs: number | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (targetMs === undefined) return "—";
  const s = Math.max(0, Math.floor((targetMs - now) / 1000));
  if (s === 0) return "Due now";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const d = Math.floor(s / 86_400);
  const days = d > 0 ? `${d}d ` : "";
  return `${days}${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function MemeCard({ meme, state }: { meme: MemeInfo; state: PoolState | undefined }) {
  const countdown = useCountdown(state ? nsToDate(state.next_draw_at).getTime() : undefined);
  const jackpot = state
    ? formatMeme((BigInt(state.emission_now) * BigInt(state.params.jackpot_bps)) / 10_000n, 0)
    : "…";
  return (
    <a
      href={appLink(`m/${meme.slug}`)}
      className="card flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-lime/40"
    >
      <div className="flex items-center gap-3">
        <MemeIcon icon={meme.icon} symbol={meme.symbol} slug={meme.slug} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{meme.name}</div>
          <div className="font-mono text-xs text-muted">${meme.symbol}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="kicker">Next draw</div>
          <div className={`font-mono tabular-nums ${countdown === "Due now" ? "text-lime" : ""}`}>
            {countdown}
          </div>
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
          <dd className="font-mono">{jackpot}</dd>
        </div>
      </dl>
      <div className="flex justify-between text-xs text-muted">
        <span>{state ? plural(state.depositors, "depositor") : "… depositors"}</span>
        <span>{state ? plural(state.draws, "draw") : "… draws"}</span>
      </div>
    </a>
  );
}
