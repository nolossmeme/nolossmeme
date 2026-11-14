/** Narration, one short line per scene. `pnpm voice` turns each into public/voice/<id>.mp3.
 *  `lead` is silence before the line (the visual sets it up); `tail` holds after it. */
export const SCENES = [
  { id: "hook", text: "Most memecoins go to zero.", lead: 3.0, tail: 1.4 },
  { id: "flip", text: "What if you couldn't lose? Meet NoLossMeme.", lead: 0.2, tail: 0.9 },
  { id: "deposit", text: "Deposit NEAR. It stays yours. Withdraw any time.", lead: 1.0, tail: 0.8 },
  { id: "yield", text: "Only the staking yield turns into meme tokens.", lead: 0.2, tail: 1.2 },
  {
    id: "checkin",
    text: "Check in every day. Hit the community target, and everyone who showed up gets paid.",
    lead: 0.3,
    tail: 2.0,
  },
  { id: "miss", text: "Miss it, and that share burns.", lead: 0.2, tail: 1.2 },
  { id: "live", text: "It's live on NEAR testnet. Every draw is on chain.", lead: 0.3, tail: 1.6 },
  { id: "launch", text: "Launch your own meme in one click.", lead: 1.4, tail: 1.6 },
  { id: "outro", text: "NoLossMeme. Memecoins you can't lose on.", lead: 0.3, tail: 2.2 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
