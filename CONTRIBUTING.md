# Contributing

## Layout

| Path           | What                                                    |
| -------------- | ------------------------------------------------------- |
| `contracts/`   | Rust workspace: `meme-pool`, `factory`, `mock-metapool` |
| `apps/web`     | React web app                                           |
| `packages/sdk` | TypeScript client shared by the app and tools           |
| `tools/keeper` | Scheduled `draw` trigger                                |
| `tools/sim`    | Tokenomics simulation                                   |
| `docs/`        | Architecture notes and submission material              |

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
