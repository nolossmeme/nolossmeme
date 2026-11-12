import { useQueries, useQuery } from "@tanstack/react-query";

import { Benefits } from "./components/Benefits";
import { CtaBand } from "./components/CtaBand";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { MemeCard } from "./components/MemeCard";
import { StatsStrip } from "./components/StatsStrip";
import { Steps } from "./components/Steps";
import { appLink, client } from "./lib/config";

export function App() {
  const { data: memes = [] } = useQuery({
    queryKey: ["memes"],
    queryFn: () => client.getAllMemes(),
    refetchInterval: 30_000,
  });
  const states = useQueries({
    queries: memes.map((m) => ({
      queryKey: ["pool", m.account_id],
      queryFn: () => client.getPoolState(m.account_id),
      refetchInterval: 30_000,
    })),
  });
  return (
    <>
      <Header />
      <main>
        <Hero />
        <StatsStrip memes={memes} states={states.map((s) => s.data)} />
        <Benefits />
        <section id="memes" className="mx-auto max-w-6xl px-4 pb-24 scroll-mt-24">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="kicker">Live on testnet</span>
              <h2 className="display mt-2 text-3xl sm:text-4xl">Pick a meme</h2>
            </div>
            <a href={appLink()} className="btn-secondary">
              All memes
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memes.slice(0, 3).map((m, i) => (
              <MemeCard key={m.slug} meme={m} state={states[i]?.data} />
            ))}
          </div>
        </section>
        <Steps />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
