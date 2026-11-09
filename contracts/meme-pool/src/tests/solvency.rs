//! Liquid staking pools mint slightly fewer shares on deposit than their quoted price implies
//! (Meta Pool testnet: ~0.06%). Found on testnet 2026-11-09: the last withdrawer's callback
//! panicked with "vault cannot cover principal", which rolled back the in-flight counter and
//! locked the pool's draws forever.
use near_sdk::PromiseError;
use near_sdk::json_types::U128;

use super::*;
use crate::constants::STORAGE_COST;

/// Deposit where the staking pool returns `spread_bps` fewer shares than the price implies.
fn deposit_with_spread(c: &mut Contract, who: AccountId, near: u128, ts: u64, spread_bps: u128) {
    ctx(who.clone(), near + STORAGE_COST.as_yoctonear(), ts);
    let _ = c.deposit();
    ctx(pool(), 0, ts);
    let shares = crate::math::shares_from_near(near, PRICE) * (10_000 - spread_bps) / 10_000;
    c.on_deposit(who, U128(near), Ok(U128(shares)));
}

fn withdraw_all(c: &mut Contract, who: AccountId, ts: u64) -> u128 {
    let principal = c.get_account(who.clone()).principal.0;
    ctx(who.clone(), 0, ts);
    let _ = c.withdraw(None);
    ctx(pool(), 0, ts);
    let _ = c.on_withdraw_price(who, U128(principal), Ok(U128(PRICE)));
    principal
}

#[test]
fn regression_last_withdrawer_is_paid_despite_deposit_spread() {
    let mut c = new_contract(0);
    deposit_with_spread(&mut c, alice(), 2 * ONE_NEAR, 0, 6);
    deposit_with_spread(&mut c, bob(), 3 * ONE_NEAR, 0, 6);
    ctx(carol(), 2 * ONE_NEAR, 1);
    let _ = c.fund_treasury();
    ctx(pool(), 0, 1);
    let treasury = crate::math::shares_from_near(2 * ONE_NEAR, PRICE);
    c.on_funded(carol(), U128(2 * ONE_NEAR), Ok(U128(treasury)));

    withdraw_all(&mut c, alice(), 2);
    withdraw_all(&mut c, bob(), 3); // used to panic: "vault cannot cover principal"
    let s = c.get_state();
    assert_eq!(s.total_principal.0, 0);
    assert_eq!(
        s.treasury_shares.0, treasury,
        "the treasury is never used to pay principal"
    );
    assert_eq!(
        s.total_shares.0, treasury,
        "all backing shares were paid out"
    );
}

#[test]
fn regression_failed_final_payout_is_parked_not_stuck() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, 1);
    let _ = c.withdraw_near(None, U128(0));
    assert_eq!(c.get_state().in_flight, 1);
    ctx(pool(), 0, 1);
    // the pull from the staking pool fails
    c.on_near_pulled(alice(), U128(ONE_NEAR), U128(0), Err(PromiseError::Failed));
    assert_eq!(c.get_state().in_flight, 0, "draws are not blocked");
    assert_eq!(c.get_pending(alice()).0, ONE_NEAR);
    ctx(alice(), 0, 2);
    let _ = c.claim_pending();
    assert_eq!(c.get_pending(alice()).0, 0);
    ctx(pool(), 0, 2);
    c.on_near_pulled(alice(), U128(ONE_NEAR), U128(0), Ok(()));
    assert_eq!(c.get_state().in_flight, 0);
}
