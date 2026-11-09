/**
 * Turn one Lake block into typed events for the accounts we watch.
 *
 * Pure and synchronous, so it is easy to test with recorded blocks. Sources, in order:
 * 1. `nolossmeme` NEP-297 events (contracts built after #43): one event per state change
 * 2. NEP-141 `EVENT_JSON:` logs (mint/burn/transfer on pools)
 * 3. Legacy pools only: callback return values (`on_draw_price` → Draw, `check_in` → streak) and
 *    plain log lines for vault movements
 */
import type { EventKind, IndexedEvent } from "./events.js";
import type { LakeBlock, LakeReceiptOutcome } from "./neardata.js";

export interface Watch {
  factory: string;
  pools: Set<string>;
}

type Push = (
  kind: EventKind,
  account: string | null,
  amount: string | null,
  data: Record<string, unknown>,
) => void;

interface ReceiptContext {
  contract: string;
  isPool: boolean;
  isFactory: boolean;
  ret: string | undefined;
  push: Push;
}

interface EventJson {
  standard: string;
  event: string;
  data: unknown[];
}

function decodeJson<T>(b64: string | undefined): T | undefined {
  if (!b64) return undefined;
  try {
    const text = Buffer.from(b64, "base64").toString("utf8");
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

function decodeEventJson(line: string): EventJson | null {
  try {
    return JSON.parse(line.slice("EVENT_JSON:".length)) as EventJson;
  } catch {
    return null;
  }
}

function methodName(r: LakeReceiptOutcome): string | null {
  const action = (
    r.receipt.receipt as { Action?: { actions: { FunctionCall?: { method_name: string } }[] } }
  ).Action;
  return action?.actions.find((a) => a.FunctionCall)?.FunctionCall?.method_name ?? null;
}

// ---- 1. nolossmeme events ---------------------------------------------------------------

const VAULT_EVENTS = new Set<EventKind>([
  "deposit",
  "deposit_refunded",
  "withdraw",
  "withdraw_near",
  "redeem",
  "fund",
]);

function handleNolossmeme(ev: EventJson, ctx: ReceiptContext): void {
  const d = (ev.data[0] ?? {}) as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = d[k];
    return typeof v === "string" ? v : null;
  };
  const kind = ev.event as EventKind;
  if (VAULT_EVENTS.has(kind)) {
    if (ctx.isPool)
      ctx.push(kind, str("account_id"), str("amount"), { shares: str("shares"), fee: str("fee") });
  } else if (kind === "check_in") {
    if (ctx.isPool)
      ctx.push("check_in", str("account_id"), null, {
        streak: d["streak"] ?? null,
        epoch: d["epoch"] ?? null,
      });
  } else if (kind === "draw") {
    if (ctx.isPool) ctx.push("draw", str("winner"), str("jackpot"), d);
  } else if (kind === "draw_aborted") {
    if (ctx.isPool) ctx.push("draw_aborted", null, null, { epoch: d["epoch"] ?? null });
  } else if (kind === "launch" && ctx.isFactory) {
    ctx.push("launch", str("creator"), null, {
      symbol: str("symbol"),
      pool: str("account_id"),
      slug: str("slug"),
      name: str("name"),
    });
  }
}

// ---- 2. NEP-141 -------------------------------------------------------------------------

function handleNep141(ev: EventJson, ctx: ReceiptContext): void {
  if (!ctx.isPool) return;
  for (const d of ev.data as Record<string, string | undefined>[]) {
    const memo = d["memo"] ?? null;
    if (ev.event === "ft_mint" || ev.event === "ft_burn") {
      ctx.push(ev.event, d["owner_id"] ?? null, d["amount"] ?? null, { memo });
    } else if (ev.event === "ft_transfer") {
      ctx.push("ft_transfer", d["old_owner_id"] ?? null, d["amount"] ?? null, {
        to: d["new_owner_id"] ?? null,
        memo,
      });
    }
  }
}

// ---- 3. legacy plain logs and return values ---------------------------------------------

interface LegacyRule {
  re: RegExp;
  factoryOnly?: boolean;
  emit: (m: RegExpExecArray, ctx: ReceiptContext) => void;
}

const LEGACY_RULES: LegacyRule[] = [
  {
    re: /^deposit (\d+) yoctoNEAR from (\S+) -> (\d+) stNEAR shares$/,
    emit: (m, c) => c.push("deposit", m[2]!, m[1]!, { shares: m[3] }),
  },
  {
    re: /^staking failed, refunding (\d+) to (\S+)$/,
    emit: (m, c) => c.push("deposit_refunded", m[2]!, m[1]!, {}),
  },
  {
    re: /^withdraw (\d+) yoctoNEAR as (\d+) stNEAR to (\S+)$/,
    emit: (m, c) => c.push("withdraw", m[3]!, m[1]!, { shares: m[2] }),
  },
  {
    re: /^withdraw_near (\d+) yoctoNEAR \(fee (\d+)\) to (\S+)$/,
    emit: (m, c) => c.push("withdraw_near", m[3]!, m[1]!, { fee: m[2] }),
  },
  {
    re: /^redeem (\d+) MEME -> (\d+) stNEAR to (\S+)$/,
    emit: (m, c) => c.push("redeem", m[3]!, m[1]!, { shares: m[2] }),
  },
  {
    re: /^price lookup failed, draw aborted/,
    emit: (_m, c) => c.push("draw_aborted", null, null, {}),
  },
  {
    re: /^launched (\S+) at (\S+) by (\S+)$/,
    factoryOnly: true,
    emit: (m, c) =>
      c.push("launch", m[3]!, null, {
        symbol: m[1],
        pool: m[2],
        info: decodeJson<Record<string, unknown>>(c.ret) ?? null,
      }),
  },
];

function handleLegacyLine(line: string, ctx: ReceiptContext): void {
  for (const rule of LEGACY_RULES) {
    if (rule.factoryOnly ? !ctx.isFactory : !ctx.isPool) continue;
    const m = rule.re.exec(line);
    if (m) {
      rule.emit(m, ctx);
      return;
    }
  }
}

function handleLegacyReturn(method: string | null, predecessor: string, ctx: ReceiptContext): void {
  if (!ctx.isPool) return;
  if (method === "check_in") {
    ctx.push("check_in", predecessor, null, { streak: decodeJson<number>(ctx.ret) ?? null });
  } else if (method === "on_draw_price") {
    const draw = decodeJson<Record<string, unknown> | null>(ctx.ret);
    if (draw)
      ctx.push(
        "draw",
        (draw["winner"] as string | null) ?? null,
        (draw["jackpot"] as string | undefined) ?? null,
        draw,
      );
  }
}

// ---- receipt and block ------------------------------------------------------------------

/** Returns true when the receipt carried a `nolossmeme` event (so legacy derivations are skipped). */
function parseLogs(logs: string[], ctx: ReceiptContext): boolean {
  let structured = false;
  for (const line of logs) {
    if (!line.startsWith("EVENT_JSON:")) {
      handleLegacyLine(line, ctx);
      continue;
    }
    const ev = decodeEventJson(line);
    if (ev?.standard === "nolossmeme") {
      handleNolossmeme(ev, ctx);
      structured = true;
    } else if (ev?.standard === "nep141") {
      handleNep141(ev, ctx);
    }
  }
  return structured;
}

function receiptToTxMap(block: LakeBlock): Map<string, string> {
  const map = new Map<string, string>();
  for (const shard of block.shards) {
    for (const tx of shard.chunk?.transactions ?? []) {
      for (const rid of tx.outcome.execution_outcome.outcome.receipt_ids)
        map.set(rid, tx.transaction.hash);
    }
  }
  return map;
}

function parseReceipt(
  r: LakeReceiptOutcome,
  watch: Watch,
  base: Omit<IndexedEvent, "id" | "kind" | "account" | "amount" | "data">,
  out: IndexedEvent[],
): void {
  const contract = r.receipt.receiver_id;
  let n = 0;
  const ctx: ReceiptContext = {
    contract,
    isPool: watch.pools.has(contract),
    isFactory: contract === watch.factory,
    ret: r.execution_outcome.outcome.status.SuccessValue,
    push: (kind, account, amount, data) =>
      out.push({ ...base, id: `${r.receipt.receipt_id}:${n++}`, kind, account, amount, data }),
  };
  const structured = parseLogs(r.execution_outcome.outcome.logs, ctx);
  if (!structured) handleLegacyReturn(methodName(r), r.receipt.predecessor_id, ctx);
}

export function parseBlock(block: LakeBlock, watch: Watch): IndexedEvent[] {
  const blockHeight = block.block.header.height;
  const blockTimestamp = Math.floor(block.block.header.timestamp / 1_000_000);
  const txOf = receiptToTxMap(block);
  const out: IndexedEvent[] = [];
  for (const shard of block.shards) {
    for (const r of shard.receipt_execution_outcomes) {
      const contract = r.receipt.receiver_id;
      if (!watch.pools.has(contract) && contract !== watch.factory) continue;
      if (r.execution_outcome.outcome.status.Failure) continue;
      const receiptId = r.receipt.receipt_id;
      parseReceipt(
        r,
        watch,
        { blockHeight, blockTimestamp, txHash: txOf.get(receiptId) ?? null, receiptId, contract },
        out,
      );
    }
  }
  return out;
}

/** Pools newly launched in this block, so the scanner can start watching them immediately. */
export function launchedPools(events: IndexedEvent[]): string[] {
  return events.filter((e) => e.kind === "launch").map((e) => String(e.data["pool"]));
}
