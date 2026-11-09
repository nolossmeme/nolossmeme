/** Optional backend (services/backend). When `VITE_INDEXER_URL` is unset every hook is disabled and the app runs on contract views alone. */
export const INDEXER_URL = ((import.meta.env.VITE_INDEXER_URL as string | undefined) ?? "").replace(
  /\/$/,
  "",
);
export const indexerEnabled = INDEXER_URL.length > 0;

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
  id: string;
  blockHeight: number;
  blockTimestamp: number;
  txHash: string | null;
  receiptId: string;
  contract: string;
  kind: EventKind;
  account: string | null;
  amount: string | null;
  data: Record<string, unknown>;
}

export interface SnapshotRow {
  pool: string;
  taken_at: number;
  total_principal: string;
  treasury_near: string;
  total_supply: string;
  floor_price: string;
  depositors: number;
  draws: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${INDEXER_URL}${path}`);
  if (!res.ok) throw new Error(`indexer ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const indexer = {
  poolActivity: (pool: string, limit = 30) =>
    get<IndexedEvent[]>(`/pools/${pool}/activity?limit=${limit}`),
  series: (pool: string, hours = 24 * 7) =>
    get<SnapshotRow[]>(`/pools/${pool}/series?hours=${hours}`),
  recent: (limit = 20) => get<IndexedEvent[]>(`/activity?limit=${limit}`),
  account: (accountId: string, limit = 30) =>
    get<IndexedEvent[]>(`/accounts/${accountId}/activity?limit=${limit}`),
};
