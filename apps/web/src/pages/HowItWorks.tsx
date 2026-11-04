const steps = [
  [
    "Deposit NEAR",
    "Your NEAR is staked with Meta Pool as stNEAR inside the pool contract. Your principal is recorded at face value.",
  ],
  [
    "Earn tickets",
    "Every second your deposit sits in the pool it earns ticket weight. A daily check-in builds a streak that boosts it.",
  ],
  [
    "Yield becomes the prize",
    "At the end of each epoch anyone can run the draw. The staking yield since last time is swept into the token treasury.",
  ],
  [
    "Meme is minted",
    "A fixed, halving emission of the meme token is minted: most of it to one weighted-random winner, the rest split among everyone who checked in.",
  ],
  [
    "Floor, not zero",
    "Any token can be burned for its share of the treasury. Since the treasury only grows from yield, the floor can never reach zero.",
  ],
  [
    "Leave whenever",
    "Withdraw your principal any time as stNEAR (no fee) or as NEAR through Meta Pool's liquid unstake. Nothing you deposited is ever at risk.",
  ],
];

const limits = [
  "Randomness comes from the block producer's seed mixed with epoch data. A validator could predict a draw it produces. A commit-reveal or VRF is the upgrade path.",
  "The draw settles every depositor in one call, which comfortably handles hundreds of accounts, not tens of thousands.",
  "Withdrawing straight to NEAR depends on Meta Pool's liquidity pool and pays its swap fee. Withdrawing as stNEAR always works and is fee-free.",
  "Pools have no admin. Parameters are fixed at launch. Bugs cannot be patched in place; a new pool would have to be launched.",
];

export function HowItWorksPage() {
  return (
    <div className="max-w-3xl flex flex-col gap-10">
      <section>
        <h1 className="display text-3xl sm:text-4xl">How it works</h1>
        <p className="mt-3 text-muted">
          PoolTogether-style prize savings, pointed at memecoins. The joke has rules, and the rules
          live in the contract.
        </p>
      </section>
      <ol className="grid sm:grid-cols-2 gap-4">
        {steps.map(([title, body], i) => (
          <li key={title} className="card p-5">
            <div className="text-lime font-mono text-sm">0{i + 1}</div>
            <h2 className="font-semibold mt-1">{title}</h2>
            <p className="text-sm text-muted mt-2">{body}</p>
          </li>
        ))}
      </ol>
      <section className="card p-5">
        <h2 className="font-semibold">Known limits</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted flex flex-col gap-2">
          {limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
