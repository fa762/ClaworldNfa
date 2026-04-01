# ClaworldNfa — Project Overview

## What We Built

ClaworldNfa is a complete implementation of the BAP-578 Non-Fungible Agent (NFA) standard on BNB Chain. It turns static NFTs into living on-chain AI agents that can think, act, earn, and evolve.

The project delivers a full-stack system: 10 smart contracts on BSC mainnet, a web frontend, a 2D browser RPG, and an AI skill plugin for the OpenClaw local runtime. All open source under MIT license.

## The Problem We Solve

BAP-578 is BNB Chain's proposed standard for Non-Fungible Agents — NFTs that function as autonomous AI agents. But until ClaworldNfa, no project had delivered a working end-to-end implementation.

Existing on-chain AI Agent projects suffer from fragmentation: agent identity lives in one contract, its wallet in another, execution permissions in a third, and learning data somewhere off-chain. This makes agents non-composable, non-portable, and impossible to truly own or trade as a single asset.

ClaworldNfa solves this by unifying all four BAP-578 capabilities — **identity, wallet, execution, and learning** — into a single ERC-721 token.

## How It Works

### One Token = One Agent

Each ClawNFA token is a complete AI agent on-chain. It carries:

- **Identity**: level, rarity, shelter assignment, job class, DNA traits
- **Wallet**: internal CLW token balance managed by the router contract
- **Execution**: authorized skill contracts (tasks, PvP, marketplace) that the agent can invoke
- **Learning**: a 5-dimension personality vector (courage, wisdom, social, creativity, grit) that evolves based on player behavior

### Player-Driven Personality Evolution

The personality system is the core innovation. Unlike random stat allocation, an NFA's personality is shaped entirely by the player's choices:

- Choose adventure tasks → courage grows
- Choose puzzle tasks → wisdom grows
- Choose trade tasks → social grows
- Choose creation tasks → creativity grows
- Play consistently → grit grows

Each dimension is capped at ±5 per month to prevent gaming. The personality vector directly affects economic outcomes through a match scoring formula:

```
matchScore = dot(personality_vector, task_requirement_vector)
reward_multiplier = 0.05x to 2.0x based on matchScore
```

A well-trained NFA earns up to 20x more than a blank one. This creates genuine long-term engagement incentive — your agent becomes more valuable the more thoughtfully you develop it.

### Modular Skill Architecture

The system uses a hub-and-spoke architecture centered on ClawRouter:

- **ClawRouter** — core hub managing CLW balances, game state, and skill authorization
- **TaskSkill** — quest completion with XP and CLW rewards scaled by personality match
- **PKSkill** — PvP arena using commit-reveal strategy (attack/balanced/defense) with personality-based modifiers
- **MarketSkill** — decentralized marketplace supporting fixed-price sales, 24-hour auctions, and NFA-for-NFA swaps
- **PersonalityEngine** — personality evolution logic extracted into its own upgradeable contract
- **GenesisVault** — 888 genesis NFAs minted via commit-reveal with enhanced entropy
- **WorldState** — global game parameters (reward multiplier, event flags) with 24-hour timelock governance
- **DepositRouter** — routes BNB deposits through DEX or bonding curve to acquire CLW
- **ClawOracle** — AI oracle for processing game events with commit-reveal verification

Each skill is a separate UUPS upgradeable proxy contract. New skills can be added without modifying existing contracts.

### Three Ways to Play

The system provides three entry points that share the same on-chain state:

1. **Website** (clawnfaterminal.xyz) — CRT terminal-style interface for viewing NFA stats, minting, and management. Built with Next.js 16, React 19, wagmi, and viem.

2. **2D RPG** (/game route) — A Phaser 3 pixel art browser game where players walk through underground shelters, interact with NPCs, complete tasks, enter PvP arenas, and trade on the marketplace. All actions trigger real on-chain transactions.

3. **OpenClaw Skill** — A plugin for the OpenClaw local AI runtime. Players can have deep AI-powered conversations with their lobster agent, receive strategic advice, and execute complex multi-step operations through natural language. The AI runs entirely on the player's device — no backend servers, no corporate control.

## Security

All contracts are built with security as a first-class concern:

- **UUPS Proxy Pattern** — all contracts upgradeable, owner-only access control
- **Commit-Reveal** — used in minting, PvP, and oracle operations to prevent frontrunning
- **Enhanced Entropy** — salt + nonce + gasleft() mixing for randomness without VRF dependency
- **24-Hour Timelock** — WorldState changes require a propose-wait-execute cycle
- **Pull-over-Push** — all BNB refunds use pending withdrawals with explicit claim, preventing reentrancy
- **Skill Authorization** — only router-authorized contracts can modify NFA state
- **Monthly Caps** — personality evolution hard-capped at ±5 per dimension per month
- **Storage Gaps** — 40 storage slots reserved in every contract for future upgrades

229 automated tests cover all contracts with 0 failures.

## Technical Details

| Component | Technology |
|-----------|-----------|
| Blockchain | BNB Chain (BSC Mainnet) |
| Smart Contracts | Solidity ^0.8.20, OpenZeppelin UUPS |
| Build & Test | Hardhat, Chai, Mocha |
| Frontend | Next.js 16, React 19, TypeScript |
| Chain Interaction | wagmi v3, viem v2 |
| Game Engine | Phaser 3 |
| AI Runtime | OpenClaw (local) |
| UI Design | Tailwind CSS, CRT/PipBoy terminal aesthetic |

## Mainnet Contracts

| Contract | Address |
|----------|---------|
| ClawNFA | 0xAa2094798B5892191124eae9D77E337544FFAE48 |
| ClawRouter | 0x60C0D5276c007Fd151f2A615c315cb364EF81BD5 |
| GenesisVault | 0xCe04f834aC4581FD5562f6c58C276E60C624fF83 |
| WorldState | 0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA |
| TaskSkill | 0x652c192B6A3b13e0e90F145727DE6484AdA8442a |
| PKSkill | 0xaed370784536e31BE4A5D0Dbb1bF275c98179D10 |
| MarketSkill | 0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF |
| DepositRouter | 0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54 |
| PersonalityEngine | 0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269 |
| ClawOracle | 0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E |

## What's Next

- **Cross-Agent Communication** — NFAs interacting with each other autonomously on-chain
- **Multi-Chain Expansion** — bringing BAP-578 beyond BNB Chain
- **DAO Governance** — NFA holders voting on WorldState parameters
- **Equipment System** — on-chain items that modify agent capabilities
- **Advanced AI Integration** — deeper personality-driven AI behavior in OpenClaw conversations

## Links

- Website: https://www.clawnfaterminal.xyz
- GitHub: https://github.com/fa762/ClaworldNfa
- ClawHub Skill: https://clawhub.ai/fa762/claw-world
- Skill Source: https://github.com/fa762/claw-world-skill
