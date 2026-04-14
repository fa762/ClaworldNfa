# ClaworldNfa

## Summary

ClaworldNfa is an AI-first on-chain NFA world on BNB Chain.

It combines:

- on-chain identity
- NFA-owned internal ledger accounts
- playable loops
- structured long-term memory
- bounded AI autonomy

The core idea is simple: one NFA should be able to hold identity, keep memory, spend from its own ledger path, and act on-chain inside owner-defined boundaries.

## Why this project matters

Most agent projects still split ownership into separate pieces:

- identity is on one layer
- assets live somewhere else
- memory is temporary
- AI can talk but cannot act safely on-chain

ClaworldNfa closes that gap by attaching identity, ledger, memory, gameplay, and bounded autonomy to the same NFA.

## AI runtime model

AI is not a cosmetic add-on here.

In ClaworldNfa, AI is the runtime layer that:

- loads memory
- builds planning context
- applies directives and policy boundaries
- routes bounded chain actions
- writes action outcomes back into memory

Main components:

- `OpenClaw`
- `CML`
- `ClawOracle`
- `ClawAutonomyRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`

## Agent surface and runtime compatibility

ClaworldNfa is designed so the same world model can be used by different agent runtimes.

Today that includes:

- `OpenClaw` local runtime
- the `claw` skill tool surface
- Hermes-style tool adapters
- generic function-calling agents that separate reads from wallet-confirmed writes

This reusable surface already covers:

- environment and world reads
- owned NFA inspection
- memory load / save
- mining / upkeep / PK / market helpers
- autonomy request paths

## Memory model

ClaworldNfa uses `OpenClaw + CML` as structured long-term memory.

The memory path is:

1. session fragments are buffered into hippocampus
2. `SLEEP` consolidates them into a new CML snapshot
3. the snapshot is hashed
4. the hash is anchored on-chain with `updateLearningTreeByOwner(...)`
5. the full file can also be backed up to Greenfield

This lets memory stay useful as runtime state while still producing an on-chain anchor for later verification.

## Two AI paths

### 1. Copilot path

The user is online. The runtime reads state and memory, helps with mining / PK / market decisions, and leaves state-changing actions to the wallet.

### 2. Autonomy path

The owner pre-defines policy boundaries. Then the autonomy stack can:

1. read memory and world state
2. form a bounded candidate action
3. call `requestAutonomousAction(...)`
4. get a `reasoningCid` from `ClawOracle`
5. execute through `ClawOracleActionHub` and adapters
6. finalize receipts and ledger effects
7. write memory updates after execution

## Core layers

### Identity

`ClawNFA`

### Account

`ClawRouter`

### Gameplay

- Genesis Mint
- mining
- PK
- Battle Royale

### Memory

- `OpenClaw`
- `CML`

### Autonomy

- `ClawOracle`
- `ClawAutonomyRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`

## Economy model

1. owner deposits Claworld into `ClawRouter`
2. `ClawRouter` credits a specific NFA ledger
3. gameplay spends from that ledger where supported
4. rewards return to that ledger
5. owner withdraws back to the main wallet

## Current mainnet status

Already live:

- Genesis Mint commit-reveal
- NFA ledger accounts
- upkeep / deposit / withdraw
- mining
- PK
- Battle Royale
- Battle Royale public timeout reveal
- OpenClaw runtime
- bounded autonomy infrastructure
- directive sync into the runner
- autonomy receipt / ledger / reasoning CID flow

## Product direction

The active mainline is:

- mobile-first PWA shell
- mining
- PK
- Battle Royale
- proxy / autonomy controls
- OpenClaw runtime

The legacy `/game` 2D RPG surface still exists, but it is no longer the mainline product path.

## Notes for judges and reviewers

- project name: `ClaworldNfa`
- token name: `Claworld`
- AI is the runtime core, not a side feature
- the distinctive part is the full chain from memory -> planner -> oracle -> execution -> receipt -> memory update