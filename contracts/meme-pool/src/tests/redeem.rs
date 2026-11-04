use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_sdk::json_types::U128;

use super::*;

fn pool_with_treasury() -> (Contract, u128) {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 100 * ONE_NEAR, 0);
    draw(&mut c, EPOCH_NS, PRICE * 105 / 100);
    let bal = c.ft_balance_of(alice()).0;
    assert!(bal > 0);
    (c, bal)
}

#[test]
fn redeem_pays_pro_rata_treasury_and_burns() {
    let (mut c, bal) = pool_with_treasury();
    let s = c.get_state();
    let half = bal / 2;
    let expected_shares = crate::math::mul_div(s.treasury_shares.0, half, s.total_supply.0);

    ctx(alice(), 1, EPOCH_NS + 1);
    let _ = c.redeem(U128(half));
    let s2 = c.get_state();
    assert_eq!(s2.treasury_shares.0, s.treasury_shares.0 - expected_shares);
    assert_eq!(s2.total_supply.0, s.total_supply.0 - half);
    assert_eq!(s2.in_flight, 1);
    // floor is unchanged by a redeem (same ratio)
    assert!(s2.floor_price.0.abs_diff(s.floor_price.0) <= 1);

    ctx(pool(), 0, EPOCH_NS + 1);
    c.on_redeem_done(alice(), U128(half), U128(expected_shares), Ok(()));
    assert_eq!(c.get_state().in_flight, 0);
}

#[test]
fn failed_transfer_restores_meme_and_treasury() {
    let (mut c, bal) = pool_with_treasury();
    let before = c.get_state();
    ctx(alice(), 1, EPOCH_NS + 1);
    let _ = c.redeem(U128(bal));
    ctx(pool(), 0, EPOCH_NS + 1);
    let shares = before.treasury_shares.0; // all supply redeemed -> all treasury
    c.on_redeem_done(
        alice(),
        U128(bal),
        U128(shares),
        Err(near_sdk::PromiseError::Failed),
    );
    let after = c.get_state();
    assert_eq!(after.treasury_shares.0, before.treasury_shares.0);
    assert_eq!(after.total_supply.0, before.total_supply.0);
    assert_eq!(c.ft_balance_of(alice()).0, bal);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn redeem_requires_one_yocto() {
    let (mut c, bal) = pool_with_treasury();
    ctx(alice(), 0, EPOCH_NS + 1);
    let _ = c.redeem(U128(bal));
}
