//! Registry records and the subset of pool parameters a creator chooses.
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, near};

/// Launch parameters a creator picks. The factory adds `staking_pool` and forwards the
/// result to `meme-pool::new` as its `Params`.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct PoolParams {
    pub epoch_length_ns: U64,
    pub initial_emission: U128,
    pub halving_every: u32,
    pub jackpot_bps: u16,
    pub streak_step_bps: u16,
    pub max_streak_bonus_bps: u16,
    pub min_deposit: U128,
    /// Check-ins the community needs per epoch for its share of the emission (0 means 1).
    /// Miss it and that share is never minted (burned) and the community streak resets.
    #[serde(default)]
    pub checkin_target: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct MemeInfo {
    pub slug: String,
    pub account_id: AccountId,
    pub creator: AccountId,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub created_at: U64,
    pub params: PoolParams,
}
