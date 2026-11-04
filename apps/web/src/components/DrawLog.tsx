import { formatMeme, formatNear, nsToDate, shortAccount, type Draw } from "@nolossmeme/sdk";

import { explorerAccount } from "../lib/client";

export function DrawLog({ draws, symbol }: { draws: Draw[]; symbol: string }) {
  if (draws.length === 0) {
    return (
      <p className="text-sm text-muted">
        No draws yet. The first one can be called once the epoch ends.
      </p>
    );
  }
  const rows = [...draws].reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="kicker text-left">
          <tr>
            <th className="py-2 pr-3">Epoch</th>
            <th className="py-2 pr-3">When</th>
            <th className="py-2 pr-3">Yield swept</th>
            <th className="py-2 pr-3">Winner</th>
            <th className="py-2 pr-3">Jackpot</th>
            <th className="py-2 pr-3">Check-ins</th>
            <th className="py-2 pr-3">Floor after</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((d) => (
            <tr key={d.epoch} className="border-t border-border">
              <td className="py-2 pr-3">#{d.epoch}</td>
              <td className="py-2 pr-3 text-muted whitespace-nowrap">
                {nsToDate(d.timestamp).toLocaleString()}
              </td>
              <td className="py-2 pr-3">{formatNear(d.yield_near, 5)} Ⓝ</td>
              <td className="py-2 pr-3">
                {d.winner ? (
                  <a
                    className="text-lime hover:underline"
                    href={explorerAccount(d.winner)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAccount(d.winner, 22)}
                  </a>
                ) : (
                  <span className="text-muted">no tickets</span>
                )}
              </td>
              <td className="py-2 pr-3">
                {formatMeme(d.jackpot, 0)} {symbol}
              </td>
              <td className="py-2 pr-3">
                {d.checkins}
                {d.checkins > 0 && (
                  <span className="text-muted"> × {formatMeme(d.checkin_reward_each, 1)}</span>
                )}
              </td>
              <td className="py-2 pr-3">{formatNear(d.floor_after, 6)} Ⓝ</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
