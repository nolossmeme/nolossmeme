//! End-to-end: deposit -> check-in -> yield -> draw -> redeem -> withdraw.
mod common;

use common::*;
use near_api::NearToken;
use serde_json::json;

#[tokio::test]
async fn full_epoch_lifecycle() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;

    // 1. Deposits are staked and credited at face value.
    f.deposit(&f.alice, 10 * ONE_NEAR).await?;
    f.deposit(&f.bob, 5 * ONE_NEAR).await?;
    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_principal"]), 15 * ONE_NEAR);
    assert_eq!(u128_of(&s["total_shares"]), 15 * ONE_NEAR); // price 1.0
    assert_eq!(
        f.st_near_balance(&near_api::Account(f.pool.0.clone()))
            .await?,
        15 * ONE_NEAR
    );

    // 2. Alice performs the ritual.
    f.call(
        &f.alice,
        "check_in",
        json!({}),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();
    assert_eq!(
        f.account_view(&f.alice).await?["checked_in_this_epoch"],
        true
    );
    f.call(
        &f.alice,
        "check_in",
        json!({}),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_failure();

    // 3. Validators pay 2% and the epoch ends. Anyone may draw.
    f.accrue_yield(200).await?;
    f.call(&f.bob, "draw", json!({}), NearToken::from_yoctonear(0))
        .await?
        .assert_failure(); // too early
    f.next_epoch().await?;
    let r = f
        .call(&f.bob, "draw", json!({}), NearToken::from_yoctonear(0))
        .await?;
    r.assert_success();
    let draws = f.view("get_draws", json!({})).await?;
    let d = &draws[0];
    assert_eq!(d["epoch"], 0);
    assert_eq!(d["depositors"], 2);
    assert_eq!(d["checkins"], 1);
    assert_eq!(u128_of(&d["jackpot"]), EMISSION * 7 / 10);
    assert_eq!(u128_of(&d["checkin_reward_each"]), EMISSION * 3 / 10);
    assert!(d["winner"].is_string());
    // ~2% of 15 NEAR, minus rounding dust
    let y = u128_of(&d["yield_near"]);
    assert!(
        y > 29 * ONE_NEAR / 100 && y <= 30 * ONE_NEAR / 100,
        "yield {y}"
    );

    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_supply"]), EMISSION);
    assert!(u128_of(&s["treasury_shares"]) > 0);
    assert!(u128_of(&s["floor_price"]) > 0);
    assert_eq!(s["epoch_index"], 1);

    // 4. Alice redeems half of her MEME for treasury stNEAR.
    let alice_meme = u128_of(&f.account_view(&f.alice).await?["meme_balance"]);
    assert!(alice_meme >= EMISSION * 3 / 10);
    let before = f.st_near_balance(&f.alice).await?;
    f.call(
        &f.alice,
        "redeem",
        json!({ "amount": (alice_meme / 2).to_string() }),
        NearToken::from_yoctonear(1),
    )
    .await?
    .assert_success();
    let after = f.st_near_balance(&f.alice).await?;
    assert!(after > before, "redeem paid stNEAR");
    assert_eq!(
        u128_of(&f.account_view(&f.alice).await?["meme_balance"]),
        alice_meme - alice_meme / 2
    );

    // 5. Alice withdraws all principal as stNEAR worth exactly 10 NEAR at the live price.
    let before = f.st_near_balance(&f.alice).await?;
    f.call(
        &f.alice,
        "withdraw",
        json!({ "amount": null }),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();
    let got = f.st_near_balance(&f.alice).await? - before;
    let price = u128_of(&f.state().await?["st_near_price"]);
    let near_value = (got as f64 * price as f64 / ONE_NEAR as f64) as u128;
    assert!(
        (10 * ONE_NEAR).abs_diff(near_value) < ONE_NEAR / 1_000_000,
        "worth {near_value}"
    );
    assert_eq!(f.account_view(&f.alice).await?["principal"], "0");
    assert_eq!(f.state().await?["depositors"], 1);

    // 6. Bob takes NEAR straight away through the liquid-unstake path (0.3% fee).
    let before = f.near_balance(&f.bob).await?;
    let min_near = 5 * ONE_NEAR * 99 / 100;
    f.call(
        &f.bob,
        "withdraw_near",
        json!({ "amount": null, "min_near": min_near.to_string() }),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();
    let delta = f.near_balance(&f.bob).await? as i128 - before as i128;
    assert!(
        delta > (min_near as i128) - (ONE_NEAR as i128) / 10,
        "bob received {delta}"
    );
    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_principal"]), 0);
    assert_eq!(s["in_flight"], 0);
    // Treasury survives everyone leaving: MEME is still backed.
    assert!(u128_of(&s["treasury_shares"]) > 0);
    Ok(())
}

#[tokio::test]
async fn withdraw_more_than_principal_fails_and_changes_nothing() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    f.deposit(&f.alice, ONE_NEAR).await?;
    f.call(
        &f.alice,
        "withdraw",
        json!({ "amount": (2 * ONE_NEAR).to_string() }),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_failure();
    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_principal"]), ONE_NEAR);
    assert_eq!(s["in_flight"], 0);
    Ok(())
}

#[tokio::test]
async fn params_are_public_and_there_is_no_admin() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    let p = f.view("get_params", json!({})).await?;
    assert_eq!(p["jackpot_bps"], 7000);
    // No method can change them: calling a non-existent setter fails.
    f.call(
        &f.alice,
        "set_params",
        json!({}),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_failure();
    Ok(())
}
