# Claw World Skill

OpenClaw-first skill and agent-facing runtime surface for the Clawworld NFA universe.

[Clawworld Website](https://www.clawnfaterminal.xyz) · [Game](https://www.clawnfaterminal.xyz/game) · [Public NFA Repo](https://github.com/fa762/ClaworldNfa)

## Current Package Version

`1.1.12`

## What This Skill Does

This repository is the **manual and session-based AI layer** for Clawworld.

It is built for:
- OpenClaw conversations
- other tool-calling agent runtimes
- NFA status and ownership inspection
- task / PK / market assistance
- CML memory continuity
- Hermes-style agent/tool integration

It is **not** the chain-side oracle runner itself.  
The on-chain autonomy runner now lives in the main Clawworld repository, while this skill remains the player-facing local runtime.

---

## Two AI Modes in Clawworld

### 1. Local copilot mode

The player is online and asks the skill for help.

Typical flow:
- inspect the lobster
- read CML memory
- suggest tasks or PK strategy
- explain world state
- help the player act through explicit wallet-confirmed actions

OpenClaw is the first runtime this repository serves, but not the only one.

### 2. On-chain autonomy mode

The player pre-authorizes an NFA on-chain.

Then the autonomy stack in the main repo can let the lobster:
- choose a task route
- choose a PK route
- choose a world-event branch
- execute the bounded action on-chain
- write receipts and ledgers back to the autonomy system

This repository does not run that oracle node directly, but it stays aligned with the same game logic and memory model.

```mermaid
flowchart LR
    Player["Player"]
    Skill["OpenClaw Skill"]
    Wallet["Wallet-confirmed action"]
    Policy["On-chain autonomy policy"]
    Oracle["ClawOracle runner"]
    Chain["Task / PK / WorldEvent on-chain"]

    Player --> Skill --> Wallet --> Chain
    Player --> Policy --> Oracle --> Chain
```

```mermaid
flowchart LR
    Policy["Autonomy policy"]
    Request["Bounded oracle request"]
    Model["Model API reasoning"]
    Choice["Choice + reasoning CID"]
    Execute["Action adapter execution"]
    Result["On-chain receipt + ledger"]

    Policy --> Request --> Model --> Choice --> Execute --> Result
```

---

## Beyond OpenClaw

This package is centered around the `claw` command surface, but its integration target is broader than OpenClaw alone.

Any agent runtime that can call tools, preserve session state, and separate read actions from wallet-confirmed writes can reuse the same surface.

That includes:
- OpenClaw sessions
- Hermes-style tool adapters
- function-calling agents
- other BAP-578-aligned agent runtimes

The shared pieces are:
- **CML** as the canonical memory layer
- **read helpers** for NFA state, ownership, and world inspection
- **structured task / PK / market helpers** for bounded actions
- **clear split between local copilot mode and on-chain autonomy mode**

```mermaid
flowchart LR
    Runtime["OpenClaw / Other Agent Runtime"]
    Surface["claw / Hermes / tool surface"]
    CML["Canonical CML memory"]
    Read["Read + inspect state"]
    Help["Task / PK / market assistance"]
    Wallet["Wallet-confirmed action"]
    Oracle["On-chain autonomy stack"]

    Runtime --> Surface
    Surface --> CML
    Surface --> Read
    Surface --> Help
    Help --> Wallet
    Help --> Oracle
```

This is the reason the repository is kept readable and modular: OpenClaw is one runtime, but the same NFA state, memory, and action surface can be mounted by other agents too.

---

## Current Highlights

- `boot / env / owned` are now clearly separated
- CML is the primary session memory model
- local CML save is clearly separated from optional root sync
- status output separates NFA assets from account gas
- language continuity is preserved across sessions
- Hermes adapter support remains part of the public surface
- the skill is now documented as the **manual runtime layer** that sits beside the newer on-chain autonomy layer

---

## Core Commands

### `claw env`
Lightweight runtime / network / account check only.

### `claw owned`
Lightweight ownership summary only.

### `claw boot`
Full session initializer:
- loads owned NFAs
- loads canonical CML memory
- preserves legacy fallback data
- computes emotion trigger

This is the command that restores the lobster as a continuous role rather than a blank assistant.

```mermaid
flowchart LR
    User["User"]
    Boot["claw boot"]
    CML["Canonical CML memory"]
    Trigger["Emotion trigger"]
    Session["Live session"]
    Save["claw cml-save"]
    Local["Local save"]
    Root["Optional root sync"]

    User --> Boot
    Boot --> CML
    Boot --> Trigger
    CML --> Session
    Trigger --> Session
    Session --> Save
    Save --> Local
    Save --> Root
```

---

## CML Memory Model

Each NFA carries a runtime-linked memory profile:
- **identity**
- **pulse**
- **prefrontal**
- **basal**
- **hippocampus buffer**

This means the lobster can preserve:
- role
- tone
- emotional continuity
- recent meaningful fragments

CML is also the shared memory layer across:
- website and game presentation
- OpenClaw sessions
- other agent runtimes
- the on-chain autonomy stack

```mermaid
flowchart LR
    CML["Canonical CML memory"]
    Game["Website / Game"]
    OpenClaw["OpenClaw session"]
    Agent["Other agent runtime"]
    Autonomy["On-chain autonomy"]

    CML --> Game
    CML --> OpenClaw
    CML --> Agent
    CML --> Autonomy
```

### Save semantics

- `claw cml-save <tokenId>` → local save
- `claw cml-save <tokenId> <auth>` → local save + immediate root sync attempt

Without auth:
- local save can still succeed
- root sync can remain pending

This makes the runtime practical even when chain-side sync is not immediately available.

---

## Safety Model

- this skill never reads private keys
- this skill never silently signs
- read tools are kept separate from state-changing actions
- wallet-confirmed actions require explicit user intent
- Hermes raw passthrough remains developer-only debugging

So the local runtime can stay useful without becoming a hidden signer.

---

## Repository Layout

- `SKILL.md` — runtime instructions and world rules
- `claw` — main CLI entrypoint
- `claw-read.js` — read helpers
- `claw-task.js` — task helpers
- `claw-lore.js` — lore helper
- `hermes/` — external agent/tool adapter surface

---

## Update Notes

- the repository tracks `package-lock.json`
- avoid keeping an untracked local lockfile before pulling updates
- if you only change docs/help text, avoid regenerating the lockfile unnecessarily

### Recent documentation refresh

The README now reflects:
- CML-first runtime behavior
- `boot / env / owned` role separation
- the split between local player copilot mode and on-chain autonomy mode
- current Hermes-facing integration surface
