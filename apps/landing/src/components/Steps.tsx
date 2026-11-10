const steps = [
  [
    "01",
    "Deposit",
    "NEAR goes to Meta Pool as stNEAR inside the pool. Your principal is recorded 1:1.",
  ],
  [
    "02",
    "Earn tickets",
    "Every second of deposit adds weight. A daily check-in builds a streak that boosts it, up to the cap.",
  ],
  [
    "03",
    "Draw",
    "When the epoch ends anyone calls draw. Yield since last time is swept into the treasury.",
  ],
  [
    "04",
    "Mint",
    "A fixed, halving emission is minted: most to one weighted-random winner, the rest to everyone who checked in.",
  ],
  [
    "05",
    "Hit the target",
    "The community needs enough check-ins each epoch. Hit it and the streak grows; miss it and the community share burns and the streak resets.",
  ],
  [
    "06",
    "Redeem or ride",
    "Burn tokens for treasury stNEAR at the floor, or hold the meme and let the floor climb.",
  ],
];

export function Steps() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 pb-24 scroll-mt-24">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
        <div className="lg:sticky lg:top-28">
          <span className="kicker">One epoch, start to finish</span>
          <h2 className="display mt-3 text-3xl sm:text-5xl">
            PoolTogether energy, memecoin mechanics.
          </h2>
          <p className="mt-4 text-muted">
            Prize savings proved people will lock capital for a chance at the pot. We point that at
            the one thing memecoins never had: a backed floor.
          </p>
        </div>
        <ol className="grid gap-3">
          {steps.map(([n, t, d]) => (
            <li key={n} className="card p-5 sm:p-6 flex gap-5">
              <span className="font-mono text-lime text-sm pt-1">{n}</span>
              <div>
                <h3 className="font-medium">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
