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

/// Audit 13 Nov: any panic inside `on_draw_price` (log limit, gas) rolled back the unlock and
/// left `draw_in_progress` set forever, blocking every withdrawal. The lock now expires.
#[test]
fn regression_stale_draw_lock_expires() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(bob(), 0, EPOCH_NS);
    let _ = c.draw(); // the callback never lands, as if it had panicked
    assert!(c.get_state().draw_in_progress);
    let later = EPOCH_NS + crate::constants::DRAW_LOCK_TIMEOUT_NS;
    ctx(alice(), 0, later);
    assert!(!c.get_state().draw_in_progress, "lock is stale");
    let _ = c.withdraw(None); // would panic with "draw in progress" before the fix
    assert_eq!(c.get_account(alice()).principal.0, 0);
}

/// Audit 13 Nov: one `ft_mint` log per check-in hit NEAR's 100-log receipt limit at ~95
/// check-ins and failed the draw. Mints are now one batched event.
#[test]
fn regression_draw_logs_stay_few_with_many_checkins() {
    let mut c = new_contract(0);
    let ts = 1;
    let who: Vec<AccountId> = (0..150)
        .map(|i| format!("u{i}.testnet").parse().unwrap())
        .collect();
    for a in &who {
        deposit(&mut c, a.clone(), ONE_NEAR, ts);
        ctx(a.clone(), 0, ts);
        c.check_in();
    }
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert_eq!(d.checkins, 150);
    assert!(
        near_sdk::test_utils::get_logs().len() <= 3,
        "batched events"
    );
}

/// Audit 13 Nov: 1-yocto positions could fake many check-ins. Check-in now needs
/// `min_deposit`, and a partial withdrawal must leave at least that much.
#[test]
fn regression_dust_positions_cannot_check_in() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, 1);
    let left_dust = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = c.withdraw(Some(U128(ONE_NEAR - 1)));
    }));
    assert!(left_dust.is_err(), "dust remainder refused");
    ctx(alice(), 0, 2);
    let _ = c.withdraw(Some(U128(ONE_NEAR / 2))); // half stays: allowed (min is 0.1)
}

/// Audit 13 Nov: an emission near u128::MAX overflowed total supply on the second draw.
#[test]
#[should_panic(expected = "emission too large")]
fn regression_huge_emission_is_refused() {
    ctx(pool(), 0, 0);
    let mut p = params();
    p.initial_emission = U128(u128::MAX / 2);
    let _ = Contract::new(alice(), "X".into(), "X".into(), None, p);
}
