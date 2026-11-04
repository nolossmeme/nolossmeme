//! Epoch roll-over: sweep yield, pick a winner, mint.
//!
//! `draw` is permissionless. It fetches the live stNEAR price and finishes in
//! `on_draw_price`, which runs the whole epoch settlement in one callback so the
//! randomness, the weights and the mint are atomic.
use near_contract_standards::fungible_token::events::FtMint;
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, Promise, PromiseError, env, log, near, require};

use crate::constants::*;
use crate::math::{emission_for, hex, mul_div, mul_div_ceil, near_from_shares};
use crate::types::Draw;
use crate::{Contract, ContractExt};

/// One depositor's standing in the lottery.
struct Ticket {
    account: AccountId,
    weight: u128,
    checked_in: bool,
}

#[near]
impl Contract {
    /// Anyone may call once the epoch is over.
    pub fn draw(&mut self) -> Promise {
        require!(!self.draw_in_progress, "draw already in progress");
        require!(self.in_flight == 0, "withdrawals in flight, retry");
        require!(
            env::block_timestamp() >= self.epoch_start + self.params.epoch_length_ns.0,
            "epoch not over"
        );
        self.draw_in_progress = true;
        self.price_promise().then(
            Self::ext(env::current_account_id())
                .with_static_gas(GAS_CB_DRAW)
                .on_draw_price(),
        )
    }

    #[private]
    pub fn on_draw_price(&mut self, #[callback_result] price: Result<U128, PromiseError>) -> Draw {
        self.draw_in_progress = false;
        let price = price.expect("price lookup failed").0;
        self.st_near_price = price;
        let now = env::block_timestamp();

        let yield_shares = self.sweep_yield(price);
        let (tickets, total_weight, checkins) = self.settle_tickets(now);
        let seed = self.epoch_seed(total_weight);
        let emission = emission_for(&self.params, self.epoch_index);

        let (winner, jackpot, each, minted) = if total_weight > 0 && emission > 0 {
            self.mint_epoch(&tickets, total_weight, checkins, emission, &seed)
        } else {
            (None, 0, 0, 0)
        };

        let epoch = self.epoch_index;
        self.roll_epoch(now);

        let draw = Draw {
            epoch,
            timestamp: U64(now),
            yield_shares: U128(yield_shares),
            yield_near: U128(near_from_shares(yield_shares, price)),
            st_near_price: U128(price),
            total_weight: U128(total_weight),
            depositors: tickets.len() as u32,
            checkins,
            winner,
            jackpot: U128(jackpot),
            checkin_reward_each: U128(each),
            minted: U128(minted),
            supply_after: U128(self.token.total_supply),
            floor_after: U128(self.floor_price()),
            seed: hex(&seed),
        };
        self.draws.push(draw.clone());
        log!(
            "draw #{} winner={:?} jackpot={} checkins={} yield_shares={}",
            draw.epoch,
            draw.winner,
            jackpot,
            checkins,
            yield_shares
        );
        draw
    }
}

impl Contract {
    /// Whatever the vault holds beyond what covers principal is treasury. Returns the
    /// newly swept shares. Never shrinks the treasury (a price drop would mean slashing).
    fn sweep_yield(&mut self, price: u128) -> u128 {
        let principal_shares = mul_div_ceil(self.total_principal, ONE_NEAR, price);
        let covered = self.total_shares.saturating_sub(principal_shares);
        let swept = covered.saturating_sub(self.treasury_shares);
        self.treasury_shares = self.treasury_shares.max(covered);
        swept
    }

    /// Finalise every depositor's weight for the epoch and reset their accumulator.
    // ponytail: O(n) scan over depositors per draw; fine for hundreds of accounts within
    // one 300 TGas call. Beyond that, keep a sum tree and settle in pages.
    fn settle_tickets(&mut self, now: u64) -> (Vec<Ticket>, u128, u32) {
        let keys: Vec<AccountId> = self.depositors.keys().cloned().collect();
        let mut tickets = Vec::with_capacity(keys.len());
        let mut total_weight = 0u128;
        let mut checkins = 0u32;
        for account in keys {
            let mut d = self.depositors.get(&account).cloned().unwrap_or_default();
            Self::accrue(&mut d, now);
            let checked_in = self.checked_in_this_epoch(&d);
            let weight = self.boosted_weight(&d);
            d.weight_acc = U128(0);
            self.depositors.insert(account.clone(), d);
            checkins += u32::from(checked_in);
            total_weight += weight;
            tickets.push(Ticket {
                account,
                weight,
                checked_in,
            });
        }
        (tickets, total_weight, checkins)
    }

    /// Block randomness mixed with epoch data. Predictable by the block producer only;
    /// see README "Known limits".
    fn epoch_seed(&self, total_weight: u128) -> Vec<u8> {
        let mut b = env::random_seed();
        b.extend_from_slice(&self.epoch_index.to_le_bytes());
        b.extend_from_slice(&total_weight.to_le_bytes());
        env::sha256(&b)
    }

    fn pick_winner(tickets: &[Ticket], total_weight: u128, seed: &[u8]) -> Option<AccountId> {
        let r = u128::from_le_bytes(seed[..16].try_into().ok()?) % total_weight;
        let mut acc = 0u128;
        tickets
            .iter()
            .find(|t| {
                acc += t.weight;
                r < acc
            })
            .map(|t| t.account.clone())
    }

    /// Returns (winner, jackpot, reward per check-in, total minted).
    fn mint_epoch(
        &mut self,
        tickets: &[Ticket],
        total_weight: u128,
        checkins: u32,
        emission: u128,
        seed: &[u8],
    ) -> (Option<AccountId>, u128, u128, u128) {
        let winner = Self::pick_winner(tickets, total_weight, seed);
        let jackpot = mul_div(emission, u128::from(self.params.jackpot_bps), BPS);
        let mut minted = 0u128;
        if let Some(w) = &winner {
            self.mint(w, jackpot, "jackpot");
            minted += jackpot;
            if let Some(mut d) = self.depositors.get(w).cloned() {
                d.total_won = U128(d.total_won.0 + jackpot);
                self.depositors.insert(w.clone(), d);
            }
        }
        // If nobody checked in, the community share is simply never minted.
        let each = if checkins > 0 {
            (emission - jackpot) / u128::from(checkins)
        } else {
            0
        };
        if each > 0 {
            for t in tickets.iter().filter(|t| t.checked_in) {
                self.mint(&t.account, each, "check-in");
                minted += each;
            }
        }
        (winner, jackpot, each, minted)
    }

    /// Advance to the next epoch, keeping the schedule aligned to launch time.
    fn roll_epoch(&mut self, now: u64) {
        let len = self.params.epoch_length_ns.0;
        let elapsed = (now - self.epoch_start) / len;
        self.epoch_start += elapsed.max(1) * len;
        self.epoch_index += 1;
        self.checkins_this_epoch = 0;
    }

    pub(crate) fn mint(&mut self, to: &AccountId, amount: u128, memo: &str) {
        if amount == 0 {
            return;
        }
        if !self.token.accounts.contains_key(to) {
            self.token.internal_register_account(to);
        }
        self.token.internal_deposit(to, amount);
        FtMint {
            owner_id: to,
            amount: U128(amount),
            memo: Some(memo),
        }
        .emit();
    }

    pub(crate) fn floor_price(&self) -> u128 {
        let treasury_near = near_from_shares(self.treasury_shares, self.st_near_price);
        crate::math::floor_price(treasury_near, self.token.total_supply)
    }
}
