/** Narration, one entry per scene. `pnpm voice` turns each into public/voice/<id>.mp3. */
export const SCENES = [
  {
    id: "hook",
    text: "Most memecoins end the same way. You buy the top, and your money is gone. NoLossMeme flips that. It's a memecoin launchpad on NEAR where your deposit is never at risk.",
  },
  {
    id: "vault",
    text: "You deposit NEAR, and it's staked through Meta Pool. Your principal stays yours, withdrawable any time. Only the staking yield, plus sponsor funding, flows into a treasury that backs every meme token minted.",
  },
  {
    id: "streak",
    text: "Each pool is a streak coin. Depositors check in once per epoch. Hit the community target, and new tokens are minted: seventy percent to one raffle winner, weighted by streak, the rest shared by everyone who showed up. Miss it, and that share is burned and the streak resets.",
  },
  {
    id: "live",
    text: "Here's DOGN, live on testnet. A new holder grabs free testnet NEAR from the built-in faucet, deposits, and checks in. Two check-ins, target hit. Every step is a real transaction, picked up by our indexer in seconds.",
  },
  {
    id: "draw",
    text: "When the epoch ends, a keeper triggers the draw. Target hit: a thousand DOGN minted, the jackpot goes to one raffle winner, and both check-ins earn their share. That's draw number sixty-five, and every one is verifiable on NEAR Blocks.",
  },
  {
    id: "floor",
    text: "Because the treasury holds staked NEAR, every token has a floor price. Redeem it for stNEAR, or withdraw your deposit whenever you like.",
  },
  {
    id: "outro",
    text: "Anyone can launch their own streak coin from the factory in one transaction. NoLossMeme: memecoins you can't lose on. Try it at app dot nolossmeme dot fun.",
  },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
