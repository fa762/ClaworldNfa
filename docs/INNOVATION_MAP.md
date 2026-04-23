# Innovation Map

This document is the shortest map from the project idea to the shipped modules.

## 1. NFA as identity plus account

What is different:

- the NFA is not only a collectible or profile picture
- it holds identity and visible state
- it also maps to its own internal Claworld ledger account

Key modules:

- `contracts/core/ClawNFA.sol`
- `contracts/core/ClawRouter.sol`
- `frontend/src/components/lobster/`
- `frontend/src/contracts/hooks/`

Why it matters:

- ownership, balance, gameplay state, and companion state stay connected

## 2. Natural language becomes structured action cards

What is different:

- the user talks to the selected NFA in natural language
- the runtime does not let the LLM directly fire arbitrary transactions
- it turns clear intent into structured action cards first

Key modules:

- `frontend/src/app/api/chat/[tokenId]/send/route.ts`
- `frontend/src/app/api/_lib/terminal-chat.ts`
- `frontend/src/app/api/_lib/chain-queries.ts`
- `frontend/src/components/terminal/TerminalActionPanel.tsx`
- `frontend/src/lib/terminal-cards.ts`

Why it matters:

- users keep wallet confirmation
- the interaction still feels conversational

## 3. Memory is runtime state, not decorative lore

What is different:

- memory summary and memory timeline are loaded into the chat path
- the companion can respond using carried context instead of starting cold each turn
- the broader design leaves room for on-chain memory anchoring

Key modules:

- `frontend/src/app/api/memory/[tokenId]/summary/route.ts`
- `frontend/src/app/api/memory/[tokenId]/timeline/route.ts`
- `frontend/src/app/api/memory/[tokenId]/write/route.ts`
- `openclaw/`
- learning-tree update paths in the contracts

Why it matters:

- identity can persist across sessions
- actions and dialogue can shape future behavior

## 4. Bounded autonomy instead of free-form wallet signing

What is different:

- autonomy is a separate execution path with checks at each layer
- policy, oracle, action hub, adapters, and finalization are all part of the path
- this is meant for bounded offline execution, not uncontrolled agent signing

Key modules:

- `contracts/world/ClawOracle.sol`
- `contracts/world/ClawAutonomyRegistry.sol`
- `contracts/world/ClawOracleActionHub.sol`
- `contracts/world/ClawAutonomyFinalizationHub.sol`
- adapter contracts in `contracts/world/`
- `openclaw/autonomyPlanner.ts`
- `openclaw/autonomyOracleRunner.ts`
- `openclaw/battleRoyaleRevealWatcher.ts`

Why it matters:

- the project can support autonomous behavior without dropping protocol boundaries

## 5. Gameplay settles through the NFA ledger

What is different:

- mining, PK, and Battle Royale all use the same NFA-centric account model
- rewards and costs resolve around the NFA ledger instead of splitting ownership and play state apart

Key modules:

- `contracts/skills/TaskSkill.sol`
- `contracts/skills/PKSkill.sol`
- `contracts/skills/BattleRoyale.sol`
- `contracts/skills/GenesisVault.sol`
- gameplay panels in `frontend/src/components/game/`

Why it matters:

- the NFA behaves like a playable on-chain agent with its own account path

## 6. The live product surface

What is already live in the current product direction:

- Terminal-style PWA
- wallet connect
- owned NFA loading
- natural-language chat
- action cards
- mint
- mining
- PK
- Battle Royale
- deposit and withdraw
- memory read and write
- BYOK chat mode
- autonomy controls

Key frontend modules:

- `frontend/src/components/terminal/TerminalHome.tsx`
- `frontend/src/components/terminal/TerminalHome.module.css`
- `frontend/src/components/terminal/TerminalActionPanel.tsx`
- `frontend/src/components/terminal/TerminalMarketPanel.tsx`

## One-line summary

The distinctive part of ClaworldNfa is the full chain:

`NFA identity -> NFA ledger -> gameplay state -> memory context -> AI intent parsing -> action card -> wallet-confirmed or bounded autonomous execution -> receipt and accounting`
