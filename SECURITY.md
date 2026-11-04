# Security

NoLossMeme is hackathon software running on NEAR **testnet**. It has not been audited. Do not deploy the contracts on mainnet with real funds without an independent audit.

## Reporting

Open a private security advisory on GitHub (Security → Report a vulnerability) or email the maintainers listed in `CODEOWNERS`. Please include the contract account, the transaction hash if any, and steps to reproduce. We aim to acknowledge within 48 hours.

## Scope and known limits

- Pools have no admin keys and cannot be upgraded; a fix ships as a new factory.
- Draw randomness comes from `env::random_seed()` and is predictable by the block producer of the draw receipt.
- `withdraw_near` depends on Meta Pool's liquidity pool; `withdraw` (stNEAR) is always available.
- See the "Known limits" section of the README for the full list.
