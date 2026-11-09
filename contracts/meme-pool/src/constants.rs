//! Protocol-wide constants. Nothing here is tunable per pool; per-pool knobs live in
//! [`crate::Params`].
use near_sdk::{Gas, NearToken};

pub const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
/// 10^18: one whole MEME in yocto-MEME (the token uses 18 decimals).
pub const ONE_MEME: u128 = 1_000_000_000_000_000_000;
pub const BPS: u128 = 10_000;
pub const NANOS_PER_SECOND: u128 = 1_000_000_000;

/// Fixed storage fee per account (token balance + depositor record). Refunded on
/// `storage_unregister`.
pub const STORAGE_COST: NearToken = NearToken::from_millinear(5);

/// Gas budgets for the cross-contract legs. Meta Pool's `deposit_and_stake` also runs
/// its liquidity-pool clearing, hence the generous allowance.
pub const GAS_PRICE_VIEW: Gas = Gas::from_tgas(10);
pub const GAS_STAKE: Gas = Gas::from_tgas(70);
pub const GAS_FT_TRANSFER: Gas = Gas::from_tgas(25);
pub const GAS_STORAGE_DEPOSIT: Gas = Gas::from_tgas(10);
/// Meta Pool's `storage_balance_bounds` (same on testnet and mainnet): registering a receiver.
pub const STAKING_POOL_STORAGE: NearToken = NearToken::from_micronear(1_250);
pub const GAS_LIQUID_UNSTAKE: Gas = Gas::from_tgas(60);
pub const GAS_POOL_WITHDRAW: Gas = Gas::from_tgas(30);
pub const GAS_CB_SMALL: Gas = Gas::from_tgas(15);
pub const GAS_CB_WITHDRAW: Gas = Gas::from_tgas(50);
pub const GAS_CB_WITHDRAW_NEAR: Gas = Gas::from_tgas(130);
pub const GAS_CB_AFTER_UNSTAKE: Gas = Gas::from_tgas(55);
/// The epoch settlement runs in one callback; callers attach 300 TGas to `draw`.
pub const GAS_CB_DRAW: Gas = Gas::from_tgas(270);
