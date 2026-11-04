//! Every state change an indexer cares about must leave one `EVENT_JSON:` line behind.
use near_sdk::json_types::U128;
use near_sdk::serde_json::Value;
use near_sdk::test_utils::get_logs;

use super::*;

fn events() -> Vec<Value> {
    get_logs()
        .iter()
        .filter_map(|l| l.strip_prefix("EVENT_JSON:"))
        .map(|j| near_sdk::serde_json::from_str(j).expect("valid json"))
        .filter(|v: &Value| v["standard"] == "nolossmeme")
        .collect()
}

#[test]
fn deposit_check_in_and_draw_emit_nolossmeme_events() {
    let mut c = new_contract(0);
    deposit(&mut c, alice(), 2 * ONE_NEAR, 0);
    let ev = events();
    let dep = ev
        .iter()
        .find(|e| e["event"] == "deposit")
        .expect("deposit event");
    assert_eq!(dep["version"], "1.0.0");
    assert_eq!(dep["data"][0]["account_id"], "alice.testnet");
    assert_eq!(dep["data"][0]["amount"], (2 * ONE_NEAR).to_string());
    assert!(dep["data"][0]["shares"].is_string());

    ctx(alice(), 0, 1);
    c.check_in();
    let ev = events();
    let ci = ev
        .iter()
        .find(|e| e["event"] == "check_in")
        .expect("check_in event");
    assert_eq!(ci["data"][0]["streak"], 1);
    assert_eq!(ci["data"][0]["epoch"], 0);

    draw(&mut c, EPOCH_NS, PRICE);
    let ev = events();
    let d = ev
        .iter()
        .find(|e| e["event"] == "draw")
        .expect("draw event");
    assert_eq!(d["data"][0]["epoch"], 0);
    assert_eq!(d["data"][0]["winner"], "alice.testnet");
    assert_eq!(d["data"][0]["jackpot"], (EMISSION * 7 / 10).to_string());
}

#[test]
fn failed_stake_and_aborted_draw_emit_events() {
    let mut c = new_contract(0);
    ctx(pool(), 0, 0);
    c.on_deposit(alice(), U128(ONE_NEAR), Err(near_sdk::PromiseError::Failed));
    assert!(events().iter().any(
        |e| e["event"] == "deposit_refunded" && e["data"][0]["amount"] == ONE_NEAR.to_string()
    ));

    deposit(&mut c, alice(), ONE_NEAR, 0);
    ctx(bob(), 0, EPOCH_NS);
    let _ = c.draw();
    ctx(pool(), 0, EPOCH_NS);
    c.on_draw_price(Err(near_sdk::PromiseError::Failed));
    assert!(
        events()
            .iter()
            .any(|e| e["event"] == "draw_aborted" && e["data"][0]["epoch"] == 0)
    );
}
