import { formatNear } from "@nolossmeme/sdk";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { MemeCard } from "../components/MemeCard";
import { StatTile } from "../components/StatTile";
import { useMemes } from "../hooks/useMemes";
import { client } from "../lib/client";

export function HomePage() {
  const { data: memes, isLoading, error } = useMemes();
  const states = useQueries({
    queries: (memes ?? []).map((m) => ({
      queryKey: ["pool", m.account_id, "state"],
      queryFn: () => client.getPoolState(m.account_id),
    })),
  });
  const tvl = states.reduce((acc, s) => acc + BigInt(s.data?.total_principal ?? 0), 0n);
  const treasury = states.reduce((acc, s) => acc + BigInt(s.data?.treasury_near ?? 0), 0n);
  const draws = states.reduce((acc, s) => acc + (s.data?.draws ?? 0), 0);

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
        <StatTile label="NEAR locked" value={`${formatNear(tvl, 1)} Ⓝ`} hint="100 % withdrawable" />
        <StatTile
          label="Treasury backing"
          value={`${formatNear(treasury, 4)} Ⓝ`}
          hint="from yield only"
          accent
        />
        <StatTile label="Memes" value={memes?.length ?? "…"} />
        <StatTile label="Draws so far" value={draws} />
      </section>
      <section>
        {isLoading && <p className="text-muted">Loading…</p>}
        {error && <p className="text-red">Could not reach the factory: {String(error)}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memes?.map((m) => (
            <MemeCard key={m.slug} meme={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
