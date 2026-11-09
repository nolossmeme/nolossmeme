//! Community check-in target: hit it and the community share mints and the streak grows;
//! miss it and that share burns and the streak resets. The best streak is kept.
use super::*;

fn pool_with_target(target: u32) -> Contract {
    ctx(pool(), 0, 0);
    Contract::new(
        alice(),
        "Doge of NEAR".into(),
        "DOGN".into(),
        None,
        Params {
            checkin_target: target,
            ..params()
        },
    )
}

fn check_in(c: &mut Contract, who: AccountId, ts: u64) {
    ctx(who, 0, ts);
    c.check_in();
}

#[test]
fn target_hit_mints_and_miss_burns_the_community_share() {
    let mut c = pool_with_target(2);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    deposit(&mut c, bob(), ONE_NEAR, 0);
    let community = EMISSION * 3 / 10;

    // Epoch 0: both check in, target hit.
    check_in(&mut c, alice(), 1);
    check_in(&mut c, bob(), 1);
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert!(d.target_hit);
    assert_eq!((d.burned.0, d.community_streak), (0, 1));
    assert_eq!(d.checkin_reward_each.0, community / 2);

    // Epoch 1: hit again.
    check_in(&mut c, alice(), EPOCH_NS + 1);
    check_in(&mut c, bob(), EPOCH_NS + 1);
    assert_eq!(draw(&mut c, 2 * EPOCH_NS, PRICE).community_streak, 2);

    // Epoch 2: only alice checks in, target missed. The jackpot still mints.
    check_in(&mut c, alice(), 2 * EPOCH_NS + 1);
    let d = draw(&mut c, 3 * EPOCH_NS, PRICE);
    assert!(!d.target_hit);
    assert_eq!(d.burned.0, community);
    assert_eq!(d.checkin_reward_each.0, 0);
    assert_eq!(d.minted.0, EMISSION - community);
    assert_eq!(d.community_streak, 0);

    let s = c.get_state();
    assert_eq!(
        (s.checkin_target, s.community_streak, s.best_streak),
        (2, 0, 2)
    );
}

#[test]
fn zero_target_means_one_check_in() {
    let mut c = pool_with_target(0);
    deposit(&mut c, alice(), ONE_NEAR, 0);
    assert_eq!(c.get_state().checkin_target, 1);
    let d = draw(&mut c, EPOCH_NS, PRICE);
    assert!(!d.target_hit, "nobody checked in");
    check_in(&mut c, alice(), EPOCH_NS + 1);
    assert!(draw(&mut c, 2 * EPOCH_NS, PRICE).target_hit);
}
