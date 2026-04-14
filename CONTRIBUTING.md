# Contributing

Thanks for contributing to ClaworldNfa.

This repository mixes contracts, frontend, AI runtime code, and live-operation scripts. Small, well-scoped changes are easier to review and safer to merge than broad cleanups.

## Before you start

Please read:

- `README.md`
- `PROJECT.md`
- `ARCHITECTURE.md`
- `SECURITY.md`

If your change touches user-facing flows, read the relevant surface in `frontend/` first. If it touches mainnet behavior, read the related scripts and tests before editing.

## Local setup

Root setup:

```bash
npm install
npx hardhat compile
npx hardhat test
```

Frontend setup:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Useful checks:

```bash
npm run coverage
npm run size
npm --prefix frontend run build
npm run runner:autonomy:check
npm run directive:check
npm run watch:battle-royale:check
```

## What to include in a PR

Please keep PRs focused and include:

- the problem being solved
- the files or subsystems touched
- risks or tradeoffs
- tests you ran
- screenshots if the change affects UI

If you change contract behavior, include or update tests.

If you change mainnet-facing addresses, routes, or upgrade flows, update the docs that point to them.

## Repo conventions

### Contracts

- follow the existing contract/module boundaries
- keep state changes explicit
- prefer narrow upgrades over broad refactors
- update tests when behavior changes

### Frontend

- keep copy short and direct
- keep actions clear
- do not turn UI into long protocol essays
- prefer action-first interaction over explanation-first screens

### AI runtime

- keep policy boundaries explicit
- separate read helpers from wallet-confirmed writes
- do not hide execution assumptions in prompt text alone
- keep memory and receipt behavior testable or inspectable

## Public / private boundary

This repository is open source, but some material should stay out of public commits:

- private keys
- hosted secrets
- local machine paths
- private runbooks
- operational credentials
- transient local artifacts

Do not commit files such as:

- `.env` with real secrets
- local caches
- machine-specific logs
- `.openzeppelin/*.json` runtime drift unless the file is intentionally being versioned for a specific reason

## Commit style

Use short, direct commit messages that say what changed.

Good examples:

- `fix: block stale battle royale reveal path`
- `docs: add security and architecture guides`
- `feat: route BR rewards back into NFA ledger`

## Reporting large changes

If your change spans contracts, runtime, and frontend together, split it into reviewable commits when you can. That makes safety review much easier.
