//! One test per bug found and fixed. Names start with `regression_` so the whole layer can
//! be run with `cargo test regression`. Keep each test's doc comment pointing at the cause.
use near_contract_standards::storage_management::StorageManagement;
use near_sdk::PromiseError;
use near_sdk::json_types::U128;

use super::*;
use crate::constants::STORAGE_COST;

const SEC: u64 = 1_000_000_000;

/// `accrue` skipped accounts whose `last_update` was 0, so a deposit in the genesis block
/// (and every sandbox test) earned no tickets. Fixed by accruing whenever time moved.
#[test]
fn regression_accrual_from_zero_timestamp() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, 10 * SEC);
    assert_eq!(c.get_account(alice()).weight.0, 10);
}

/// Meta Pool rejects stakes under its `min_deposit_amount` (1 NEAR on testnet). The first
/// 0.5 NEAR deposit on testnet was refunded by `on_deposit`; make sure the refund path
/// leaves no principal behind and keeps the (already paid) registration.
#[test]
fn regression_failed_stake_refunds_without_principal() {
    let mut c = new_contract(0);
    ctx(alice(), ONE_NEAR / 2 + STORAGE_COST.as_yoctonear(), 0);
    let _ = c.deposit();
    ctx(pool(), 0, 0);
    let credited = c.on_deposit(alice(), U128(ONE_NEAR / 2), Err(PromiseError::Failed));
    assert_eq!(credited.0, 0);
    let a = c.get_account(alice());
    assert_eq!(a.principal.0, 0);
    assert!(a.registered, "storage registration survives a failed stake");
    assert_eq!(c.get_state().total_principal.0, 0);
    assert_eq!(c.get_state().total_shares.0, 0);
    assert!(c.storage_balance_of(alice()).is_some());
}

/// `on_draw_price` used to `expect` the price; a failed lookup panicked in the callback,
/// which rolled back the `draw_in_progress = false` write and bricked the pool forever.
#[test]
fn regression_draw_unlocks_when_price_lookup_fails() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(bob(), 0, EPOCH_NS);
    let _ = c.draw();
    assert!(c.get_state().draw_in_progress);
    ctx(pool(), 0, EPOCH_NS);
    assert!(c.on_draw_price(Err(PromiseError::Failed)).is_none());
    let s = c.get_state();
    assert!(!s.draw_in_progress, "lock released");
    assert_eq!(s.epoch_index, 0, "epoch not advanced");
    assert_eq!(s.draws, 0);
    // and the next attempt works
    let d = draw(&mut c, EPOCH_NS + SEC, PRICE);
    assert_eq!(d.epoch, 0);
}

/// `draw` attached "all remaining gas" computed before promise creation, which exceeded
/// the prepaid budget (`GasExceeded`). It now attaches a fixed `GAS_CB_DRAW`.
#[test]
fn regression_draw_attaches_fixed_gas() {
    let mut c = new_contract(0);
    ctx(bob(), 0, EPOCH_NS);
    let _ = c.draw(); // would panic with GasExceeded under the old dynamic computation
    assert!(c.get_state().draw_in_progress);
}
