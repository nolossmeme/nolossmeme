# NoLossMeme

**Memecoins you can't lose on.** Deposit NEAR, keep every yocto, and let only the staking
yield be turned into meme tokens and raffled off. Every token can be burned for its share of
the treasury, so the floor can never reach zero.

Built at [NEAR HACKATHON](https://nearhackathon.com) (Nov 2026). Tracks: **Memecoins With
Mechanics** (primary), Unstoppable DeFi, Social Money, Open Innovation.

[![contracts](https://github.com/nolossmeme/nolossmeme/actions/workflows/contracts.yml/badge.svg)](https://github.com/nolossmeme/nolossmeme/actions/workflows/contracts.yml)
[![web](https://github.com/nolossmeme/nolossmeme/actions/workflows/web.yml/badge.svg)](https://github.com/nolossmeme/nolossmeme/actions/workflows/web.yml)
[![sim](https://github.com/nolossmeme/nolossmeme/actions/workflows/sim.yml/badge.svg)](https://github.com/nolossmeme/nolossmeme/actions/workflows/sim.yml)

|                 |                                                                                                                                                                                                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live on testnet | factory [`streak.nolossmeme.testnet`](https://testnet.nearblocks.io/address/streak.nolossmeme.testnet), first pool [`dogn.streak.nolossmeme.testnet`](https://testnet.nearblocks.io/address/dogn.streak.nolossmeme.testnet) (hourly draws; pool code hash `ZXy+WdxusTX3W9Fgtg12p3wCxiKSX5+dE2b16rsmnB8=`, built from `main`) |
| Staking         | Meta Pool testnet [`meta-v2.pool.testnet`](https://testnet.nearblocks.io/address/meta-v2.pool.testnet) (stNEAR)                                                                                                                                                                                                              |
| Keeper          | [`keeper.nolossmeme.testnet`](https://testnet.nearblocks.io/address/keeper.nolossmeme.testnet), GitHub Actions cron every 15 min                                                                                                                                                                                             |
| Landing         | **<https://nolossmeme.fun>** (static site, `apps/landing`, served from the VPS; mirror at <https://nolossmeme.github.io/nolossmeme/>)                                                                                                                                                                                        |
| Web app         | **<https://app.nolossmeme.fun/>** (dApp, `apps/web`); API at <https://api.nolossmeme.fun>; everything deploys from `main` (`deploy/vps`)                                                                                                                                                                                     |
| Demo post       | _added at submission_ (44 s walkthrough of the hosted app: [`docs/demo.mp4`](docs/demo.mp4))                                                                                                                                                                                                                                 |

<p align="center"><img src="docs/screenshots/meme.png" alt="Pool page" width="800"></p>

## The mechanic in one minute

```mermaid
flowchart LR
  U[Depositor] -- NEAR --> P[meme-pool contract]
  P -- deposit_and_stake --> M[Meta Pool<br/>stNEAR]
  M -. staking yield .-> P
  P -- every epoch: draw --> T[Treasury<br/>stNEAR from yield only]
  P -- mint jackpot --> W[1 weighted-random winner]
  P -- mint share --> C[Everyone who checked in]
  W & C -- burn MEME --> T
  T -- floor price --> W
  U -- withdraw any time, face value --> P
```

1. **Deposit** NEAR. The pool stakes it with Meta Pool. Your principal is recorded at face value and is withdrawable at any time as stNEAR (no fee) or as NEAR (Meta Pool liquid unstake).
2. **Tickets** accrue as NEAR-seconds: a deposit made just before a draw earns almost nothing. A once-per-epoch **check-in** builds a streak that multiplies your weight (capped).
3. **Draw** (permissionless, once the epoch ends): the staking yield since the last draw is swept into the treasury; a fixed, halving emission of MEME is minted. `jackpot_bps` of it goes to one weighted-random depositor, the rest is split equally among everyone who checked in, **if the community hit its check-in target** (below).
4. **Floor**: `floor = treasury / supply`. Burn MEME any time (`redeem`) for that share, paid in stNEAR. The treasury only ever receives yield and sponsor funding, never principal, so the floor never reaches zero and a "rug" is impossible: if everyone leaves, every depositor has their NEAR back and every holder still has a backed token.
5. **Community ritual.** Each pool sets `checkin_target` at launch: how many accounts must check in per epoch. Hit it and the community share mints and the pool's **community streak** grows. Miss it and that share **burns** (it is never minted, the draw records it as `burned`) and the streak resets to 0. The longest streak is kept on-chain as `best_streak` and shown on the token page as the high score. Supply therefore tracks how alive the community is: a quiet pool mints only jackpots.
6. **No admin.** All parameters are fixed in `new` and public via `get_params`. There is no owner, no upgrade key, no pause.
7. **Sponsors.** `fund_treasury` stakes NEAR straight into the treasury: it is never principal and cannot be withdrawn, it only raises the floor. Creators can seed a launch, partners can top up the pot.

> **Testnet note.** Testnet validators pay no staking rewards (the stNEAR price of `meta-v2.pool.testnet` has not moved since 4 Nov 2026), so on testnet a backend job stands in for the yield: every 12 h `sponsor.nolossmeme.testnet` calls `fund_treasury` with 1 Ⓝ on each pool. Every subsidy is public (`fund` events, `total_funded` in `get_state`) and the app shows it as "from sponsors". On mainnet the treasury is real staking yield plus whatever sponsors add.

<p align="center"><img src="docs/projection.png" alt="60-day simulation" width="800"></p>

60-day simulation (`tools/sim`): in the `rugpull-attempt` scenario everyone exits by day 14; NEAR locked drops to zero while treasury and floor hold.

## For judges: do X, see Y

Prerequisites: Rust (the `contracts/rust-toolchain.toml` pins 1.96), [`cargo-near`](https://github.com/near/cargo-near), Node 22 + pnpm 10, [`uv`](https://docs.astral.sh/uv/) for the simulator. Everything else is installed by the commands below.

1. `git clone https://github.com/nolossmeme/nolossmeme && cd nolossmeme && pnpm install`
   → see pnpm install the workspace and Husky register the git hooks.
2. `cd contracts && cargo test --workspace --lib`
   → see **30 unit tests pass** (26 for `meme-pool`: vault accounting, ticket weights, streak cap, draw settlement, halving, redeem and rollback paths; 4 for `factory`).
3. `cargo test -p integration-tests`
   → see **4 sandbox tests pass** after the wasm is built and a local `near-sandbox` starts: a full epoch lifecycle (deposit → check-in → 2 % yield → draw → redeem → withdraw as stNEAR → withdraw as NEAR), a rejected over-withdraw, the absence of admin methods, and a factory launch. Takes 1–3 minutes on the first run.
4. `cd .. && pnpm --filter @nolossmeme/sdk test`
   → see **15 tests pass** for the TypeScript SDK (formatting, transaction builders, tokenomics mirrors, RPC client).
5. `pnpm --filter @nolossmeme/sdk build && pnpm --filter @nolossmeme/web dev`, open <http://localhost:5173>
   → see the memes list and the **Doge of NEAR** pool (`dogn.streak.nolossmeme.testnet`) with live testnet data. (`pnpm --filter @nolossmeme/landing dev` serves the marketing site on <http://localhost:5174>.): NEAR locked, floor, next-draw countdown, draw log. Connect a testnet wallet (HOT, Meteor, MyNearWallet) to deposit 0.1 Ⓝ, check in, and withdraw again.
6. `DRY_RUN=1 pnpm --filter @nolossmeme/keeper start`
   → see the keeper list every pool and print `skip (epoch ends in Ns)` or `would draw epoch #N`.
7. `cd tools/sim && uv run --with matplotlib --with pytest python -m pytest -q && uv run --with matplotlib python -m nolossmeme_sim.cli --out output`
   → see **5 tests pass** and `output/projection.png` regenerated; the table shows MEME burned by missed check-in targets and the best community streak per scenario (`--checkin-target`, default 20).
8. `pnpm --filter @nolossmeme/backend test && pnpm --filter @nolossmeme/backend dev`, then `curl localhost:8787/health`
   → see **10 backend tests pass** (parser on recorded testnet blocks, store, API, rate limiter), then the indexer follow the chain from the factory deploy and `/health` report its cursor; `/pools/dogn.streak.nolossmeme.testnet/activity` lists deposits, check-ins and draws. With `VITE_INDEXER_URL` set, the web app shows an activity feed and TVL/treasury/floor over time.
9. Read the chain directly (no tooling needed):
   ```bash
   curl -s https://test.rpc.fastnear.com -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"call_function","finality":"final","account_id":"dogn.streak.nolossmeme.testnet","method_name":"get_state","args_base64":"e30="}}' | python3 -c 'import sys,json;print(bytes(json.load(sys.stdin)["result"]["result"]).decode())'
   ```
   → see the pool state JSON (`total_principal`, `treasury_shares`, `floor_price`, `next_draw_at`, …).

## Repository layout

| Path                                                         | What                                                                                             | Stack                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [`contracts/meme-pool`](contracts/meme-pool)                 | One contract per memecoin: vault, tickets, draw, redeem, NEP-141/145/148                         | Rust, near-sdk 5.30, near-contract-standards |
| [`contracts/factory`](contracts/factory)                     | Launches `<slug>.<factory>`, stores the pool wasm once (frozen, hash public), keeps the registry | Rust                                         |
| [`contracts/mock-metapool`](contracts/mock-metapool)         | Meta Pool stand-in with a settable price for sandbox tests                                       | Rust                                         |
| [`contracts/integration-tests`](contracts/integration-tests) | near-sandbox end-to-end tests                                                                    | near-sandbox 0.4, near-api-rs                |
| [`packages/sdk`](packages/sdk)                               | Typed RPC client, wallet-agnostic transaction builders, contract math mirrors                    | TypeScript, near-api-js 7                    |
| [`apps/web`](apps/web)                                       | Memes list, pool page, launch form with 60-day projection, how-it-works                          | Vite, React 19, Tailwind 4, near-connect     |
| [`services/backend`](services/backend)                       | Indexer (block scanner over FastNEAR's archive), REST API, snapshot job, optional keeper worker  | TypeScript, Hono, libsql                     |
| [`tools/keeper`](tools/keeper)                               | Calls `draw` where due; cron in `.github/workflows/keeper.yml`                                   | TypeScript                                   |
| [`tools/sim`](tools/sim)                                     | Tokenomics simulation and charts                                                                 | Python                                       |

### `meme-pool` module map

| Module       | Responsibility                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `vault.rs`   | `deposit`, `withdraw` (stNEAR), `withdraw_near` (liquid unstake); state committed in callbacks, restored on failure |
| `tickets.rs` | `check_in`, streak bonus, NEAR-second weights                                                                       |
| `draw.rs`    | `draw` → `on_draw_price`: sweep yield, settle tickets, pick winner, mint, roll epoch                                |
| `redeem.rs`  | burn MEME for pro-rata treasury stNEAR                                                                              |
| `token.rs`   | NEP-141 core, NEP-145 storage (flat 0.005 Ⓝ, refundable), NEP-148 metadata                                          |
| `views.rs`   | `get_state`, `get_account`, `get_draws`, `get_depositors`, `get_params`                                             |
| `math.rs`    | U256-backed `mul_div`, share/price conversion, emission schedule, floor                                             |

### Pool parameters (fixed at launch)

| Parameter                                  | Meaning                                           | DOGN on testnet |
| ------------------------------------------ | ------------------------------------------------- | --------------- |
| `epoch_length_ns`                          | time between draws                                | 1 h             |
| `initial_emission`                         | MEME minted per epoch at launch                   | 1 000           |
| `halving_every`                            | emission halves every N epochs                    | 168 (weekly)    |
| `jackpot_bps`                              | share of emission to the single winner            | 70 %            |
| `streak_step_bps` / `max_streak_bonus_bps` | ticket boost per consecutive check-in and its cap | +10 % / 50 %    |
| `min_deposit`                              | smallest deposit                                  | 1 Ⓝ             |
| `checkin_target`                           | check-ins per epoch to mint the community share   | 3               |

## Launch your own

Through the web app (**Launch** page) or with the CLI:

```bash
near contract call-function as-transaction streak.nolossmeme.testnet create_meme \
  json-args '{"slug":"pepn","name":"Pepe of NEAR","symbol":"PEPN","icon":"🐸","params":{"epoch_length_ns":"86400000000000","initial_emission":"1000000000000000000000","halving_every":30,"jackpot_bps":7000,"streak_step_bps":1000,"max_streak_bonus_bps":5000,"min_deposit":"1000000000000000000000000","checkin_target":3}}' \
  prepaid-gas '300 Tgas' attached-deposit '4 NEAR' sign-as you.testnet network-config testnet sign-with-keychain send
```

The attached NEAR funds the new account's storage (`get_launch_cost`, ≈ 3.8 Ⓝ). To deploy a fresh factory: `contracts/scripts/deploy-testnet.sh <account.testnet>`. Earlier factories at `nolossmeme.testnet`, `factory.nolossmeme.testnet`, `pad.nolossmeme.testnet`, `fun.nolossmeme.testnet` and `meme.nolossmeme.testnet` run older pool code (`pad` lacks the solvent-withdraw and Meta Pool registration fixes, `fun` lacks the `withdraw_near` payout fix, `meme` has no community target) and are kept only as history; pool code is frozen per factory, so fixes ship as a new factory.

## Known limits

- **Randomness.** The draw hashes `env::random_seed()` with the epoch index and total weight. The producer of the block containing the `on_draw_price` receipt can predict it. Fine for a hackathon; a commit-reveal from the keeper or a VRF is the upgrade path.
- **Draw cost is O(depositors).** One callback settles every depositor (270 TGas). Hundreds of accounts are fine; thousands need paged settlement or a sum tree.
- **Sybil resistance of check-ins** is the deposit itself: a check-in only boosts weight you already have (`min_deposit` applies), and the community share is split per account, so splitting a deposit across accounts does not increase the expected jackpot and only redistributes the community share. A per-account minimum weight for the community share would tighten this.
- **Sybil resistance of the community target** is weak by design for a demo: it counts accounts, so one person with N accounts of `min_deposit` each can hit a target of N alone. Each fake account costs 1 Ⓝ locked (refundable, it is a no-loss pool) plus 0.005 Ⓝ storage and one check-in transaction per epoch. Hitting the target that way only mints a share that is split across the same accounts, so it buys the streak, not extra MEME. Weighting the target by principal or requiring a minimum account age would tighten it.
- **Meta Pool minimum.** `meta-v2.pool.testnet` rejects stakes under 1 Ⓝ; a smaller deposit is refunded by the pool's callback (no loss, but no deposit). Set `min_deposit` ≥ 1 Ⓝ at launch; the web app enforces it.
- **`withdraw_near`** depends on Meta Pool's liquidity pool and pays its swap fee; `withdraw` (stNEAR) always works and is free.
- **Slashing** of the staking pool would leave the last withdrawers short; the treasury is never used to cover principal.
- **No upgrades.** A pool cannot be patched; a new one would have to be launched.

## Development

```bash
pnpm install                 # workspace + git hooks (commitlint, lint-staged)
pnpm contracts:lint          # cargo fmt --check + clippy -D warnings
pnpm contracts:test          # all Rust tests
pnpm lint && pnpm test       # TypeScript packages
pnpm --filter @nolossmeme/web build
```

CI: `contracts` (fmt, clippy, unit, sandbox), `web` (format, lint, test, build for sdk, ui, landing, web, keeper, backend), `sim` (pytest + chart), `sonar` (SonarQube Cloud), `keeper` (cron). The backend ships as a Docker image (`services/backend/Dockerfile`); set the repository variable `INDEXER_URL` (planned: `https://api.nolossmeme.fun`) and the Pages builds point at it. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and commit conventions.

## Hackathon notes

- All code was written during the hackathon window (first commit 4 Nov 2026). Tags: `pre-hackathon` (empty repository), `hackathon-submission` (the submitted state).
- Libraries and templates: `near-sdk` / `near-contract-standards` 5.30, `cargo-near` project template, `near-sandbox`, `near-api-rs`, `near-api-js` 7, `near-connect-hooks`, `@tanstack/react-query`, `recharts`, Tailwind 4, matplotlib. Meta Pool is integrated through its public contract interface. AI coding assistants were used, as the rules allow.
- Testnet only. Nothing here is audited; do not deploy to mainnet with real funds without an audit.

## License

[MIT](LICENSE)
