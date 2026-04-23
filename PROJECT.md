# ClaworldNfa

## Summary

ClaworldNfa is an AI-first on-chain NFA companion and game protocol on BNB Chain.

The current live product is a Terminal-style PWA where the user connects a wallet, selects an owned NFA, talks to it in natural language, and receives structured action cards for on-chain actions.

It combines:

- on-chain identity
- NFA-owned internal ledger accounts
- natural-language interaction
- playable loops
- structured memory context
- bounded AI autonomy

The core idea is simple: one NFA holds identity, keeps memory context, spends through its own ledger path, and can act on-chain inside owner-defined boundaries.

## Why this project matters

Most AI agent projects still split the important pieces apart:

- identity is on one layer
- assets are controlled somewhere else
- memory is temporary or off to the side
- AI can talk, but execution is either unsafe or disconnected from ownership

ClaworldNfa brings those pieces back together. The user is not just chatting with a bot. The user is interacting with an owned on-chain character that has identity, balance, game state, memory context, and bounded execution paths.

## Current product surface

The mainline product today is the Terminal PWA, not the older experimental 2D surface.

Current user flow:

1. connect wallet
2. read owned NFAs
3. select one NFA
4. chat with that NFA
5. let the AI turn clear intent into action cards
6. confirm wallet actions from those cards
7. read balance, memory, world, and autonomy state in the same shell

Current actions exposed in the shipped product:

- mint
- mining
- PK
- Battle Royale
- deposit
- withdraw
- memory read / write
- model mode / BYOK settings
- autonomy controls

## AI runtime model

AI is not a cosmetic layer in ClaworldNfa. It is the runtime interface for the product.

In the current stack, AI is responsible for:

- reading NFA detail
- loading memory summary and memory timeline
- reading world state
- reading autonomy status
- understanding user intent from chat
- returning structured action cards for chain actions
- producing readable replies without exposing private keys to the browser

Main protocol and runtime pieces:

- `ClawNFA`
- `ClawRouter`
- `ClawOracle`
- `ClawAutonomyRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`
- `openclaw/autonomyPlanner.ts`
- `openclaw/autonomyOracleRunner.ts`
- `openclaw/battleRoyaleRevealWatcher.ts`

## Agent surface and runtime compatibility

ClaworldNfa is designed so the same world can be used through more than one AI path.

Today that includes:

- project-hosted backend chat API
- optional OpenAI-compatible server fallback
- BYOK mode in the terminal
- bounded autonomy runner for offline execution

This surface already covers:

- chain reads
- owned NFA inspection
- memory summary / timeline loading
- action-card generation
- wallet-confirmed writes
- autonomy directives

## Memory model

ClaworldNfa uses a CML-style memory model for persistent identity.

What is already in the shipped product:

- the frontend loads memory summary into chat context
- the frontend loads recent memory timeline into chat context
- the terminal includes a memory write path through API routes

The broader protocol path is:

1. conversation or action outcome produces memory material
2. memory is summarized into a structured snapshot
3. the snapshot can be hashed
4. the hash can be anchored on-chain through the learning-tree path
5. the full body can stay in backend storage or backup storage

This lets memory stay useful as runtime state while still leaving room for verifiable on-chain anchoring.

## Two AI paths

### 1. Copilot path

The user is online. The terminal reads state and memory, helps with decisions, and turns clear intent into wallet-confirmed action cards.

### 2. Autonomy path

The owner defines policy boundaries first. Then the autonomy stack can:

1. read state, memory, and policy
2. plan a bounded action
3. request autonomous execution
4. pass through oracle / registry / action hub / adapter checks
5. execute through the target skill
6. finalize receipts and accounting
7. write the result back into the runtime context

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
- market hooks where configured

### Memory

- terminal memory API
- CML-style structured memory
- learning-tree anchor path

### Autonomy

- `ClawOracle`
- `ClawAutonomyRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`
- adapters
- runner / planner / watcher scripts

## Economy model

The main account model is NFA-centric:

1. owner deposits Claworld into `ClawRouter`
2. `ClawRouter` credits a specific NFA ledger
3. supported skills can spend from that NFA ledger
4. rewards and claim flows settle according to each skill path
5. owner can withdraw ledger balance back to the wallet

This makes the NFA behave more like an on-chain companion account than a cosmetic NFT.

## Current mainnet status

Already live on mainnet:

- Genesis Mint commit-reveal
- NFA ledger accounts
- upkeep / deposit / withdraw
- mining
- PK
- Battle Royale
- Battle Royale public timeout reveal path
- Terminal PWA
- natural-language chat
- action-card based execution flow
- BYOK mode
- memory summary / timeline API integration
- bounded autonomy infrastructure
- directive sync into the runner
- autonomy receipt / ledger / reasoning CID flow

## Product direction

The active mainline is:

- mobile-first Terminal PWA
- NFA chat
- mining
- PK
- Battle Royale
- autonomy / proxy controls
- memory-aware interaction

The old `/game` and earlier 2D RPG direction are no longer the mainline product path.

## Notes for judges and reviewers

- project name: `ClaworldNfa`
- token name used in the product UI: `Claworld`
- live app: `https://www.clawnfaterminal.xyz`
- public repository: `https://github.com/fa762/ClaworldNfa`
- network: BNB Smart Chain mainnet

Key point:

The distinctive part of ClaworldNfa is not just “AI + NFT”. The distinctive part is the full chain from NFA identity -> ledger -> game state -> memory context -> AI intent parsing -> bounded execution -> receipt / accounting -> memory-aware continuation.

Supporting docs:

- `ARCHITECTURE.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
