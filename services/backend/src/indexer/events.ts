/** Typed events the indexer derives from receipts on the factory and the pools. */
export type EventKind =
  | "launch"
  | "deposit"
  | "deposit_refunded"
  | "withdraw"
  | "withdraw_near"
  | "check_in"
  | "draw"
  | "draw_aborted"
  | "redeem"
  | "fund"
  | "ft_mint"
  | "ft_burn"
  | "ft_transfer";

export interface IndexedEvent {
  /** `${receiptId}:${n}` so re-indexing a block is idempotent. */
  id: string;
  blockHeight: number;
  blockTimestamp: number;
  txHash: string | null;
  receiptId: string;
  contract: string;
  kind: EventKind;
  /** The user the event is about (depositor, winner, creator...). */
  account: string | null;
  /** Primary amount in yocto units (NEAR for vault events, MEME for token events). */
  amount: string | null;
  data: Record<string, unknown>;
}
