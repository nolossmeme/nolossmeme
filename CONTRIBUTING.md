# Contributing

## Layout

| Path               | What                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `contracts/`       | Rust workspace: `meme-pool`, `factory`, `mock-metapool`, sandbox tests |
| `apps/web`         | React dApp (app.nolossmeme.fun)                                        |
| `apps/landing`     | Landing site and demo page (nolossmeme.fun)                            |
| `packages/sdk`     | TypeScript client shared by the apps, backend and tools                |
| `packages/ui`      | Shared React components, theme and logos                               |
| `services/backend` | Indexer, API, keeper, sponsor and faucet jobs                          |
| `tools/keeper`     | Standalone `draw` trigger (GitHub Actions backup)                      |
| `tools/sim`        | Tokenomics simulation                                                  |
| `tools/video`      | Demo video (HyperFrames + ElevenLabs)                                  |
| `deploy/vps`       | Docker Compose and nginx for the VPS                                   |
| `docs/`            | Architecture notes and submission material                             |

## Workflow

1. Open an issue (or pick one) and add the `area:` and `type:` labels.
2. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`.
3. Keep commits small and follow [Conventional Commits](https://www.conventionalcommits.org):
   `feat(pool): add check-in streak bonus`. Allowed scopes are listed in `commitlint.config.mjs`.
4. Open a PR using the template, link the issue, wait for CI, merge with rebase.

## Tooling

- `pnpm install` once; Husky installs the `pre-commit` (lint-staged) and `commit-msg` (commitlint) hooks.
- `pnpm contracts:lint`, `pnpm contracts:test`, `pnpm lint`, `pnpm test`.
- Sonar runs on every PR; keep new code free of blocker/critical issues.

## Conduct and security

Be kind: see the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues.
