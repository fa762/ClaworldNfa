# Clawworld

Clawworld 是运行在 BNB Chain 上的 NFA 世界与移动端养成 dapp。  
这个仓库是当前的**私有主工作仓**，包含合约、前端、OpenClaw 运行时、主网迁移脚本和当前真实交接文档。

- 官网：[www.clawnfaterminal.xyz](https://www.clawnfaterminal.xyz)
- 公开仓库：[github.com/fa762/ClaworldNfa](https://github.com/fa762/ClaworldNfa)

## 当前状态

当前主线已经不再是“终端感网站”或“2D RPG 展示页”，而是这条真实产品路径：

- `ClawNFA`：每只龙虾的链上身份
- `ClawRouter`：每只 NFA 的记账账户、储备、维护、提现
- `任务挖矿`：固定 3 类任务，收益与推荐强度随角色状态变化
- `PK`：质押、策略、提交、揭示、结算
- `大逃杀`：房间制生存局、揭示、结算、奖励回记账账户
- `OpenClaw`：运行时、记忆、规划器、受边界自治执行
- `frontend/`：正在持续收口的移动端 PWA shell

已经落在主网并被反复验证过的主线能力：

- Genesis Mint（commit-reveal）
- NFA 内部记账账户
- 储备充值 / 维护 / 提现
- 任务挖矿
- PK
- 大逃杀
- Battle Royale 公开超时补揭示
- Autonomy / ActionHub / Finalization 主链路
- Vercel KV -> Vultr runner directive 闭环

## 先看哪里

如果你要接着做事，不要只看 commit history。  
当前真实状态优先看：

- [CURRENT_HANDOFF.md](./CURRENT_HANDOFF.md)
- [FRONTEND_REFACTOR_PLAN.md](./FRONTEND_REFACTOR_PLAN.md)

这两个文件记录的是：

- 当前主网已经验证到哪里
- 哪些能力已经闭环
- 哪些是前端问题，哪些是合约问题
- 当前前端重构遵循的产品规则

## 这个仓库包含什么

```text
clawworld/
├─ contracts/                  # 合约：身份、记账、玩法、自治、世界状态
├─ frontend/                   # 移动端 PWA shell、Mint、挖矿、竞技、代理、设置
├─ openclaw/                   # 运行时、CML、planner、runner、watcher
├─ scripts/                    # 主网部署、升级、迁移、校验、smoke 脚本
├─ test/                       # 合约测试
├─ CURRENT_HANDOFF.md          # 当前真实交接文档
├─ FRONTEND_REFACTOR_PLAN.md   # 前端重构主计划
├─ AGENT.md                    # 长期背景上下文
└─ CLAUDE.md                   # 长期背景上下文
```

## 当前产品模型

### 1. 身份层

`ClawNFA` 是世界里的身份载体。  
每只 NFA 不只是图片，而是：

- 一个链上身份
- 一个单独的记账账户
- 一套成长/玩法属性
- 一个可被策略和记忆影响的角色

### 2. 记账层

`ClawRouter` 负责：

- NFA 储备余额
- 日维护消耗
- 充值 / 提现
- 玩法消耗与奖励回账
- 共享金库式补付能力

### 3. 玩法层

当前主线玩法：

- `任务挖矿`
- `PK`
- `大逃杀`

前端默认表达规则已经固定：

- 默认页面只保留：动作、收益、条件、结果
- 少解释，少长文，少内部术语
- 交互优先于说明

### 4. 运行时与自治

`OpenClaw` 负责：

- 记忆与上下文
- planner / runner
- oracle request -> sync -> execute -> finalize
- Battle Royale reveal watcher
- directive 注入

这部分在私有仓里保留完整代码和运维脚本；公开仓不会包含敏感运行细节。

## 当前主网关键地址

主网前端 canonical 地址来源：

- [frontend/src/contracts/addresses.ts](./frontend/src/contracts/addresses.ts)

### 核心世界合约

| 合约 | 地址 |
| --- | --- |
| ClawNFA | `0xAa2094798B5892191124eae9D77E337544FFAE48` |
| ClawRouter | `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5` |
| WorldState | `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA` |
| GenesisVault | `0xCe04f834aC4581FD5562f6c58C276E60C624fF83` |
| Claworld | `0x3b486c191c74c9945fa944a3ddde24acdd63ffff` |
| TaskSkill | `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10` |
| PKSkill | `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF` |
| BattleRoyale | `0x2B2182326Fd659156B2B119034A72D1C2cC9758D` |

### 自治相关合约

| 合约 | 地址 |
| --- | --- |
| ClawAutonomyRegistry | `0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044` |
| ClawAutonomyDelegationRegistry | `0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa` |
| ClawOracleActionHub | `0xEdd04D821ab9E8eCD5723189A615333c3509f1D5` |
| ClawAutonomyFinalizationHub | `0x65F850536bE1B844c407418d8FbaE795045061bd` |
| TaskSkillAdapter | `0xe7a7E66F9F05eC14925B155C4261F32603857E8E` |
| PKSkillAdapter | `0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c` |
| BattleRoyaleAdapter | `0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc` |

## 快速开始

### 合约

```bash
npm install
npx hardhat compile
npx hardhat test
```

### 前端

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

### 前端生产构建

```bash
npm --prefix frontend run build
```

### 运行时自检

```bash
npm run runner:autonomy:check
npm run directive:check
npm run watch:battle-royale:check
```

## 当前工作约定

这些规则已经在当前产品里固定下来：

- 产品名：`Clawworld`
- 代币名：`Claworld`
- `/play` 是“任务挖矿”，不是泛动作页
- `/arena` 只表达两条玩法：
  - `PK`
  - `大逃杀`
- 中文页应当中文优先，只允许极少量英文装饰
- 默认界面不要写成长解释页
- 默认界面只保留：
  - 动作名
  - 奖励 / 收益
  - 条件 / 阻塞
  - 当前状态 / 结果

## 2D RPG 的当前定位

仓库里仍然保留了旧的 2D RPG / `/game` 路径与相关代码，主要为了：

- 历史实验保留
- 素材和交互参考
- 旧路由回退

但它**已经不是当前主产品主线**。  
当前主线是：

- 移动端 PWA shell
- 任务挖矿
- PK
- 大逃杀
- 代理 / 自治

如果你在做新功能，不要再把 2D RPG 当成默认入口来设计。

## Secrets 与托管环境

真实 secrets 不进 git。  
这个仓库里应该只保留：

- 代码
- 示例 env
- 公共地址
- 不含密钥的文档

本地或托管环境中才应该存在：

- 私钥
- runner env
- Vercel / KV token
- 运行时 API key
- 任何生产密钥或账户文件

## 私有仓与公开仓的边界

这个私有仓是主工作仓。  
公开仓只应保留：

- 合约 / 前端 / 运行时代码
- 非敏感产品文档
- 开发者可见的公开地址

不要把下面这些带进公开仓：

- 运维 runbook
- 本地路径
- 托管环境细节
- operator 账户操作细节
- 敏感部署步骤

## 一句话总结

现在的 Clawworld 不是一个“概念展示仓”，也不再是以 2D RPG 为中心的项目。  
它当前真实主线是：**NFA 身份 + 记账账户 + 任务挖矿 / PK / 大逃杀 + 移动端 PWA shell + 受边界自治运行时。**
