import { NearAmount, UsdHint } from "@nolossmeme/ui";
import { nsToDate, type MemeInfo, type PoolState } from "@nolossmeme/sdk";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ActivityFeed } from "../components/ActivityFeed";
import { ListToolbar, NoMatch, Pager } from "../components/ListControls";
import { useList } from "../hooks/useList";
import { MemeCard } from "../components/MemeCard";
import { StatTile } from "../components/StatTile";
import { useRecentActivity } from "../hooks/useIndexer";
import { useMemes } from "../hooks/useMemes";
import { client } from "../lib/client";
import { indexerEnabled } from "../lib/indexer";
import { by } from "../lib/list";

interface Row {
  meme: MemeInfo;
  state: PoolState | undefined;
}
const locked = (r: Row) => BigInt(r.state?.total_principal ?? 0);
const nextDraw = (r: Row) =>
  r.state ? nsToDate(r.state.next_draw_at).getTime() : Number.MAX_SAFE_INTEGER;
const SPEC = {
  text: (r: Row) => `${r.meme.name} ${r.meme.symbol} ${r.meme.slug} ${r.meme.creator}`,
  filters: {
    All: () => true,
    "With depositors": (r: Row) => (r.state?.depositors ?? 0) > 0,
    "Draw due": (r: Row) => nextDraw(r) <= Date.now(),
  },
  sorts: {
    Newest: by((r: Row) => BigInt(r.meme.created_at), -1),
    "Most NEAR locked": by(locked, -1),
    "Most draws": by((r: Row) => r.state?.draws ?? 0, -1),
    "Next draw soonest": by(nextDraw),
    "Name A–Z": by((r: Row) => r.meme.name.toLowerCase()),
  },
  pageSize: 9,
};

export function HomePage() {
  const { data: memes, isLoading, error } = useMemes();
  const { data: recent } = useRecentActivity();
  const states = useQueries({
    queries: (memes ?? []).map((m) => ({
      queryKey: ["pool", m.account_id, "state"],
      queryFn: () => client.getPoolState(m.account_id),
    })),
  });
  const tvl = states.reduce((acc, s) => acc + BigInt(s.data?.total_principal ?? 0), 0n);
  const treasury = states.reduce((acc, s) => acc + BigInt(s.data?.treasury_near ?? 0), 0n);
  const draws = states.reduce((acc, s) => acc + (s.data?.draws ?? 0), 0);
  const ctl = useList(
    (memes ?? []).map((meme, i): Row => ({ meme, state: states[i]?.data })),
    SPEC,
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="kicker">Live memes</span>
          <h1 className="display mt-2 text-4xl sm:text-5xl">Pick a pool, keep your NEAR.</h1>
          <p className="mt-3 max-w-xl text-muted">
            Every pool stakes with Meta Pool and raffles only the yield. Deposits are withdrawable
            at face value at any time.
          </p>
        </div>
        <Link to="/launch" className="btn-accent">
          Launch yours
        </Link>
      </section>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="NEAR locked"
          value={<NearAmount yocto={tvl} digits={1} />}
          hint={<UsdHint yocto={tvl} prefix="100 % withdrawable" />}
        />
        <StatTile
          label="Treasury backing"
          value={<NearAmount yocto={treasury} digits={4} />}
          hint={<UsdHint yocto={treasury} prefix="from yield only" />}
          accent
        />
        <StatTile label="Memes" value={memes?.length ?? "…"} />
        <StatTile label="Draws so far" value={draws} />
      </section>
      <section>
        {isLoading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red">Could not reach the factory: {String(error)}</p>}
        {memes && memes.length > 0 && (
          <ListToolbar ctl={ctl} label="memes" placeholder="Name, ticker or creator" />
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ctl.rows.map((r) => (
            <MemeCard key={r.meme.slug} meme={r.meme} />
          ))}
        </div>
        {memes && memes.length > 0 && <NoMatch ctl={ctl} />}
        <Pager ctl={ctl} />
      </section>
      {indexerEnabled && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent activity</h2>
            <span className="text-xs text-muted">from the indexer</span>
          </div>
          <ActivityFeed events={recent ?? []} symbol="MEME" showPool />
        </section>
      )}
    </div>
  );
}
