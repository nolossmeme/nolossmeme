import { MemeIcon, NearAmount } from "@nolossmeme/ui";
import { actions, parseMeme, parseNear, validateSlug, type LaunchParams } from "@nolossmeme/sdk";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ProjectionChart } from "../components/ProjectionChart";
import { useLaunchCost, useMemes } from "../hooks/useMemes";
import { imageToIcon } from "../lib/icon";
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
  return signedIn ? "Launch" : "Connect wallet to launch";
}

/** The account name defaults to the ticker; Advanced can override it. */
const slugFromSymbol = (symbol: string) => symbol.toLowerCase().replace(/[^a-z0-9_-]/g, "");

export function LaunchPage() {
  const tx = useTx();
  const navigate = useNavigate();
  const { data: cost } = useLaunchCost();
  const { data: memes } = useMemes();
  const [iconError, setIconError] = useState<string | null>(null);
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
    checkinTarget: "3",
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
        checkin_target: Math.max(1, Math.floor(Number(form.checkinTarget) || 1)),
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

  const slug = form.slug || slugFromSymbol(form.symbol);
  const taken = memes?.some((m) => m.slug === slug) ?? false;
  const takenError = taken ? "already taken" : null;
  const slugError = slug ? (validateSlug(slug) ?? takenError) : null;
  const ready =
    params &&
    !slugError &&
    slug &&
    form.name &&
    form.symbol &&
    cost !== undefined &&
    params.jackpot_bps <= 10_000;

  const pickImage = async (file: File | undefined) => {
    setIconError(null);
    if (!file) return;
    try {
      set("icon")(await imageToIcon(file));
    } catch (e) {
      setIconError(e instanceof Error ? e.message : String(e));
    }
  };

  const launch = async () => {
    if (!ready || !params || cost === undefined) return;
    const ok = await tx.send(
      actions.createMeme(
        network.factory,
        {
          slug,
          name: form.name,
          symbol: form.symbol.toUpperCase(),
          icon: form.icon || null,
          params,
        },
        cost,
      ),
      "Launch",
    );
    if (ok) void navigate(`/m/${slug}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <form
        className="card flex flex-col gap-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void launch();
        }}
      >
        <div>
          <h1 className="display text-3xl sm:text-4xl">Launch a no-loss meme</h1>
          <p className="mt-2 text-sm text-muted">
            Picture, name, ticker. Holders deposit NEAR they can always withdraw; only the staking
            yield backs your token.
          </p>
        </div>

        <div className="flex items-center gap-5">
          <label
            htmlFor="image"
            className="group relative grid size-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-white/20 bg-white/[0.03] hover:border-lime/60"
          >
            {form.icon ? (
              <MemeIcon icon={form.icon} symbol={form.symbol || "?"} size={96} />
            ) : (
              <span className="text-center text-xs text-muted group-hover:text-text">+ image</span>
            )}
            <input
              id="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pickImage(e.target.files?.[0])}
            />
          </label>
          <div className="flex-1 text-sm text-muted">
            Square works best. It is shrunk to 96 px and stored on chain as the token icon.
            {iconError && <p className="mt-1 text-red">{iconError}</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
          <div>
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
          <div>
            <label className="label" htmlFor="symbol">
              Ticker
            </label>
            <input
              id="symbol"
              className="input"
              value={form.symbol}
              onChange={(e) => set("symbol")(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="PEPN"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">
          {slugError ? (
            <span className="text-red">
              {slug}: {slugError}
            </span>
          ) : (
            slugPreview(slug)
          )}
        </p>

        <button className="btn-accent py-3 text-base" type="submit" disabled={!ready || tx.pending}>
          {launchLabel(tx.pending, Boolean(tx.signedAccountId))}
          {cost !== undefined && (
            <span className="font-mono text-sm opacity-70">
              · <NearAmount yocto={cost} />
            </span>
          )}
        </button>
        <p className="-mt-2 text-center text-xs text-muted">
          The fee pays the new contract&apos;s storage. Rules are frozen at launch, even for you.
        </p>

        <details className="rounded-2xl border border-white/8 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced: mechanics (defaults are fine)
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="slug">
                Account name (defaults to the ticker)
              </label>
              <input
                id="slug"
                className="input"
                value={form.slug}
                onChange={(e) => set("slug")(e.target.value.toLowerCase())}
                placeholder={slugFromSymbol(form.symbol) || "pepn"}
              />
            </div>
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
              label="Minimum deposit (NEAR)"
              value={form.minDeposit}
              onChange={set("minDeposit")}
              hint="Meta Pool rejects stakes under 1 NEAR"
            />
            <Field
              id="target"
              label="Community check-in target"
              value={form.checkinTarget}
              onChange={set("checkinTarget")}
              hint="Accounts that must check in each epoch; miss it and the community share burns"
            />
          </div>
        </details>
      </form>

      <details className="card p-6">
        <summary className="cursor-pointer font-semibold">60-day projection</summary>
        <p className="mt-3 text-sm text-muted">
          Same math as the contract. Tweak the community assumptions to see how supply, treasury and
          floor move.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            id="tvl"
            label="TVL (NEAR)"
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
        <div className="mt-4">
          <ProjectionChart points={points} />
        </div>
        {points.length > 0 && (
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="kicker">Supply day 60</dt>
              <dd className="font-mono">
                {Number(points.at(-1)!.supply / 10n ** 18n).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="kicker">Treasury day 60</dt>
              <dd className="font-mono">
                <NearAmount yocto={points.at(-1)!.treasuryNear} />
              </dd>
            </div>
            <div>
              <dt className="kicker">Floor day 60</dt>
              <dd className="font-mono text-lime">
                <NearAmount yocto={points.at(-1)!.floor} digits={8} />
              </dd>
            </div>
          </dl>
        )}
      </details>
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
