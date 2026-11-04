//! NEP-297 style events (`EVENT_JSON:` logs) for everything an indexer cares about.
//!
//! Standard `nolossmeme`, version `1.0.0`. One event per log line, `data` is always a
//! one-element array like the NEP-141 events, so generic NEP-297 tooling can read them.
use near_sdk::json_types::U128;
use near_sdk::serde::Serialize;
use near_sdk::{AccountId, env};

use crate::types::Draw;

const STANDARD: &str = "nolossmeme";
const VERSION: &str = "1.0.0";

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct Envelope<'a, T: Serialize> {
    standard: &'a str,
    version: &'a str,
    event: &'a str,
    data: [T; 1],
}

fn emit<T: Serialize>(event: &str, data: T) {
    let json = near_sdk::serde_json::to_string(&Envelope {
        standard: STANDARD,
        version: VERSION,
        event,
        data: [data],
    })
    .expect("event serialises");
    env::log_str(&format!("EVENT_JSON:{json}"));
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultEvent<'a> {
    pub account_id: &'a AccountId,
    pub amount: U128,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shares: Option<U128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee: Option<U128>,
}

pub fn deposit(account_id: &AccountId, amount: u128, shares: u128) {
    emit(
        "deposit",
        VaultEvent {
            account_id,
            amount: U128(amount),
            shares: Some(U128(shares)),
            fee: None,
        },
    );
}

pub fn deposit_refunded(account_id: &AccountId, amount: u128) {
    emit(
        "deposit_refunded",
        VaultEvent {
            account_id,
            amount: U128(amount),
            shares: None,
            fee: None,
        },
    );
}

pub fn withdraw(account_id: &AccountId, amount: u128, shares: u128) {
    emit(
        "withdraw",
        VaultEvent {
            account_id,
            amount: U128(amount),
            shares: Some(U128(shares)),
            fee: None,
        },
    );
}

pub fn withdraw_near(account_id: &AccountId, amount: u128, fee: u128) {
    emit(
        "withdraw_near",
        VaultEvent {
            account_id,
            amount: U128(amount),
            shares: None,
            fee: Some(U128(fee)),
        },
    );
}

pub fn redeem(account_id: &AccountId, amount: u128, shares: u128) {
    emit(
        "redeem",
        VaultEvent {
            account_id,
            amount: U128(amount),
            shares: Some(U128(shares)),
            fee: None,
        },
    );
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct CheckIn<'a> {
    account_id: &'a AccountId,
    streak: u32,
    epoch: u32,
}

pub fn check_in(account_id: &AccountId, streak: u32, epoch: u32) {
    emit(
        "check_in",
        CheckIn {
            account_id,
            streak,
            epoch,
        },
    );
}

pub fn draw(draw: &Draw) {
    emit("draw", draw);
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct DrawAborted {
    epoch: u32,
}

pub fn draw_aborted(epoch: u32) {
    emit("draw_aborted", DrawAborted { epoch });
}
