import { formatMeme, formatNear, shortAccount, winChance, type AccountView } from "@nolossmeme/sdk";

import { explorerAccount } from "../lib/client";

export function Leaderboard({
  rows,
  symbol,
  me,
}: {
  rows: [string, AccountView][];
  symbol: string;
  me?: string;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">Nobody has deposited yet. Be first.</p>;
  const totalWeight = rows.reduce((acc, [, a]) => acc + BigInt(a.weight), 0n);
  const sorted = [...rows].sort((a, b) =>
    BigInt(b[1].principal) > BigInt(a[1].principal) ? 1 : -1,
  );
  return (
    <table className="w-full text-sm">
      <thead className="kicker text-left">
        <tr>
          <th className="py-2 pr-3">Depositor</th>
          <th className="py-2 pr-3">Locked</th>
          <th className="py-2 pr-3">Streak</th>
          <th className="py-2 pr-3">Odds</th>
          <th className="py-2 pr-3">Won</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {sorted.map(([id, a]) => (
          <tr key={id} className={`border-t border-border ${id === me ? "text-lime" : ""}`}>
            <td className="py-2 pr-3">
              <a
                className="hover:underline"
                href={explorerAccount(id)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAccount(id, 24)}
              </a>
            </td>
            <td className="py-2 pr-3">{formatNear(a.principal, 2)} Ⓝ</td>
            <td className="py-2 pr-3">
              {a.streak > 0 ? `🔥 ${a.streak}` : "—"}
              {a.checked_in_this_epoch && <span className="text-muted"> ✓</span>}
            </td>
            <td className="py-2 pr-3">
              {(winChance(BigInt(a.weight), totalWeight) * 100).toFixed(1)}%
            </td>
            <td className="py-2 pr-3">
              {formatMeme(a.total_won, 0)} {symbol}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
