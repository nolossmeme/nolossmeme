import { Link } from "react-router-dom";

import { FaucetCard } from "../components/FaucetCard";
import { faucetEnabled } from "../lib/faucet";
import { useTx } from "../lib/wallet";

const STEPS = [
  ["Connect", "Connect a NEAR testnet wallet with the button at the top."],
  ["Verify", "Pass the Cloudflare check so the faucet knows you are human."],
  ["Claim", "Get 1 testnet NEAR, once per account every 24 hours."],
  ["Deposit", "Open a pool, deposit 1 NEAR and check in to join the next draw."],
];

export function FaucetPage() {
  const tx = useTx();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section>
        <span className="kicker">Testnet faucet</span>
        <h1 className="display mt-2 text-4xl sm:text-5xl">Free NEAR to try it out</h1>
        <p className="mt-3 text-muted">
          Testnet NEAR has no value. It lets you deposit, check in and win a draw without risking
          anything real.
        </p>
      </section>
      {faucetEnabled ? (
        <FaucetCard accountId={tx.signedAccountId || undefined} />
      ) : (
        <p className="card p-5 text-sm text-muted">The faucet is not configured on this build.</p>
      )}
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="card p-5">
            <span className="font-mono text-sm text-lime">0{i + 1}</span>
            <h2 className="mt-1 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>
      <Link to="/" className="btn-primary self-start">
        Pick a pool →
      </Link>
    </div>
  );
}
