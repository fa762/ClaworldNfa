# Clawworld

Private main repository for the live Clawworld NFA world on BNB Chain.

[Website](https://www.clawnfaterminal.xyz) · [Game](https://www.clawnfaterminal.xyz/game) · [Public Repo](https://github.com/fa762/ClaworldNfa)

## Overview

Clawworld is a full on-chain NFA game world built around three connected layers:

- `contracts/`: identity, balances, gameplay, oracle, and autonomy contracts
- `frontend/`: mobile-first owner shell, game entry surfaces, mint, mining, arena, auto, settings
- `openclaw/`: runtime, memory, planner, and bounded autonomy runner

Each lobster NFA is treated as an agent-like character:

- on-chain identity via `ClawNFA`
- internal account via `ClawRouter`
- progression via mining, PK, and Battle Royale
- long-term runtime memory via OpenClaw + CML
- bounded self-action through the ClawOracle / autonomy stack

## What Is Live

Mainnet product surfaces already in use:

- Genesis mint with commit-reveal
- ClawRouter internal balances, upkeep, deposit, withdraw
- mining / task flows
- PK
- Battle Royale
- browser shell and game entry surfaces
- OpenClaw runtime
- bounded on-chain autonomy with policy, budget, approval, lease, receipt, and finalization paths

The frontend is currently being rebuilt toward a mobile-first companion dapp. The live shell now centers on:

- Home
- Mining
- Arena
- Auto
- Mint
- Settings

## Current Source Of Truth

For current live status and active work, do not rely only on commit history.

Start here:

- [CURRENT_HANDOFF.md](./CURRENT_HANDOFF.md)
- [FRONTEND_REFACTOR_PLAN.md](./FRONTEND_REFACTOR_PLAN.md)

These two files track:

- what is already verified live
- what is still blocked by contract/runtime issues
- what the frontend is currently optimizing for

## Repo Layout

```text
clawworld/
├── contracts/      # gameplay, identity, oracle, autonomy contracts
├── frontend/       # website, rebuilt mobile shell, wallet-gated actions
├── openclaw/       # runtime, CML memory, planner, runner
├── scripts/        # deployment, upgrade, migration, validation
├── test/           # contract tests
├── CURRENT_HANDOFF.md
└── FRONTEND_REFACTOR_PLAN.md
```

## Quick Start

### Contracts

```bash
npm install
npx hardhat compile
npx hardhat test
```

### Frontend

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

### Frontend production build

```bash
npm --prefix frontend run build
```

## Mainnet Addresses

Canonical frontend address wiring lives in:

- [frontend/src/contracts/addresses.ts](./frontend/src/contracts/addresses.ts)

Do not treat old hosted env values as the source of truth for mainnet addresses.

## Working Rules

- Product name: `Clawworld`
- Token name: `Claworld`
- `/play` is the mining surface, not a generic action bucket
- Arena is split into `PK` and `大逃杀`
- Default frontend screens should stay short:
  - action
  - reward
  - condition/blocker
  - current result

## Secrets And Hosted Infra

Real secrets are not tracked in this repository.

Tracked content should contain:

- code
- templates
- examples
- public addresses
- non-secret documentation

Local-only or hosted-only values stay outside git, including:

- private keys
- runner env files
- hosted KV tokens
- hosted API credentials

## Public Repo Split

This private repository is the main working repo.

The public code mirror is:

- [github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)

When updating public docs or code, keep out:

- live operator details
- internal runbooks
- private infra notes
- local secret paths

## 中文说明

这是 Clawworld 的私有主仓库。

当前主要包含三部分：

- 合约
- 前端
- OpenClaw 运行时 / autonomy

如果要快速了解当前真实进度，不要只看 README，优先看：

- [CURRENT_HANDOFF.md](./CURRENT_HANDOFF.md)
- [FRONTEND_REFACTOR_PLAN.md](./FRONTEND_REFACTOR_PLAN.md)

这两个文件记录的是当前真实状态，而不是历史理想状态。
