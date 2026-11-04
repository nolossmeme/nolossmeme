# Testing strategy

Three layers, each runnable on its own from the repository root.

| Layer           | Command                 | What it proves                                                                                                                                | Where                                                                                                                                |
| --------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit**        | `pnpm test:unit`        | Pure logic in isolation: contract math and state machines with `testing_env!`, SDK helpers, web projection, keeper decisions, simulator model | `contracts/*/src/**/tests*`, `packages/sdk/src/__tests__`, `apps/web/src/__tests__`, `tools/keeper/src/__tests__`, `tools/sim/tests` |
| **Integration** | `pnpm test:integration` | Real wasm on a local `near-sandbox`: promise chains, cross-contract calls to the Meta Pool stand-in, storage, gas, refunds, factory deploys   | `contracts/integration-tests/tests`                                                                                                  |
| **Regression**  | `pnpm test:regression`  | One named test per bug ever found, at whichever layer reproduces it                                                                           | `*regression*` tests in all of the above                                                                                             |

CI runs all three: `contracts.yml` (unit, sandbox, then `cargo test --workspace regression`), `web.yml` (TypeScript packages), `sim.yml` (Python). Manual end-to-end checks happen on testnet against `dogn.nolossmeme.testnet` and are logged in pull requests.

## Adding a regression test

1. Reproduce the bug in a test **before** fixing it, in the lowest layer that can show it.
2. Name it `regression_<what_went_wrong>` (Rust) or put it in a `describe("regression")` block with a title starting with `regression` (TypeScript).
3. Write a doc comment with the date or PR and the root cause, not just the symptom.
4. Fix, watch the test go green, keep both in the same PR.

## Current regression catalogue

| Test                                                             | Root cause                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `regression_accrual_from_zero_timestamp`                         | `accrue` treated `last_update == 0` as "never" and skipped the genesis block    |
| `regression_failed_stake_refunds_without_principal`              | Meta Pool's 1 Ⓝ minimum rejected a deposit; the refund path had no test         |
| `regression_draw_unlocks_when_price_lookup_fails`                | `expect` in the callback rolled back the unlock and would have bricked the pool |
| `regression_draw_attaches_fixed_gas`                             | dynamic "all remaining gas" exceeded the prepaid budget                         |
| `regression_deposit_below_staking_minimum_is_refunded` (sandbox) | same incident, end to end with the mock's minimum                               |
| `regression_factory_refunds_when_pool_init_fails` (sandbox)      | invalid params must not leave a half-launched pool                              |
| sdk `regression keeps 24-decimal precision`                      | a `Number`/u128 overflow in a test helper                                       |
| sdk `regression staking minimum is one NEAR`                     | UI allowed deposits the staking pool refuses                                    |
| web `regression projection emits points for hourly epochs`       | the preview chart was empty for non-daily epochs                                |
