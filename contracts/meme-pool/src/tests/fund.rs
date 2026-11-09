use near_sdk::PromiseError;
use near_sdk::json_types::U128;

use super::*;

fn fund(c: &mut Contract, who: AccountId, near: u128, ts: u64) -> U128 {
    ctx(who.clone(), near, ts);
    let _ = c.fund_treasury();
    ctx(pool(), 0, ts);
    let shares = crate::math::shares_from_near(near, PRICE);
    c.on_funded(who, U128(near), Ok(U128(shares)))
}

#[test]
fn funding_goes_to_the_treasury_not_principal() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 10 * ONE_NEAR, 0);
    let shares = fund(&mut c, bob(), 2 * ONE_NEAR, 1);
    let s = c.get_state();
    assert_eq!(s.total_principal.0, 10 * ONE_NEAR);
    assert_eq!(s.treasury_shares.0, shares.0);
    assert_eq!(s.total_funded.0, 2 * ONE_NEAR);
    assert!(s.treasury_near.0 > 2 * ONE_NEAR - 1_000);
    assert_eq!(
        c.get_account(bob()).principal.0,
        0,
        "the funder gets no principal"
    );
}

#[test]
fn funded_treasury_backs_the_floor_after_a_draw() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 10 * ONE_NEAR, 0);
    fund(&mut c, bob(), 3 * ONE_NEAR, 1);
    // flat price: no staking yield at all, like testnet
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert_eq!(d.yield_shares.0, 0, "funding is not counted as yield");
    assert!(
        d.floor_after.0 > 0,
        "the floor is backed by the sponsor's NEAR"
    );
    let s = c.get_state();
    assert_eq!(
        s.floor_price.0,
        crate::math::mul_div(s.treasury_near.0, ONE_MEME, s.total_supply.0)
    );
}

#[test]
fn failed_stake_refunds_the_funder() {
    let mut c = new_contract(0);
    ctx(bob(), 2 * ONE_NEAR, 0);
    let _ = c.fund_treasury();
    ctx(pool(), 0, 0);
    assert_eq!(
        c.on_funded(bob(), U128(2 * ONE_NEAR), Err(PromiseError::Failed))
            .0,
        0
    );
    let s = c.get_state();
    assert_eq!(s.treasury_shares.0, 0);
    assert_eq!(s.total_funded.0, 0);
}

#[test]
#[should_panic(expected = "below min_deposit")]
fn funding_below_minimum_is_rejected() {
    let mut c = new_contract(0);
    ctx(bob(), ONE_NEAR / 100, 0);
    let _ = c.fund_treasury();
}
