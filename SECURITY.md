# Security Policy

## Scope

This policy covers the code shipped in this repository, including:

- Solidity contracts in `contracts/`
- frontend code in `frontend/`
- AI runtime code in `openclaw/`
- scripts in `scripts/` that can change live deployments or operating state

Hosted secrets, private infrastructure, local developer machines, and third-party wallets are outside this repository and outside the scope of code review here.

## Supported code

Security fixes are handled on a best-effort basis for:

- the current `main` branch
- the latest mainnet contract set documented in `README.md`

Older branches and historical deployments may not receive fixes.

## How to report a vulnerability

Please do not open a public issue for an exploitable bug.

Use this order:

1. Open a private GitHub security advisory for this repository if that option is available.
2. If the advisory flow is unavailable, contact the maintainer privately through GitHub before publishing details.

Please include:

- affected component
- network and contract address
- impact on funds, permissions, or data integrity
- reproduction steps
- proof of concept or transaction hashes if you have them
- whether the issue is already exploitable on mainnet

## Response target

Target response times:

- initial acknowledgement: within 3 business days
- severity assessment: within 7 business days
- remediation plan or next step: as soon as the issue is reproduced

These are targets, not hard guarantees.

## Disclosure expectations

- Give the maintainer time to reproduce and patch the issue.
- Keep proof of concept activity to the minimum needed to demonstrate the problem.
- Prefer testnet or local-fork reproduction when possible.
- Do not expose user funds, private keys, or operational secrets in your report.

## What is especially important here

Because this repository covers on-chain assets and bounded AI execution, high-priority reports include:

- fund loss or fund lock scenarios
- broken auth or approval checks
- upgrade authorization issues
- ledger/accounting inconsistencies
- oracle or action-hub execution bypasses
- adapter routing bugs
- directive injection that escapes policy boundaries
- memory anchoring or state-sync bugs that can corrupt ownership or execution state

## Out of scope

The following usually do not qualify as repository security issues on their own:

- spelling or copy issues
- feature requests
- RPC outages
- third-party wallet UI bugs
- local environment setup mistakes
- rate limits or availability problems on public infrastructure that this repository does not control
