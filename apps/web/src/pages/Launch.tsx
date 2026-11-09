import {
  actions,
  formatNear,
  parseMeme,
  parseNear,
  validateSlug,
  type LaunchParams,
} from "@nolossmeme/sdk";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ProjectionChart } from "../components/ProjectionChart";
import { useLaunchCost } from "../hooks/useMemes";
import { network } from "../lib/client";
import { project } from "../lib/projection";
import { useTx } from "../lib/wallet";

const EPOCHS = [
  { label: "1 hour (demo)", seconds: 3_600 },
  { label: "6 hours", seconds: 21_600 },
  { label: "1 day", seconds: 86_400 },
  { label: "1 week", seconds: 604_800 },
];

function slugPreview(slug: string): string {
  return slug ? `${slug}.${network.factory}` : " ";
}

function launchLabel(pending: boolean, signedIn: boolean): string {
  if (pending) return "Confirm in wallet…";
  return signedIn ? "Launch" : "Connect wallet";
}

export function LaunchPage() {
  const tx = useTx();
  const navigate = useNavigate();
  const { data: cost } = useLaunchCost();
  const [form, setForm] = useState({
    slug: "",
    name: "",
    symbol: "",
    icon: "",
    epochSeconds: 86_400,
    emission: "1000",
    halving: "30",
    jackpotPct: "70",
    streakStepPct: "10",
    maxStreakPct: "50",
    minDeposit: "1",
  });
  const [sim, setSim] = useState({ tvl: "1000", apy: "9", checkin: "50", depositors: "50" });
  const set = (k: keyof typeof form) => (v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const params: LaunchParams | null = useMemo(() => {
    try {
      return {
        epoch_length_ns: (BigInt(form.epochSeconds) * 1_000_000_000n).toString(),
        initial_emission: parseMeme(form.emission || "0").toString(),
        halving_every: Math.max(1, Number(form.halving) || 1),
        jackpot_bps: Math.round(Number(form.jackpotPct) * 100),
        streak_step_bps: Math.round(Number(form.streakStepPct) * 100),
        max_streak_bonus_bps: Math.round(Number(form.maxStreakPct) * 100),
        min_deposit: parseNear(form.minDeposit || "0").toString(),
      };
    } catch {
      return null;
    }
  }, [form]);

  const points = useMemo(
    () =>
      params
        ? project({
            params,
            tvlNear: Number(sim.tvl) || 0,
            apyBps: Math.round((Number(sim.apy) || 0) * 100),
            checkinRate: Math.min(1, (Number(sim.checkin) || 0) / 100),
            depositors: Number(sim.depositors) || 0,
            days: 60,
          })
        : [],
    [params, sim],
  );

  const slugError = form.slug ? validateSlug(form.slug) : null;
  const ready =
    params &&
    !slugError &&
    form.slug &&
    form.name &&
    form.symbol &&
    cost !== undefined &&
    params.jackpot_bps <= 10_000;

  const launch = async () => {
    if (!ready || !params || cost === undefined) return;
    const ok = await tx.send(
      actions.createMeme(
        network.factory,
        {
          slug: form.slug,
          name: form.name,
          symbol: form.symbol.toUpperCase(),
          icon: form.icon || null,
          params,
        },
        cost,
      ),
      "Launch",
    );
    if (ok) void navigate(`/m/${form.slug}`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8">
      <form
        className="card p-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void launch();
        }}
      >
        <h1 className="display text-2xl sm:text-3xl">Launch a no-loss meme</h1>
        <p className="text-sm text-muted">
          Parameters are written into the contract at launch and can never be changed, not even by
          you.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="slug">
              Slug (account name)
            </label>
            <input
              id="slug"
              className="input"
              value={form.slug}
              onChange={(e) => set("slug")(e.target.value.toLowerCase())}
              placeholder="pepn"
            />
            <p className="text-xs mt-1 text-muted">
              {slugError ? <span className="text-red">{slugError}</span> : slugPreview(form.slug)}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="symbol">
              Symbol
            </label>
            <input
              id="symbol"
              className="input"
              value={form.symbol}
              onChange={(e) => set("symbol")(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="PEPN"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Pepe of NEAR"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="icon">
              Icon (emoji or image URL, optional)
            </label>
            <input
              id="icon"
              className="input"
              value={form.icon}
              onChange={(e) => set("icon")(e.target.value)}
              placeholder="🐸"
            />
          </div>
        </div>

        <h2 className="font-semibold mt-2">Mechanics</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="epoch">
              Draw every
            </label>
            <select
              id="epoch"
              className="input"
              value={form.epochSeconds}
              onChange={(e) => set("epochSeconds")(Number(e.target.value))}
            >
              {EPOCHS.map((e) => (
                <option key={e.seconds} value={e.seconds}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            id="emission"
            label="Emission per draw (tokens)"
            value={form.emission}
            onChange={set("emission")}
          />
          <Field
            id="halving"
            label="Halve emission every N draws"
            value={form.halving}
            onChange={set("halving")}
          />
          <Field
            id="jackpot"
            label="Jackpot share (%)"
            value={form.jackpotPct}
            onChange={set("jackpotPct")}
            hint="rest is split among check-ins"
          />
          <Field
            id="streak"
            label="Streak boost per day (%)"
            value={form.streakStepPct}
            onChange={set("streakStepPct")}
          />
          <Field
            id="maxstreak"
            label="Max streak boost (%)"
            value={form.maxStreakPct}
            onChange={set("maxStreakPct")}
          />
          <Field
            id="mindep"
            label="Minimum deposit (Ⓝ)"
            value={form.minDeposit}
            onChange={set("minDeposit")}
            hint="Meta Pool rejects stakes under 1 Ⓝ"
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-muted">Launch cost (storage for the pool contract)</span>
          <span className="font-mono">{cost !== undefined ? `${formatNear(cost, 2)} Ⓝ` : "…"}</span>
        </div>
        <button className="btn-primary" type="submit" disabled={!ready || tx.pending}>
          {launchLabel(tx.pending, Boolean(tx.signedAccountId))}
        </button>
      </form>

      <div className="card p-6 flex flex-col gap-4">
        <h2 className="font-semibold">60-day projection</h2>
        <p className="text-sm text-muted">
          Same math as the contract. Tweak the community assumptions to see how supply, treasury and
          floor move.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field
            id="tvl"
            label="TVL (Ⓝ)"
            value={sim.tvl}
            onChange={(v) => setSim((s) => ({ ...s, tvl: v }))}
          />
          <Field
            id="apy"
            label="Staking APY (%)"
            value={sim.apy}
            onChange={(v) => setSim((s) => ({ ...s, apy: v }))}
          />
          <Field
            id="checkin"
            label="Check-in rate (%)"
            value={sim.checkin}
            onChange={(v) => setSim((s) => ({ ...s, checkin: v }))}
          />
          <Field
            id="deps"
            label="Depositors"
            value={sim.depositors}
            onChange={(v) => setSim((s) => ({ ...s, depositors: v }))}
          />
        </div>
        <ProjectionChart points={points} />
        {points.length > 0 && (
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="kicker">Supply day 60</dt>
              <dd className="font-mono">
                {Number(points.at(-1)!.supply / 10n ** 18n).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="kicker">Treasury day 60</dt>
              <dd className="font-mono">{formatNear(points.at(-1)!.treasuryNear, 2)} Ⓝ</dd>
            </div>
            <div>
              <dt className="kicker">Floor day 60</dt>
              <dd className="font-mono text-lime">{formatNear(points.at(-1)!.floor, 8)} Ⓝ</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
