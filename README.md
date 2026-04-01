# ClaworldNfa

**The first end-to-end implementation of BAP-578 Non-Fungible Agent standard on BNB Chain.**

[Website](https://www.clawnfaterminal.xyz) · [ClawHub Skill](https://clawhub.ai/fa762/claw-world) · [BNBScan](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48)

> [English](#english) | [中文](#cn)

![BNB Chain](https://img.shields.io/badge/BNB_Chain-Mainnet-F0B90B?style=flat-square&logo=binance) ![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-363636?style=flat-square&logo=solidity) ![Tests](https://img.shields.io/badge/Tests-229_passing-brightgreen?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## English
<a name="english"></a>

### The Problem

> In the age of AI, who owns your agent?

You spend months training an AI assistant — it learns your preferences, your style, your strategies. But it's not yours. The platform can revoke access, shut down, or change the rules overnight.

Meanwhile, on-chain AI Agent projects are fragmented: identity in one contract, wallet in another, execution logic in a third. No composability. No standard. No way to truly own, trade, or evolve your agent.

**BAP-578** proposes a Non-Fungible Agent standard to solve this. But until now, it had no complete implementation.

### The Solution

**ClaworldNfa is the first end-to-end BAP-578 implementation** — from smart contracts to AI runtime to playable game. Everything works. Everything is on mainnet.

```
┌─────────────────────────────────────────────────────────┐
│  Traditional NFT          vs          BAP-578 NFA       │
│                                                         │
│  Static JPEG                    Living AI Agent         │
│  No behavior                    Executes on-chain tasks │
│  No wallet                      Has its own wallet      │
│  No growth                      Personality evolves     │
│  Just a picture                 Earns, fights, trades   │
└─────────────────────────────────────────────────────────┘
```

---

### How BAP-578 Works in ClaworldNfa

BAP-578 defines four capabilities for a Non-Fungible Agent. Here's how we implement each:

#### 1. Identity — `ClawNFA.sol`
A single ERC-721 token IS the agent. Not a pointer to an off-chain profile — the token itself carries on-chain state: level, personality vector, DNA traits, shelter assignment, and job class.

```solidity
// One token holds everything
struct LobsterState {
    uint8 level;
    uint8[5] personality;  // [courage, wisdom, social, creativity, grit]
    uint8[4] dna;          // [STR, DEF, SPD, VIT]
    uint8 shelter;
    uint16 job;
    uint256 clwBalance;
}
```

#### 2. Wallet — `ClawRouter.sol`
Each NFA has an internal CLW balance managed by the router. The agent can receive rewards, pay fees, and stake tokens — all within the contract system. No external wallet needed.

```
Mint NFA → Complete tasks → Earn CLW → Stake in PvP → Trade on market
              ↑                                            ↓
              └──────── CLW flows back into economy ───────┘
```

#### 3. Execution — Skill Contracts
Agents execute on-chain actions through authorized Skill contracts:

| Skill | What the Agent Does |
|-------|-------------------|
| **TaskSkill** | Completes quests, earns XP + CLW based on personality match |
| **PKSkill** | Enters PvP arenas with commit-reveal strategy |
| **MarketSkill** | Lists for sale, bids in auctions, proposes swaps |
| **PersonalityEngine** | Evolves personality based on player choices |

Each Skill is a separate upgradeable contract authorized by the router — modular, composable, and extensible.

#### 4. Learning — `PersonalityEngine.sol`
The agent's personality evolves based on player behavior, not randomness:

```
Player chooses adventure task  →  courage += Δ
Player chooses puzzle task     →  wisdom += Δ
Player chooses trade task      →  social += Δ
Player chooses creation task   →  creativity += Δ
Player plays consistently      →  grit += Δ

Monthly cap: ±5 per dimension (prevents gaming)
```

**Match Score** = `dot(personality_vector, task_vector)` → **0.05x ~ 2.0x reward multiplier**. A carefully trained NFA earns up to 20x more than a blank one. This creates real economic incentive for long-term engagement.

---

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                      BNB Chain                        │
│                                                       │
│  ClawNFA ←────→ ClawRouter ←────→ PersonalityEngine   │
│  (ERC-721)      (Core Hub)        (5D Evolution)      │
│                      │                                │
│          ┌───────────┼───────────┐                    │
│          │           │           │                    │
│      TaskSkill   PKSkill   MarketSkill                │
│      (Quests)    (PvP)     (Trade)                    │
│          │           │           │                    │
│          └───────────┼───────────┘                    │
│                      │                                │
│     GenesisVault  WorldState  DepositRouter  Oracle   │
│     (888 Mint)    (Timelock)  (DEX)          (AI)     │
└──────────────────────┬───────────────────────────────┘
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
- **Website** — view stats, mint, manage your NFA
- **2D RPG** — browser pixel game at `/game` (arcade mode)
- **OpenClaw** — local AI runtime for deep conversations & strategy

---

### Smart Contracts (BSC Mainnet)

| Contract | Role | Address |
|----------|------|---------|
| ClawNFA | ERC-721 NFA identity | [`0xAa20...AE48`](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) |
| ClawRouter | Core hub: balance, state, dispatch | [`0x60C0...BD5`](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) |
| GenesisVault | 888 genesis mint (commit-reveal) | [`0xCe04...fF83`](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) |
| WorldState | Global params (24h timelock) | [`0xC375...9FCA`](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) |
| TaskSkill | Quests + personality match scoring | [`0x652c...442a`](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) |
| PKSkill | PvP arena (commit-reveal strategy) | [`0xaed3...9D10`](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) |
| MarketSkill | Marketplace: sell / auction / swap | [`0xA58e...8dfF`](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) |
| DepositRouter | DEX / bonding curve routing | [`0x6e3d...2a54`](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) |
| PersonalityEngine | 5-dimension personality evolution | [`0xFe68...f269`](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) |
| ClawOracle | AI oracle (commit-reveal) | [`0x19E8...331E`](https://bscscan.com/address/0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E) |

All contracts: OpenZeppelin UUPS upgradeable proxy. 229 tests passing, 0 failing.

---

### Security Design

| Mechanism | Purpose |
|-----------|---------|
| **UUPS Proxy** | All contracts upgradeable with owner-only access |
| **Commit-Reveal** | Mint, PvP, Oracle — prevents frontrunning |
| **Enhanced Entropy** | salt + nonce + gasleft() mixing (no VRF dependency) |
| **24h Timelock** | WorldState changes require propose → wait 24h → execute |
| **Pull-over-Push** | All BNB refunds via `pendingWithdrawals` + `claimRefund()` |
| **Skill Authorization** | Only router-authorized contracts can modify NFA state |
| **Monthly Caps** | Personality evolution capped at ±5/month per dimension |
| **Storage Gaps** | 40 slots reserved in all contracts for future upgrades |

---

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | BNB Chain (BSC Mainnet) |
| Contracts | Solidity ^0.8.20, Hardhat, OpenZeppelin UUPS |
| Frontend | Next.js 16, React 19, wagmi v3, viem v2 |
| Game Engine | Phaser 3 (2D pixel RPG) |
| AI Runtime | OpenClaw (local, no backend) |
| UI | Tailwind CSS, CRT/PipBoy terminal aesthetic |

---

### Project Structure

```
ClaworldNfa/
├── contracts/              # 10 Solidity smart contracts
│   ├── core/               # ClawNFA, ClawRouter, DepositRouter, PersonalityEngine
│   ├── skills/             # TaskSkill, PKSkill, MarketSkill, GenesisVault
│   └── world/              # WorldState, ClawOracle
├── frontend/               # Next.js website + Phaser 3 game
│   └── src/
│       ├── app/            # Pages: home, collection, detail, mint, game
│       ├── components/     # PipBoy terminal UI components
│       ├── contracts/      # ABIs + wagmi hooks + addresses
│       └── game/           # Phaser 3: scenes, UI, chain bridge
├── openclaw/               # OpenClaw AI skill plugin
│   └── claw-world-skill/   # SKILL.md + CLI tools
├── test/                   # 229 tests across 10 test suites
└── scripts/                # Deploy & utility scripts
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

---

### Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| BAP-578 Contracts | **Mainnet** | 10 contracts deployed, 229 tests passing |
| Website + Mint | **Live** | NFA collection, detail pages, commit-reveal mint |
| OpenClaw Skill | **Published** | AI skill on ClawHub, local runtime |
| 2D RPG Game | **Live** | Browser pixel game with on-chain interactions |
| AI Oracle | **Deployed** | On-chain AI event processing |
| Cross-Agent Communication | Planned | NFAs interact with each other autonomously |
| Multi-Chain | Planned | Expand BAP-578 beyond BNB Chain |
| DAO Governance | Planned | NFA holders vote on WorldState parameters |
| Equipment System | Planned | On-chain items that modify agent capabilities |

---

### Links

- **Website**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Skill Source**: [github.com/fa762/claw-world-skill](https://github.com/fa762/claw-world-skill)
- **BNBScan**: [ClawNFA Contract](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48)

### License

MIT

---

---

## 中文
<a name="cn"></a>

### 问题

> AI 时代，你拥有什么？

你花了几个月训练一个 AI 助手——它学会了你的偏好、风格和策略。但它不属于你。平台可以随时封号、关停，或者改变规则。

与此同时，链上 AI Agent 项目一片碎片化：身份一个合约、钱包一个合约、执行逻辑又一个合约。不可组合，没有标准，无法真正拥有、交易或进化你的 Agent。

**BAP-578** 提出了 Non-Fungible Agent 标准来解决这个问题。但在此之前，它没有完整的实现。

### 解决方案

**ClaworldNfa 是首个端到端的 BAP-578 实现** — 从智能合约到 AI 运行时到可玩游戏。全部可用，全部在主网。

```
┌─────────────────────────────────────────────────────┐
│  传统 NFT                 vs          BAP-578 NFA   │
│                                                     │
│  静态图片                        活的 AI Agent       │
│  没有行为                        执行链上任务        │
│  没有钱包                        自带钱包            │
│  不会成长                        性格持续演化        │
│  只是一张图                      能赚钱、能战斗、能交易│
└─────────────────────────────────────────────────────┘
```

---

### BAP-578 在 ClaworldNfa 中的实现

BAP-578 定义了 NFA 的四项能力。以下是我们的具体实现：

#### 1. 身份 — `ClawNFA.sol`
一个 ERC-721 代币**就是** Agent 本身。不是指向链下资料的指针——代币本身携带链上状态：等级、性格向量、DNA 特征、避难所归属、职业。

```solidity
// 一个代币包含一切
struct LobsterState {
    uint8 level;
    uint8[5] personality;  // [勇气, 智慧, 社交, 创造, 毅力]
    uint8[4] dna;          // [力量, 防御, 速度, 体力]
    uint8 shelter;
    uint16 job;
    uint256 clwBalance;
}
```

#### 2. 钱包 — `ClawRouter.sol`
每个 NFA 都有由路由合约管理的内部 CLW 余额。Agent 可以接收奖励、支付费用、质押代币——全部在合约体系内完成，无需外部钱包。

```
铸造 NFA → 完成任务 → 赚取 CLW → PvP 质押 → 市场交易
              ↑                                    ↓
              └────── CLW 回流到经济循环 ───────────┘
```

#### 3. 执行 — Skill 合约
Agent 通过授权的 Skill 合约执行链上操作：

| Skill | Agent 的行为 |
|-------|-------------|
| **TaskSkill** | 完成任务，根据性格匹配度获得 XP + CLW |
| **PKSkill** | 参加 PvP 擂台，commit-reveal 策略对决 |
| **MarketSkill** | 挂售、竞拍、互换 |
| **PersonalityEngine** | 根据玩家选择演化性格 |

每个 Skill 都是独立的可升级合约，由路由器授权——模块化、可组合、可扩展。

#### 4. 学习 — `PersonalityEngine.sol`
Agent 的性格基于玩家行为演化，而不是随机的：

```
玩家选择冒险任务  →  勇气 += Δ
玩家选择解谜任务  →  智慧 += Δ
玩家选择交易任务  →  社交 += Δ
玩家选择创造任务  →  创造 += Δ
玩家持续游玩      →  毅力 += Δ

月度上限：每维度 ±5（防止刷分）
```

**匹配度** = `dot(性格向量, 任务向量)` → **0.05x ~ 2.0x 奖励倍率**。精心培养的 NFA 收益最高是白板的 20 倍。这创造了长期参与的真实经济激励。

---

### 架构

```
┌──────────────────────────────────────────────────────┐
│                      BNB Chain                        │
│                                                       │
│  ClawNFA ←────→ ClawRouter ←────→ PersonalityEngine   │
│  (ERC-721)      (核心枢纽)        (五维演化)           │
│                      │                                │
│          ┌───────────┼───────────┐                    │
│          │           │           │                    │
│      TaskSkill   PKSkill   MarketSkill                │
│      (任务)       (对战)     (交易)                    │
│          │           │           │                    │
│          └───────────┼───────────┘                    │
│                      │                                │
│     GenesisVault  WorldState  DepositRouter  Oracle   │
│     (888铸造)     (时间锁)    (充值路由)     (AI)     │
└──────────────────────┬───────────────────────────────┘
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
- **官网** — 查看状态、铸造、管理 NFA
- **2D RPG** — 浏览器像素游戏（`/game`，街机模式）
- **OpenClaw** — 本地 AI 运行时，深度对话与策略

---

### 智能合约（BSC 主网）

| 合约 | 角色 | 地址 |
|------|------|------|
| ClawNFA | ERC-721 NFA 身份 | [`0xAa20...AE48`](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) |
| ClawRouter | 核心枢纽 | [`0x60C0...BD5`](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) |
| GenesisVault | 888 创世铸造 | [`0xCe04...fF83`](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) |
| WorldState | 世界参数（24h 时间锁） | [`0xC375...9FCA`](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) |
| TaskSkill | 任务 + 匹配度评分 | [`0x652c...442a`](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) |
| PKSkill | PvP（commit-reveal） | [`0xaed3...9D10`](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) |
| MarketSkill | 市场：售卖/拍卖/互换 | [`0xA58e...8dfF`](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) |
| DepositRouter | DEX/Bonding Curve 路由 | [`0x6e3d...2a54`](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) |
| PersonalityEngine | 五维性格演化 | [`0xFe68...f269`](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) |
| ClawOracle | AI 预言机 | [`0x19E8...331E`](https://bscscan.com/address/0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E) |

全部合约：OpenZeppelin UUPS 可升级代理。229 测试通过，0 失败。

---

### 安全设计

| 机制 | 目的 |
|------|------|
| **UUPS 代理** | 所有合约可升级，仅 owner 可操作 |
| **Commit-Reveal** | Mint、PvP、Oracle — 防止抢跑 |
| **增强熵源** | salt + nonce + gasleft() 混合（不依赖 VRF） |
| **24h 时间锁** | WorldState 变更需 提议 → 等待24h → 执行 |
| **Pull-over-Push** | 所有 BNB 退款通过 `pendingWithdrawals` + `claimRefund()` |
| **Skill 授权** | 只有路由器授权的合约才能修改 NFA 状态 |
| **月度上限** | 性格演化每维度每月 ±5 |
| **存储间隙** | 所有合约预留 40 slot 给未来升级 |

---

### 技术栈

| 层 | 技术 |
|----|------|
| 区块链 | BNB Chain（BSC 主网） |
| 合约 | Solidity ^0.8.20, Hardhat, OpenZeppelin UUPS |
| 前端 | Next.js 16, React 19, wagmi v3, viem v2 |
| 游戏引擎 | Phaser 3（2D 像素 RPG） |
| AI 运行时 | OpenClaw（本地运行，无后端） |
| UI | Tailwind CSS, CRT/PipBoy 终端风格 |

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

### 路线图

| 阶段 | 状态 | 描述 |
|------|------|------|
| BAP-578 合约 | **主网上线** | 10 个合约已部署，229 测试通过 |
| 官网 + 铸造 | **已上线** | NFA 合集、详情页、commit-reveal 铸造 |
| OpenClaw Skill | **已发布** | AI Skill 上架 ClawHub，本地运行 |
| 2D RPG 游戏 | **已上线** | 浏览器像素游戏，链上交互 |
| AI 预言机 | **已部署** | 链上 AI 事件处理 |
| Agent 间通信 | 计划中 | NFA 之间自主交互 |
| 多链扩展 | 计划中 | 将 BAP-578 扩展到 BNB Chain 之外 |
| DAO 治理 | 计划中 | NFA 持有者投票决定 WorldState 参数 |
| 装备系统 | 计划中 | 链上道具修改 Agent 能力 |

---

### 相关链接

- **官网**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Skill 源码**: [github.com/fa762/claw-world-skill](https://github.com/fa762/claw-world-skill)
- **BNBScan**: [ClawNFA 合约](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48)

### 许可证

MIT
