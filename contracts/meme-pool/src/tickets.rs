//! The ritual and the tickets.
//!
//! Ticket weight is time-weighted principal (NEAR-seconds) over the epoch, so a deposit
//! made just before the draw earns almost nothing. Checking in once per epoch builds a
//! streak that multiplies the weight, up to the launch-time cap.
use near_sdk::json_types::{U64, U128};
use near_sdk::{env, near, require};

use crate::constants::{BPS, NANOS_PER_SECOND, ONE_NEAR};
use crate::events;
use crate::math::mul_div;
use crate::types::Depositor;
use crate::{Contract, ContractExt};

#[near]
impl Contract {
    /// Daily ritual: once per epoch, depositors check in. Consecutive check-ins build a
    /// streak that boosts ticket weight; everyone who checked in shares the epoch's
    /// community reward. Returns the new streak length.
    pub fn check_in(&mut self) -> u32 {
        let account = env::predecessor_account_id();
        let mut d = self
            .depositors
            .get(&account)
            .cloned()
            .expect("deposit first");
        require!(
            d.principal.0 >= self.params.min_deposit.0,
            "deposit at least min_deposit to check in"
        );
        require!(
            d.last_checkin_epoch != Some(self.epoch_index),
            "already checked in this epoch"
        );
        d.streak = match d.last_checkin_epoch {
            Some(e) if e + 1 == self.epoch_index => d.streak + 1,
            _ => 1,
        };
        d.last_checkin_epoch = Some(self.epoch_index);
        let streak = d.streak;
        events::check_in(&account, streak, self.epoch_index);
        self.depositors.insert(account, d);
        self.checkins_this_epoch += 1;
        streak
    }
}

impl Contract {
    /// Fold elapsed time into `weight_acc` (NEAR-seconds) and stamp `last_update`.
    pub(crate) fn accrue(d: &mut Depositor, now: u64) {
        if now > d.last_update.0 {
            let dt = u128::from(now - d.last_update.0) / NANOS_PER_SECOND;
            let whole = d.principal.0 / ONE_NEAR * dt;
            let frac = mul_div(d.principal.0 % ONE_NEAR, dt, ONE_NEAR);
            d.weight_acc = U128(d.weight_acc.0 + whole + frac);
        }
        d.last_update = U64(now);
    }

    /// Weight after the streak bonus. The bonus only applies if the account checked in
    /// during the current epoch.
    pub(crate) fn boosted_weight(&self, d: &Depositor) -> u128 {
        let w = d.weight_acc.0;
        if d.last_checkin_epoch != Some(self.epoch_index) {
            return w;
        }
        let bonus = (u128::from(d.streak) * u128::from(self.params.streak_step_bps))
            .min(u128::from(self.params.max_streak_bonus_bps));
        mul_div(w, BPS + bonus, BPS)
    }

    pub(crate) fn checked_in_this_epoch(&self, d: &Depositor) -> bool {
        d.last_checkin_epoch == Some(self.epoch_index)
    }
}
