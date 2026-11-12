import { NearAmount } from "@nolossmeme/ui";
import { formatMeme, nsToDate, shortAccount, type Draw } from "@nolossmeme/sdk";

import { explorerAccount } from "../lib/client";
import { by } from "../lib/list";
import { useList } from "../hooks/useList";
import { ListToolbar, NoMatch, Pager } from "./ListControls";

const SPEC = {
  text: (d: Draw) => `${d.epoch} ${d.winner ?? ""}`,
  filters: {
    All: () => true,
    "Target hit": (d: Draw) => d.target_hit === true,
    Missed: (d: Draw) => d.target_hit === false,
  },
  sorts: {
    Newest: by((d: Draw) => d.epoch, -1),
    Oldest: by((d: Draw) => d.epoch),
    "Biggest jackpot": by((d: Draw) => BigInt(d.jackpot), -1),
  },
  pageSize: 10,
};

export function DrawLog({ draws, symbol }: { draws: Draw[]; symbol: string }) {
  const ctl = useList(draws, SPEC);
  if (draws.length === 0) {
    return (
      <p className="text-sm text-muted">
        No draws yet. The first one can be called once the epoch ends.
      </p>
    );
  }
  return (
    <div>
      <ListToolbar ctl={ctl} label="draws" placeholder="Epoch or winner" />
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
            {ctl.rows.map((d) => (
              <tr key={d.epoch} className="border-t border-border">
                <td className="py-2 pr-3">#{d.epoch}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {nsToDate(d.timestamp).toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  <NearAmount yocto={d.yield_near} digits={5} />
                </td>
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
                  {d.checkins > 0 && d.target_hit !== false && (
                    <span className="text-muted"> × {formatMeme(d.checkin_reward_each, 1)}</span>
                  )}
                  {d.target_hit === false && d.burned && BigInt(d.burned) > 0n && (
                    <span className="text-red"> 🔥 {formatMeme(d.burned, 0)} burned</span>
                  )}
                  {d.target_hit && (
                    <span className="text-muted"> · streak {d.community_streak}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <NearAmount yocto={d.floor_after} digits={6} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NoMatch ctl={ctl} />
      <Pager ctl={ctl} />
    </div>
  );
}
