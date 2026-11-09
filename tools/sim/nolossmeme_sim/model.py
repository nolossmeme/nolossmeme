"""A faithful, integer-exact model of one pool.

The contract keeps principal untouched and sweeps only staking yield into the treasury;
emission follows a halving schedule; the floor is treasury / supply. Depositor behaviour
(joins, exits, check-ins) is the stochastic part this module lets you vary.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

ONE_NEAR = 10**24
ONE_MEME = 10**18
BPS = 10_000
SECONDS_PER_YEAR = 31_536_000


def near(amount: float) -> int:
    """Whole/fractional NEAR -> yocto without float drift (6 decimals of precision)."""
    return round(amount * 1_000_000) * (ONE_NEAR // 1_000_000)


@dataclass(frozen=True)
class Params:
    """Mirror of `meme-pool::Params` (minus the staking pool account)."""

    epoch_seconds: int = 86_400
    initial_emission: int = 1_000 * ONE_MEME
    halving_every: int = 30
    jackpot_bps: int = 7_000
    streak_step_bps: int = 1_000
    max_streak_bonus_bps: int = 5_000
    # check-ins the community needs per epoch; a miss burns the community share (0 means 1)
    checkin_target: int = 1


@dataclass(frozen=True)
class Scenario:
    """Community behaviour assumptions."""

    name: str
    days: int = 60
    apy_bps: int = 900
    initial_depositors: int = 50
    deposit_near: float = 20.0
    joins_per_day: float = 1.0
    exits_per_day: float = 0.2
    checkin_rate: float = 0.5
    seed: int = 7


@dataclass
class Depositor:
    principal: int
    streak: int = 0
    checked_in: bool = False
    won: int = 0


@dataclass
class EpochRecord:
    epoch: int
    day: float
    depositors: int
    tvl: int
    checkins: int
    yield_near: int
    treasury: int
    minted: int
    supply: int
    floor: int
    jackpot: int
    winner: int | None
    burned: int = 0
    community_streak: int = 0


@dataclass
class PoolSim:
    params: Params
    scenario: Scenario
    rng: random.Random = field(init=False)
    depositors: list[Depositor] = field(default_factory=list)
    treasury: int = 0
    supply: int = 0
    community_streak: int = 0
    best_streak: int = 0
    history: list[EpochRecord] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.rng = random.Random(self.scenario.seed)
        amount = near(self.scenario.deposit_near)
        self.depositors = [Depositor(amount) for _ in range(self.scenario.initial_depositors)]

    # -- contract math ----------------------------------------------------------

    def emission_for(self, epoch: int) -> int:
        halvings = epoch // max(self.params.halving_every, 1)
        return 0 if halvings >= 128 else self.params.initial_emission >> halvings

    def floor(self) -> int:
        return 0 if self.supply == 0 else self.treasury * ONE_MEME // self.supply

    def weight(self, d: Depositor) -> int:
        # time-weighted principal over a full epoch, in NEAR-seconds, with streak bonus
        base = d.principal * self.params.epoch_seconds // ONE_NEAR
        if not d.checked_in:
            return base
        bonus = min(d.streak * self.params.streak_step_bps, self.params.max_streak_bonus_bps)
        return base * (BPS + bonus) // BPS

    # -- one epoch ----------------------------------------------------------------

    def step(self, epoch: int) -> EpochRecord:
        p, s = self.params, self.scenario
        epochs_per_day = 86_400 / p.epoch_seconds

        # the ritual
        for d in self.depositors:
            d.checked_in = self.rng.random() < s.checkin_rate
            d.streak = d.streak + 1 if d.checked_in else 0

        # yield sweep: tvl * apy * epoch / year
        tvl = sum(d.principal for d in self.depositors)
        yield_near = tvl * s.apy_bps * p.epoch_seconds // (BPS * SECONDS_PER_YEAR)
        self.treasury += yield_near

        # lottery + mint
        emission = self.emission_for(epoch)
        weights = [self.weight(d) for d in self.depositors]
        total_w = sum(weights)
        minted = jackpot = 0
        winner: int | None = None
        checkins = sum(1 for d in self.depositors if d.checked_in)
        hit = checkins >= max(p.checkin_target, 1)
        self.community_streak = self.community_streak + 1 if hit else 0
        self.best_streak = max(self.best_streak, self.community_streak)
        burned = 0
        if total_w > 0 and emission > 0:
            jackpot = emission * p.jackpot_bps // BPS
            winner = self.rng.choices(range(len(self.depositors)), weights=weights)[0]
            self.depositors[winner].won += jackpot
            minted += jackpot
            if hit:
                each = (emission - jackpot) // checkins
                minted += each * checkins
            else:
                burned = emission - jackpot
        self.supply += minted

        # joins and exits land at the epoch boundary, after the draw
        for _ in range(self._poisson(s.joins_per_day / epochs_per_day)):
            self.depositors.append(Depositor(near(s.deposit_near)))
        for _ in range(self._poisson(s.exits_per_day / epochs_per_day)):
            if self.depositors:
                self.depositors.pop(self.rng.randrange(len(self.depositors)))

        rec = EpochRecord(
            epoch=epoch,
            day=(epoch + 1) / epochs_per_day,
            depositors=len(self.depositors),
            tvl=tvl,
            checkins=checkins,
            yield_near=yield_near,
            treasury=self.treasury,
            minted=minted,
            supply=self.supply,
            floor=self.floor(),
            jackpot=jackpot,
            winner=winner,
            burned=burned,
            community_streak=self.community_streak,
        )
        self.history.append(rec)
        return rec

    def run(self) -> list[EpochRecord]:
        epochs = int(self.scenario.days * 86_400 / self.params.epoch_seconds)
        for e in range(epochs):
            self.step(e)
        return self.history

    def _poisson(self, lam: float) -> int:
        # Knuth; lam is small here
        if lam <= 0:
            return 0
        import math

        limit, k, prod = math.exp(-lam), 0, self.rng.random()
        while prod > limit:
            k += 1
            prod *= self.rng.random()
        return k
