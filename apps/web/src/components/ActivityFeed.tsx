import { formatMeme, formatNear, shortAccount } from "@nolossmeme/sdk";

import { explorerAccount, explorerTx } from "../lib/client";
import type { IndexedEvent } from "../lib/indexer";

const LABEL: Record<IndexedEvent["kind"], string> = {
  launch: "launched a meme",
  deposit: "deposited",
  deposit_refunded: "deposit refunded (below staking minimum)",
  withdraw: "withdrew (stNEAR)",
  withdraw_near: "withdrew (NEAR)",
  check_in: "checked in",
  draw: "won the jackpot",
  draw_aborted: "draw aborted, retrying",
  redeem: "redeemed",
  ft_mint: "received",
  ft_burn: "burned",
  ft_transfer: "transferred",
};

const ICON: Record<IndexedEvent["kind"], string> = {
  launch: "🚀",
  deposit: "⬇️",
  deposit_refunded: "↩️",
  withdraw: "⬆️",
  withdraw_near: "⬆️",
  check_in: "🔥",
  draw: "🎰",
  draw_aborted: "⚠️",
  redeem: "🔥",
  ft_mint: "✨",
  ft_burn: "🔥",
  ft_transfer: "➡️",
};

function amount(e: IndexedEvent, symbol: string): string {
  if (!e.amount) return "";
  if (["deposit", "deposit_refunded", "withdraw", "withdraw_near"].includes(e.kind))
    return `${formatNear(e.amount, 3)} Ⓝ`;
  return `${formatMeme(e.amount, 1)} ${symbol}`;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

export function ActivityFeed({
  events,
  symbol,
  showPool = false,
}: {
  events: IndexedEvent[];
  symbol: string;
  showPool?: boolean;
}) {
  if (events.length === 0) return <p className="text-sm text-muted">No activity indexed yet.</p>;
  return (
    <ol className="divide-y divide-white/6">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.05]"
            aria-hidden
          >
            {ICON[e.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate">
              {e.account ? (
                <a
                  className="font-mono hover:text-lime"
                  href={explorerAccount(e.account)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAccount(e.account, 22)}
                </a>
              ) : (
                <span className="text-muted">pool</span>
              )}{" "}
              <span className="text-muted">{LABEL[e.kind]}</span>{" "}
              <span className="font-mono">{amount(e, symbol)}</span>
              {e.kind === "check_in" && typeof e.data["streak"] === "number" && (
                <span className="text-muted"> · streak {e.data["streak"]}</span>
              )}
              {e.kind === "draw" && (
                <span className="text-muted"> · epoch #{String(e.data["epoch"])}</span>
              )}
            </div>
            <div className="text-xs text-muted">
              {showPool && <span className="font-mono">{e.contract.split(".")[0]} · </span>}
              {ago(e.blockTimestamp)}
              {e.txHash && (
                <>
                  {" · "}
                  <a
                    className="hover:text-text"
                    href={explorerTx(e.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx
                  </a>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
