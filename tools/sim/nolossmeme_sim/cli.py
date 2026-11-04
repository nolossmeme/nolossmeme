"""Run every scenario, write CSVs and charts.

    uv run --with matplotlib python -m nolossmeme_sim.cli --out output
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from .model import ONE_MEME, ONE_NEAR, Params, PoolSim
from .scenarios import SCENARIOS


def write_csv(path: Path, sim: PoolSim) -> None:
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["epoch", "day", "depositors", "tvl_near", "checkins", "yield_near", "treasury_near", "supply_meme", "floor_near_per_meme", "jackpot_meme"])
        for r in sim.history:
            w.writerow([r.epoch, f"{r.day:.2f}", r.depositors, r.tvl / ONE_NEAR, r.checkins, r.yield_near / ONE_NEAR, r.treasury / ONE_NEAR, r.supply / ONE_MEME, r.floor / ONE_NEAR, r.jackpot / ONE_MEME])


def plot(out: Path, sims: dict[str, PoolSim]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    fig.patch.set_facecolor("#0b0b10")
    for ax in axes.flat:
        ax.set_facecolor("#13131b")
        ax.tick_params(colors="#9b9bb3")
        for spine in ax.spines.values():
            spine.set_color("#262634")
        ax.title.set_color("#f3f3f8")
        ax.grid(color="#262634", linestyle=":")
    panels = [
        (axes[0][0], "Supply (MEME)", lambda r: r.supply / ONE_MEME),
        (axes[0][1], "Treasury (NEAR, yield only)", lambda r: r.treasury / ONE_NEAR),
        (axes[1][0], "Floor price (NEAR per MEME)", lambda r: r.floor / ONE_NEAR),
        (axes[1][1], "NEAR locked (principal, never at risk)", lambda r: r.tvl / ONE_NEAR),
    ]
    colors = ["#a3ff5b", "#ffc857", "#ff5bd6", "#6bc5ff"]
    for ax, title, fn in panels:
        for (name, sim), color in zip(sims.items(), colors, strict=False):
            ax.plot([r.day for r in sim.history], [fn(r) for r in sim.history], label=name, color=color, linewidth=2)
        ax.set_title(title)
        ax.set_xlabel("day", color="#9b9bb3")
    axes[0][0].legend(facecolor="#13131b", edgecolor="#262634", labelcolor="#f3f3f8")
    fig.tight_layout()
    fig.savefig(out / "projection.png", dpi=130)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=Path("output"))
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--epoch-seconds", type=int, default=86_400)
    ap.add_argument("--emission", type=int, default=1_000, help="MEME per epoch at launch")
    ap.add_argument("--halving", type=int, default=30)
    ap.add_argument("--jackpot-bps", type=int, default=7_000)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    params = Params(epoch_seconds=args.epoch_seconds, initial_emission=args.emission * ONE_MEME, halving_every=args.halving, jackpot_bps=args.jackpot_bps)
    sims: dict[str, PoolSim] = {}
    print(f"{'scenario':<18}{'depositors':>11}{'TVL Ⓝ':>10}{'treasury Ⓝ':>13}{'supply':>10}{'floor Ⓝ/MEME':>16}")
    for sc in SCENARIOS:
        sim = PoolSim(params, Scenario_with_days(sc, args.days))
        sim.run()
        sims[sc.name] = sim
        write_csv(args.out / f"{sc.name}.csv", sim)
        last = sim.history[-1]
        print(f"{sc.name:<18}{last.depositors:>11}{last.tvl / ONE_NEAR:>10.0f}{last.treasury / ONE_NEAR:>13.3f}{last.supply / ONE_MEME:>10.0f}{last.floor / ONE_NEAR:>16.8f}")
    plot(args.out, sims)
    print(f"wrote {args.out}/projection.png")


def Scenario_with_days(sc, days):  # noqa: N802 - small helper keeping dataclass frozen
    from dataclasses import replace

    return replace(sc, days=days)


if __name__ == "__main__":
    main()
