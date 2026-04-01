# ClaworldNfa

> [English](#english) | [中文](#cn)

---

## English
<a name="english"></a>

## What We Built

ClaworldNfa is a complete implementation of the [BAP-578](https://github.com/nicepkg/openclaw) Non-Fungible Agent (NFA) standard on [BNB Chain](https://www.bnbchain.org/). It turns static NFTs into living on-chain AI agents that can think, act, earn, and evolve.

The project delivers a full-stack system: 10 smart contracts on BSC mainnet, a web frontend, a 2D browser RPG, and an AI skill plugin for the [OpenClaw](https://github.com/nicepkg/openclaw) local runtime. All open source under MIT license.

- **Website**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **GitHub**: [fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Skill Source**: [fa762/claw-world-skill](https://github.com/fa762/claw-world-skill)

---

## The Problem

BAP-578 is BNB Chain's proposed standard for Non-Fungible Agents — NFTs that function as autonomous AI agents. But until ClaworldNfa, no project had delivered a working end-to-end implementation.

Existing on-chain AI Agent projects suffer from fragmentation: agent identity lives in one contract, its wallet in another, execution permissions in a third, and learning data somewhere off-chain. This makes agents non-composable, non-portable, and impossible to truly own or trade as a single asset.

ClaworldNfa solves this by unifying all four BAP-578 capabilities — **identity, wallet, execution, and learning** — into a single ERC-721 token.

---

## How It Works

### One Token = One Agent

Each [ClawNFA](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) token is a complete AI agent on-chain. It carries:

- **Identity**: level, rarity, shelter assignment, job class, DNA traits
- **Wallet**: internal CLW token balance managed by the [ClawRouter](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) contract
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

The system uses a hub-and-spoke architecture centered on [ClawRouter](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5):

| Skill | Function | Contract |
|-------|----------|----------|
| [TaskSkill](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) | Quest completion, XP + CLW rewards scaled by personality match | `0x652c...442a` |
| [PKSkill](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) | PvP arena, commit-reveal strategy with personality modifiers | `0xaed3...9D10` |
| [MarketSkill](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) | Fixed-price sales, 24h auctions, NFA-for-NFA swaps | `0xA58e...8dfF` |
| [PersonalityEngine](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) | 5-dimension personality evolution | `0xFe68...f269` |
| [GenesisVault](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) | 888 genesis mint via commit-reveal | `0xCe04...fF83` |
| [WorldState](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) | Global parameters with 24h timelock | `0xC375...9FCA` |
| [DepositRouter](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) | BNB → CLW via DEX or bonding curve | `0x6e3d...2a54` |
| [ClawOracle](https://bscscan.com/address/0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E) | AI oracle with commit-reveal verification | `0x19E8...331E` |

Each skill is a separate UUPS upgradeable proxy. New skills can be added without modifying existing contracts.

### Three Ways to Play

The system provides three entry points sharing the same on-chain state:

1. **[Website](https://www.clawnfaterminal.xyz)** — CRT terminal-style interface for viewing NFA stats, minting, and management. Built with Next.js 16, React 19, wagmi, and viem.

2. **[2D RPG](https://www.clawnfaterminal.xyz/game)** — A Phaser 3 pixel art browser game. Players walk through underground shelters, interact with NPCs, complete tasks, enter PvP arenas, and trade. All actions trigger real on-chain transactions.

3. **[OpenClaw Skill](https://clawhub.ai/fa762/claw-world)** — A plugin for the OpenClaw local AI runtime. Deep AI-powered conversations with your lobster agent, strategic advice, and complex operations through natural language. The AI runs entirely on your device — no backend, no corporate control.

---

## Security

| Mechanism | Purpose |
|-----------|---------|
| **UUPS Proxy** | All contracts upgradeable, owner-only access |
| **Commit-Reveal** | Mint, PvP, Oracle — prevents frontrunning |
| **Enhanced Entropy** | salt + nonce + gasleft() mixing, no VRF dependency |
| **24h Timelock** | WorldState: propose → wait 24h → execute |
| **Pull-over-Push** | BNB refunds via `pendingWithdrawals` + `claimRefund()` |
| **Skill Authorization** | Only router-authorized contracts modify NFA state |
| **Monthly Caps** | Personality ±5/month per dimension |
| **Storage Gaps** | 40 slots reserved per contract for upgrades |

229 automated tests, 0 failures.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | [BNB Chain](https://www.bnbchain.org/) (BSC Mainnet) |
| Contracts | Solidity ^0.8.20, [OpenZeppelin](https://www.openzeppelin.com/) UUPS |
| Build & Test | [Hardhat](https://hardhat.org/), Chai, Mocha |
| Frontend | [Next.js](https://nextjs.org/) 16, [React](https://react.dev/) 19, TypeScript |
| Chain Interaction | [wagmi](https://wagmi.sh/) v3, [viem](https://viem.sh/) v2 |
| Game Engine | [Phaser 3](https://phaser.io/) |
| AI Runtime | [OpenClaw](https://github.com/nicepkg/openclaw) (local) |
| UI | [Tailwind CSS](https://tailwindcss.com/), CRT/PipBoy terminal aesthetic |

---

## What's Next

- **Cross-Agent Communication** — NFAs interacting with each other autonomously on-chain
- **Multi-Chain Expansion** — bringing BAP-578 beyond BNB Chain
- **DAO Governance** — NFA holders voting on [WorldState](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) parameters
- **Equipment System** — on-chain items that modify agent capabilities
- **Advanced AI Integration** — deeper personality-driven AI behavior in [OpenClaw](https://clawhub.ai/fa762/claw-world) conversations

---

---

## 中文
<a name="cn"></a>

## 我们做了什么

ClaworldNfa 是 [BNB Chain](https://www.bnbchain.org/) 上 [BAP-578](https://github.com/nicepkg/openclaw) Non-Fungible Agent (NFA) 标准的完整实现。它将静态 NFT 变成了能思考、行动、赚取和进化的链上 AI Agent。

项目交付了一个全栈系统：BSC 主网上的 10 个智能合约、一个网页前端、一个 2D 浏览器 RPG 游戏，以及 [OpenClaw](https://github.com/nicepkg/openclaw) 本地 AI 运行时的 Skill 插件。全部在 MIT 许可下开源。

- **官网**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **GitHub**: [fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Skill 源码**: [fa762/claw-world-skill](https://github.com/fa762/claw-world-skill)

---

## 解决什么问题

BAP-578 是 BNB Chain 提出的 Non-Fungible Agent 标准——让 NFT 作为自主 AI Agent 运行。但在 ClaworldNfa 之前，没有项目交付过可用的端到端实现。

现有链上 AI Agent 项目高度碎片化：Agent 身份在一个合约里，钱包在另一个，执行权限在第三个，学习数据则在链下。不可组合、不可迁移、无法作为单一资产真正拥有或交易。

ClaworldNfa 将 BAP-578 的四项能力——**身份、钱包、执行、学习**——统一到一个 ERC-721 代币中。

---

## 工作原理

### 一个代币 = 一个 Agent

每个 [ClawNFA](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) 代币就是一个完整的链上 AI Agent，携带：

- **身份**：等级、稀有度、避难所归属、职业、DNA 特征
- **钱包**：由 [ClawRouter](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) 合约管理的内部 CLW 余额
- **执行**：授权的 Skill 合约（任务、PvP、市场），Agent 可以调用
- **学习**：五维性格向量（勇气、智慧、社交、创造、毅力），基于玩家行为演化

### 玩家驱动的性格演化

性格系统是核心创新。不同于随机属性分配，NFA 的性格完全由玩家选择塑造：

- 选择冒险任务 → 勇气成长
- 选择解谜任务 → 智慧成长
- 选择交易任务 → 社交成长
- 选择创造类任务 → 创造成长
- 持续游玩 → 毅力成长

每维度每月上限 ±5，防止刷分。性格向量通过匹配度公式直接影响经济收益：

```
matchScore = dot(性格向量, 任务需求向量)
奖励倍率 = 基于 matchScore 的 0.05x ~ 2.0x
```

精心培养的 NFA 收益最高是白板的 20 倍。这创造了真实的长期参与激励——你越用心培养 Agent，它就越有价值。

### 模块化 Skill 架构

系统采用以 [ClawRouter](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) 为核心的辐射式架构：

| Skill | 功能 | 合约 |
|-------|------|------|
| [TaskSkill](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) | 任务完成，XP + CLW 奖励随性格匹配度缩放 | `0x652c...442a` |
| [PKSkill](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) | PvP 擂台，commit-reveal 策略 + 性格修正 | `0xaed3...9D10` |
| [MarketSkill](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) | 固定价售卖、24h 拍卖、NFA 互换 | `0xA58e...8dfF` |
| [PersonalityEngine](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) | 五维性格演化 | `0xFe68...f269` |
| [GenesisVault](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) | 888 创世铸造，commit-reveal | `0xCe04...fF83` |
| [WorldState](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) | 全局参数，24h 时间锁 | `0xC375...9FCA` |
| [DepositRouter](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) | BNB → CLW，通过 DEX 或 Bonding Curve | `0x6e3d...2a54` |
| [ClawOracle](https://bscscan.com/address/0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E) | AI 预言机，commit-reveal 验证 | `0x19E8...331E` |

每个 Skill 都是独立的 UUPS 可升级代理合约。新增 Skill 无需修改现有合约。

### 三种游玩方式

系统提供三个入口，共享同一个链上状态：

1. **[官网](https://www.clawnfaterminal.xyz)** — CRT 终端风格界面，查看 NFA 状态、铸造和管理。技术栈：Next.js 16、React 19、wagmi、viem。

2. **[2D RPG](https://www.clawnfaterminal.xyz/game)** — Phaser 3 像素风浏览器游戏。玩家在地下避难所中走动、与 NPC 交互、完成任务、进入 PvP 擂台、进行交易。所有操作触发真实链上交易。

3. **[OpenClaw Skill](https://clawhub.ai/fa762/claw-world)** — OpenClaw 本地 AI 运行时的插件。与龙虾 Agent 进行深度 AI 对话、获取策略建议、通过自然语言执行复杂操作。AI 完全在你的设备上运行——无后端、无企业控制。

---

## 安全设计

| 机制 | 目的 |
|------|------|
| **UUPS 代理** | 所有合约可升级，仅 owner 可操作 |
| **Commit-Reveal** | Mint、PvP、Oracle — 防止抢跑 |
| **增强熵源** | salt + nonce + gasleft() 混合，不依赖 VRF |
| **24h 时间锁** | WorldState：提议 → 等待 24h → 执行 |
| **Pull-over-Push** | BNB 退款通过 `pendingWithdrawals` + `claimRefund()` |
| **Skill 授权** | 只有路由器授权的合约才能修改 NFA 状态 |
| **月度上限** | 性格每维度每月 ±5 |
| **存储间隙** | 每个合约预留 40 slot 给未来升级 |

229 自动化测试，0 失败。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 区块链 | [BNB Chain](https://www.bnbchain.org/)（BSC 主网） |
| 合约 | Solidity ^0.8.20, [OpenZeppelin](https://www.openzeppelin.com/) UUPS |
| 构建与测试 | [Hardhat](https://hardhat.org/), Chai, Mocha |
| 前端 | [Next.js](https://nextjs.org/) 16, [React](https://react.dev/) 19, TypeScript |
| 链交互 | [wagmi](https://wagmi.sh/) v3, [viem](https://viem.sh/) v2 |
| 游戏引擎 | [Phaser 3](https://phaser.io/) |
| AI 运行时 | [OpenClaw](https://github.com/nicepkg/openclaw)（本地运行） |
| UI | [Tailwind CSS](https://tailwindcss.com/), CRT/PipBoy 终端风格 |

---

## 未来计划

- **跨 Agent 通信** — NFA 之间在链上自主交互
- **多链扩展** — 将 BAP-578 扩展到 BNB Chain 之外
- **DAO 治理** — NFA 持有者投票决定 [WorldState](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) 参数
- **装备系统** — 链上道具修改 Agent 能力
- **深度 AI 集成** — 在 [OpenClaw](https://clawhub.ai/fa762/claw-world) 对话中实现更深的性格驱动 AI 行为
