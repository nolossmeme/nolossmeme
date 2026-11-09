from nolossmeme_sim.model import ONE_MEME, ONE_NEAR, Params, PoolSim, Scenario


def test_principal_is_never_touched_and_treasury_only_grows():
    sim = PoolSim(Params(), Scenario(name="t", days=30, joins_per_day=0, exits_per_day=0))
    sim.run()
    assert all(r.tvl == 50 * 20 * ONE_NEAR for r in sim.history)
    treasuries = [r.treasury for r in sim.history]
    assert treasuries == sorted(treasuries)
    # 30 days at 9% on 1000 NEAR ~ 7.4 NEAR
    assert 7.3 * ONE_NEAR < treasuries[-1] < 7.5 * ONE_NEAR


def test_emission_halves_and_floor_rises_after_halving():
    sim = PoolSim(
        Params(halving_every=10),
        Scenario(name="t", days=20, joins_per_day=0, exits_per_day=0, checkin_rate=1.0),
    )
    h = sim.run()
    assert h[0].minted == 1_000 * ONE_MEME
    assert h[10].minted == 500 * ONE_MEME
    assert h[-1].floor > h[9].floor


def test_no_checkins_means_community_share_is_not_minted():
    sim = PoolSim(
        Params(), Scenario(name="t", days=1, joins_per_day=0, exits_per_day=0, checkin_rate=0.0)
    )
    (r,) = sim.run()
    assert r.minted == 700 * ONE_MEME
    assert r.checkins == 0


def test_everyone_leaving_keeps_meme_backed():
    sim = PoolSim(
        Params(),
        Scenario(name="t", days=10, initial_depositors=3, joins_per_day=0, exits_per_day=30),
    )
    h = sim.run()
    assert h[-1].depositors == 0 and h[-1].tvl == 0
    assert h[-1].treasury > 0 and h[-1].supply > 0


def test_missed_target_burns_community_share_and_resets_streak():
    # 10 depositors, target 6: everyone checks in for 3 days, then nobody does.
    sim = PoolSim(
        Params(checkin_target=6),
        Scenario(
            name="t",
            days=3,
            initial_depositors=10,
            joins_per_day=0,
            exits_per_day=0,
            checkin_rate=1.0,
        ),
    )
    sim.run()
    assert [r.community_streak for r in sim.history] == [1, 2, 3]
    assert all(r.burned == 0 for r in sim.history)
    sim.scenario = Scenario(
        name="t", days=1, initial_depositors=10, joins_per_day=0, exits_per_day=0, checkin_rate=0.0
    )
    r = sim.step(3)
    assert r.burned == 300 * ONE_MEME and r.minted == 700 * ONE_MEME
    assert r.community_streak == 0 and sim.best_streak == 3
