use super::*;

const SEC: u64 = 1_000_000_000;

#[test]
fn weight_is_principal_times_seconds() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 2 * ONE_NEAR, 0);
    ctx(alice(), 0, 100 * SEC);
    assert_eq!(c.get_account(alice()).weight.0, 200);
    // fractional NEAR is weighted too
    deposit(&mut c, bob(), ONE_NEAR / 2, 0);
    ctx(bob(), 0, 100 * SEC);
    assert_eq!(c.get_account(bob()).weight.0, 50);
}

#[test]
fn late_deposit_earns_little_weight() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    deposit(&mut c, bob(), 100 * ONE_NEAR, EPOCH_NS - SEC);
    ctx(pool(), 0, EPOCH_NS);
    assert!(c.get_account(alice()).weight.0 > c.get_account(bob()).weight.0);
}

#[test]
fn check_in_builds_streak_and_boosts_weight() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, SEC);
    assert_eq!(c.check_in(), 1);
    assert_eq!(c.get_state().checkins_this_epoch, 1);

    ctx(alice(), 0, 1_000 * SEC);
    let boosted = c.get_account(alice()).weight.0;
    assert_eq!(boosted, 1_000 * 11 / 10); // +10% for streak 1

    draw(&mut c, EPOCH_NS, PRICE);
    ctx(alice(), 0, EPOCH_NS + SEC);
    assert_eq!(c.check_in(), 2);
    draw(&mut c, 2 * EPOCH_NS, PRICE);
    // skipping an epoch resets the streak
    draw(&mut c, 3 * EPOCH_NS, PRICE);
    ctx(alice(), 0, 3 * EPOCH_NS + SEC);
    assert_eq!(c.check_in(), 1);
}

#[test]
fn streak_bonus_is_capped() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    for e in 0..8u64 {
        ctx(alice(), 0, e * EPOCH_NS + SEC);
        c.check_in();
        draw(&mut c, (e + 1) * EPOCH_NS, PRICE);
    }
    ctx(alice(), 0, 8 * EPOCH_NS + SEC);
    assert_eq!(c.check_in(), 9);
    ctx(alice(), 0, 8 * EPOCH_NS + 1_000 * SEC);
    // 9 * 10% = 90% requested, capped at 50%
    assert_eq!(c.get_account(alice()).weight.0, 1_000 * 15 / 10);
}

#[test]
#[should_panic(expected = "already checked in this epoch")]
fn cannot_check_in_twice_per_epoch() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, SEC);
    c.check_in();
    c.check_in();
}
