//! Principal in, principal out. Every path that touches the staking pool lives here.
//!
//! State is only committed in callbacks (deposit) or optimistically reduced and restored
//! on failure (withdraw), so a failed promise never strands user funds.
use near_sdk::json_types::U128;
use near_sdk::{
    AccountId, NearToken, Promise, PromiseError, PromiseOrValue, env, log, near, require,
};

use crate::constants::*;
use crate::math::{mul_div, shares_from_near};
use crate::types::LiquidUnstakeResult;
use crate::{Contract, ContractExt};

#[near]
impl Contract {
    /// Deposit NEAR. Unregistered accounts pay [`STORAGE_COST`] out of the deposit once.
    /// The rest is staked with the staking pool; principal is credited in the callback.
    #[payable]
    pub fn deposit(&mut self) -> Promise {
        let account = env::predecessor_account_id();
        let mut amount = env::attached_deposit().as_yoctonear();
        if !self.token.accounts.contains_key(&account) {
            require!(
                amount > STORAGE_COST.as_yoctonear(),
                "deposit too small to cover storage"
            );
            amount -= STORAGE_COST.as_yoctonear();
            self.token.internal_register_account(&account);
        }
        require!(amount >= self.params.min_deposit.0, "below min_deposit");
        Promise::new(self.params.staking_pool.clone())
            .function_call(
                "deposit_and_stake".to_string(),
                b"{}".to_vec(),
                NearToken::from_yoctonear(amount),
                GAS_STAKE,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CB_SMALL)
                    .on_deposit(account, U128(amount)),
            )
    }

    #[private]
    pub fn on_deposit(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] shares: Result<U128, PromiseError>,
    ) -> U128 {
        match shares {
            Ok(shares) if shares.0 > 0 => {
                self.credit_principal(&account, amount.0);
                self.total_shares += shares.0;
                self.st_near_price = mul_div(amount.0, ONE_NEAR, shares.0);
                log!(
                    "deposit {} yoctoNEAR from {} -> {} stNEAR shares",
                    amount.0,
                    account,
                    shares.0
                );
                amount
            }
            _ => {
                log!("staking failed, refunding {} to {}", amount.0, account);
                Promise::new(account)
                    .transfer(NearToken::from_yoctonear(amount.0))
                    .detach();
                U128(0)
            }
        }
    }

    /// Withdraw principal as stNEAR: instant, no fee, worth exactly `amount` NEAR at the
    /// current price. `None` withdraws everything.
    pub fn withdraw(&mut self, amount: Option<U128>) -> Promise {
        let (account, amount) = self.begin_withdraw(amount);
        self.price_promise().then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB_WITHDRAW)
                .on_withdraw_price(account, U128(amount)),
        )
    }

    /// Withdraw principal as NEAR right now via Meta Pool's liquid-unstake pool.
    /// Meta Pool charges a swap fee (see its `nslp_get_discount_basis_points`);
    /// `min_near` guards against it.
    pub fn withdraw_near(&mut self, amount: Option<U128>, min_near: U128) -> Promise {
        let (account, amount) = self.begin_withdraw(amount);
        self.price_promise().then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB_WITHDRAW_NEAR)
                .on_withdraw_near_price(account, U128(amount), min_near),
        )
    }

    #[private]
    pub fn on_withdraw_price(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] price: Result<U128, PromiseError>,
    ) -> PromiseOrValue<U128> {
        let Ok(price) = price else {
            self.abort_withdraw(&account, amount.0, None);
            return PromiseOrValue::Value(U128(0));
        };
        let shares = self.shares_for_withdraw(amount.0, price.0);
        PromiseOrValue::Promise(
            self.ft_transfer_st_near(&account, shares).then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CB_SMALL)
                    .on_withdraw_done(account, amount, U128(shares)),
            ),
        )
    }

    #[private]
    pub fn on_withdraw_done(
        &mut self,
        account: AccountId,
        amount: U128,
        shares: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> U128 {
        if result.is_err() {
            log!("stNEAR transfer failed, principal restored");
            self.abort_withdraw(&account, amount.0, Some(shares.0));
            return U128(0);
        }
        self.in_flight -= 1;
        self.cleanup_depositor(&account);
        log!(
            "withdraw {} yoctoNEAR as {} stNEAR to {}",
            amount.0,
            shares.0,
            account
        );
        shares
    }

    #[private]
    pub fn on_withdraw_near_price(
        &mut self,
        account: AccountId,
        amount: U128,
        min_near: U128,
        #[callback_result] price: Result<U128, PromiseError>,
    ) -> PromiseOrValue<U128> {
        let Ok(price) = price else {
            self.abort_withdraw(&account, amount.0, None);
            return PromiseOrValue::Value(U128(0));
        };
        let shares = self.shares_for_withdraw(amount.0, price.0);
        let args = near_sdk::serde_json::json!({
            "st_near_to_burn": U128(shares),
            "min_expected_near": min_near,
        });
        let unstake = Promise::new(self.params.staking_pool.clone()).function_call(
            "liquid_unstake".to_string(),
            args.to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            GAS_LIQUID_UNSTAKE,
        );
        PromiseOrValue::Promise(
            unstake.then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CB_AFTER_UNSTAKE)
                    .on_liquid_unstaked(account, amount, U128(shares)),
            ),
        )
    }

    #[private]
    pub fn on_liquid_unstaked(
        &mut self,
        account: AccountId,
        amount: U128,
        shares: U128,
        #[callback_result] result: Result<LiquidUnstakeResult, PromiseError>,
    ) -> PromiseOrValue<U128> {
        let Ok(res) = result else {
            log!("liquid_unstake failed, principal restored");
            self.abort_withdraw(&account, amount.0, Some(shares.0));
            return PromiseOrValue::Value(U128(0));
        };
        // The NEAR now sits in our "available" balance on the staking pool. Pull it here,
        // then forward it. Both legs move funds that are already ours, so no rollback.
        self.cleanup_depositor(&account);
        let pull = Promise::new(self.params.staking_pool.clone()).function_call(
            "withdraw".to_string(),
            near_sdk::serde_json::json!({ "amount": res.near })
                .to_string()
                .into_bytes(),
            NearToken::from_yoctonear(0),
            GAS_POOL_WITHDRAW,
        );
        PromiseOrValue::Promise(
            pull.then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CB_SMALL)
                    .on_near_pulled(account, res.near, res.fee),
            ),
        )
    }

    #[private]
    pub fn on_near_pulled(
        &mut self,
        account: AccountId,
        near: U128,
        fee: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> U128 {
        self.in_flight -= 1;
        require!(
            result.is_ok(),
            "staking pool withdraw failed; funds remain in the pool's available balance"
        );
        log!(
            "withdraw_near {} yoctoNEAR (fee {}) to {}",
            near.0,
            fee.0,
            account
        );
        Promise::new(account)
            .transfer(NearToken::from_yoctonear(near.0))
            .detach();
        near
    }
}

impl Contract {
    pub(crate) fn credit_principal(&mut self, account: &AccountId, amount: u128) {
        let mut d = self.depositors.get(account).cloned().unwrap_or_default();
        Self::accrue(&mut d, env::block_timestamp());
        d.principal = U128(d.principal.0 + amount);
        self.depositors.insert(account.clone(), d);
        self.total_principal += amount;
    }

    /// Optimistically remove principal and count the chain as in flight.
    fn begin_withdraw(&mut self, amount: Option<U128>) -> (AccountId, u128) {
        require!(
            !self.draw_in_progress,
            "draw in progress, retry in a few seconds"
        );
        let account = env::predecessor_account_id();
        let mut d = self.depositors.get(&account).cloned().expect("no deposit");
        let amount = amount.map_or(d.principal.0, |a| a.0);
        require!(amount > 0 && amount <= d.principal.0, "invalid amount");
        Self::accrue(&mut d, env::block_timestamp());
        d.principal = U128(d.principal.0 - amount);
        self.depositors.insert(account.clone(), d);
        self.total_principal -= amount;
        self.in_flight += 1;
        (account, amount)
    }

    /// Undo [`Self::begin_withdraw`] (and the share debit, if it already happened).
    fn abort_withdraw(&mut self, account: &AccountId, amount: u128, debited_shares: Option<u128>) {
        if let Some(s) = debited_shares {
            self.total_shares += s;
        }
        self.credit_principal(account, amount);
        self.in_flight -= 1;
    }

    fn shares_for_withdraw(&mut self, amount: u128, price: u128) -> u128 {
        self.st_near_price = price;
        let shares = shares_from_near(amount, price);
        require!(
            shares <= self.total_shares - self.treasury_shares,
            "vault cannot cover principal (staking pool slashed?)"
        );
        self.total_shares -= shares;
        shares
    }

    pub(crate) fn price_promise(&self) -> Promise {
        Promise::new(self.params.staking_pool.clone()).function_call(
            "get_st_near_price".to_string(),
            b"{}".to_vec(),
            NearToken::from_yoctonear(0),
            GAS_PRICE_VIEW,
        )
    }

    pub(crate) fn ft_transfer_st_near(&self, receiver: &AccountId, shares: u128) -> Promise {
        let args = near_sdk::serde_json::json!({ "receiver_id": receiver, "amount": U128(shares) });
        Promise::new(self.params.staking_pool.clone()).function_call(
            "ft_transfer".to_string(),
            args.to_string().into_bytes(),
            NearToken::from_yoctonear(1),
            GAS_FT_TRANSFER,
        )
    }

    fn cleanup_depositor(&mut self, account: &AccountId) {
        if self
            .depositors
            .get(account)
            .is_some_and(|d| d.principal.0 == 0)
        {
            self.depositors.remove(account);
        }
    }
}
