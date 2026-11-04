use near_contract_standards::fungible_token::core::FungibleTokenCore;

use super::*;

#[test]
#[should_panic(expected = "epoch not over")]
fn draw_before_epoch_end_is_rejected() {
    let mut c = new_contract(0);
    ctx(bob(), 0, EPOCH_NS - 1);
    let _ = c.draw();
}

#[test]
fn draw_with_no_depositors_only_rolls_epoch() {
    let mut c = new_contract(0);
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert_eq!(d.minted.0, 0);
    assert!(d.winner.is_none());
    let s = c.get_state();
    assert_eq!(s.epoch_index, 1);
    assert_eq!(s.epoch_start.0, EPOCH_NS);
    assert_eq!(s.draws, 1);
}

#[test]
fn draw_sweeps_yield_mints_jackpot_and_checkin_rewards() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 10 * ONE_NEAR, 0);
    deposit(&mut c, bob(), 10 * ONE_NEAR, 0);
    ctx(alice(), 0, 1);
    c.check_in();

    // stNEAR appreciated 2% over the epoch
    let price = PRICE * 102 / 100;
    let d = draw(&mut c, EPOCH_NS, price);

    // yield ~ 2% of 20 NEAR = 0.4 NEAR (rounding dust allowed)
    let expected_yield = 20 * ONE_NEAR * 2 / 100;
    assert!(d.yield_near.0 <= expected_yield && expected_yield - d.yield_near.0 < 1_000);
    assert_eq!(d.depositors, 2);
    assert_eq!(d.checkins, 1);
    assert_eq!(d.jackpot.0, EMISSION * 7 / 10);
    assert_eq!(d.checkin_reward_each.0, EMISSION * 3 / 10);
    assert_eq!(d.minted.0, EMISSION);
    assert_eq!(d.supply_after.0, EMISSION);
    assert!(d.winner.is_some());

    // floor = treasury / supply
    let s = c.get_state();
    assert_eq!(
        s.floor_price.0,
        crate::math::mul_div(s.treasury_near.0, ONE_MEME, EMISSION)
    );
    assert_eq!(
        c.ft_balance_of(alice()).0 + c.ft_balance_of(bob()).0,
        EMISSION
    );
    // alice checked in, so she holds at least the community share
    assert!(c.ft_balance_of(alice()).0 >= EMISSION * 3 / 10);
}

#[test]
fn community_share_is_not_minted_without_checkins() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert_eq!(d.minted.0, EMISSION * 7 / 10);
    assert_eq!(d.checkin_reward_each.0, 0);
}

#[test]
fn winner_follows_weight_with_a_fixed_seed() {
    // With equal weights the seed decides; with one whale the whale always wins.
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 1_000_000 * ONE_NEAR, 0);
    deposit(&mut c, bob(), ONE_NEAR, 0);
    for e in 0..5u64 {
        let d = draw(&mut c, (e + 1) * EPOCH_NS, PRICE);
        assert_eq!(d.winner, Some(alice()));
    }
}

#[test]
fn emission_halves_after_schedule() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    for e in 0..30u64 {
        draw(&mut c, (e + 1) * EPOCH_NS, PRICE);
    }
    assert_eq!(c.get_state().emission_now.0, EMISSION / 2);
    let d = draw(&mut c, 31 * EPOCH_NS, PRICE);
    assert_eq!(d.jackpot.0, EMISSION / 2 * 7 / 10);
}

#[test]
fn late_draw_keeps_schedule_aligned() {
    let mut c = new_contract(0);
    draw(&mut c, 3 * EPOCH_NS + 5, PRICE);
    assert_eq!(c.get_state().epoch_start.0, 3 * EPOCH_NS);
    assert_eq!(c.get_state().epoch_index, 1);
}

#[test]
#[should_panic(expected = "withdrawals in flight")]
fn draw_waits_for_in_flight_withdrawals() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(alice(), 0, 1);
    let _ = c.withdraw(None);
    ctx(bob(), 0, EPOCH_NS);
    let _ = c.draw();
}
