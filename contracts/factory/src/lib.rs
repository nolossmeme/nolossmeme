//! NoLossMeme factory.
//!
//! Anyone can launch a memecoin: the factory creates `<slug>.<factory>`, deploys the
//! `meme-pool` code it holds, initialises it with the caller's parameters and records
//! the launch in a public registry. Pools have no owner; the factory itself only decides
//! which code *future* launches get, and that code is frozen once stored.
mod launch;
mod types;
mod views;

use near_sdk::json_types::Base64VecU8;
use near_sdk::store::IterableMap;
use near_sdk::{AccountId, PanicOnDefault, env, near, require};

pub use types::*;

/// Raw storage key for the pool wasm. Kept out of the contract struct so ordinary calls
/// never deserialise 270 KB of code.
pub(crate) const CODE_KEY: &[u8] = b"pool_code";

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Meta Pool contract every launched pool stakes into.
    staking_pool: AccountId,
    memes: IterableMap<String, MemeInfo>,
    code_hash: Option<[u8; 32]>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(staking_pool: AccountId) -> Self {
        Self {
            staking_pool,
            memes: IterableMap::new(b"m"),
            code_hash: None,
        }
    }

    /// Store the `meme-pool` wasm. Callable once, by the factory account itself, so the
    /// code every launch receives is fixed and verifiable via `get_code_hash`.
    pub fn store_pool_code(&mut self, code: Base64VecU8) -> Base64VecU8 {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "only the factory account can store code"
        );
        require!(self.code_hash.is_none(), "pool code already stored");
        let code: Vec<u8> = code.into();
        require!(code.len() > 1_000, "not a wasm blob");
        let hash: [u8; 32] = env::sha256(&code).try_into().expect("sha256 is 32 bytes");
        env::storage_write(CODE_KEY, &code);
        self.code_hash = Some(hash);
        Base64VecU8::from(hash.to_vec())
    }
}

impl Contract {
    pub(crate) fn pool_code(&self) -> Vec<u8> {
        env::storage_read(CODE_KEY).expect("pool code not stored yet")
    }
}

#[cfg(test)]
mod tests {
    use near_sdk::NearToken;
    use near_sdk::json_types::{U64, U128};
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    use super::*;

    fn factory() -> AccountId {
        "nolossmeme.testnet".parse().unwrap()
    }

    fn ctx(predecessor: &str, deposit: u128) {
        testing_env!(
            VMContextBuilder::new()
                .current_account_id(factory())
                .predecessor_account_id(predecessor.parse().unwrap())
                .attached_deposit(NearToken::from_yoctonear(deposit))
                .build()
        );
    }

    fn params() -> PoolParams {
        PoolParams {
            epoch_length_ns: U64(86_400_000_000_000),
            initial_emission: U128(1_000_000_000_000_000_000_000),
            halving_every: 30,
            jackpot_bps: 7_000,
            streak_step_bps: 1_000,
            max_streak_bonus_bps: 5_000,
            min_deposit: U128(100_000_000_000_000_000_000_000),
        }
    }

    #[test]
    fn code_is_stored_once_by_the_factory_only() {
        ctx("nolossmeme.testnet", 0);
        let mut c = Contract::new("meta-v2.pool.testnet".parse().unwrap());
        assert!(c.get_code_hash().is_none());
        c.store_pool_code(Base64VecU8::from(vec![1u8; 2_000]));
        assert!(c.get_code_hash().is_some());
        let again = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.store_pool_code(Base64VecU8::from(vec![2u8; 2_000]))
        }));
        assert!(again.is_err());
    }

    #[test]
    #[should_panic(expected = "only the factory account")]
    fn strangers_cannot_store_code() {
        ctx("nolossmeme.testnet", 0);
        let mut c = Contract::new("meta-v2.pool.testnet".parse().unwrap());
        ctx("mallory.testnet", 0);
        c.store_pool_code(Base64VecU8::from(vec![1u8; 2_000]));
    }

    #[test]
    fn launch_cost_covers_code_and_state() {
        ctx("nolossmeme.testnet", 0);
        let mut c = Contract::new("meta-v2.pool.testnet".parse().unwrap());
        c.store_pool_code(Base64VecU8::from(vec![1u8; 200_000]));
        let cost = c.get_launch_cost().as_yoctonear();
        // 200 KB * 1e19 yocto/byte = 2 NEAR for code, plus the state allowance
        assert!(cost > NearToken::from_near(2).as_yoctonear());
        assert!(cost < NearToken::from_near(4).as_yoctonear());
    }

    #[test]
    #[should_panic(expected = "slug")]
    fn slug_must_be_a_valid_subaccount_label() {
        ctx("nolossmeme.testnet", 0);
        let mut c = Contract::new("meta-v2.pool.testnet".parse().unwrap());
        c.store_pool_code(Base64VecU8::from(vec![1u8; 2_000]));
        ctx("alice.testnet", 10_000_000_000_000_000_000_000_000);
        let _ = c.create_meme("Bad Slug!".into(), "x".into(), "X".into(), None, params());
    }
}
