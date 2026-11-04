/**
 * Turn one Lake block into typed events for the accounts we watch.
 *
 * Pure and synchronous, so it is easy to test with recorded blocks. Sources, in order:
 * 1. NEP-297 `EVENT_JSON:` logs (NEP-141 mint/burn/transfer on pools)
 * 2. Return values of callbacks (`on_draw_price` → Draw, `on_meme_created` → MemeInfo, `check_in` → streak)
 * 3. Plain contract logs for vault movements (until the contracts emit their own NEP-297 events)
 */
import type { IndexedEvent } from "./events.js";
import type { LakeBlock, LakeReceiptOutcome } from "./neardata.js";

export interface Watch {
  factory: string;
  pools: Set<string>;
}

const RE = {
  deposit: /^deposit (\d+) yoctoNEAR from (\S+) -> (\d+) stNEAR shares$/,
  refund: /^staking failed, refunding (\d+) to (\S+)$/,
  withdraw: /^withdraw (\d+) yoctoNEAR as (\d+) stNEAR to (\S+)$/,
  withdrawNear: /^withdraw_near (\d+) yoctoNEAR \(fee (\d+)\) to (\S+)$/,
  redeem: /^redeem (\d+) MEME -> (\d+) stNEAR to (\S+)$/,
  launched: /^launched (\S+) at (\S+) by (\S+)$/,
  drawAborted: /^price lookup failed, draw aborted/,
};

function decodeJson<T>(b64: string | undefined): T | undefined {
  if (!b64) return undefined;
  try {
    const text = Buffer.from(b64, "base64").toString("utf8");
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

function functionCall(
  r: LakeReceiptOutcome,
): { method: string; args: Record<string, unknown>; signer: string } | null {
  const action = (
    r.receipt.receipt as {
      Action?: {
        signer_id: string;
        actions: { FunctionCall?: { method_name: string; args: string } }[];
      };
    }
  ).Action;
  const fc = action?.actions.find((a) => a.FunctionCall)?.FunctionCall;
  if (!action || !fc) return null;
  return {
    method: fc.method_name,
    args: decodeJson<Record<string, unknown>>(fc.args) ?? {},
    signer: action.signer_id,
  };
}

export function parseBlock(block: LakeBlock, watch: Watch): IndexedEvent[] {
  const height = block.block.header.height;
  const timestamp = Math.floor(block.block.header.timestamp / 1_000_000);
  const receiptToTx = new Map<string, string>();
  for (const shard of block.shards) {
    for (const tx of shard.chunk?.transactions ?? []) {
      for (const rid of tx.outcome.execution_outcome.outcome.receipt_ids)
        receiptToTx.set(rid, tx.transaction.hash);
    }
  }
  const out: IndexedEvent[] = [];
  for (const shard of block.shards) {
    for (const r of shard.receipt_execution_outcomes) {
      const contract = r.receipt.receiver_id;
      const isPool = watch.pools.has(contract);
      if (!isPool && contract !== watch.factory) continue;
      if (r.execution_outcome.outcome.status.Failure) continue;
      const base = {
        blockHeight: height,
        blockTimestamp: timestamp,
        txHash: receiptToTx.get(r.receipt.receipt_id) ?? null,
        receiptId: r.receipt.receipt_id,
        contract,
      };
      let n = 0;
      const push = (
        kind: IndexedEvent["kind"],
        account: string | null,
        amount: string | null,
        data: Record<string, unknown>,
      ) => out.push({ ...base, id: `${r.receipt.receipt_id}:${n++}`, kind, account, amount, data });

      const call = functionCall(r);
      const logs = r.execution_outcome.outcome.logs;
      const ret = r.execution_outcome.outcome.status.SuccessValue;

      for (const line of logs) {
        if (line.startsWith("EVENT_JSON:")) {
          const ev = decodeEventJson(line);
          if (ev && ev.standard === "nep141" && isPool) {
            for (const d of ev.data as Record<string, string>[]) {
              if (ev.event === "ft_mint")
                push("ft_mint", d["owner_id"] ?? null, d["amount"] ?? null, {
                  memo: d["memo"] ?? null,
                });
              else if (ev.event === "ft_burn")
                push("ft_burn", d["owner_id"] ?? null, d["amount"] ?? null, {
                  memo: d["memo"] ?? null,
                });
              else if (ev.event === "ft_transfer")
                push("ft_transfer", d["old_owner_id"] ?? null, d["amount"] ?? null, {
                  to: d["new_owner_id"] ?? null,
                  memo: d["memo"] ?? null,
                });
            }
          }
          continue;
        }
        let m: RegExpMatchArray | null;
        if (isPool && (m = line.match(RE.deposit))) push("deposit", m[2]!, m[1]!, { shares: m[3] });
        else if (isPool && (m = line.match(RE.refund))) push("deposit_refunded", m[2]!, m[1]!, {});
        else if (isPool && (m = line.match(RE.withdraw)))
          push("withdraw", m[3]!, m[1]!, { shares: m[2] });
        else if (isPool && (m = line.match(RE.withdrawNear)))
          push("withdraw_near", m[3]!, m[1]!, { fee: m[2] });
        else if (isPool && (m = line.match(RE.redeem)))
          push("redeem", m[3]!, m[1]!, { shares: m[2] });
        else if (isPool && RE.drawAborted.test(line)) push("draw_aborted", null, null, {});
        else if (contract === watch.factory && (m = line.match(RE.launched))) {
          const info = decodeJson<Record<string, unknown>>(ret);
          push("launch", m[3]!, null, { symbol: m[1], pool: m[2], info: info ?? null });
        }
      }

      if (isPool && call?.method === "check_in") {
        const streak = decodeJson<number>(ret);
        push("check_in", r.receipt.predecessor_id, null, { streak: streak ?? null });
      }
      if (isPool && call?.method === "on_draw_price") {
        const draw = decodeJson<Record<string, unknown> | null>(ret);
        if (draw)
          push(
            "draw",
            (draw["winner"] as string | null) ?? null,
            (draw["jackpot"] as string) ?? null,
            draw,
          );
      }
    }
  }
  return out;
}

function decodeEventJson(
  line: string,
): { standard: string; event: string; data: unknown[] } | null {
  try {
    return JSON.parse(line.slice("EVENT_JSON:".length)) as {
      standard: string;
      event: string;
      data: unknown[];
    };
  } catch {
    return null;
  }
}

/** Pools newly launched in this block, so the scanner can start watching them immediately. */
export function launchedPools(events: IndexedEvent[]): string[] {
  return events.filter((e) => e.kind === "launch").map((e) => String(e.data["pool"]));
}
