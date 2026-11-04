//! Read-only snapshots for the web app, the keeper and the judges.
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, env, near};

use crate::math::{emission_for, near_from_shares};
use crate::types::{AccountView, Draw, Params, PoolState};
use crate::{Contract, ContractExt};

#[near]
impl Contract {
    pub fn get_params(&self) -> Params {
        self.params.clone()
    }

    pub fn get_state(&self) -> PoolState {
        PoolState {
            params: self.params.clone(),
            creator: self.creator.clone(),
            launched_at: U64(self.launched_at),
            total_principal: U128(self.total_principal),
            total_shares: U128(self.total_shares),
            treasury_shares: U128(self.treasury_shares),
            treasury_near: U128(near_from_shares(self.treasury_shares, self.st_near_price)),
            st_near_price: U128(self.st_near_price),
            total_supply: U128(self.token.total_supply),
            floor_price: U128(self.floor_price()),
            epoch_index: self.epoch_index,
            epoch_start: U64(self.epoch_start),
            next_draw_at: U64(self.epoch_start + self.params.epoch_length_ns.0),
            emission_now: U128(emission_for(&self.params, self.epoch_index)),
            depositors: u64::from(self.depositors.len()),
            checkins_this_epoch: self.checkins_this_epoch,
            draws: u64::from(self.draws.len()),
            draw_in_progress: self.draw_in_progress,
            in_flight: self.in_flight,
            current_time: U64(env::block_timestamp()),
        }
    }

    pub fn get_account(&self, account_id: AccountId) -> AccountView {
        let mut d = self
            .depositors
            .get(&account_id)
            .cloned()
            .unwrap_or_default();
        Self::accrue(&mut d, env::block_timestamp());
        AccountView {
            principal: d.principal,
            meme_balance: U128(self.token.accounts.get(&account_id).unwrap_or(0)),
            streak: d.streak,
            checked_in_this_epoch: self.checked_in_this_epoch(&d),
            total_won: d.total_won,
            weight: U128(self.boosted_weight(&d)),
            registered: self.token.accounts.contains_key(&account_id),
        }
    }

    /// Draw history, oldest first.
    pub fn get_draws(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Draw> {
        self.draws
            .iter()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .cloned()
            .collect()
    }

    /// Depositors with their live view (leaderboards are sorted client-side).
    pub fn get_depositors(
        &self,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<(AccountId, AccountView)> {
        self.depositors
            .keys()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(100) as usize)
            .map(|k| (k.clone(), self.get_account(k.clone())))
            .collect()
    }
}
