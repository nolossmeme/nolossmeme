//! Serialisable types: launch parameters, per-account state, draw records and views.
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, BorshStorageKey, near};

#[derive(BorshStorageKey)]
#[near]
pub(crate) enum StorageKey {
    Token,
    Metadata,
    Depositors,
    Draws,
}

/// Immutable launch parameters. Set once in `new`, readable by anyone via `get_params`.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Params {
    /// Meta Pool (stNEAR) contract the vault stakes into.
    pub staking_pool: AccountId,
    /// Epoch length in nanoseconds (86_400e9 for daily draws).
    pub epoch_length_ns: U64,
    /// MEME minted in epoch 0 (yocto-MEME).
    pub initial_emission: U128,
    /// Emission halves every this many epochs.
    pub halving_every: u32,
    /// Share of each epoch's emission that goes to the single jackpot winner (bps).
    /// The remainder is split equally among depositors who checked in that epoch.
    pub jackpot_bps: u16,
    /// Each consecutive check-in adds this many bps of ticket weight...
    pub streak_step_bps: u16,
    /// ...up to this cap.
    pub max_streak_bonus_bps: u16,
    /// Minimum NEAR per deposit (yocto).
    pub min_deposit: U128,
}

/// Per-account vault state.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, Default)]
pub struct Depositor {
    /// NEAR deposited, withdrawable at face value (yocto).
    pub principal: U128,
    /// NEAR-seconds accumulated since the last draw (ticket weight before bonus).
    pub weight_acc: U128,
    /// Timestamp of the last weight accumulation (ns).
    pub last_update: U64,
    /// Consecutive epochs with a check-in.
    pub streak: u32,
    /// Epoch index of the last check-in.
    pub last_checkin_epoch: Option<u32>,
    /// Lifetime jackpot winnings (yocto-MEME).
    pub total_won: U128,
}

/// Immutable record of one epoch draw.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Draw {
    pub epoch: u32,
    pub timestamp: U64,
    /// Staking yield swept into the treasury this epoch.
    pub yield_shares: U128,
    pub yield_near: U128,
    pub st_near_price: U128,
    pub total_weight: U128,
    pub depositors: u32,
    pub checkins: u32,
    pub winner: Option<AccountId>,
    pub jackpot: U128,
    pub checkin_reward_each: U128,
    pub minted: U128,
    pub supply_after: U128,
    /// yocto NEAR per whole MEME after this draw.
    pub floor_after: U128,
    /// Hex of the hashed randomness used for the winner pick.
    pub seed: String,
}

/// Snapshot returned by `get_state`.
#[near(serializers = [json])]
pub struct PoolState {
    pub params: Params,
    pub creator: AccountId,
    pub launched_at: U64,
    pub total_principal: U128,
    pub total_shares: U128,
    pub treasury_shares: U128,
    pub treasury_near: U128,
    pub st_near_price: U128,
    pub total_supply: U128,
    /// yocto NEAR per whole MEME.
    pub floor_price: U128,
    pub epoch_index: u32,
    pub epoch_start: U64,
    pub next_draw_at: U64,
    pub emission_now: U128,
    pub depositors: u64,
    pub checkins_this_epoch: u32,
    pub draws: u64,
    pub draw_in_progress: bool,
    pub in_flight: u32,
    pub current_time: U64,
}

/// Snapshot returned by `get_account`.
#[near(serializers = [json])]
pub struct AccountView {
    pub principal: U128,
    pub meme_balance: U128,
    pub streak: u32,
    pub checked_in_this_epoch: bool,
    pub total_won: U128,
    /// Ticket weight so far this epoch, after the streak bonus.
    pub weight: U128,
    pub registered: bool,
}

/// Return type of Meta Pool's `liquid_unstake`.
#[near(serializers = [json])]
#[derive(Clone)]
pub struct LiquidUnstakeResult {
    pub near: U128,
    pub fee: U128,
    pub meta: U128,
}
