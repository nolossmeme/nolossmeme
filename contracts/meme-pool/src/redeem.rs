//! The floor: burn MEME, receive the matching share of the treasury in stNEAR.
use near_contract_standards::fungible_token::events::{FtBurn, FtMint};
use near_sdk::json_types::U128;
use near_sdk::{AccountId, Promise, PromiseError, assert_one_yocto, env, log, near, require};

use crate::constants::GAS_CB_SMALL;
use crate::events;
use crate::math::mul_div;
use crate::{Contract, ContractExt};

#[near]
impl Contract {
    /// Burn `amount` MEME for its pro-rata share of the treasury, paid in stNEAR.
    #[payable]
    pub fn redeem(&mut self, amount: U128) -> Promise {
        assert_one_yocto();
        require!(
            !self.draw_in_progress,
            "draw in progress, retry in a few seconds"
        );
        require!(amount.0 > 0, "amount must be > 0");
        let account = env::predecessor_account_id();
        let shares = mul_div(self.treasury_shares, amount.0, self.token.total_supply);
        require!(shares > 0, "amount too small");
        self.token.internal_withdraw(&account, amount.0);
        FtBurn {
            owner_id: &account,
            amount,
            memo: Some("redeem"),
        }
        .emit();
        self.treasury_shares -= shares;
        self.total_shares -= shares;
        self.in_flight += 1;
        self.ft_transfer_st_near(&account, shares).then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB_SMALL)
                .on_redeem_done(account, amount, U128(shares)),
        )
    }

    #[private]
    pub fn on_redeem_done(
        &mut self,
        account: AccountId,
        amount: U128,
        shares: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> U128 {
        self.in_flight -= 1;
        if result.is_err() {
            self.treasury_shares += shares.0;
            self.total_shares += shares.0;
            self.token.internal_deposit(&account, amount.0);
            FtMint {
                owner_id: &account,
                amount,
                memo: Some("redeem rollback"),
            }
            .emit();
            log!("stNEAR transfer failed, MEME restored");
            return U128(0);
        }
        events::redeem(&account, amount.0, shares.0);
        shares
    }
}
