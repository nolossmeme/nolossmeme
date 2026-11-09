//! Sandbox-level regression tests: each one reproduces an incident seen on testnet.
mod common;

use base64::Engine;
use common::*;
use near_api::{Contract, NearGas, NearToken};
use serde_json::{Value, json};

/// 2026-11-04: a 0.5 NEAR deposit on `dogn.nolossmeme.testnet` was rejected by Meta Pool
/// (`minimum deposit amount is 1 NEAR`). The pool must refund the depositor in full and
/// record nothing.
#[tokio::test]
async fn regression_deposit_below_staking_minimum_is_refunded() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    let before = f.near_balance(&f.alice).await?;
    let r = f
        .call(
            &f.alice,
            "deposit",
            json!({}),
            NearToken::from_yoctonear(ONE_NEAR / 2 + ONE_NEAR / 200),
        )
        .await?;
    r.assert_success(); // the transaction succeeds; the refund happens inside
    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_principal"]), 0);
    assert_eq!(u128_of(&s["total_shares"]), 0);
    assert_eq!(s["depositors"], 0);
    let a = f.account_view(&f.alice).await?;
    assert_eq!(a["principal"], "0");
    assert_eq!(a["registered"], true);
    // only gas and the 0.005 storage fee are gone
    let spent = before - f.near_balance(&f.alice).await?;
    assert!(
        spent < ONE_NEAR / 50,
        "spent {spent} yocto, expected only storage + gas"
    );
    Ok(())
}

/// A pool whose `new` panics (jackpot > 100 %) must not leave a half-created account in the
/// registry, and the creator must get the launch deposit back.
#[tokio::test]
async fn regression_factory_refunds_when_pool_init_fails() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    let factory = f.create_account("factory.sandbox", 50).await?.as_contract();
    Contract::deploy(factory.account_id().clone())
        .use_code(f.wasm("factory"))
        .with_init_call("new", json!({ "staking_pool": f.metapool.account_id() }))?
        .with_signer(f.signer.clone())
        .send_to(&f.network)
        .await?
        .assert_success();
    let code = base64::engine::general_purpose::STANDARD.encode(f.wasm("meme-pool"));
    factory
        .call_function("store_pool_code", json!({ "code": code }))
        .transaction()
        .gas(NearGas::from_tgas(100))
        .with_signer(factory.account_id().clone(), f.signer.clone())
        .send_to(&f.network)
        .await?
        .assert_success();
    let cost: Value = factory
        .call_function("get_launch_cost", json!({}))
        .read_only()
        .fetch_from(&f.network)
        .await?
        .data;
    let cost = u128_of(&cost);

    let before = f.near_balance(&f.bob).await?;
    let bad_params = json!({
        "epoch_length_ns": EPOCH_NS.to_string(),
        "initial_emission": EMISSION.to_string(),
        "halving_every": 30,
        "jackpot_bps": 12_000,
        "streak_step_bps": 1000,
        "max_streak_bonus_bps": 5000,
        "checkin_target": 1,
        "min_deposit": ONE_NEAR.to_string(),
    });
    factory
        .call_function("create_meme", json!({ "slug": "bad", "name": "Bad", "symbol": "BAD", "icon": null, "params": bad_params }))
        .transaction()
        .deposit(NearToken::from_yoctonear(cost))
        .gas(NearGas::from_tgas(300))
        .with_signer(f.bob.account_id().clone(), f.signer.clone())
        .send_to(&f.network)
        .await?
        .assert_success(); // outer tx succeeds, the inner deploy+init fails and is refunded
    let count: Value = factory
        .call_function("get_meme_count", json!({}))
        .read_only()
        .fetch_from(&f.network)
        .await?
        .data;
    assert_eq!(count, 0);
    let spent = before - f.near_balance(&f.bob).await?;
    assert!(
        spent < ONE_NEAR / 10,
        "creator lost {spent} yocto, expected gas only"
    );
    Ok(())
}

/// 2026-11-09 on testnet: Meta Pool mints ~0.06% fewer shares than its quoted price implies, so the
/// last withdrawer could not be covered at the quoted price; the callback panicked, rolled back the
/// in-flight counter and locked the pool's draws for good. Withdrawals are now pro-rata solvent.
#[tokio::test]
async fn regression_withdraw_all_with_a_deposit_spread() -> testresult::TestResult<()> {
    let f = Fixture::new().await?;
    f.metapool
        .call_function("set_deposit_spread_bps", json!({ "bps": "6" }))
        .transaction()
        .with_signer(f.metapool.account_id().clone(), f.signer.clone())
        .send_to(&f.network)
        .await?
        .assert_success();
    f.deposit(&f.alice, 2 * ONE_NEAR).await?;
    f.deposit(&f.bob, 3 * ONE_NEAR).await?;
    f.call(&f.bob, "fund_treasury", json!({}), NearToken::from_near(1))
        .await?
        .assert_success();
    let treasury = u128_of(&f.state().await?["treasury_shares"]);

    f.call(
        &f.alice,
        "withdraw",
        json!({ "amount": null }),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();
    // the last withdrawer, through liquid unstake: used to panic and lock the pool
    f.call(
        &f.bob,
        "withdraw_near",
        json!({ "amount": null, "min_near": "0" }),
        NearToken::from_yoctonear(0),
    )
    .await?
    .assert_success();
    let s = f.state().await?;
    assert_eq!(u128_of(&s["total_principal"]), 0);
    assert_eq!(s["in_flight"], 0, "draws are not blocked");
    assert_eq!(
        u128_of(&s["treasury_shares"]),
        treasury,
        "the treasury is untouched"
    );
    let pool_balance = f
        .st_near_balance(&near_api::Account(f.pool.0.clone()))
        .await?;
    assert_eq!(
        pool_balance, treasury,
        "only the treasury is left in the vault"
    );
    // and the pool keeps working
    f.next_epoch().await?;
    f.call(&f.alice, "draw", json!({}), NearToken::from_yoctonear(0))
        .await?
        .assert_success();
    Ok(())
}
