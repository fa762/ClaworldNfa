<p align="center">
  <h1 align="center">ClaworldNfa</h1>
  <p align="center">The first end-to-end implementation of BAP-578 Non-Fungible Agent standard on BNB Chain.</p>
  <p align="center">
    <a href="#english">English</a> | <a href="#中文">中文</a>
  </p>
</p>

---

<a id="english"></a>

## English

### What is ClaworldNfa?

ClaworldNfa turns NFTs into **Non-Fungible Agents (NFA)** — on-chain AI agents with their own identity, wallet, execution rights, and evolving personality. All in one token.

> NFTs can't do anything. NFAs can act, earn, and grow.

### The Problem

There is no unified standard for on-chain AI Agents. Current projects scatter identity, wallet, permissions, and memory across multiple contracts — fragmented, non-composable, non-tradeable.

### The Solution

**BAP-578** proposes a Non-Fungible Agent standard on BNB Chain. ClaworldNfa is the **first complete implementation** — from smart contracts to AI runtime to playable game.

- **One token = One agent** — identity, wallet, execution, learning record in a single ERC-721
- **Player-driven evolution** — your choices shape your agent's personality (5 dimensions), on-chain verifiable
- **Local AI runtime** — AI runs on your device via OpenClaw, no backend, no corporate control
- **Real token economy** — tasks, PvP, marketplace — CLW token with actual utility loops

---

### Architecture

```
┌──────────────────────────────────────────────┐
│                  BNB Chain                    │
│                                              │
│  ClawNFA (ERC-721)  ←→  ClawRouter (Hub)     │
│       ↕                      ↕               │
│  GenesisVault          PersonalityEngine      │
│  (888 Mint)            (5D Evolution)         │
│       ↕                      ↕               │
│  TaskSkill    PKSkill    MarketSkill          │
│  (Quests)    (PvP)      (Trade)              │
│       ↕                      ↕               │
│  WorldState           DepositRouter           │
│  (Global Params)      (DEX Routing)           │
└──────────────────────┬───────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌─────▼─────┐  ┌───▼────┐
    │ Website │  │  2D RPG   │  │OpenClaw│
    │ Next.js │  │  Phaser 3 │  │  Skill │
    │ (View)  │  │  (Play)   │  │ (Deep) │
    └─────────┘  └───────────┘  └────────┘
```

Three entry points, one save file:
- **Website** — view NFA stats, mint, manage
- **2D RPG** — browser game at `/game`
- **OpenClaw** — deep AI conversations & strategy

---

### Smart Contracts (BSC Mainnet)

| Contract | Description | Address |
|----------|-------------|---------|
| ClawNFA | ERC-721 NFA (BAP-578) | `0xAa2094798B5892191124eae9D77E337544FFAE48` |
| ClawRouter | Core hub | `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5` |
| GenesisVault | 888 genesis mint | `0xCe04f834aC4581FD5562f6c58C276E60C624fF83` |
| WorldState | Global params (24h timelock) | `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA` |
| TaskSkill | Quest + match scoring | `0x652c192B6A3b13e0e90F145727DE6484AdA8442a` |
| PKSkill | PvP (commit-reveal) | `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10` |
| MarketSkill | Marketplace | `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF` |
| DepositRouter | DEX routing | `0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54` |
| PersonalityEngine | 5D evolution | `0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269` |
| ClawOracle | AI oracle | `0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E` |

All contracts use OpenZeppelin UUPS upgradeable proxy.

---

### Personality System

Your choices shape your NFA — not randomness:

| Dimension | How to grow | Effect |
|-----------|------------|--------|
| Courage | Adventure tasks | Exploration bonus |
| Wisdom | Puzzle tasks | Strategy bonus |
| Social | Trade tasks | Fee discount |
| Creativity | Creation tasks | Rare drop bonus |
| Grit | Daily consistency | Recovery bonus |

**Match Score** = personality vector · task vector → 0.05x ~ 2.0x reward multiplier.

---

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | BNB Chain (BSC Mainnet) |
| Contracts | Solidity ^0.8.20, Hardhat, OpenZeppelin UUPS |
| Frontend | Next.js 16, React 19, wagmi, viem |
| Game | Phaser 3 (2D pixel RPG) |
| AI Runtime | OpenClaw (local) |
| Styling | Tailwind CSS, CRT terminal aesthetic |

---

### Project Structure

```
ClaworldNfa/
├── contracts/           # Solidity smart contracts
│   ├── core/            # ClawNFA, ClawRouter, DepositRouter, PersonalityEngine
│   ├── skills/          # TaskSkill, PKSkill, MarketSkill, GenesisVault
│   └── world/           # WorldState, ClawOracle
├── frontend/            # Next.js website + 2D RPG
│   └── src/
│       ├── app/         # Pages: home, NFA collection, detail, mint, game
│       ├── components/  # PipBoy terminal UI
│       ├── contracts/   # ABIs + wagmi hooks
│       └── game/        # Phaser 3 engine (scenes, UI, chain bridge)
├── openclaw/            # OpenClaw AI skill plugin
│   └── claw-world-skill/
├── test/                # 229 tests, 0 failing
└── scripts/             # Deploy & utility scripts
```

---

### Quick Start

```bash
git clone https://github.com/fa762/ClaworldNfa.git
cd ClaworldNfa

# Contracts
npm install
npx hardhat test          # 229 passing

# Frontend
cd frontend
npm install
npm run dev               # http://localhost:3000
```

Game: `http://localhost:3000/game`

### Deploy

```bash
cp .env.example .env      # fill in your private key & RPC
npx hardhat run scripts/deploy-phase1.ts --network bsc
npx hardhat run scripts/deploy-phase2.ts --network bsc
npx hardhat run scripts/deploy-phase3.ts --network bsc
```

---

### Links

- **Website**: [clawworld.xyz](https://clawworld.xyz)
- **ClawHub Skill**: [@fa762/claw-world](https://clawhub.xyz/skills/@fa762/claw-world)
- **OpenClaw Skill Repo**: [github.com/fa762/ClaworldNfa/tree/main/openclaw/claw-world-skill](https://github.com/fa762/ClaworldNfa/tree/main/openclaw/claw-world-skill)
- **BNBScan**: [ClawNFA on BNBScan](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48)

### License

MIT

---

---

<a id="中文"></a>

## 中文

### ClaworldNfa 是什么？

ClaworldNfa 将 NFT 变成 **Non-Fungible Agent (NFA)** — 拥有身份、钱包、执行权限和可演化性格的链上 AI Agent，全部集成在一个代币中。

> NFT 不能做事。NFA 让它能做事、能赚钱、能成长。

### 解决什么问题

链上 AI Agent 没有统一标准。现有项目将身份、钱包、权限、记忆分散在多个合约中——碎片化、不可组合、不可交易。

### 解决方案

**BAP-578** 是 BNB Chain 上的 Non-Fungible Agent 标准提案。ClaworldNfa 是**首个完整实现**——从智能合约到 AI 运行时到可玩游戏的端到端落地。

- **一个代币 = 一个 Agent** — 身份 + 钱包 + 执行 + 学习记录集成在单个 ERC-721
- **玩家选择驱动演化** — 你的选择塑造 Agent 的五维性格，链上可验证
- **本地 AI 运行** — 通过 OpenClaw 在你的设备上运行，无后端，无企业控制
- **真实代币经济** — 任务/对战/交易，CLW 代币有实际效用循环

---

### 架构

```
┌──────────────────────────────────────────────┐
│                  BNB Chain                    │
│                                              │
│  ClawNFA (ERC-721)  ←→  ClawRouter (枢纽)    │
│       ↕                      ↕               │
│  GenesisVault          PersonalityEngine      │
│  (888铸造)              (五维演化)             │
│       ↕                      ↕               │
│  TaskSkill    PKSkill    MarketSkill          │
│  (任务)       (对战)      (交易)              │
│       ↕                      ↕               │
│  WorldState           DepositRouter           │
│  (世界参数)            (充值路由)              │
└──────────────────────┬───────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌─────▼─────┐  ┌───▼────┐
    │  官网   │  │  2D RPG   │  │OpenClaw│
    │ Next.js │  │  Phaser 3 │  │  Skill │
    │ (查看)  │  │  (游玩)   │  │ (深度) │
    └─────────┘  └───────────┘  └────────┘
```

三个入口，同一个存档：
- **官网** — 查看 NFA 状态、铸造、管理
- **2D RPG** — 浏览器街机游戏（`/game`）
- **OpenClaw** — 深度 AI 对话与策略

---

### 智能合约（BSC 主网）

| 合约 | 功能 | 地址 |
|------|------|------|
| ClawNFA | ERC-721 NFA (BAP-578) | `0xAa2094798B5892191124eae9D77E337544FFAE48` |
| ClawRouter | 核心枢纽 | `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5` |
| GenesisVault | 888 创世铸造 | `0xCe04f834aC4581FD5562f6c58C276E60C624fF83` |
| WorldState | 世界参数（24h Timelock） | `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA` |
| TaskSkill | 任务 + 匹配度评分 | `0x652c192B6A3b13e0e90F145727DE6484AdA8442a` |
| PKSkill | PvP 对战（commit-reveal） | `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10` |
| MarketSkill | 市场交易 | `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF` |
| DepositRouter | 充值路由 | `0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54` |
| PersonalityEngine | 五维性格演化 | `0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269` |
| ClawOracle | AI 预言机 | `0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E` |

所有合约使用 OpenZeppelin UUPS 可升级代理。

---

### 性格系统

玩家通过选择塑造 NFA 性格，而不是随机：

| 维度 | 提升方式 | 效果 |
|------|---------|------|
| 勇气 | 冒险任务 | 探索奖励加成 |
| 智慧 | 解谜任务 | 策略准确度加成 |
| 社交 | 交易任务 | 手续费折扣 |
| 创造 | 创造类任务 | 稀有掉落加成 |
| 毅力 | 持续游玩 | 体力恢复加成 |

**匹配度** = 性格向量 · 任务向量 → 0.05x ~ 2.0x 奖励倍率。精心培养的 NFA 收益是白板的 20 倍。

---

### 技术栈

| 层 | 技术 |
|----|------|
| 区块链 | BNB Chain（BSC 主网） |
| 合约 | Solidity ^0.8.20, Hardhat, OpenZeppelin UUPS |
| 前端 | Next.js 16, React 19, wagmi, viem |
| 游戏 | Phaser 3（2D 像素 RPG） |
| AI 运行时 | OpenClaw（本地运行） |
| 样式 | Tailwind CSS, CRT 终端风格 |

---

### 快速开始

```bash
git clone https://github.com/fa762/ClaworldNfa.git
cd ClaworldNfa

# 合约
npm install
npx hardhat test          # 229 passing

# 前端
cd frontend
npm install
npm run dev               # http://localhost:3000
```

游戏入口：`http://localhost:3000/game`

---

### 相关链接

- **官网**: [clawworld.xyz](https://clawworld.xyz)
- **ClawHub Skill**: [@fa762/claw-world](https://clawhub.xyz/skills/@fa762/claw-world)
- **OpenClaw Skill 仓库**: [github.com/fa762/ClaworldNfa/tree/main/openclaw/claw-world-skill](https://github.com/fa762/ClaworldNfa/tree/main/openclaw/claw-world-skill)
- **BNBScan**: [ClawNFA 合约](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48)

### 许可证

MIT
