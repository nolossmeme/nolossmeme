//! NEP-141 (core), NEP-145 (storage) and NEP-148 (metadata) for the MEME token.
//!
//! Storage is a flat [`STORAGE_COST`] per account that covers both the token balance
//! and the depositor record; it is refunded on `storage_unregister`.
use near_contract_standards::fungible_token::events::FtBurn;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider,
};
use near_contract_standards::fungible_token::{FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{
    AccountId, NearToken, Promise, PromiseOrValue, assert_one_yocto, env, near, require,
};

use crate::constants::STORAGE_COST;
use crate::{Contract, ContractExt};

fn fixed_balance() -> StorageBalance {
    StorageBalance {
        total: STORAGE_COST,
        available: NearToken::from_yoctonear(0),
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo);
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used, burned) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned > 0 {
            FtBurn {
                owner_id: &sender_id,
                amount: U128(burned),
                memo: None,
            }
            .emit();
        }
        U128(used)
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        #[allow(unused_variables)] registration_only: Option<bool>,
    ) -> StorageBalance {
        let account = account_id.unwrap_or_else(env::predecessor_account_id);
        let attached = env::attached_deposit();
        let refund = if self.token.accounts.contains_key(&account) {
            attached
        } else {
            require!(attached >= STORAGE_COST, "attach at least STORAGE_COST");
            self.token.internal_register_account(&account);
            attached.saturating_sub(STORAGE_COST)
        };
        if !refund.is_zero() {
            Promise::new(env::predecessor_account_id())
                .transfer(refund)
                .detach();
        }
        fixed_balance()
    }

    #[payable]
    fn storage_withdraw(
        &mut self,
        #[allow(unused_variables)] amount: Option<NearToken>,
    ) -> StorageBalance {
        assert_one_yocto();
        fixed_balance()
    }

    /// Close the account and get the storage fee back. Requires zero principal; with
    /// `force` any remaining MEME is burned.
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        assert_one_yocto();
        let account = env::predecessor_account_id();
        let Some(balance) = self.token.accounts.get(&account) else {
            return false;
        };
        let principal = self.depositors.get(&account).map_or(0, |d| d.principal.0);
        require!(principal == 0, "withdraw principal first");
        // A failing withdraw or redeem rolls back onto this account; keep it registered meanwhile.
        require!(self.in_flight == 0, "withdrawals in flight, retry");
        require!(
            balance == 0 || force == Some(true),
            "redeem your MEME first, or pass force=true to burn it"
        );
        if balance > 0 {
            self.token.internal_withdraw(&account, balance);
            FtBurn {
                owner_id: &account,
                amount: U128(balance),
                memo: Some("unregister"),
            }
            .emit();
        }
        self.token.accounts.remove(&account);
        self.depositors.remove(&account);
        Promise::new(account).transfer(STORAGE_COST).detach();
        true
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds {
            min: STORAGE_COST,
            max: Some(STORAGE_COST),
        }
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token
            .accounts
            .contains_key(&account_id)
            .then(fixed_balance)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().clone().expect("metadata set at init")
    }
}
