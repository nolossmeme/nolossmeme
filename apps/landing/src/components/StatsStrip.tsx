import { NearAmount, UsdHint } from "@nolossmeme/ui";
import { plural, type MemeInfo, type PoolState } from "@nolossmeme/sdk";

export function StatsStrip({
  memes,
  states,
}: {
  memes: MemeInfo[];
  states: (PoolState | undefined)[];
}) {
  const tvl = states.reduce((a, s) => a + BigInt(s?.total_principal ?? 0), 0n);
  const treasury = states.reduce((a, s) => a + BigInt(s?.treasury_near ?? 0), 0n);
  const draws = states.reduce((a, s) => a + (s?.draws ?? 0), 0);
  const depositors = states.reduce((a, s) => a + (s?.depositors ?? 0), 0);
  const tiles = [
    {
      k: "NEAR locked",
      v: <NearAmount yocto={tvl} digits={1} />,
      hint: <UsdHint yocto={tvl} prefix="100 % withdrawable" />,
      accent: false,
    },
    {
      k: "Treasury backing",
      v: <NearAmount yocto={treasury} digits={4} />,
      hint: <UsdHint yocto={treasury} prefix="yield only, never principal" />,
      accent: true,
    },
    {
      k: "Live memes",
      v: memes.length.toString(),
      hint: plural(depositors, "depositor"),
      accent: false,
    },
    { k: "Draws settled", v: draws.toString(), hint: "on-chain, permissionless", accent: false },
  ];
  return (
    <section className="relative -mt-10 mx-auto max-w-6xl px-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.k} className="card glow-top p-5">
            <div className="kicker">{t.k}</div>
            <div className={`mt-2 font-mono text-2xl font-semibold ${t.accent ? "text-lime" : ""}`}>
              {t.v}
            </div>
            <div className="mt-1 text-xs text-muted">{t.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
