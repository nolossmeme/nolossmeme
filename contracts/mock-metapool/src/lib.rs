//! A tiny Meta Pool look-alike for sandbox tests.
//!
//! Implements exactly the surface `meme-pool` uses: `deposit_and_stake`,
//! `get_st_near_price`, `ft_transfer`, `ft_balance_of`, `liquid_unstake` and `withdraw`,
//! plus a test-only `set_price` to simulate staking yield. Never deploy this on mainnet.
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{
    AccountId, NearToken, PanicOnDefault, Promise, assert_one_yocto, env, near, require,
};
use primitive_types::U256;

const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
/// Liquid-unstake fee, 0.3% like Meta Pool's floor.
const LIQUID_UNSTAKE_FEE_BPS: u128 = 30;
/// Meta Pool's `min_deposit_amount` on testnet.
const MIN_DEPOSIT: u128 = ONE_NEAR;

fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    (U256::from(a) * U256::from(b) / U256::from(c)).as_u128()
}

#[near(serializers = [borsh])]
#[derive(Default, Clone)]
pub struct Account {
    shares: u128,
    available: u128,
}

#[near(serializers = [json])]
pub struct LiquidUnstakeResult {
    pub near: U128,
    pub fee: U128,
    pub meta: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    price: u128,
    total_shares: u128,
    accounts: LookupMap<AccountId, Account>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(price: U128) -> Self {
        Self {
            price: price.0,
            total_shares: 0,
            accounts: LookupMap::new(b"a"),
        }
    }

    /// Test hook: pretend the validators paid rewards.
    pub fn set_price(&mut self, price: U128) {
        require!(price.0 > 0, "price must be > 0");
        self.price = price.0;
    }

    pub fn get_st_near_price(&self) -> U128 {
        U128(self.price)
    }

    #[payable]
    pub fn deposit_and_stake(&mut self) -> U128 {
        let amount = env::attached_deposit().as_yoctonear();
        require!(
            amount >= MIN_DEPOSIT,
            format!("minimum deposit amount is {MIN_DEPOSIT}")
        );
        let shares = mul_div(amount, ONE_NEAR, self.price);
        let mut acc = self.account(&env::predecessor_account_id());
        acc.shares += shares;
        self.accounts.insert(env::predecessor_account_id(), acc);
        self.total_shares += shares;
        U128(shares)
    }

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        assert_one_yocto();
        let _ = memo;
        let sender = env::predecessor_account_id();
        let mut from = self.account(&sender);
        require!(from.shares >= amount.0, "not enough stNEAR");
        from.shares -= amount.0;
        let mut to = self.account(&receiver_id);
        to.shares += amount.0;
        self.accounts.insert(sender, from);
        self.accounts.insert(receiver_id, to);
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.account(&account_id).shares)
    }

    pub fn ft_total_supply(&self) -> U128 {
        U128(self.total_shares)
    }

    pub fn liquid_unstake(
        &mut self,
        st_near_to_burn: U128,
        min_expected_near: U128,
    ) -> LiquidUnstakeResult {
        let caller = env::predecessor_account_id();
        let mut acc = self.account(&caller);
        require!(acc.shares >= st_near_to_burn.0, "not enough stNEAR");
        let gross = mul_div(st_near_to_burn.0, self.price, ONE_NEAR);
        let fee = gross * LIQUID_UNSTAKE_FEE_BPS / 10_000;
        let near = gross - fee;
        require!(
            near >= min_expected_near.0,
            "min_expected_near not satisfied"
        );
        acc.shares -= st_near_to_burn.0;
        acc.available += near;
        self.accounts.insert(caller, acc);
        self.total_shares -= st_near_to_burn.0;
        LiquidUnstakeResult {
            near: U128(near),
            fee: U128(fee),
            meta: U128(0),
        }
    }

    pub fn withdraw(&mut self, amount: U128) -> Promise {
        let caller = env::predecessor_account_id();
        let mut acc = self.account(&caller);
        require!(acc.available >= amount.0, "not enough available");
        acc.available -= amount.0;
        self.accounts.insert(caller.clone(), acc);
        Promise::new(caller).transfer(NearToken::from_yoctonear(amount.0))
    }

    pub fn get_account_info(&self, account_id: AccountId) -> (U128, U128) {
        let a = self.account(&account_id);
        (U128(a.shares), U128(a.available))
    }
}

impl Contract {
    fn account(&self, id: &AccountId) -> Account {
        self.accounts.get(id).cloned().unwrap_or_default()
    }
}
