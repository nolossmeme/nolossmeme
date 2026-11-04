use near_contract_standards::storage_management::StorageManagement;
use near_sdk::json_types::U128;

use super::*;
use crate::constants::STORAGE_COST;

#[test]
fn deposit_registers_and_credits_principal_in_callback() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 10 * ONE_NEAR, 0);
    let s = c.get_state();
    assert_eq!(s.total_principal.0, 10 * ONE_NEAR);
    assert_eq!(
        s.total_shares.0,
        crate::math::shares_from_near(10 * ONE_NEAR, PRICE)
    );
    assert_eq!(s.st_near_price.0, PRICE);
    assert_eq!(s.depositors, 1);
    let a = c.get_account(alice());
    assert!(a.registered);
    assert_eq!(a.principal.0, 10 * ONE_NEAR);
    assert_eq!(c.storage_balance_bounds().min, STORAGE_COST);
}

#[test]
fn failed_stake_credits_nothing() {
    let mut c = new_contract(0);
    ctx(pool(), 0, 0);
    c.on_deposit(alice(), U128(ONE_NEAR), Err(near_sdk::PromiseError::Failed));
    assert_eq!(c.get_state().total_principal.0, 0);
}

#[test]
#[should_panic(expected = "below min_deposit")]
fn deposit_below_minimum_is_rejected() {
    let mut c = new_contract(0);
    ctx(alice(), ONE_NEAR / 100 + STORAGE_COST.as_yoctonear(), 0);
    let _ = c.deposit();
}

#[test]
fn withdraw_debits_optimistically_and_restores_on_failure() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 4 * ONE_NEAR, 0);

    ctx(alice(), 0, 10);
    let _ = c.withdraw(Some(U128(3 * ONE_NEAR)));
    assert_eq!(c.get_state().total_principal.0, ONE_NEAR);
    assert_eq!(c.get_state().in_flight, 1);

    ctx(pool(), 0, 10);
    let _ = c.on_withdraw_price(
        alice(),
        U128(3 * ONE_NEAR),
        Err(near_sdk::PromiseError::Failed),
    );
    assert_eq!(c.get_state().total_principal.0, 4 * ONE_NEAR);
    assert_eq!(c.get_state().in_flight, 0);
}

#[test]
fn withdraw_all_pays_shares_at_live_price_and_removes_depositor() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 4 * ONE_NEAR, 0);
    let shares_before = c.get_state().total_shares.0;

    ctx(alice(), 0, 10);
    let _ = c.withdraw(None);
    ctx(pool(), 0, 10);
    // price went up 10% since the deposit: fewer shares cover the same NEAR
    let price = PRICE * 11 / 10;
    let _ = c.on_withdraw_price(alice(), U128(4 * ONE_NEAR), Ok(U128(price)));
    let expected = crate::math::shares_from_near(4 * ONE_NEAR, price);
    assert_eq!(c.get_state().total_shares.0, shares_before - expected);
    c.on_withdraw_done(alice(), U128(4 * ONE_NEAR), U128(expected), Ok(()));
    assert_eq!(c.get_state().depositors, 0);
    assert_eq!(c.get_state().in_flight, 0);
    // the 10% appreciation is still in the vault, waiting to be swept as yield
    assert!(c.get_state().total_shares.0 > 0);
}

#[test]
#[should_panic(expected = "invalid amount")]
fn cannot_withdraw_more_than_principal() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, 1);
    let _ = c.withdraw(Some(U128(2 * ONE_NEAR)));
}
