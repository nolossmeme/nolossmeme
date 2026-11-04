//! `create_meme`: sub-account, deploy, init, register. Refunds on failure.
use near_sdk::json_types::U64;
use near_sdk::serde_json::json;
use near_sdk::{AccountId, Gas, NearToken, Promise, PromiseError, env, log, near, require};

use crate::types::{MemeInfo, PoolParams};
use crate::{Contract, ContractExt};

const GAS_INIT: Gas = Gas::from_tgas(30);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);
/// Allowance for the new pool's own state (token, depositors, draws) on top of its code.
pub(crate) const STATE_ALLOWANCE: NearToken = NearToken::from_millinear(500);
const MAX_SLUG_LEN: usize = 32;

#[near]
impl Contract {
    /// Launch a memecoin at `<slug>.<factory>`. Attach at least `get_launch_cost()`;
    /// the whole deposit funds the new account (it pays for code and state storage).
    #[payable]
    pub fn create_meme(
        &mut self,
        slug: String,
        name: String,
        symbol: String,
        icon: Option<String>,
        params: PoolParams,
    ) -> Promise {
        Self::validate_slug(&slug);
        require!(!self.memes.contains_key(&slug), "slug already taken");
        let cost = self.get_launch_cost();
        require!(
            env::attached_deposit() >= cost,
            format!("attach at least {} yoctoNEAR", cost.as_yoctonear())
        );
        let account_id: AccountId = format!("{slug}.{}", env::current_account_id())
            .parse()
            .expect("valid sub-account");
        let creator = env::predecessor_account_id();
        let info = MemeInfo {
            slug: slug.clone(),
            account_id: account_id.clone(),
            creator: creator.clone(),
            name: name.clone(),
            symbol: symbol.clone(),
            icon: icon.clone(),
            created_at: U64(env::block_timestamp()),
            params: params.clone(),
        };
        let init_args = json!({
            "creator": creator,
            "name": name,
            "symbol": symbol,
            "icon": icon,
            "params": {
                "staking_pool": self.staking_pool,
                "epoch_length_ns": params.epoch_length_ns,
                "initial_emission": params.initial_emission,
                "halving_every": params.halving_every,
                "jackpot_bps": params.jackpot_bps,
                "streak_step_bps": params.streak_step_bps,
                "max_streak_bonus_bps": params.max_streak_bonus_bps,
                "min_deposit": params.min_deposit,
            }
        });
        Promise::new(account_id)
            .create_account()
            .transfer(env::attached_deposit())
            .deploy_contract(self.pool_code())
            .function_call(
                "new".to_string(),
                init_args.to_string().into_bytes(),
                NearToken::from_yoctonear(0),
                GAS_INIT,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_meme_created(info, env::attached_deposit()),
            )
    }

    #[private]
    pub fn on_meme_created(
        &mut self,
        info: MemeInfo,
        deposit: NearToken,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> Option<MemeInfo> {
        if result.is_err() {
            log!("launch of {} failed, refunding {}", info.slug, info.creator);
            Promise::new(info.creator).transfer(deposit).detach();
            return None;
        }
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "nolossmeme",
                "version": "1.0.0",
                "event": "launch",
                "data": [{ "slug": info.slug, "account_id": info.account_id, "creator": info.creator, "symbol": info.symbol, "name": info.name }]
            })
        ));
        self.memes.insert(info.slug.clone(), info.clone());
        Some(info)
    }
}

impl Contract {
    fn validate_slug(slug: &str) {
        require!(
            (2..=MAX_SLUG_LEN).contains(&slug.len()),
            "slug must be 2-32 characters"
        );
        require!(
            slug.bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_'),
            "slug may only contain a-z, 0-9, - and _"
        );
        require!(
            !slug.starts_with('-') && !slug.ends_with('-'),
            "slug may not start or end with -"
        );
    }
}
