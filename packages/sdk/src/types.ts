/**
 * Wire types returned by the contracts. All u128 / u64 values arrive as decimal strings
 * (NEAR JSON convention); helpers in `format.ts` turn them into `bigint`.
 */

/** Immutable pool parameters (`meme-pool::Params`). */
export interface PoolParams {
  staking_pool: string;
  epoch_length_ns: string;
  initial_emission: string;
  halving_every: number;
  jackpot_bps: number;
  streak_step_bps: number;
  max_streak_bonus_bps: number;
  min_deposit: string;
  /** Check-ins the community needs per epoch; missing it burns the community share. */
  checkin_target?: number;
}

/** Parameters a creator chooses at launch (`factory::PoolParams`). */
export type LaunchParams = Omit<PoolParams, "staking_pool">;

export interface PoolState {
  params: PoolParams;
  creator: string;
  launched_at: string;
  total_principal: string;
  total_shares: string;
  treasury_shares: string;
  treasury_near: string;
  /** NEAR sponsors added through `fund_treasury` (absent on pools deployed before it existed). */
  total_funded?: string;
  st_near_price: string;
  total_supply: string;
  floor_price: string;
  epoch_index: number;
  epoch_start: string;
  next_draw_at: string;
  emission_now: string;
  depositors: number;
  checkins_this_epoch: number;
  /** Community ritual (absent on pools that predate it). `checkin_target` is at least 1. */
  checkin_target?: number;
  community_streak?: number;
  best_streak?: number;
  draws: number;
  draw_in_progress: boolean;
  in_flight: number;
  current_time: string;
}

export interface AccountView {
  principal: string;
  meme_balance: string;
  streak: number;
  checked_in_this_epoch: boolean;
  total_won: string;
  weight: string;
  registered: boolean;
}

export interface Draw {
  epoch: number;
  timestamp: string;
  yield_shares: string;
  yield_near: string;
  st_near_price: string;
  total_weight: string;
  depositors: number;
  checkins: number;
  winner: string | null;
  jackpot: string;
  checkin_reward_each: string;
  minted: string;
  target_hit?: boolean;
  /** Community share never minted because the target was missed. */
  burned?: string;
  community_streak?: number;
  supply_after: string;
  floor_after: string;
  seed: string;
}

export interface MemeInfo {
  slug: string;
  account_id: string;
  creator: string;
  name: string;
  symbol: string;
  icon: string | null;
  created_at: string;
  params: LaunchParams;
}

export interface FtMetadata {
  spec: string;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
}

/** A `FunctionCall` action in the shape wallet libraries accept. */
export interface FunctionCallAction {
  type: "FunctionCall";
  params: {
    methodName: string;
    args: Record<string, unknown>;
    gas: string;
    deposit: string;
  };
}

/** A transaction against one contract. */
export interface ContractCall {
  receiverId: string;
  actions: FunctionCallAction[];
}
