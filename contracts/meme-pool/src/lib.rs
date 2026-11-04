//! NoLossMeme pool.
//!
//! One contract per memecoin. Users deposit NEAR; the pool stakes it with Meta Pool
//! (stNEAR). Principal is always withdrawable at face value. Only the staking yield is
//! ever at play: every epoch it is swept into the token treasury and a fixed emission of
//! MEME is minted - a jackpot to one time-weighted random depositor and an equal "ritual"
//! reward to everyone who checked in that epoch. Every MEME can be burned for its share
//! of the treasury, so the floor price can never go to zero.
//!
//! No admin methods. All parameters are fixed at [`Contract::new`] and readable by anyone.
//!
//! Module map:
//! - [`vault`]: deposit / withdraw and the Meta Pool promise chains
//! - [`tickets`]: check-in ritual and time-weighted ticket accounting
//! - [`draw`]: epoch roll-over, yield sweep, weighted lottery and minting
//! - [`redeem`]: burn MEME for treasury stNEAR (the floor)
//! - [`token`]: NEP-141 / NEP-145 / NEP-148
//! - [`views`]: read-only snapshots
mod constants;
mod draw;
mod math;
mod tickets;
mod types;
mod vault;

#[cfg(test)]
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::fungible_token::metadata::{FT_METADATA_SPEC, FungibleTokenMetadata};
use near_sdk::store::{IterableMap, LazyOption, Vector};
use near_sdk::{AccountId, PanicOnDefault, env, near, require};

pub use constants::*;
pub use math::{emission_for, floor_price, near_from_shares, shares_from_near};
pub use types::*;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    params: Params,
    creator: AccountId,
    launched_at: u64,
    /// Sum of all depositors' principal (yocto NEAR).
    total_principal: u128,
    /// stNEAR shares the vault owns on the staking pool (principal cover + treasury).
    total_shares: u128,
    /// stNEAR shares backing MEME. Grows on yield sweeps, shrinks on redeem.
    treasury_shares: u128,
    /// Last observed yocto NEAR per stNEAR.
    st_near_price: u128,
    epoch_index: u32,
    epoch_start: u64,
    checkins_this_epoch: u32,
    depositors: IterableMap<AccountId, Depositor>,
    draws: Vector<Draw>,
    draw_in_progress: bool,
    /// Withdraw / redeem promise chains in flight; draws wait for zero.
    in_flight: u32,
}

#[near]
impl Contract {
    #[init]
    pub fn new(
        creator: AccountId,
        name: String,
        symbol: String,
        icon: Option<String>,
        params: Params,
    ) -> Self {
        require!(u128::from(params.jackpot_bps) <= BPS, "jackpot_bps > 100%");
        require!(
            params.epoch_length_ns.0 >= 60_000_000_000,
            "epoch must be >= 60s"
        );
        require!(params.halving_every >= 1, "halving_every must be >= 1");
        require!(params.initial_emission.0 > 0, "emission must be > 0");
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name,
            symbol,
            icon,
            reference: None,
            reference_hash: None,
            decimals: 18,
        };
        metadata.assert_valid();
        let now = env::block_timestamp();
        Self {
            token: FungibleToken::new(StorageKey::Token),
            metadata: LazyOption::new(StorageKey::Metadata, Some(metadata)),
            params,
            creator,
            launched_at: now,
            total_principal: 0,
            total_shares: 0,
            treasury_shares: 0,
            st_near_price: ONE_NEAR,
            epoch_index: 0,
            epoch_start: now,
            checkins_this_epoch: 0,
            depositors: IterableMap::new(StorageKey::Depositors),
            draws: Vector::new(StorageKey::Draws),
            draw_in_progress: false,
            in_flight: 0,
        }
    }
}
