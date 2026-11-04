//! Registry reads and the launch price.
use near_sdk::json_types::Base64VecU8;
use near_sdk::{AccountId, NearToken, env, near};

use crate::types::MemeInfo;
use crate::{Contract, ContractExt};

#[near]
impl Contract {
    pub fn get_staking_pool(&self) -> AccountId {
        self.staking_pool.clone()
    }

    /// sha256 of the pool wasm every launch receives, or `None` before it is stored.
    pub fn get_code_hash(&self) -> Option<Base64VecU8> {
        self.code_hash.map(|h| Base64VecU8::from(h.to_vec()))
    }

    /// NEAR a creator must attach: storage for the pool code plus a state allowance.
    pub fn get_launch_cost(&self) -> NearToken {
        let code_len = env::storage_read(crate::CODE_KEY).map_or(0, |c| c.len());
        env::storage_byte_cost()
            .saturating_mul(code_len as u128)
            .saturating_add(crate::launch::STATE_ALLOWANCE)
    }

    pub fn get_meme(&self, slug: String) -> Option<MemeInfo> {
        self.memes.get(&slug).cloned()
    }

    pub fn get_memes(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<MemeInfo> {
        self.memes
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .cloned()
            .collect()
    }

    pub fn get_meme_count(&self) -> u32 {
        self.memes.len()
    }
}
