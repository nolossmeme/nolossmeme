# Tokenomics simulation

Integer-exact model of one NoLossMeme pool plus a few community scenarios.

```bash
cd tools/sim
uv run --with matplotlib --with pytest python -m pytest -q      # 4 tests
uv run --with matplotlib python -m nolossmeme_sim.cli --out output
```

`output/projection.png` plots supply, treasury, floor and NEAR locked per scenario;
`output/<scenario>.csv` has the per-epoch numbers. Flags: `--days`, `--epoch-seconds`,
`--emission`, `--halving`, `--jackpot-bps`.
