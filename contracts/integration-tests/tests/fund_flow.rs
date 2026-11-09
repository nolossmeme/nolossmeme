//! A sponsor funds the treasury of a pool that earns no staking yield (like testnet): the floor
//! becomes non-zero and holders can redeem MEME for the sponsor's stNEAR.
mod common;

use common::*;
use near_api::NearToken;
use serde_json::json;

#[tokio::test]
async fn sponsor_funding_backs_the_floor_without_yield() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    f.deposit(&f.alice, 5 * ONE_NEAR).await?;
    f.call(
        &f.alice,
        "check_in",
        json!({}),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();

    // Bob sponsors 3 NEAR. Below the staking minimum is refunded.
    f.call(
        &f.bob,
        "fund_treasury",
        json!({}),
        NearToken::from_yoctonear(ONE_NEAR / 2),
    )
    .await?
    .assert_success(); // Meta Pool refuses it in a receipt; the callback refunds
    assert_eq!(f.state().await?["total_funded"], "0");
    f.call(&f.bob, "fund_treasury", json!({}), NearToken::from_near(3))
        .await?
        .assert_success();
    let s = f.state().await?;
    assert_eq!(
        u128_of(&s["total_principal"]),
        5 * ONE_NEAR,
        "funding is never principal"
    );
    assert_eq!(u128_of(&s["total_funded"]), 3 * ONE_NEAR);
    assert_eq!(u128_of(&s["treasury_near"]), 3 * ONE_NEAR);
    assert_eq!(f.account_view(&f.bob).await?["principal"], "0");

    // Draw with a flat price: no yield, but MEME is minted against a funded treasury.
    f.next_epoch().await?;
    f.call(&f.bob, "draw", json!({}), NearToken::from_yoctonear(0))
        .await?
        .assert_success();
    let d = &f.view("get_draws", json!({})).await?[0];
    assert_eq!(d["yield_shares"], "0");
    assert!(u128_of(&d["floor_after"]) > 0);

    // Alice redeems everything she won: she receives the whole treasury in stNEAR.
    let meme = u128_of(&f.account_view(&f.alice).await?["meme_balance"]);
    let before = f.st_near_balance(&f.alice).await?;
    f.call(
        &f.alice,
        "redeem",
        json!({ "amount": meme.to_string() }),
        NearToken::from_yoctonear(1),
    )
    .await?
    .assert_success();
    let got = f.st_near_balance(&f.alice).await? - before;
    assert!((3 * ONE_NEAR).abs_diff(got) < 1_000, "redeemed {got}");
    // Her principal is untouched.
    assert_eq!(
        u128_of(&f.account_view(&f.alice).await?["principal"]),
        5 * ONE_NEAR
    );
    Ok(())
}
