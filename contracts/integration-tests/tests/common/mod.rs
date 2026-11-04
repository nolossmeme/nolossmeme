//! Shared sandbox fixture: a mock Meta Pool, one meme pool and a few funded accounts.
#![allow(dead_code)]
use near_api::{Account, AccountId, Contract, NearGas, NearToken, NetworkConfig, Signer};
use near_sandbox::Sandbox;
use serde_json::{Value, json};
use std::sync::Arc;

pub const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
pub const ONE_MEME: u128 = 1_000_000_000_000_000_000;
pub const EPOCH_NS: u64 = 60_000_000_000;
pub const EMISSION: u128 = 1_000 * ONE_MEME;

pub struct Fixture {
    pub sandbox: Sandbox,
    pub network: NetworkConfig,
    pub signer: Arc<Signer>,
    pub metapool: Contract,
    pub pool: Contract,
    pub alice: Account,
    pub bob: Account,
}

pub fn wasm(crate_dir: &str) -> Vec<u8> {
    let manifest = format!("{}/../{}/Cargo.toml", env!("CARGO_MANIFEST_DIR"), crate_dir);
    let path = cargo_near_build::build_with_cli(cargo_near_build::BuildOpts {
        manifest_path: Some(manifest.into()),
        no_abi: true,
        no_locked: true,
        ..Default::default()
    })
    .expect("build wasm");
    std::fs::read(path).expect("read wasm")
}

impl Fixture {
    pub async fn new() -> testresult::TestResult<Self> {
        let sandbox = Sandbox::start_sandbox().await?;
        let network = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);
        let signer = Signer::from_secret_key(
            near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
        )?;

        let metapool = Self::account(&sandbox, "metapool.sandbox", 200)
            .await?
            .as_contract();
        let pool = Self::account(&sandbox, "dogn.sandbox", 20)
            .await?
            .as_contract();
        let alice = Self::account(&sandbox, "alice.sandbox", 100).await?;
        let bob = Self::account(&sandbox, "bob.sandbox", 100).await?;

        Contract::deploy(metapool.account_id().clone())
            .use_code(wasm("mock-metapool"))
            .with_init_call("new", json!({ "price": ONE_NEAR.to_string() }))?
            .with_signer(signer.clone())
            .send_to(&network)
            .await?
            .assert_success();

        let params = json!({
            "staking_pool": metapool.account_id(),
            "epoch_length_ns": EPOCH_NS.to_string(),
            "initial_emission": EMISSION.to_string(),
            "halving_every": 30,
            "jackpot_bps": 7000,
            "streak_step_bps": 1000,
            "max_streak_bonus_bps": 5000,
            "min_deposit": (ONE_NEAR / 10).to_string(),
        });
        Contract::deploy(pool.account_id().clone())
            .use_code(wasm("meme-pool"))
            .with_init_call(
                "new",
                json!({
                    "creator": alice.account_id(),
                    "name": "Doge of NEAR",
                    "symbol": "DOGN",
                    "icon": null,
                    "params": params,
                }),
            )?
            .with_signer(signer.clone())
            .send_to(&network)
            .await?
            .assert_success();

        Ok(Self {
            sandbox,
            network,
            signer,
            metapool,
            pool,
            alice,
            bob,
        })
    }

    async fn account(sandbox: &Sandbox, name: &str, near: u128) -> testresult::TestResult<Account> {
        let id: AccountId = name.parse()?;
        sandbox
            .create_account(id.as_str().parse()?)
            .initial_balance(NearToken::from_near(near))
            .send()
            .await?;
        Ok(Account(id))
    }

    /// Extra funded account on the running sandbox.
    pub async fn create_account(&self, name: &str, near: u128) -> testresult::TestResult<Account> {
        Self::account(&self.sandbox, name, near).await
    }

    /// Build (or reuse) a contract wasm from this workspace.
    pub fn wasm(&self, crate_dir: &str) -> Vec<u8> {
        wasm(crate_dir)
    }

    /// Change method on the pool. Returns the execution result for assertions.
    pub async fn call(
        &self,
        who: &Account,
        method: &str,
        args: Value,
        deposit: NearToken,
    ) -> testresult::TestResult<near_api::types::transaction::result::TransactionResult> {
        Ok(self
            .pool
            .call_function(method, args)
            .transaction()
            .deposit(deposit)
            .gas(NearGas::from_tgas(300))
            .with_signer(who.account_id().clone(), self.signer.clone())
            .send_to(&self.network)
            .await?)
    }

    pub async fn view(&self, method: &str, args: Value) -> testresult::TestResult<Value> {
        Ok(self
            .pool
            .call_function(method, args)
            .read_only()
            .fetch_from(&self.network)
            .await?
            .data)
    }

    pub async fn state(&self) -> testresult::TestResult<Value> {
        self.view("get_state", json!({})).await
    }

    pub async fn account_view(&self, who: &Account) -> testresult::TestResult<Value> {
        self.view("get_account", json!({ "account_id": who.account_id() }))
            .await
    }

    pub async fn st_near_balance(&self, who: &Account) -> testresult::TestResult<u128> {
        let v: Value = self
            .metapool
            .call_function("ft_balance_of", json!({ "account_id": who.account_id() }))
            .read_only()
            .fetch_from(&self.network)
            .await?
            .data;
        Ok(u128_of(&v))
    }

    pub async fn near_balance(&self, who: &Account) -> testresult::TestResult<u128> {
        Ok(who
            .tokens()
            .near_balance()
            .fetch_from(&self.network)
            .await?
            .total
            .as_yoctonear())
    }

    /// Simulate staking rewards: bump the mock price by `bps`.
    pub async fn accrue_yield(&self, bps: u128) -> testresult::TestResult<()> {
        let v: Value = self
            .metapool
            .call_function("get_st_near_price", json!({}))
            .read_only()
            .fetch_from(&self.network)
            .await?
            .data;
        let price = u128_of(&v) * (10_000 + bps) / 10_000;
        self.metapool
            .call_function("set_price", json!({ "price": price.to_string() }))
            .transaction()
            .with_signer(self.metapool.account_id().clone(), self.signer.clone())
            .send_to(&self.network)
            .await?
            .assert_success();
        Ok(())
    }

    /// Advance sandbox time past the current epoch end.
    pub async fn next_epoch(&self) -> testresult::TestResult<()> {
        loop {
            let s = self.state().await?;
            let now = u64_of(&s["current_time"]);
            let next = u64_of(&s["next_draw_at"]);
            if now >= next {
                return Ok(());
            }
            self.sandbox.fast_forward(50).await?;
        }
    }

    pub async fn deposit(&self, who: &Account, near: u128) -> testresult::TestResult<()> {
        self.call(
            who,
            "deposit",
            json!({}),
            NearToken::from_yoctonear(near + ONE_NEAR / 200),
        )
        .await?
        .assert_success();
        Ok(())
    }
}

pub fn u128_of(v: &Value) -> u128 {
    v.as_str().expect("string number").parse().expect("u128")
}

pub fn u64_of(v: &Value) -> u64 {
    v.as_str().expect("string number").parse().expect("u64")
}
