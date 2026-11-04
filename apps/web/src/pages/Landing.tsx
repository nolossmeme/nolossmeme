import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { MemeCard } from "../components/MemeCard";
import { Benefits } from "../components/landing/Benefits";
import { CtaBand } from "../components/landing/CtaBand";
import { Hero } from "../components/landing/Hero";
import { LandingFooter } from "../components/landing/LandingFooter";
import { StatsStrip } from "../components/landing/StatsStrip";
import { Steps } from "../components/landing/Steps";
import { useMemes } from "../hooks/useMemes";
import { client } from "../lib/client";

export function LandingPage() {
  const { data: memes = [] } = useMemes();
  const states = useQueries({
    queries: memes.map((m) => ({
      queryKey: ["pool", m.account_id, "state"],
      queryFn: () => client.getPoolState(m.account_id),
    })),
  });
  return (
    <>
      <Hero />
      <StatsStrip memes={memes} states={states.map((s) => s.data)} />
      <Benefits />
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <span className="kicker">Live on testnet</span>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Pick a meme</h2>
          </div>
          <Link to="/memes" className="btn-secondary">
            All memes
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memes.slice(0, 3).map((m) => (
            <MemeCard key={m.slug} meme={m} />
          ))}
        </div>
      </section>
      <Steps />
      <CtaBand />
      <LandingFooter />
    </>
  );
}
