# Submission checklist

Deadline: **14 Nov 2026, 23:59 UTC**. Form: <https://nearhackathon.com/#apply>.

## Before submitting

- [ ] All PRs merged to `main`, CI green
- [ ] Testnet pool has at least a few draws in its log (keeper cron running)
- [ ] `git tag pre-hackathon e774e3b && git tag hackathon-submission <final sha> && git push --tags`
- [ ] Demo video (60–90 s) recorded: deposit → check-in → draw → winner → redeem → withdraw
- [ ] Demo post live on X (template below), link pasted into the README header table
- [ ] NEAR **mainnet** payout account decided (named or 64-char implicit)

## Demo post (X)

> Built at NEAR HACKATHON: **NoLossMeme**, memecoins you can't lose on.
>
> Deposit NEAR, keep every yocto. Only the staking yield is minted into the meme and
> raffled daily to depositors. Burn any token for its share of the treasury: the floor
> never hits zero, a rug is impossible.
>
> Live on testnet, no admin keys, factory + pool contracts, web app, keeper, 60-day sim.
> Repo: github.com/nolossmeme/nolossmeme
>
> @NEARProtocol #NEARHackathon

Attach `docs/demo.mp4` (40 s scripted walkthrough of the hosted app, no wallet) or, better, a screen recording that also shows a wallet deposit, check-in and the draw log, plus the three screenshots in `docs/screenshots/`.

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
70 % to one time-weighted random depositor (a daily check-in streak boosts your tickets) and
the rest split among everyone who checked in. Every token can be burned for its share of
the treasury, so the floor price is backed by yield only and can never reach zero. All
parameters are fixed at launch and there are no admin keys. Built on NEAR: Rust contracts
(NEP-141/145/148, factory deploying immutable pools, Meta Pool stNEAR integration), a
near-sandbox test suite, a TypeScript SDK, a React web app with wallet support, a keeper
that runs the draws from GitHub Actions, and a 60-day tokenomics simulator.
