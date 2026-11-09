import { actions, parseMeme, parseNear, type ContractCall } from "@nolossmeme/sdk";

export type PositionTab = "deposit" | "withdraw" | "redeem" | "sponsor";

export interface PositionInput {
  pool: string;
  tab: PositionTab;
  amount: string;
  /** Withdraw as NEAR through liquid unstake instead of stNEAR. */
  asNear: boolean;
  principal: bigint;
  memeBalance: bigint;
  minDeposit: bigint;
  registered: boolean;
}

export interface PositionCall {
  call: ContractCall;
  label: string;
}

/** Slippage guard for liquid unstake: accept at least 97% of the principal in NEAR. */
const MIN_NEAR_BPS = 9_700n;

function depositCall(i: PositionInput): PositionCall | null {
  const yocto = parseNear(i.amount || "0");
  if (yocto < i.minDeposit) return null;
  return { call: actions.deposit(i.pool, yocto, i.registered), label: "Deposit" };
}

function withdrawCall(i: PositionInput): PositionCall {
  const requested = i.amount ? parseNear(i.amount) : undefined;
  const all = requested === undefined || requested >= i.principal;
  const amount = all ? undefined : requested;
  const value = amount ?? i.principal;
  const call = i.asNear
    ? actions.withdrawNear(i.pool, amount, (value * MIN_NEAR_BPS) / 10_000n)
    : actions.withdraw(i.pool, amount);
  return { call, label: "Withdraw" };
}

function sponsorCall(i: PositionInput): PositionCall | null {
  const yocto = parseNear(i.amount || "0");
  if (yocto < i.minDeposit) return null;
  return { call: actions.fundTreasury(i.pool, yocto), label: "Sponsor" };
}

function redeemCall(i: PositionInput): PositionCall | null {
  const requested = i.amount ? parseMeme(i.amount) : i.memeBalance;
  const yocto = requested > i.memeBalance ? i.memeBalance : requested;
  if (yocto <= 0n) return null;
  return { call: actions.redeem(i.pool, yocto), label: "Redeem" };
}

/** The transaction the position form sends for the active tab, or null when the input is not valid yet. */
export function buildPositionCall(i: PositionInput): PositionCall | null {
  switch (i.tab) {
    case "deposit":
      return depositCall(i);
    case "withdraw":
      return withdrawCall(i);
    case "sponsor":
      return sponsorCall(i);
    case "redeem":
      return redeemCall(i);
  }
}

/** Primary button text: wallet state first, then the tab name. */
export function submitLabel(pending: boolean, signedIn: boolean, tab: PositionTab): string {
  if (pending) return "Confirm in wallet…";
  if (!signedIn) return "Connect wallet";
  return tab[0]!.toUpperCase() + tab.slice(1);
}
