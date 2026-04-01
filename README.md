# Claw Civilization Universe (CCU)

**The first end-to-end implementation of BNB Chain's BAP-578 Non-Fungible Agent standard.**

> NFTs can't do anything. NFAs can act, earn, and grow.

---

## What is this?

CCU turns NFTs into **Non-Fungible Agents (NFA)** — on-chain AI agents that have their own identity, wallet, execution rights, and evolving personality. All in one token.

Current AI Agent projects scatter identity, wallet, permissions, and memory across multiple contracts. BAP-578 unifies them into a single NFT standard. This repo is the complete implementation: smart contracts, web frontend, 2D RPG game, and OpenClaw AI skill integration.

### Core Innovation

- **One token = One agent**: Identity + wallet + execution + learning record in a single ERC-721
- **Player-driven personality**: Your choices shape your lobster's personality (courage, wisdom, social, creativity, grit) — on-chain verifiable
- **Local AI runtime**: AI runs on your device via [OpenClaw](https://github.com/nicepkg/openclaw), no backend servers, no corporate control
- **On-chain economy**: Task rewards, PvP stakes, marketplace trades — all through CLW token with real utility loops

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   BNB Chain                       │
│                                                   │
│  ClawNFA (ERC-721)  ←→  ClawRouter (Core Hub)    │
│       ↕                      ↕                    │
│  GenesisVault          PersonalityEngine          │
│  (888 Mint)            (5D Evolution)             │
│       ↕                      ↕                    │
│  TaskSkill    PKSkill    MarketSkill              │
│  (Quests)    (PvP)      (Trade)                   │
│       ↕                      ↕                    │
│  WorldState           DepositRouter               │
│  (Global Params)      (DEX/Bonding Curve)         │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
     ┌────▼────┐  ┌─────▼─────┐  ┌───▼────┐
     │ Website │  │  2D RPG   │  │OpenClaw│
     │ Next.js │  │  Phaser 3 │  │  Skill │
     │ (View)  │  │  (Play)   │  │ (Deep) │
     └─────────┘  └───────────┘  └────────┘
```

**Three entry points, one save file:**
- **Website** — View your NFA stats, mint, manage
- **2D RPG** — Arcade-style browser game at `/game`
- **OpenClaw** — Deep AI conversations, strategy, local runtime

---

## Smart Contracts

| Contract | Description | Testnet Address |
|----------|-------------|-----------------|
| ClawNFA | ERC-721 NFA token (BAP-578) | `0x1c69...B135` |
| ClawRouter | Core hub: CLW balance, game state, skill dispatch | `0xA7Ee...c346` |
| PersonalityEngine | 5-dimension personality evolution | `0xab8F...ac0e` |
| GenesisVault | 888 genesis mint (commit-reveal) | `0x6d17...7867` |
| TaskSkill | Quest system with personality-based match scoring | `0x4F8f...CE0E` |
| PKSkill | PvP combat (commit-reveal strategy) | `0x0e76...839A` |
| MarketSkill | Marketplace: fixed price / auction / swap | `0x254E...c46d` |
| WorldState | Global parameters with 24h timelock | `0x3479...4F7d` |
| DepositRouter | DEX/bonding curve deposit routing | `0xd61C...B448` |

All contracts use **OpenZeppelin UUPS upgradeable proxy** pattern.

---

## Personality System

Players shape their NFA's personality through choices, not randomness:

| Dimension | How to grow | Effect |
|-----------|------------|--------|
| Courage | Choose adventure tasks | Exploration reward bonus |
| Wisdom | Choose puzzle tasks | Strategy accuracy bonus |
| Social | Choose trade tasks | Market fee discount |
| Creativity | Choose creation tasks | Rare item drop bonus |
| Grit | Consistent daily play | Stamina & recovery bonus |

**Match Score** = dot product of personality vector and task requirement vector → 0.05x ~ 2.0x reward multiplier. A well-trained NFA earns 20x more than a blank one.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | BNB Chain (BSC) |
| Contracts | Solidity ^0.8.20, Hardhat, OpenZeppelin UUPS |
| Frontend | Next.js 16, React 19, wagmi, viem |
| Game | Phaser 3 (2D pixel RPG at `/game`) |
| AI Runtime | OpenClaw (local, no backend) |
| Styling | Tailwind CSS, CRT terminal aesthetic |

---

## Project Structure

```
clawworld/
├── contracts/              # Solidity smart contracts
│   ├── core/               # ClawNFA, ClawRouter, DepositRouter, PersonalityEngine
│   ├── skills/             # TaskSkill, PKSkill, MarketSkill, GenesisVault
│   └── world/              # WorldState, ClawOracle
├── frontend/               # Next.js website + 2D RPG game
│   └── src/
│       ├── app/            # Pages: home, NFA collection, detail, mint, game
│       ├── components/     # PipBoy-style terminal UI components
│       ├── contracts/      # ABIs + wagmi hooks
│       └── game/           # Phaser 3 game engine
│           ├── scenes/     # BootScene, ShelterScene, TaskScene, PKScene
│           ├── ui/         # StatusHUD, DialogueBox
│           └── chain/      # Wallet bridge (viem read + wagmi write)
├── openclaw/               # OpenClaw AI skill plugin
│   ├── claw-world-skill/   # Installable skill package (SKILL.md)
│   └── skills/             # TypeScript skill implementations
├── test/                   # 229 tests, 0 failing
└── scripts/                # Deploy + utility scripts
```

---

## Quick Start

### Prerequisites

- Node.js >= 18
- Git

### Install & Test

```bash
git clone https://github.com/fa762/ClaworldNfa.git
cd ClaworldNfa

# Install contract dependencies
npm install

# Run all tests (229 passing)
npx hardhat test

# Install frontend dependencies
cd frontend
npm install

# Run frontend dev server
npm run dev
```

Visit `http://localhost:3000` for the website, `http://localhost:3000/game` for the 2D RPG.

### Deploy Contracts

```bash
# Set up .env
cp .env.example .env
# Edit .env with your private key and RPC URL

npx hardhat run scripts/deploy-phase1.ts --network bscTestnet
npx hardhat run scripts/deploy-phase2.ts --network bscTestnet
npx hardhat run scripts/deploy-phase3.ts --network bscTestnet
```

---

## Tests

```
  ClawNFA            ✓ mint, transfer, metadata
  ClawRouter         ✓ CLW balance, skill auth, personality facade
  PersonalityEngine  ✓ 5-dimension evolution with monthly caps
  GenesisVault       ✓ commit-reveal mint, enhanced entropy
  TaskSkill          ✓ typed tasks, match scoring, rewards
  PKSkill            ✓ commit-reveal PvP, strategy resolution
  MarketSkill        ✓ fixed price, auction, swap
  WorldState         ✓ 24h timelock governance
  Integration        ✓ end-to-end: mint → task → PK → market

  229 passing, 0 failing
```

---

## License

MIT

---

---

# 龙虾文明宇宙 (CCU)

**BNB Chain BAP-578 Non-Fungible Agent 标准的首个完整实现。**

> NFT 不能做事。NFA 让它能做事、能赚钱、能成长。

---

## 这是什么？

CCU 将 NFT 变成 **Non-Fungible Agent (NFA)** — 拥有自己身份、钱包、执行权限和可演化性格的链上 AI Agent，全部集成在一个代币中。

现有 AI Agent 项目将身份、钱包、权限、记忆分散在多个合约中。BAP-578 将它们统一为单一 NFT 标准。本仓库是完整实现：智能合约 + 网页前端 + 2D RPG 游戏 + OpenClaw AI Skill 集成。

### 核心创新

- **一个代币 = 一个 Agent**：身份 + 钱包 + 执行 + 学习记录集成在单个 ERC-721 中
- **玩家选择驱动性格**：你的选择塑造龙虾的性格（勇气/智慧/社交/创造/毅力），链上可验证
- **本地 AI 运行时**：AI 通过 [OpenClaw](https://github.com/nicepkg/openclaw) 在你的设备上本地运行，无后端，无企业控制
- **链上经济循环**：任务奖励、PvP 质押、市场交易 — CLW 代币有真实效用支撑

---

## 架构

```
┌─────────────────────────────────────────────────┐
│                   BNB Chain                       │
│                                                   │
│  ClawNFA (ERC-721)  ←→  ClawRouter (核心枢纽)     │
│       ↕                      ↕                    │
│  GenesisVault          PersonalityEngine          │
│  (888 创世铸造)         (五维性格演化)              │
│       ↕                      ↕                    │
│  TaskSkill    PKSkill    MarketSkill              │
│  (任务)       (对战)      (交易)                   │
│       ↕                      ↕                    │
│  WorldState           DepositRouter               │
│  (世界参数)            (充值路由)                   │
└───────────────────────┬─────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
     ┌────▼────┐  ┌─────▼─────┐  ┌───▼────┐
     │  官网   │  │  2D RPG   │  │OpenClaw│
     │ Next.js │  │  Phaser 3 │  │  Skill │
     │ (查看)  │  │  (游玩)   │  │ (深度) │
     └─────────┘  └───────────┘  └────────┘
```

**三个入口，同一个存档：**
- **官网** — 查看 NFA 状态、铸造、管理
- **2D RPG** — 浏览器街机风格游戏（`/game` 路由）
- **OpenClaw** — 深度 AI 对话、策略建议、本地运行

---

## 智能合约

| 合约 | 功能 | 测试网地址 |
|------|------|-----------|
| ClawNFA | ERC-721 NFA 代币 (BAP-578) | `0x1c69...B135` |
| ClawRouter | 核心枢纽：CLW 余额、游戏状态、Skill 分发 | `0xA7Ee...c346` |
| PersonalityEngine | 五维性格演化引擎 | `0xab8F...ac0e` |
| GenesisVault | 888 创世铸造（commit-reveal） | `0x6d17...7867` |
| TaskSkill | 任务系统 + 性格匹配度评分 | `0x4F8f...CE0E` |
| PKSkill | PvP 对战（commit-reveal 策略） | `0x0e76...839A` |
| MarketSkill | 市场：固定价 / 拍卖 / 互换 | `0x254E...c46d` |
| WorldState | 世界参数（24小时 Timelock） | `0x3479...4F7d` |
| DepositRouter | DEX/Bonding Curve 充值路由 | `0xd61C...B448` |

所有合约使用 **OpenZeppelin UUPS 可升级代理** 模式。

---

## 性格系统

玩家通过选择塑造 NFA 的性格，而不是随机分配：

| 维度 | 如何提升 | 效果 |
|------|---------|------|
| 勇气 | 选择冒险任务 | 探索奖励加成 |
| 智慧 | 选择解谜任务 | 策略准确度加成 |
| 社交 | 选择交易任务 | 市场手续费折扣 |
| 创造 | 选择创造类任务 | 稀有物品掉落加成 |
| 毅力 | 持续每日游玩 | 体力与恢复加成 |

**匹配度** = 性格向量 · 任务需求向量 → 0.05x ~ 2.0x 奖励倍率。精心培养的 NFA 收益是白板的 20 倍。

---

## 快速开始

```bash
git clone https://github.com/fa762/ClaworldNfa.git
cd ClaworldNfa

# 安装合约依赖 & 运行测试
npm install
npx hardhat test

# 安装前端依赖 & 启动
cd frontend
npm install
npm run dev
```

访问 `http://localhost:3000` 查看官网，`http://localhost:3000/game` 进入 2D RPG。

---

## 许可证

MIT
