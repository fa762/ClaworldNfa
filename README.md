<p align="center">
  <img src="docs/assets/banner.png" alt="ClaworldNfa banner" width="100%" />
</p>

# ClaworldNfa

Language: [English](#english) | [中文](#chinese)

ClaworldNfa is an AI-native NFA companion and game protocol on BNB Chain.

ClaworldNfa 是一个部署在 BNB Chain 上的 AI 原生 NFA 伙伴与游戏协议。

- Live app: [www.clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- Public repository: [github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)
- Network: BNB Smart Chain mainnet
- Token name used in product UI: `Claworld`
- License: MIT

---

<a id="english"></a>
## English

### What It Is

ClaworldNfa is live as a Terminal-style PWA where the user:

1. connects a wallet
2. loads owned NFAs
3. selects one NFA
4. talks to that NFA in natural language
5. receives structured action cards
6. confirms wallet actions from those cards
7. reads balance, memory, world, and autonomy state in the same shell

This repository includes smart contracts, a Next.js PWA, server-side API routes, memory endpoints, autonomy runner scripts, and deployment / upgrade / smoke scripts.

### Paradigm Thesis

The main claim of ClaworldNfa is not "AI + NFT".

The main claim is that one NFA can be all of these at once:

- an owned on-chain identity
- an in-world account holder
- a playable game actor
- a memory-bearing companion
- an AI runtime subject
- a bounded autonomous executor

That is the paradigm change in this repository.

### Why It Is Different

ClaworldNfa connects the full chain below into one system:

`NFA identity -> NFA ledger -> gameplay state -> memory context -> AI intent parsing -> action card -> wallet-confirmed or bounded autonomous execution -> receipt and accounting`

Most projects stop at one or two of those layers. This project treats them as one runtime model.

### Core Innovations

#### 1. NFA as identity plus account

- `ClawNFA` is the identity anchor.
- `ClawRouter` gives each NFA its own internal Claworld ledger account.
- Gameplay, upkeep, rewards, and withdrawals revolve around the NFA ledger instead of a wallet-only account model.

#### 2. Conversation as the runtime interface

- The live frontend is a Terminal-style PWA.
- The user talks to the selected NFA in natural language.
- The system turns clear intent into structured action cards instead of allowing an LLM to directly sign arbitrary transactions.

#### 3. Memory as runtime state

- The chat path loads memory summary and recent timeline into context.
- Memory is not decorative lore. It is part of the runtime state.
- The learning-tree path leaves room for verifiable on-chain anchoring of memory state.

#### 4. Bounded autonomy instead of free-form agent signing

- Autonomy runs through policy, registry, oracle, action hub, adapter, and finalization layers.
- Offline execution is possible, but only inside explicit protocol boundaries.
- This is not a generic unattended signer.

#### 5. NFA-native settlement across game loops

- mining
- PK
- Battle Royale
- mint
- claim flows

These loops settle around the same NFA ledger model, so identity, assets, and gameplay do not drift apart.

### On-Chain Protocol Layers

#### Identity and account

- `contracts/core/ClawNFA.sol`
- `contracts/core/ClawRouter.sol`
- `contracts/core/PersonalityEngine.sol`
- `contracts/core/DepositRouter.sol`

Highlights:

- BAP-578-aligned NFA identity
- learning-tree root storage
- personality growth caps
- upkeep, dormancy, withdraw cooldown
- ledger-based gameplay spending

#### Skills

- `contracts/skills/GenesisVault.sol`
- `contracts/skills/TaskSkill.sol`
- `contracts/skills/PKSkill.sol`
- `contracts/skills/BattleRoyale.sol`
- `contracts/skills/MarketSkill.sol`

Highlights:

- `GenesisVault`: commit-reveal mint
- `TaskSkill`: personality-weighted mining and world multiplier integration
- `PKSkill`: commit-reveal strategy game with DNA mutation
- `BattleRoyale`: room-based elimination, NFA-ledger participation, autonomy-facing entry points
- `MarketSkill`: fixed price, auction, and swap flows

#### World and economy

- `contracts/world/WorldState.sol`
- `contracts/core/DepositRouter.sol`

Highlights:

- reward multiplier
- PK stake limit
- mutation bonus
- daily cost multiplier
- world events
- 24 hour timelock for major manual world-state changes
- token ingress path through bonding-curve / `Flap Portal` before graduation and PancakeSwap after graduation

This means the token economy, gameplay economy, and world modifiers are part of the same design, not separate systems.

### Autonomy Policy Engine

Key contract:

- `contracts/world/ClawAutonomyRegistry.sol`

This contract is not a simple allowlist. It is a multi-dimensional on-chain policy engine.

The evaluation path checks dimensions such as:

- policy enabled
- emergency pause
- operator approval
- adapter approval
- protocol approval
- spend caps
- daily limits
- failure breaker
- operator budget
- per-asset budget
- reserve floor
- dynamic reserve source and buffer

Important features:

- `preflightAuthorizedAction(...)`
- `previewAuthorizedAction(...)`
- `consumeAuthorizedAction(...)`
- dynamic reserve controls through reserve-source hooks and `dynamicReserveBufferBps`

This is one of the strongest protocol-level innovations in the repository.

### Action Lifecycle and Auditability

Key contract:

- `contracts/world/ClawOracleActionHub.sol`

The action lifecycle is explicit:

1. `requestAutonomousAction(...)`
2. `syncOracleResult(...)`
3. `executeSyncedAction(...)`
4. finalization / receipt update

Important properties:

- `capabilityHash` binds the policy snapshot used at request time
- `reasoningCid` can link to uploaded reasoning documents
- pending actions have explicit lifecycle states
- receipts include spend, rewards, retry count, result hash, and receipt hash

This creates an auditable action trail for autonomous behavior.

### Agent Runtime Design

Key modules:

- `openclaw/autonomyPlanner.ts`
- `openclaw/autonomyOracleRunner.ts`
- `openclaw/autonomyCmlRuntime.ts`
- `openclaw/autonomyMemory.ts`
- `openclaw/battleRoyaleRevealWatcher.ts`

The runtime model is important:

- deterministic code builds candidates first
- deterministic code scores candidates first
- the LLM chooses only from bounded candidate sets
- fallback logic exists when the model fails or returns nothing

That is very different from handing the agent a free-form "decide everything" prompt.

### Reasoning and Memory Proof Path

The autonomy runner can produce full reasoning documents and upload them through the configured uploader path.

Important pieces:

- `reasoningCid` in oracle and action-hub flows
- optional reasoning document upload
- memory summary and timeline loaded into runtime context
- learning-tree anchoring path for persistent memory state

The repository supports both practical deployments and more verifiable deployments.

### Live Product Surface

The Terminal PWA is the main user-facing product.

Core actions exposed in the current UI:

- chat with the selected NFA
- mint a new NFA
- deposit Claworld into an NFA ledger account
- withdraw Claworld from an NFA ledger account
- run mining actions
- browse and join PK
- browse and join Battle Royale
- claim available rewards
- view and write memory
- configure BYOK / model mode
- open autonomy controls
- use market actions where configured

The UI rule is simple: show action, reward, condition, and result. Long explanations go behind panels or advanced views.

### Repository Tree

```text
contracts/
  core/
    ClawNFA.sol
    ClawRouter.sol
    DepositRouter.sol
    PersonalityEngine.sol
  skills/
    GenesisVault.sol
    TaskSkill.sol
    PKSkill.sol
    BattleRoyale.sol
    MarketSkill.sol
  world/
    ClawOracle.sol
    ClawAutonomyRegistry.sol
    ClawOracleActionHub.sol
    ClawAutonomyFinalizationHub.sol
    WorldState.sol
    adapters/

frontend/
  src/
    app/api/
      chat/
      memory/
      world/
      autonomy/
      nfas/
    components/
      terminal/
      game/
      lobster/
    contracts/
      abis/
      hooks/

openclaw/
  autonomyPlanner.ts
  autonomyOracleRunner.ts
  autonomyCmlRuntime.ts
  autonomyMemory.ts
  battleRoyaleRevealWatcher.ts
  skills/

scripts/
  deploy-*.ts
  upgrade-*.ts
  smoke-*.ts
  configure-*.ts

docs/
  INNOVATION_MAP.md

test/
```

### Reviewer Reading Path

If you are reviewing the project for technical depth, read in this order:

1. `PROJECT.md`
2. `docs/INNOVATION_MAP.md`
3. `ARCHITECTURE.md`
4. `contracts/world/ClawAutonomyRegistry.sol`
5. `contracts/world/ClawOracleActionHub.sol`
6. `contracts/core/ClawRouter.sol`
7. `contracts/skills/BattleRoyale.sol`
8. `openclaw/autonomyPlanner.ts`
9. `openclaw/autonomyOracleRunner.ts`
10. `frontend/src/components/terminal/`

### Mainnet Contract Addresses

The frontend contains canonical BNB Chain mainnet defaults in `frontend/src/contracts/addresses.ts`.

| Contract | Address |
| --- | --- |
| ClawNFA | `0xAa2094798B5892191124eae9D77E337544FFAE48` |
| ClawRouter | `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5` |
| Claworld token | `0x3b486c191c74c9945fa944a3ddde24acdd63ffff` |
| GenesisVault | `0xCe04f834aC4581FD5562f6c58C276E60C624fF83` |
| TaskSkill | `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10` |
| PKSkill | `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF` |
| BattleRoyale | `0x2B2182326Fd659156B2B119034A72D1C2cC9758D` |
| MarketSkill | `0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54` |
| DepositRouter | `0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269` |
| WorldState | `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA` |
| OracleActionHub | `0xEdd04D821ab9E8eCD5723189A615333c3509f1D5` |
| AutonomyRegistry | `0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044` |
| BattleRoyaleAdapter | `0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc` |

### Local Development

Install dependencies:

```bash
npm install
npm --prefix frontend install
```

Run frontend locally:

```bash
npm --prefix frontend run dev
```

Build frontend:

```bash
npm --prefix frontend run build
```

Compile contracts:

```bash
npm run compile
```

Run contract tests:

```bash
npx hardhat test
```

### Environment Variables

Examples live in:

- `.env.example`
- `frontend/.env.example`
- `openclaw/.env.autonomy-runner.example`

Important server-side variables include:

- `CLAWORLD_API_URL`
- `CLAWORLD_API_TOKEN`
- `CLAWORLD_CHAT_MODEL_BASE_URL`
- `CLAWORLD_CHAT_MODEL_API_KEY`
- `CLAWORLD_CHAT_MODEL_NAME`
- `CLAWORLD_ENABLE_WEB_TOOLS`

### Security

Please see `SECURITY.md` for reporting and security expectations.

Practical rules:

- user wallet writes require user confirmation
- server keys stay server-side
- BYOK keys are encrypted locally and unlocked by wallet signature
- autonomy actions are bounded by policy and contract checks
- public repository examples must not contain live secrets

---

<a id="chinese"></a>
## 中文

### 这是什么项目

ClaworldNfa 是一个部署在 BNB Chain 上的 AI 原生 NFA 伙伴与游戏协议。

当前在线产品是一个 Terminal 风格 PWA。用户连接钱包后，可以读取自己持有的 NFA，和它对话，再通过动作卡去完成链上行为。

### 它真正创新在哪里

这个项目最重要的不是“AI + NFT”这几个字，而是把下面这条链完整接起来了：

`NFA 身份 -> NFA 账本 -> 游戏状态 -> 记忆上下文 -> AI 理解意图 -> 动作卡 -> 钱包确认 / 有边界的自治执行 -> 回执与结算`

同一个 NFA 在这里同时承担：

- 链上身份
- 世界里的账户
- 游戏参与者
- 带记忆的伙伴
- AI 运行时里的主体
- 受限自治执行主体

### 核心创新模块

#### 1. NFA 既是身份，也是账户

- `ClawNFA` 负责身份锚点
- `ClawRouter` 给每只 NFA 单独的 Claworld 记账账户
- 消耗、奖励、维护、提现都围绕 NFA 账本结算

#### 2. 对话不是装饰，是运行时入口

- 当前主产品是 Terminal PWA
- 用户先说意图
- 系统先生成结构化动作卡
- 真正的链上写入仍然要经过钱包确认

#### 3. 记忆是状态层，不是文案层

- 对话会加载 memory summary 和 timeline
- learning-tree 路径给链上锚定留下空间
- 角色不是每次都重新扮演，而是能延续

#### 4. 自治不是裸签，是有边界的

- `ClawAutonomyRegistry` 负责策略约束
- `ClawOracleActionHub` 负责动作中枢
- adapter 负责协议执行隔离
- finalization 负责结果和记账回写

#### 5. 玩法围绕 NFA 账本结算

- 挖矿
- PK
- 大逃杀
- 铸造
- 奖励领取

这些玩法都围绕同一个 NFA 账本模型来运转。

### 重要协议层

#### AutonomyRegistry

`contracts/world/ClawAutonomyRegistry.sol`

这不是简单白名单，而是多维 policy engine。它会检查：

- policy 开关
- emergency pause
- operator / adapter / protocol approval
- spend cap
- daily limit
- failure breaker
- reserve floor
- dynamic reserve source 和 buffer

这层是项目里最强的协议创新之一。

#### ActionHub

`contracts/world/ClawOracleActionHub.sol`

动作生命周期是明确拆开的：

1. `requestAutonomousAction(...)`
2. `syncOracleResult(...)`
3. `executeSyncedAction(...)`
4. finalize / receipt update

关键点：

- `capabilityHash` 绑定动作发起时的策略快照
- `reasoningCid` 连接推理证明
- receipt 记录开销、奖励、重试次数、结果哈希和回执哈希

#### WorldState + DepositRouter

- `WorldState` 把奖励倍率、维护倍率、事件、timelock 放到链上
- `DepositRouter` 支持 bonding-curve 阶段的 `Flap Portal` 路径，以及毕业后的 PancakeSwap 路径

这说明世界经济、代币入口和玩法经济是联动设计，不是分开的模块。

### Agent Runtime 设计

关键代码在：

- `openclaw/autonomyPlanner.ts`
- `openclaw/autonomyOracleRunner.ts`
- `openclaw/autonomyCmlRuntime.ts`
- `openclaw/autonomyMemory.ts`
- `openclaw/battleRoyaleRevealWatcher.ts`

重要方法论：

- 先由确定性代码生成候选
- 先由确定性代码做评分
- LLM 只在候选里做多选
- 模型失败时有 fallback

这和“把一切交给模型自由发挥”不是一回事。

### 当前在线产品面

当前 Terminal PWA 已经公开的主要动作包括：

- 对话
- 铸造
- 存款
- 提现
- 挖矿
- PK
- 大逃杀
- 记忆读写
- BYOK / 模型设置
- 自治控制
- 市场能力

### 文件结构树

```text
contracts/
  core/
  skills/
  world/
    adapters/

frontend/
  src/
    app/api/
    components/
      terminal/
      game/
      lobster/
    contracts/

openclaw/
  autonomyPlanner.ts
  autonomyOracleRunner.ts
  autonomyCmlRuntime.ts
  autonomyMemory.ts
  battleRoyaleRevealWatcher.ts
  skills/

scripts/
docs/
test/
```

### 建议阅读顺序

如果你想快速看懂项目，建议按这个顺序读：

1. `PROJECT.md`
2. `docs/INNOVATION_MAP.md`
3. `ARCHITECTURE.md`
4. `contracts/world/ClawAutonomyRegistry.sol`
5. `contracts/world/ClawOracleActionHub.sol`
6. `contracts/core/ClawRouter.sol`
7. `contracts/skills/BattleRoyale.sol`
8. `openclaw/autonomyPlanner.ts`
9. `openclaw/autonomyOracleRunner.ts`
10. `frontend/src/components/terminal/`

### 主网地址

主网默认地址写在 `frontend/src/contracts/addresses.ts` 里，README 英文段落上方有完整表格。

### 本地运行

```bash
npm install
npm --prefix frontend install
npm --prefix frontend run dev
npx hardhat test
```

### 安全

请查看 `SECURITY.md`。

简单原则：

- 用户钱包写入一定要用户确认
- 服务端密钥不进浏览器
- BYOK 密钥本地加密保存
- 自治执行必须经过 policy 和合约边界
- 开源仓库不放任何真实密钥
