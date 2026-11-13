# Submission checklist

Deadline: **14 Nov 2026, 23:59 UTC**. Form: <https://nearhackathon.com/#apply>.

## Before submitting

- [x] All PRs merged to `main`, CI green
- [x] Testnet pools have draws in their log (DOGN 80+, keeper in the backend + cron backup)
- [ ] `git tag pre-hackathon e774e3b && git tag hackathon-submission <final sha> && git push --tags`
- [x] Demo video recorded (`docs/demo.mp4`, 99 s, narrated): faucet → deposit → check-in → target hit → draw → floor/redeem → launch
- [ ] Demo post live on X (template below), link pasted into the README header table
- [ ] NEAR **mainnet** payout account decided (named or 64-char implicit)

## Demo post (X)

> Built at NEAR HACKATHON: **NoLossMeme**, memecoins you can't lose on.
>
> Deposit NEAR, keep every yocto. Only the staking yield is minted into the meme and
> raffled to depositors. The community has a daily check-in target: hit it and everyone who
> showed up gets a mint, miss it and that share burns and the streak resets. Burn any token
> for its share of the treasury: the floor never hits zero, a rug is impossible.
>
> Live on testnet, no admin keys, factory + pool contracts, web app, keeper, 60-day sim.
> Site: nolossmeme.fun · App: app.nolossmeme.fun · Demo: nolossmeme.fun/demo
> Repo: github.com/nolossmeme/nolossmeme
>
> @NEARProtocol #NEARHackathon

Short version (fits 280 characters, links count as 23):

> NoLossMeme: memecoins you can't lose on.
>
> Deposit NEAR, keep it all. Only staking yield mints the meme. Hit the daily check-in target or the community share burns.
>
> Live on NEAR testnet.
> Demo: nolossmeme.fun/demo
> Repo: github.com/nolossmeme/nolossmeme
>
> @NEARProtocol #NEARHackathon

Attach `docs/demo.mp4` (99 s, narrated by ElevenLabs, built with Remotion in `tools/video`; the deposit, check-ins and the target-hit draw #65 are real testnet transactions) plus the three screenshots in `docs/screenshots/`.

## Form fields

| Field                    | Value                                    |
| ------------------------ | ---------------------------------------- |
| Project name             | NoLossMeme                               |
| Tracks                   | `memecoins`, `defi`, `social`, `open`    |
| Repository               | https://github.com/nolossmeme/nolossmeme |
| Demo post                | _X link_                                 |
| Team size                | 1                                        |
| Team lead / contact      | _fill in_                                |
| Payout account (mainnet) | _fill in_                                |

### What did you build? (20–2 000 chars)

NoLossMeme is a memecoin launchpad where nobody can lose their deposit. Users deposit NEAR
into a pool contract that stakes it with Meta Pool; principal stays withdrawable at face value
at any time. Every epoch, anyone can trigger a draw: the staking yield since the last draw is
swept into the token treasury and a fixed, halving emission of the meme token is minted,
70 % to one time-weighted random depositor (a check-in streak boosts your tickets). The rest
belongs to the community, under a rule fixed at launch: if at least `checkin_target` accounts
checked in that epoch, it is split among them and the community streak grows; if not, it is
burned (never minted) and the streak resets. The longest streak is kept on-chain as the pool's
high score, so supply tracks how alive the community is. A public `fund_treasury` lets creators and sponsors add to the
pot (on testnet, where validators pay no rewards, a labelled subsidy stands in for yield). Every token can be burned for its share of
the treasury, so the floor price is backed by yield only and can never reach zero. All
parameters are fixed at launch and there are no admin keys. Built on NEAR: Rust contracts
(NEP-141/145/148, factory deploying immutable pools, Meta Pool stNEAR integration), a
near-sandbox test suite, a TypeScript SDK, a React web app with wallet support, a backend that
indexes NEP-297 events and runs the draws, a Turnstile-gated testnet faucet, and a 60-day
simulator that compares supply, burns and streaks across community scenarios.
