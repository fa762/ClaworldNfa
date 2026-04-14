# ClaworldNfa

## Project Summary

ClaworldNfa is a live NFA world on BNB Chain.

It turns an NFT into a character-like agent with:

- on-chain identity
- its own internal account
- playable progression
- long-term memory
- bounded AI autonomy

Product name:

- `Clawworld`

Repository name:

- `ClaworldNfa`

## What Problem We Solve

Most AI agent products still break ownership into separate pieces:

- identity is separate from account
- memory is off-platform
- AI can talk but cannot act safely on-chain
- assets and execution are disconnected

That makes it hard to truly own, train, trade, and operate an agent as a single asset.

ClaworldNfa solves this by putting identity, account, gameplay, memory, and autonomy into one coherent system.

## Why AI Matters Here

AI is not an extra feature in this project.

It is the core runtime layer that turns an NFA from a static token into a character that can:

- keep long-term memory
- carry forward preferences and habits
- plan inside owner-defined policy boundaries
- execute real on-chain actions through the autonomy stack

The AI side of the project includes:

- `OpenClaw` runtime
- structured CML memory
- `ClawOracle`
- autonomy registry, delegation, action hub, finalization hub
- adapters and route skills for real gameplay actions

## Core Product Model

### 1. Identity

`ClawNFA` is the on-chain identity layer.

Each lobster has:

- rarity
- shelter
- level
- personality
- DNA battle stats
- active or dormant state

### 2. Account

`ClawRouter` gives each NFA its own internal ledger account.

That account supports:

- reserve balance
- upkeep
- deposit
- withdraw
- reward return
- gameplay spending

### 3. Gameplay

Current main loops:

- mining
- PK
- Battle Royale

### 4. Memory

`OpenClaw + CML` provide the long-term memory layer.

This is not just chat history. It is persistent state used for:

- conversation continuity
- planner context
- post-action updates
- future action preference

### 5. Autonomy

`ClawOracle` and the autonomy stack allow bounded self-action on-chain.

The owner defines boundaries first, including:

- policy
- budget
- reserve floor
- protocol approvals
- delegation lease

The runtime can then act only inside those boundaries.

## Live Features

Already live on BNB Chain mainnet:

- Genesis Mint with commit-reveal
- NFA internal accounts
- upkeep, deposit, withdraw
- mining
- PK
- Battle Royale
- OpenClaw runtime
- bounded autonomy infrastructure

Recent live work also includes:

- Battle Royale public timeout reveal
- Battle Royale reward routing back into the NFA ledger path
- directive sync from hosted KV into the live runner
- planner dry-run and bounded production controls

## AI and Runtime Flow

The current autonomy flow is:

1. owner or directive sets the boundary
2. planner reads world state and memory
3. planner forms a candidate action
4. oracle request is created on-chain
5. action hub syncs and executes through adapters
6. finalization records receipts and ledger updates
7. memory is updated after the action

This is important because the AI layer is connected to the real game and real assets, not kept as a side demo.

## Economy Model

The in-world economy is centered on the NFA ledger model:

1. the owner wallet deposits `Claworld`
2. `ClawRouter` credits the selected NFA ledger
3. gameplay spends from the ledger path where supported
4. rewards return back into the ledger
5. the owner can withdraw back to the main wallet

This makes the NFA behave more like a persistent game character account than a simple NFT.

## Tech Stack

- Solidity
- Hardhat
- OpenZeppelin UUPS
- Next.js
- React
- wagmi
- viem
- OpenClaw runtime
- TypeScript

## Repo Structure

- `contracts/` — on-chain identity, gameplay, oracle, autonomy
- `frontend/` — owner shell, mint, mining, arena, autonomy, settings
- `openclaw/` — runtime, memory, planner, runner
- `scripts/` — deployment, migration, upgrade, validation
- `test/` — contract tests

## Current Product Direction

The current mainline product is:

- mobile-first companion dapp
- mining
- PK
- Battle Royale
- bounded autonomy

The old `/game` browser RPG path still exists in the repo, but it is no longer the primary product direction.

## Mainnet Contracts

- ClawNFA: `0xAa2094798B5892191124eae9D77E337544FFAE48`
- ClawRouter: `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5`
- GenesisVault: `0xCe04f834aC4581FD5562f6c58C276E60C624fF83`
- WorldState: `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA`
- TaskSkill: `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`
- PKSkill: `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF`
- BattleRoyale: `0x2B2182326Fd659156B2B119034A72D1C2cC9758D`
- Claworld: `0x3b486c191c74c9945fa944a3ddde24acdd63ffff`

## Links

- Website: [www.clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- Public repo: [github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)
- ClawHub Skill: [claw-world](https://clawhub.ai/fa762/claw-world)

## One-Line Positioning

ClaworldNfa is a live on-chain NFA world where identity, account, gameplay, memory, and bounded AI autonomy belong to the same agent.
