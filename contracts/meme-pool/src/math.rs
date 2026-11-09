//! Overflow-safe fixed-point helpers shared by the vault, draw and redeem flows.
use primitive_types::U256;

use crate::constants::{ONE_MEME, ONE_NEAR};
use crate::types::Params;

/// `a * b / c` without intermediate overflow.
pub fn mul_div(a: u128, b: u128, c: u128) -> u128 {
    (U256::from(a) * U256::from(b) / U256::from(c)).as_u128()
}

/// `ceil(a * b / c)`.
pub fn mul_div_ceil(a: u128, b: u128, c: u128) -> u128 {
    let (q, r) = (U256::from(a) * U256::from(b)).div_mod(U256::from(c));
    (if r.is_zero() { q } else { q + 1 }).as_u128()
}

/// stNEAR shares worth `near` at `price` (yocto NEAR per stNEAR), rounded down.
pub fn shares_from_near(near: u128, price: u128) -> u128 {
    mul_div(near, ONE_NEAR, price)
}

/// NEAR value of `shares` at `price`, rounded down.
pub fn near_from_shares(shares: u128, price: u128) -> u128 {
    mul_div(shares, price, ONE_NEAR)
}

/// MEME minted in `epoch` under the halving schedule.
pub fn emission_for(params: &Params, epoch: u32) -> u128 {
    let halvings = epoch / params.halving_every.max(1);
    if halvings >= 128 {
        0
    } else {
        params.initial_emission.0 >> halvings
    }
}

/// yocto NEAR per whole MEME given treasury value and supply.
pub fn floor_price(treasury_near: u128, total_supply: u128) -> u128 {
    if total_supply == 0 {
        0
    } else {
        mul_div(treasury_near, ONE_MEME, total_supply)
    }
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use near_sdk::json_types::{U64, U128};

    use super::*;

    fn params(initial: u128, halving: u32) -> Params {
        Params {
            staking_pool: "pool.testnet".parse().unwrap(),
            epoch_length_ns: U64(60_000_000_000),
            initial_emission: U128(initial),
            halving_every: halving,
            jackpot_bps: 7_000,
            streak_step_bps: 1_000,
            max_streak_bonus_bps: 10_000,
            min_deposit: U128(ONE_NEAR),
            checkin_target: 0,
        }
    }

    #[test]
    fn mul_div_handles_values_beyond_u128_product() {
        // 10^30 * 10^24 overflows u128 but the result fits.
        assert_eq!(mul_div(10u128.pow(30), ONE_NEAR, ONE_NEAR), 10u128.pow(30));
        assert_eq!(mul_div_ceil(10, 1, 3), 4);
        assert_eq!(mul_div_ceil(9, 1, 3), 3);
    }

    #[test]
    fn shares_and_near_round_trip_within_dust() {
        let price = 3_198_752_259_237_337_050_198_977; // real stNEAR price seen on testnet
        let near = 12_345 * ONE_NEAR / 1000;
        let shares = shares_from_near(near, price);
        let back = near_from_shares(shares, price);
        assert!(back <= near && near - back < price / ONE_NEAR + 1);
    }

    #[test]
    fn emission_halves_on_schedule() {
        let p = params(1_000, 30);
        assert_eq!(emission_for(&p, 0), 1_000);
        assert_eq!(emission_for(&p, 29), 1_000);
        assert_eq!(emission_for(&p, 30), 500);
        assert_eq!(emission_for(&p, 60), 250);
        assert_eq!(emission_for(&p, 30 * 128), 0);
    }

    #[test]
    fn floor_price_is_zero_without_supply() {
        assert_eq!(floor_price(ONE_NEAR, 0), 0);
        assert_eq!(floor_price(ONE_NEAR, 2 * ONE_MEME), ONE_NEAR / 2);
    }
}
