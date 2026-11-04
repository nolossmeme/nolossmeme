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
      <section className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Memecoins you <span className="text-lime">can't lose on</span>.
          </h1>
          <p className="mt-4 text-lg text-muted max-w-xl">
            Deposit NEAR. Keep every yocto. Your deposit earns staking yield, and only that yield is
            turned into meme tokens and raffled off. Burn any token for its share of the treasury,
            so the floor never hits zero.
          </p>
          <div className="mt-6 flex gap-3">
            <a href="#memes" className="btn-primary">
              Pick a meme
            </a>
            <Link to="/launch" className="btn-secondary">
              Launch yours
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="NEAR locked"
            value={`${formatNear(tvl, 1)} Ⓝ`}
            hint="100% withdrawable"
          />
          <StatTile
            label="Treasury backing"
            value={`${formatNear(treasury, 3)} Ⓝ`}
            hint="from yield only"
            accent
          />
          <StatTile label="Memes" value={memes?.length ?? "…"} />
          <StatTile label="Draws so far" value={draws} />
        </div>
      </section>

      <section id="memes">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl font-semibold">Live memes</h2>
          <span className="text-xs text-muted">updates every 15s</span>
        </div>
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
