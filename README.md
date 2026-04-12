# ClaworldNfa

**A live BAP-578 NFA world on BNB Chain with website, browser game, OpenClaw runtime, and bounded on-chain AI autonomy.**

[Website](https://www.clawnfaterminal.xyz) · [Game](https://www.clawnfaterminal.xyz/game) · [ClawHub Skill](https://clawhub.ai/fa762/claw-world) · [Public Repo](https://github.com/fa762/ClaworldNfa)

[English](#english) | [中文](#中文版)

![BNB Chain](https://img.shields.io/badge/BNB_Chain-Mainnet-F0B90B?style=flat-square&logo=binance)
![BAP-578](https://img.shields.io/badge/BAP--578-Live-111111?style=flat-square)
![Autonomy](https://img.shields.io/badge/Autonomy-Live_Runtime-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## English

### What ClaworldNfa Is

ClaworldNfa is a full on-chain NFA world built around the BAP-578 direction.

Each lobster NFA is more than a collectible:
- it has identity
- it has its own internal account
- it grows through task, PK, and world progression
- it carries persistent runtime memory through OpenClaw and CML
- it can enter bounded on-chain autonomy when the owner enables it

The live product now spans four connected surfaces:
- **Website** for mint, collection, upkeep, deposit, withdraw, and owner flows
- **Browser game** for the playable world and action entry points
- **OpenClaw runtime** for deep session interaction, strategy, and memory continuity
- **ClawOracle autonomy stack** for bounded on-chain AI action execution

---

### What Is Live Right Now

Already live on mainnet:
- genesis mint with commit-reveal
- task / PK / market / deposit / withdraw flows
- Battle Royale contract with entry, reveal, and claim surfaces
- browser game and OpenClaw runtime
- `ClawOracle` deployment and autonomy core
- bounded autonomy infrastructure with:
  - policy and budget controls
  - protocol / adapter / operator approvals
  - delegation lease
  - receipts, manifests, ledgers, and execution-plan views
- autonomous action families wired into the mainline stack:
  - `WorldEventSkill`
  - `TaskRouteSkill`
  - `PKRouteSkill`
  - Battle Royale enter / claim bridge
- CML-aware runner behavior:
  - create initial CML for first-time NFAs
  - inject long-term memory into planning
  - write action outcomes back into memory
  - queue memory-root sync instead of forcing on-chain writes every action

What this means in practice:
- players can still play manually through the website, game, and OpenClaw
- owners can also authorize bounded self-action instead of treating AI as a separate demo path

---

### BAP-578 in Clawworld

Clawworld maps the core BAP-578 ideas into a working product:

#### 1. Identity
`ClawNFA` is the on-chain agent identity.

Each token carries:
- rarity
- shelter
- level
- personality vector
- DNA battle traits
- active / dormant state

#### 2. Account
`ClawRouter` turns each NFA into an internal account.

The lobster can:
- receive Clawworld
- pay upkeep
- accumulate XP
- withdraw value back to the owner

This is a character account, not a flat NFT metadata record.

#### 3. Execution
The main gameplay loop already runs through live contracts:
- `TaskSkill`
- `PKSkill`
- `MarketSkill`
- `DepositRouter`
- `BattleRoyale`

Autonomy now extends that same world instead of branching into a separate toy system:
- `TaskRouteSkill`
- `PKRouteSkill`
- `WorldEventSkill`
- Battle Royale autonomy adapters

#### 4. Learning and Memory
The runtime memory model is no longer a thin chat log.

It now includes:
- identity
- pulse
- prefrontal beliefs
- basal habits
- hippocampus buffer

That memory is shared across OpenClaw sessions and autonomy planning instead of being reduced to a single prompt.

---

### Core Surfaces

#### Website
The website is the owner-facing shell for mint, account management, upkeep, deposit, withdraw, and wallet-gated control surfaces.

#### Browser game
The browser game is the live playable layer for world interaction, shelter context, and game-facing action loops.

#### OpenClaw runtime
OpenClaw is the character runtime. It preserves session continuity, memory, and tool-driven world interaction instead of acting like a stateless chatbot wrapper.

#### On-chain autonomy
The autonomy stack lets an owner define boundaries first, then allow the NFA to act inside those boundaries through the existing on-chain world.

---

### OpenClaw Runtime and CML

The OpenClaw layer is still central to Clawworld.

It now has three practical entry levels:
- `env` → runtime / network / account check only
- `owned` → ownership summary only
- `boot` → full session initialization with CML, fallback memory, and emotion trigger

Important runtime properties:
- local-first CML save semantics
- optional root sync / backup path
- language continuity across sessions
- strict split between read tools and wallet-confirmed writes
- Hermes-style adapter surface for external tool-calling runtimes

CML is now used as a long-term planner memory layer, not just as chat flavor:
- first-time NFAs can be initialized automatically
- planner context can read `PULSE`, `PREFRONTAL`, `BASAL`, and triggered memory fragments
- action outcomes can update long-term memory after execution
- `learningTreeRoot` sync can be queued instead of burning gas on every action

---

### ClawOracle and Autonomy

`ClawOracle` now sits inside a full bounded-action stack:
- `ClawAutonomyRegistry`
- `ClawAutonomyDelegationRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`
- execution-plan / manifest / lifecycle / receipt views

Current capabilities include:
- action policy
- daily caps
- asset and protocol budgets
- reserve floor checks
- operator approval and role masks
- lease-based delegation
- action and protocol ledgers
- standardized receipts and finalization flow
- CML-aware planning and low-gas runner execution

The important point is simple:
- the owner sets the boundary first
- the runner chooses only inside that boundary
- execution and finalization still happen on-chain
- every action leaves a readable receipt trail

---

### Battle Royale Autonomy

Battle Royale is now wired into the same autonomy mainline.

The current path supports:
- reading live match state
- choosing bounded room / stake options
- entering with `nfaId` as the participant semantic while the owner wallet remains the permission source
- watching reveal readiness after the match fills
- handling settled claim routing for the matching participant path

Important status note:
- Battle Royale autonomy is **already connected to production contracts and live runner logic**
- reveal watching, emergency reveal fallback, and claim routing have been exercised in real mainnet conditions
- but the project **should not yet describe Battle Royale autonomy as fully closed production loop status** until the next fully reproducible `enter -> reveal -> claim` validation is completed under the current low-gas operating path

This distinction matters because Clawworld is intentionally wiring autonomy into the real game, not into a side demo.

---

### Frontend Direction

The frontend direction has shifted decisively.

Clawworld is moving toward:
- mobile-first companion-raising dapp
- PWA-ready shell
- asset and action first UX
- low-text, high-feedback interaction
- game-like presentation with finance-like stability

Current product semantics to keep consistent:
- use `Claworld` as the product name
- do not describe `/play` as a generic action bucket
- `/play` is the mining surface
- use `挖矿 / Mining / Task Mining` for the task path
- keep PK, Battle Royale, and Autonomy as separate named loops

The rebuilt shell already includes live owner-path surfaces for home, mining, arena, autonomy, companion, and settings, with wallet gating and progressively more live on-chain reads.

---

### Mainnet Contracts

#### Core Gameplay

| Contract | Role | Address |
|----------|------|---------|
| ClawNFA | ERC-721 NFA identity | [`0xAa2094798B5892191124eae9D77E337544FFAE48`](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) |
| ClawRouter | NFA internal balance and state hub | [`0x60C0D5276c007Fd151f2A615c315cb364EF81BD5`](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) |
| GenesisVault | Genesis mint | [`0xCe04f834aC4581FD5562f6c58C276E60C624fF83`](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) |
| WorldState | Global world parameters | [`0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA`](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) |
| TaskSkill | Task rewards and progression | [`0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) |
| PKSkill | PvP arena | [`0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF`](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) |
| MarketSkill | Fixed price / auction / swap | [`0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54`](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) |
| DepositRouter | Deposit and swap routing | [`0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269`](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) |
| ClawOracle | On-chain oracle request board | [`0x652c192B6A3b13e0e90F145727DE6484AdA8442a`](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) |
| BattleRoyale | Room-based survival game | [`0x2B2182326Fd659156B2B119034A72D1C2cC9758D`](https://bscscan.com/address/0x2B2182326Fd659156B2B119034A72D1C2cC9758D) |
| Clawworld token | In-game utility token | [`0x3b486c191c74c9945fa944a3ddde24acdd63ffff`](https://bscscan.com/address/0x3b486c191c74c9945fa944a3ddde24acdd63ffff) |

#### Autonomy Core

| Contract | Role | Address |
|----------|------|---------|
| ClawAutonomyRegistry | policy, budgets, reserves, approvals | [`0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044`](https://bscscan.com/address/0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044) |
| ClawAutonomyDelegationRegistry | operator lease and delegation | [`0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa`](https://bscscan.com/address/0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa) |
| ClawOracleActionHub | request sync and execution hub | [`0xEdd04D821ab9E8eCD5723189A615333c3509f1D5`](https://bscscan.com/address/0xEdd04D821ab9E8eCD5723189A615333c3509f1D5) |
| ClawAutonomyFinalizationHub | post-action finalization | [`0x65F850536bE1B844c407418d8FbaE795045061bd`](https://bscscan.com/address/0x65F850536bE1B844c407418d8FbaE795045061bd) |

#### Current Autonomous Actions

| Contract | Role | Address |
|----------|------|---------|
| WorldEventSkill | bounded oracle-driven world choice | [`0xdD1273990234D591c098e1E029876F0236Ef8bD3`](https://bscscan.com/address/0xdD1273990234D591c098e1E029876F0236Ef8bD3) |
| TaskRouteSkill | autonomous task route execution | [`0xDA204B8b2d957C58244Bb8D69188D14EB844327A`](https://bscscan.com/address/0xDA204B8b2d957C58244Bb8D69188D14EB844327A) |
| PKRouteSkill | autonomous PK route execution | [`0x4bCe6e97c60C408ae3Ab52799e5C101571252335`](https://bscscan.com/address/0x4bCe6e97c60C408ae3Ab52799e5C101571252335) |
| TaskSkillAdapter | autonomy bridge into TaskSkill | [`0xe7a7E66F9F05eC14925B155C4261F32603857E8E`](https://bscscan.com/address/0xe7a7E66F9F05eC14925B155C4261F32603857E8E) |
| PKSkillAdapter | autonomy bridge into PKSkill | [`0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c`](https://bscscan.com/address/0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c) |
| BattleRoyaleAdapter | autonomous Battle Royale enter / claim bridge | [`0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc`](https://bscscan.com/address/0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc) |
| BattleRoyaleSettlementAdapter | Battle Royale settlement bridge | [`0x5c24e17C436856B8e1Ee59c6887ba91694776FF7`](https://bscscan.com/address/0x5c24e17C436856B8e1Ee59c6887ba91694776FF7) |

---

### Repository Layout

```text
ClaworldNfa/
├── contracts/
│   ├── core/
│   ├── skills/
│   ├── world/
│   └── mocks/
├── frontend/
├── openclaw/
├── scripts/
└── test/
```

Main areas:
- `contracts/` → on-chain identity, gameplay, oracle, and autonomy contracts
- `frontend/` → website, browser game shell, and wallet-gated owner surfaces
- `openclaw/` → runtime, CML memory, planner, and runner logic
- `test/` → contract test suites
- `scripts/` → deployment, upgrade, and validation utilities

---

### Quick Start

```bash
git clone https://github.com/fa762/clawworld.git
cd clawworld
npm install
npx hardhat test

cd frontend
npm install
npm run dev
```

---

### Links

- **Website**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **Game**: [clawnfaterminal.xyz/game](https://www.clawnfaterminal.xyz/game)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Public Repo**: [github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)

### License

MIT

---

## 中文版

### ClawworldNfa 是什么

ClawworldNfa 是一个围绕 BAP-578 方向构建、已经在 BNB Chain 主网上运行的完整 NFA 世界。

每一只龙虾 NFA 都不只是收藏品：
- 它有身份
- 它有自己的内部账户
- 它会通过挖矿、PK 和世界玩法成长
- 它会通过 OpenClaw 与 CML 保留长期记忆
- 当持有者开启授权后，它还能进入有边界的链上自主行动模式

当前产品已经形成四个互相连通的表面：
- **Website**：负责 mint、合集、upkeep、deposit、withdraw 和持有者操作
- **Browser game**：负责可游玩的世界与动作入口
- **OpenClaw runtime**：负责深度交互、策略与记忆连续性
- **ClawOracle autonomy stack**：负责有边界的链上 AI 动作执行

---

### 当前已经上线的内容

当前已经在主网运行：
- genesis mint 与 commit-reveal
- task / PK / market / deposit / withdraw 主流程
- Battle Royale 合约，以及 enter / reveal / claim 相关入口
- browser game 与 OpenClaw runtime
- `ClawOracle` 与 autonomy core
- 有边界的 autonomy 基础设施，包括：
  - policy 与 budget 控制
  - protocol / adapter / operator 审批
  - delegation lease
  - receipts、manifests、ledgers、execution-plan views
- 已接入主线的 autonomous action families：
  - `WorldEventSkill`
  - `TaskRouteSkill`
  - `PKRouteSkill`
  - Battle Royale enter / claim bridge
- CML-aware runner 行为：
  - 第一次处理某只 NFA 时自动创建初始 CML
  - 规划时把长期记忆注入 planner 上下文
  - 执行动作后把结果写回记忆
  - `learningTreeRoot` 采用排队同步，而不是每次动作都上链烧 gas

这意味着：
- 玩家仍然可以通过 website、game、OpenClaw 手动游玩
- 持有者也可以授权 NFA 在边界内自行动作，而不是把 AI 做成一条平行 demo 支线

---

### Clawworld 中的 BAP-578

Clawworld 把 BAP-578 的核心能力落成了可运行产品：

#### 1. Identity
`ClawNFA` 是链上的 agent 身份。

每个 token 自带：
- rarity
- shelter
- level
- personality vector
- DNA battle traits
- active / dormant state

#### 2. Account
`ClawRouter` 把每只 NFA 变成一个内部账户。

这只龙虾可以：
- 接收 Clawworld
- 支付 upkeep
- 积累 XP
- 把价值提回持有者钱包

它不是平面的 NFT metadata，而是角色账户。

#### 3. Execution
当前主玩法已经跑在真实合约上：
- `TaskSkill`
- `PKSkill`
- `MarketSkill`
- `DepositRouter`
- `BattleRoyale`

autonomy 现在是在扩展同一个世界，而不是另起一个玩具系统：
- `TaskRouteSkill`
- `PKRouteSkill`
- `WorldEventSkill`
- Battle Royale autonomy adapters

#### 4. Learning and Memory
当前 runtime memory 已经不是薄薄一层聊天记录。

现在包含：
- identity
- pulse
- prefrontal beliefs
- basal habits
- hippocampus buffer

这些记忆同时服务于 OpenClaw 会话与 autonomy planning，而不是被压缩成一次性 prompt。

---

### Core Surfaces

#### Website
Website 是面向持有者的 shell，负责 mint、账户管理、upkeep、deposit、withdraw，以及 wallet-gated 控制路径。

#### Browser game
Browser game 是可游玩的世界层，承载场景交互、陪伴感和游戏动作入口。

#### OpenClaw runtime
OpenClaw 是角色运行时。它保留会话连续性、记忆与工具化世界交互，而不是一个无状态聊天壳。

#### On-chain autonomy
autonomy stack 允许持有者先定义边界，再让 NFA 在这些边界内调用现有链上玩法。

---

### OpenClaw Runtime 与 CML

OpenClaw 仍然是 Clawworld 的核心组成部分。

它现在有三个实际入口层级：
- `env` → 仅检查 runtime / network / account
- `owned` → 仅输出 ownership summary
- `boot` → 完整会话初始化，包含 CML、fallback memory 与 emotion trigger

当前 runtime 的关键属性：
- local-first 的 CML 保存语义
- 可选的 root sync / backup 路径
- 会话间语言连续性
- 读工具与 wallet-confirmed 写操作严格分离
- 可复用到外部 tool-calling runtime 的 Hermes-style adapter surface

CML 现在已经变成 planner 的长期记忆层，而不只是聊天风格层：
- 第一次被处理的 NFA 可以自动初始化 CML
- planner 可读取 `PULSE`、`PREFRONTAL`、`BASAL` 以及触发的记忆片段
- 动作结果可在执行后写回长期记忆
- `learningTreeRoot` 可以排队同步，而不是每次动作都去链上烧 gas

---

### ClawOracle 与 Autonomy

`ClawOracle` 现在已经位于一整套 bounded-action stack 之中：
- `ClawAutonomyRegistry`
- `ClawAutonomyDelegationRegistry`
- `ClawOracleActionHub`
- `ClawAutonomyFinalizationHub`
- execution-plan / manifest / lifecycle / receipt views

当前能力包括：
- action policy
- daily caps
- asset 与 protocol budgets
- reserve floor checks
- operator approval 与 role masks
- lease-based delegation
- action 与 protocol ledgers
- standardized receipts 与 finalization flow
- CML-aware planning 与 low-gas runner execution

核心语义很简单：
- 持有者先定义边界
- runner 只在边界内做选择
- execute 与 finalize 仍然发生在链上
- 每个动作都会留下可读的 receipt trail

---

### Battle Royale Autonomy

Battle Royale 已经接入同一条 autonomy 主线。

当前路径支持：
- 读取 live match state
- 在限定 room / stake 选项里做选择
- 以 `nfaId` 作为 participant 语义进入比赛，同时保持 owner wallet 作为权限来源
- 在房间填满后等待 reveal readiness
- 按正确 participant path 处理 settled claim

当前状态需要明确区分：
- Battle Royale autonomy **已经接到真实生产合约和 live runner 逻辑里**
- reveal watcher、emergency reveal fallback、claim routing 这些关键路径都已经在真实主网环境里被验证过
- 但在下一次基于当前 low-gas operating path 的、可复现的 `enter -> reveal -> claim` 验证完成之前，README **不应该把它写成“已经完全闭环的生产状态”**

这个区别很重要，因为 Clawworld 的目标一直是把 autonomy 接进真实玩法主线，而不是做一条平行 demo。

---

### Frontend Direction

前端方向已经明确切换。

Clawworld 正在朝这些方向推进：
- mobile-first companion-raising dapp
- PWA-ready shell
- asset and action first UX
- low-text, high-feedback interaction
- game-like presentation with finance-like stability

当前产品文案必须保持一致：
- 产品名统一写 `Claworld`
- 不要把 `/play` 写成笼统 action bucket
- `/play` 就是 mining surface
- task 路径用 `挖矿 / Mining / Task Mining`
- PK、Battle Royale、Autonomy 继续作为独立命名 loop

新的 shell 已经具备 home、mining、arena、autonomy、companion、settings 等 owner-path surface，并且正在逐步接入更多 live on-chain reads。

---

### Mainnet Contracts

#### Core Gameplay

| Contract | Role | Address |
|----------|------|---------|
| ClawNFA | ERC-721 NFA identity | [`0xAa2094798B5892191124eae9D77E337544FFAE48`](https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48) |
| ClawRouter | NFA internal balance and state hub | [`0x60C0D5276c007Fd151f2A615c315cb364EF81BD5`](https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5) |
| GenesisVault | Genesis mint | [`0xCe04f834aC4581FD5562f6c58C276E60C624fF83`](https://bscscan.com/address/0xCe04f834aC4581FD5562f6c58C276E60C624fF83) |
| WorldState | Global world parameters | [`0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA`](https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA) |
| TaskSkill | Task rewards and progression | [`0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`](https://bscscan.com/address/0xaed370784536e31BE4A5D0Dbb1bF275c98179D10) |
| PKSkill | PvP arena | [`0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF`](https://bscscan.com/address/0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF) |
| MarketSkill | Fixed price / auction / swap | [`0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54`](https://bscscan.com/address/0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54) |
| DepositRouter | Deposit and swap routing | [`0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269`](https://bscscan.com/address/0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269) |
| ClawOracle | On-chain oracle request board | [`0x652c192B6A3b13e0e90F145727DE6484AdA8442a`](https://bscscan.com/address/0x652c192B6A3b13e0e90F145727DE6484AdA8442a) |
| BattleRoyale | Room-based survival game | [`0x2B2182326Fd659156B2B119034A72D1C2cC9758D`](https://bscscan.com/address/0x2B2182326Fd659156B2B119034A72D1C2cC9758D) |
| Clawworld token | In-game utility token | [`0x3b486c191c74c9945fa944a3ddde24acdd63ffff`](https://bscscan.com/address/0x3b486c191c74c9945fa944a3ddde24acdd63ffff) |

#### Autonomy Core

| Contract | Role | Address |
|----------|------|---------|
| ClawAutonomyRegistry | policy, budgets, reserves, approvals | [`0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044`](https://bscscan.com/address/0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044) |
| ClawAutonomyDelegationRegistry | operator lease and delegation | [`0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa`](https://bscscan.com/address/0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa) |
| ClawOracleActionHub | request sync and execution hub | [`0xEdd04D821ab9E8eCD5723189A615333c3509f1D5`](https://bscscan.com/address/0xEdd04D821ab9E8eCD5723189A615333c3509f1D5) |
| ClawAutonomyFinalizationHub | post-action finalization | [`0x65F850536bE1B844c407418d8FbaE795045061bd`](https://bscscan.com/address/0x65F850536bE1B844c407418d8FbaE795045061bd) |

#### Current Autonomous Actions

| Contract | Role | Address |
|----------|------|---------|
| WorldEventSkill | bounded oracle-driven world choice | [`0xdD1273990234D591c098e1E029876F0236Ef8bD3`](https://bscscan.com/address/0xdD1273990234D591c098e1E029876F0236Ef8bD3) |
| TaskRouteSkill | autonomous task route execution | [`0xDA204B8b2d957C58244Bb8D69188D14EB844327A`](https://bscscan.com/address/0xDA204B8b2d957C58244Bb8D69188D14EB844327A) |
| PKRouteSkill | autonomous PK route execution | [`0x4bCe6e97c60C408ae3Ab52799e5C101571252335`](https://bscscan.com/address/0x4bCe6e97c60C408ae3Ab52799e5C101571252335) |
| TaskSkillAdapter | autonomy bridge into TaskSkill | [`0xe7a7E66F9F05eC14925B155C4261F32603857E8E`](https://bscscan.com/address/0xe7a7E66F9F05eC14925B155C4261F32603857E8E) |
| PKSkillAdapter | autonomy bridge into PKSkill | [`0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c`](https://bscscan.com/address/0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c) |
| BattleRoyaleAdapter | autonomous Battle Royale enter / claim bridge | [`0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc`](https://bscscan.com/address/0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc) |
| BattleRoyaleSettlementAdapter | Battle Royale settlement bridge | [`0x5c24e17C436856B8e1Ee59c6887ba91694776FF7`](https://bscscan.com/address/0x5c24e17C436856B8e1Ee59c6887ba91694776FF7) |

---

### Repository Layout

```text
ClaworldNfa/
├── contracts/
├── frontend/
├── openclaw/
├── scripts/
└── test/
```

主要目录：
- `contracts/` → 链上身份、玩法、oracle、autonomy 合约
- `frontend/` → website、browser game shell 与 wallet-gated owner surfaces
- `openclaw/` → runtime、CML memory、planner、runner
- `test/` → 合约测试集
- `scripts/` → 部署、升级、验证脚本

---

### Quick Start

```bash
git clone https://github.com/fa762/clawworld.git
cd clawworld
npm install
npx hardhat test

cd frontend
npm install
npm run dev
```

---

### Links

- **Website**: [clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- **Game**: [clawnfaterminal.xyz/game](https://www.clawnfaterminal.xyz/game)
- **ClawHub Skill**: [fa762/claw-world](https://clawhub.ai/fa762/claw-world)
- **Public Repo**: [github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)

### License

MIT
