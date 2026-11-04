//! Unit tests run the contract in-process with `testing_env!`. Cross-contract callbacks
//! are invoked directly with the result Meta Pool would have returned.
mod draw;
mod redeem;
mod regression;
mod tickets;
mod vault;

use near_sdk::json_types::{U64, U128};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{AccountId, NearToken, testing_env};

use crate::Contract;
use crate::constants::{ONE_MEME, ONE_NEAR};
use crate::types::Params;

pub const EPOCH_NS: u64 = 86_400_000_000_000;
pub const PRICE: u128 = 3 * ONE_NEAR / 2; // 1 stNEAR = 1.5 NEAR
pub const EMISSION: u128 = 1_000 * ONE_MEME;

pub fn pool() -> AccountId {
    "meme.factory.testnet".parse().unwrap()
}
pub fn staking() -> AccountId {
    "meta-v2.pool.testnet".parse().unwrap()
}
pub fn alice() -> AccountId {
    "alice.testnet".parse().unwrap()
}
pub fn bob() -> AccountId {
    "bob.testnet".parse().unwrap()
}

pub fn params() -> Params {
    Params {
        staking_pool: staking(),
        epoch_length_ns: U64(EPOCH_NS),
        initial_emission: U128(EMISSION),
        halving_every: 30,
        jackpot_bps: 7_000,
        streak_step_bps: 1_000,
        max_streak_bonus_bps: 5_000,
        min_deposit: U128(ONE_NEAR / 10),
    }
}

/// Switch the VM context: who is calling, how much is attached, what time it is.
pub fn ctx(predecessor: AccountId, deposit: u128, ts: u64) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(pool())
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts)
            .random_seed([7u8; 32])
            .build()
    );
}

pub fn new_contract(ts: u64) -> Contract {
    ctx(pool(), 0, ts);
    Contract::new(
        alice(),
        "Doge of NEAR".into(),
        "DOGN".into(),
        None,
        params(),
    )
}

/// Simulate a successful `deposit` + Meta Pool callback for `who` at the test price.
pub fn deposit(c: &mut Contract, who: AccountId, near: u128, ts: u64) {
    ctx(
        who.clone(),
        near + crate::constants::STORAGE_COST.as_yoctonear(),
        ts,
    );
    let _ = c.deposit();
    ctx(pool(), 0, ts);
    let shares = crate::math::shares_from_near(near, PRICE);
    c.on_deposit(who, U128(near), Ok(U128(shares)));
}

/// Run a full draw at `ts` with the given price (callback invoked directly).
pub fn draw(c: &mut Contract, ts: u64, price: u128) -> crate::types::Draw {
    ctx(bob(), 0, ts);
    let _ = c.draw();
    ctx(pool(), 0, ts);
    c.on_draw_price(Ok(U128(price))).expect("draw settles")
}
