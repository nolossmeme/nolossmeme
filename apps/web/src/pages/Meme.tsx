import { MemeIcon, NearAmount, UsdHint } from "@nolossmeme/ui";
import {
  STAKING_MIN_DEPOSIT,
  actions,
  bpsToPercent,
  formatDuration,
  formatMeme,
  formatNear,
  nsToDate,
  nsToSeconds,
  parseNear,
  plural,
  secondsUntilDraw,
  splitEmission,
  winChance,
  type AccountView,
  type PoolState,
} from "@nolossmeme/sdk";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ActivityFeed } from "../components/ActivityFeed";
import { AmountInput } from "../components/AmountInput";
import { Countdown } from "../components/Countdown";
import { DrawLog } from "../components/DrawLog";
import { FloorChart } from "../components/FloorChart";
import { Leaderboard } from "../components/Leaderboard";
import { SeriesChart } from "../components/SeriesChart";
import { CommunityStreak } from "../components/CommunityStreak";
import { StatTile } from "../components/StatTile";
import { useAccountActivity, usePoolActivity, usePoolSeries } from "../hooks/useIndexer";
import { useMeme } from "../hooks/useMemes";
import { useDepositors, useDraws, useMyPosition, usePending, usePoolState } from "../hooks/usePool";
import { explorerAccount } from "../lib/client";
import { faucetEnabled } from "../lib/faucet";
import { indexerEnabled } from "../lib/indexer";
import { buildPositionCall, submitLabel, type PositionTab } from "../lib/positionCall";
import { useTx } from "../lib/wallet";

export function MemePage() {
  const { slug } = useParams();
  const { data: meme, isLoading } = useMeme(slug);
  const pool = meme?.account_id;
  const { data: state } = usePoolState(pool);
  const { data: draws } = useDraws(pool, state?.draws);
  const { data: depositors } = useDepositors(pool);
  const tx = useTx();
  const { data: me } = useMyPosition(pool, tx.signedAccountId || undefined);
  const { data: activity } = usePoolActivity(pool);
  const { data: mine } = useAccountActivity(tx.signedAccountId || undefined);
  const myEvents = (mine ?? []).filter((e) => e.contract === pool);
  const { data: series } = usePoolSeries(pool);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!meme || !pool) return <p className="text-muted">Unknown meme.</p>;

  const split = state
    ? splitEmission(state.params, state.epoch_index, Math.max(state.checkins_this_epoch, 1))
    : null;
  const totalWeight = (depositors ?? []).reduce((acc, [, a]) => acc + BigInt(a.weight), 0n);
  const drawDue = state ? secondsUntilDraw(state) === 0 : false;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <MemeIcon icon={meme.icon} symbol={meme.symbol} slug={meme.slug} size={56} />
        <div>
          <h1 className="display text-3xl sm:text-4xl">
            {meme.name} <span className="text-muted font-mono text-xl">${meme.symbol}</span>
          </h1>
          <a
            className="text-xs text-muted hover:text-text font-mono break-all"
            href={explorerAccount(pool)}
            target="_blank"
            rel="noreferrer"
          >
            {pool}
          </a>
        </div>
        <div className="ml-auto w-full sm:w-auto card px-5 py-3 text-right">
          <div className="kicker">Next draw</div>
          <div className="text-2xl">
            <Countdown targetMs={state ? nsToDate(state.next_draw_at).getTime() : undefined} />
          </div>
          {state && drawDue && (
            <button
              className="btn-primary mt-2 w-full"
              disabled={tx.pending || state.in_flight > 0}
              onClick={() => void tx.send(actions.draw(pool), "Draw")}
            >
              Run the draw
            </button>
          )}
        </div>
      </header>

      {state && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="NEAR locked"
            value={<NearAmount yocto={state.total_principal} />}
            hint={
              <UsdHint
                yocto={state.total_principal}
                prefix={plural(state.depositors, "depositor")}
              />
            }
          />
          <StatTile
            label="Floor price"
            value={<NearAmount yocto={state.floor_price} digits={7} />}
            hint={
              <>
                <UsdHint yocto={state.floor_price} prefix={`per ${meme.symbol}`} />
                <br />
                {state.total_funded && BigInt(state.total_funded) > 0n
                  ? `treasury ${formatNear(state.treasury_near, 4)} NEAR · ${formatNear(state.total_funded, 2)} NEAR from sponsors`
                  : `treasury ${formatNear(state.treasury_near, 4)} NEAR`}
              </>
            }
            accent
          />
          <StatTile
            label="This epoch's jackpot"
            value={`${formatMeme(split?.jackpot ?? 0n, 0)} ${meme.symbol}`}
            hint={`${bpsToPercent(state.params.jackpot_bps)} of ${formatMeme(state.emission_now, 0)} minted`}
          />
          <StatTile
            label="Check-in reward"
            value={`${formatMeme(split?.perCheckin ?? 0n, 1)} ${meme.symbol}`}
            hint={`${state.checkins_this_epoch} checked in · every ${formatDuration(nsToSeconds(state.params.epoch_length_ns))}`}
          />
        </section>
      )}

      {state && <CommunityStreak state={state} />}

      <section className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        <PositionCard
          pool={pool}
          symbol={meme.symbol}
          state={state}
          me={me}
          totalWeight={totalWeight}
          tx={tx}
        />
        <div className="card p-5">
          <h2 className="font-semibold mb-3">
            {series && series.length >= 2 ? "Pool over time" : "Floor price over time"}
          </h2>
          {series && series.length >= 2 ? (
            <SeriesChart rows={series} />
          ) : (
            <FloorChart draws={draws ?? []} />
          )}
          <p className="mt-3 text-xs text-muted">
            Floor = treasury ÷ supply. The treasury only receives staking yield and sponsor funding,
            never principal, and every {meme.symbol} can be burned for its share.
          </p>
        </div>
      </section>

      {faucetEnabled && (
        <Link
          to="/faucet"
          className="card flex items-center justify-between gap-3 p-4 text-sm hover:border-lime/40"
        >
          <span>
            <span className="font-semibold">Need testnet NEAR?</span>{" "}
            <span className="text-muted">Claim 1 free NEAR a day from the faucet.</span>
          </span>
          <span className="text-lime">Open faucet →</span>
        </Link>
      )}

      {indexerEnabled && (
        <section className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
          <div className="card p-5">
            <h2 className="font-semibold mb-3">Your history here</h2>
            {tx.signedAccountId ? (
              <ActivityFeed events={myEvents} symbol={meme.symbol} />
            ) : (
              <p className="text-sm text-muted">
                Connect a wallet to see your deposits, check-ins and wins.
              </p>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-semibold mb-3">Pool activity</h2>
            <ActivityFeed events={activity ?? []} symbol={meme.symbol} />
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Draw log</h2>
        <DrawLog draws={draws ?? []} symbol={meme.symbol} />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Leaderboard</h2>
        <Leaderboard
          rows={depositors ?? []}
          symbol={meme.symbol}
          me={tx.signedAccountId || undefined}
        />
      </section>

      {state && <ParamsCard state={state} />}
    </div>
  );
}

type Tab = PositionTab;

function PositionCard({
  pool,
  symbol,
  state,
  me,
  totalWeight,
  tx,
}: {
  pool: string;
  symbol: string;
  state: PoolState | undefined;
  me: AccountView | undefined;
  totalWeight: bigint;
  tx: ReturnType<typeof useTx>;
}) {
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [asNear, setAsNear] = useState(false);
  const principal = BigInt(me?.principal ?? 0);
  const balance = BigInt(me?.meme_balance ?? 0);
  const odds = me ? winChance(BigInt(me.weight), totalWeight) : 0;
  const poolMin = BigInt(state?.params.min_deposit ?? 0);
  const minDeposit = poolMin > STAKING_MIN_DEPOSIT ? poolMin : STAKING_MIN_DEPOSIT;
  const canSponsor = state?.total_funded !== undefined;
  const { data: pending } = usePending(pool, tx.signedAccountId || undefined);

  const submit = async (): Promise<void> => {
    const next = buildPositionCall({
      pool,
      tab,
      amount,
      asNear,
      principal,
      memeBalance: balance,
      minDeposit,
      registered: me?.registered ?? false,
    });
    if (next && (await tx.send(next.call, next.label))) setAmount("");
  };

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your position</h2>
        {me && me.streak > 0 && <span className="text-sm">🔥 {me.streak} streak</span>}
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="kicker">Locked</dt>
          <dd className="font-mono">
            <NearAmount yocto={principal} digits={3} usd />
          </dd>
        </div>
        <div>
          <dt className="kicker">{symbol}</dt>
          <dd className="font-mono">{formatMeme(balance, 2)}</dd>
        </div>
        <div>
          <dt className="kicker">Odds now</dt>
          <dd className="font-mono text-lime">{(odds * 100).toFixed(2)}%</dd>
        </div>
      </dl>

      {pending !== undefined && pending > 0n && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 text-sm flex items-center justify-between gap-3">
          <span>
            <NearAmount yocto={pending} digits={4} /> from a NEAR withdrawal is waiting for you.
          </span>
          <button
            className="btn-accent"
            disabled={tx.pending}
            onClick={() => void tx.send(actions.claimPending(pool), "Claim")}
          >
            Claim
          </button>
        </div>
      )}

      <button
        className="btn-secondary"
        disabled={!me || principal === 0n || me.checked_in_this_epoch || tx.pending}
        onClick={() => void tx.send(actions.checkIn(pool), "Check-in")}
      >
        {me?.checked_in_this_epoch
          ? "Checked in for this epoch ✓"
          : "Daily check-in (+ticket boost, share of rewards)"}
      </button>

      <div className="flex gap-1 border-b border-border pb-2">
        {(["deposit", "withdraw", "redeem", ...(canSponsor ? ["sponsor"] : [])] as Tab[]).map(
          (t) => (
            <button
              key={t}
              className={`tab ${tab === t ? "tab-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </div>

      {tab === "deposit" && (
        <>
          <AmountInput value={amount} onChange={setAmount} unit="NEAR" />
          <p className="text-xs text-muted">
            Staked with Meta Pool. Withdraw any time at face value.
            {me &&
              !me.registered &&
              " First deposit adds a one-time 0.005 NEAR storage fee (refundable)."}
            {` Minimum ${formatNear(minDeposit, 2)} NEAR (Meta Pool's floor).`}
          </p>
        </>
      )}
      {tab === "withdraw" && (
        <>
          <AmountInput
            value={amount}
            onChange={setAmount}
            unit="NEAR"
            max={formatNear(principal, 6)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asNear} onChange={(e) => setAsNear(e.target.checked)} />
            Receive NEAR now (Meta Pool liquid unstake, small fee) instead of stNEAR
          </label>
          <p className="text-xs text-muted">
            Leave empty to withdraw everything. stNEAR is worth exactly your NEAR at today's price.
          </p>
        </>
      )}
      {tab === "sponsor" && (
        <>
          <AmountInput value={amount} onChange={setAmount} unit="NEAR" />
          <p className="text-xs text-muted">
            Stake NEAR straight into the treasury. It is not principal and cannot be withdrawn: it
            only raises the floor every {symbol} is redeemable at. Minimum{" "}
            {formatNear(minDeposit, 2)} NEAR.
          </p>
        </>
      )}
      {tab === "redeem" && (
        <>
          <AmountInput
            value={amount}
            onChange={setAmount}
            unit={symbol}
            max={formatMeme(balance, 6)}
          />
          <p className="text-xs text-muted">
            Burn {symbol} for its share of the treasury, paid in stNEAR at the floor price
            {state && ` (${formatNear(state.floor_price, 7)} NEAR each)`}.
          </p>
        </>
      )}
      <button
        className="btn-primary"
        disabled={
          tx.pending ||
          ((tab === "deposit" || tab === "sponsor") &&
            amount !== "" &&
            parseNear(amount || "0") < minDeposit)
        }
        onClick={() => void submit()}
      >
        {submitLabel(tx.pending, Boolean(tx.signedAccountId), tab)}
      </button>
    </div>
  );
}

function ParamsCard({ state }: { state: PoolState }) {
  const p = state.params;
  const rows: [string, string][] = [
    ["Epoch length", formatDuration(nsToSeconds(p.epoch_length_ns))],
    ["Initial emission", `${formatMeme(p.initial_emission, 0)} per epoch`],
    ["Halving", `every ${p.halving_every} epochs`],
    ["Jackpot share", bpsToPercent(p.jackpot_bps)],
    [
      "Streak bonus",
      `+${bpsToPercent(p.streak_step_bps)} per day, max ${bpsToPercent(p.max_streak_bonus_bps)}`,
    ],
    ["Min deposit", `${formatNear(p.min_deposit, 2)} NEAR`],
    ["Staking pool", p.staking_pool],
    ["Admin keys", "none, parameters frozen at launch"],
  ];
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Rules (on-chain, immutable)</h2>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1">
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
