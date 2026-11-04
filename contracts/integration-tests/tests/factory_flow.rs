//! Launching a pool through the factory and talking to it afterwards.
mod common;

use base64::Engine;
use common::*;
use near_api::{Contract, NearGas, NearToken};
use serde_json::{Value, json};

struct FactoryFixture {
    f: Fixture,
    factory: Contract,
}

impl FactoryFixture {
    async fn new() -> testresult::TestResult<Self> {
        let f = Fixture::new().await?;
        let factory = f.create_account("factory.sandbox", 50).await?.as_contract();
        Contract::deploy(factory.account_id().clone())
            .use_code(f.wasm("factory"))
            .with_init_call("new", json!({ "staking_pool": f.metapool.account_id() }))?
            .with_signer(f.signer.clone())
            .send_to(&f.network)
            .await?
            .assert_success();
        // Only the factory account itself may store the pool code, once.
        let code = base64::engine::general_purpose::STANDARD.encode(f.wasm("meme-pool"));
        factory
            .call_function("store_pool_code", json!({ "code": code }))
            .transaction()
            .gas(NearGas::from_tgas(100))
            .with_signer(factory.account_id().clone(), f.signer.clone())
            .send_to(&f.network)
            .await?
            .assert_success();
        Ok(Self { f, factory })
    }

    async fn view(&self, method: &str, args: Value) -> testresult::TestResult<Value> {
        Ok(self
            .factory
            .call_function(method, args)
            .read_only()
            .fetch_from(&self.f.network)
            .await?
            .data)
    }

    async fn launch(
        &self,
        who: &near_api::Account,
        slug: &str,
        deposit: NearToken,
    ) -> testresult::TestResult<near_api::types::transaction::result::TransactionResult> {
        let params = json!({
            "epoch_length_ns": EPOCH_NS.to_string(),
            "initial_emission": EMISSION.to_string(),
            "halving_every": 30,
            "jackpot_bps": 7000,
            "streak_step_bps": 1000,
            "max_streak_bonus_bps": 5000,
            "min_deposit": (ONE_NEAR / 10).to_string(),
        });
        Ok(self
            .factory
            .call_function(
                "create_meme",
                json!({ "slug": slug, "name": "Pepe of NEAR", "symbol": "PEPN", "icon": null, "params": params }),
            )
            .transaction()
            .deposit(deposit)
            .gas(NearGas::from_tgas(300))
            .with_signer(who.account_id().clone(), self.f.signer.clone())
            .send_to(&self.f.network)
            .await?)
    }
}

#[tokio::test]
async fn factory_launches_an_immutable_pool() -> testresult::TestResult<()> {
    let x = FactoryFixture::new().await?;
    assert!(x.view("get_code_hash", json!({})).await?.is_string());
    let cost = u128_of(&x.view("get_launch_cost", json!({})).await?);
    assert!(cost > 2 * ONE_NEAR && cost < 5 * ONE_NEAR, "cost {cost}");

    // Too little attached: rejected before anything is created.
    x.launch(&x.f.alice, "pepn", NearToken::from_yoctonear(cost / 2))
        .await?
        .assert_failure();
    assert_eq!(x.view("get_meme_count", json!({})).await?, 0);

    x.launch(&x.f.alice, "pepn", NearToken::from_yoctonear(cost))
        .await?
        .assert_success();
    let memes = x.view("get_memes", json!({})).await?;
    assert_eq!(memes.as_array().map(Vec::len), Some(1));
    assert_eq!(memes[0]["account_id"], "pepn.factory.sandbox");
    assert_eq!(memes[0]["creator"], x.f.alice.account_id().to_string());

    // The new pool is live, points at the staking pool, and has the chosen params.
    let pool = Contract("pepn.factory.sandbox".parse()?);
    let state: Value = pool
        .call_function("get_state", json!({}))
        .read_only()
        .fetch_from(&x.f.network)
        .await?
        .data;
    assert_eq!(
        state["params"]["staking_pool"],
        x.f.metapool.account_id().to_string()
    );
    assert_eq!(state["params"]["jackpot_bps"], 7000);
    assert_eq!(state["creator"], x.f.alice.account_id().to_string());

    // Deposits work through the factory-made pool too.
    pool.call_function("deposit", json!({}))
        .transaction()
        .deposit(NearToken::from_near(2))
        .gas(NearGas::from_tgas(150))
        .with_signer(x.f.bob.account_id().clone(), x.f.signer.clone())
        .send_to(&x.f.network)
        .await?
        .assert_success();
    let state: Value = pool
        .call_function("get_state", json!({}))
        .read_only()
        .fetch_from(&x.f.network)
        .await?
        .data;
    assert!(u128_of(&state["total_principal"]) > 0);

    // Same slug twice is refused.
    x.launch(&x.f.bob, "pepn", NearToken::from_yoctonear(cost))
        .await?
        .assert_failure();
    assert_eq!(x.view("get_meme_count", json!({})).await?, 1);
    Ok(())
}
