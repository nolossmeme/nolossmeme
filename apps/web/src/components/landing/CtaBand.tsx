import { Link } from "react-router-dom";

/** Fundora-style spotlight band: soft beams from the top edge over a faint grid, retuned to lime. */
const beams = [
  "left-[8%] rotate-[33deg]",
  "left-[22%] rotate-[30deg]",
  "left-[44%] -rotate-[6deg]",
  "left-[52%] rotate-[8deg]",
  "left-[60%] rotate-[12deg]",
  "right-[18%] -rotate-[24deg]",
  "right-[6%] -rotate-[30deg]",
];

export function CtaBand() {
  return (
    <section className="relative isolate overflow-hidden rounded-[2.5rem] mx-4 lg:mx-auto max-w-6xl my-12 border border-white/8 bg-[#010101]">
      <div
        className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(60%_70%_at_50%_40%,#000,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "94px 94px",
        }}
        aria-hidden
      />
      {beams.map((b) => (
        <div
          key={b}
          className={`absolute -top-24 h-[140%] w-24 ${b} bg-gradient-to-b from-lime/35 to-transparent blur-2xl`}
          aria-hidden
        />
      ))}
      <div className="relative px-6 py-20 sm:py-28 text-center">
        <span className="pill">✦ Launch in one transaction</span>
        <h2 className="display gradient-lime mt-6 text-3xl sm:text-5xl">
          Launch your own no-loss meme
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Pick the epoch, emission, halving and jackpot split. The factory deploys an immutable pool
          at <span className="font-mono text-text">yourslug.factory.nolossmeme.testnet</span>, no
          admin keys included.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/launch" className="btn-accent">
            Create a meme
          </Link>
          <a
            className="btn-secondary"
            href="https://github.com/nolossmeme/nolossmeme#for-judges-do-x-see-y"
            target="_blank"
            rel="noreferrer"
          >
            Read the contracts
          </a>
        </div>
      </div>
    </section>
  );
}
