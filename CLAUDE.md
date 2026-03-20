# CLAW CIVILIZATION UNIVERSE — 项目状态与开发计划

> 本文档是 AI 助手的持久记忆文件。每次对话开始时应读取此文件，了解项目全貌和当前进度。
> 最后更新：2026-03-20

---

## 一、项目概述

龙虾文明宇宙（CCU）是一个基于 BNB Chain 的 AI NFT 游戏，核心架构：

- **BAP-578 NFA 标准**：BNB Chain 官方 Non-Fungible Agent 标准，单合约统一身份+钱包+执行+学习
- **OpenClaw 框架**：开源本地 AI 助手（GitHub 300K Star），龙虾以 Skill 插件形式运行
- **Flap 平台**：CLW 代币通过 Flap Bonding Curve 发行，毕业后上 PancakeSwap
- **无后端架构**：官网直接读链上数据，AI 在用户设备本地运行

### 核心玩法理解（重要）

**性格系统是玩家选择驱动的，不是随机的：**

- 玩家选择做冒险任务 → 勇气涨
- 玩家选择做解谜任务 → 智慧涨
- 玩家选择做交易任务 → 社交涨
- 玩家选择做创造类任务 → 创造涨
- 玩家坚持做任务不中断 → 韧性涨
- 每月上限 ±5，取决于玩家行为

**只有以下场景使用随机数：**

1. Mint 时初始 personality 5维 + DNA 4基因
2. 每升 10 级，随机选一个基因 +2
3. PK 打赢高 5 级对手时，10% 概率触发变异
4. 变异触发后随机选哪个基因

**任务匹配度机制**：龙虾 personality 向量 · 任务需求向量 = 0.05x~2.0x 奖励倍率。精心培养的龙虾收益是白板龙虾的 20 倍。

---

## 二、代码库结构

```
clawworld/
├── contracts/                    # Solidity 智能合约
│   ├── core/
│   │   ├── ClawNFA.sol          # ERC-721 NFA 代币（BAP-578）
│   │   └── ClawRouter.sol       # 核心路由：CLW余额、游戏状态、Skill分发
│   ├── skills/
│   │   ├── GenesisVault.sol     # 888创世Mint（commit-reveal）
│   │   ├── TaskSkill.sol        # 任务系统（operator提交结果）
│   │   ├── PKSkill.sol          # PvP一次性结算（commit-reveal策略）
│   │   └── MarketSkill.sol      # 市场：固定价/拍卖/互换
│   ├── world/
│   │   ├── WorldState.sol       # 世界状态引擎（链上数据→游戏参数）
│   │   └── ClawOracle.sol       # AI预言机（commit-reveal）
│   └── mocks/                   # 测试用Mock合约
├── frontend/                    # Next.js 官网前端（部署在 Vercel）
│   └── src/
│       ├── app/                 # 页面：首页/NFA合集/NFA详情/Mint/指南/世界观
│       ├── components/          # UI组件：PipBoy风格
│       ├── contracts/           # ABI + hooks（wagmi）
│       ├── content/             # 静态内容（指南/世界观文本）
│       └── lib/                 # 工具函数
├── scripts/                     # 部署脚本（Phase 1/2/3）
├── test/                        # 测试
│   └── Integration.test.ts      # 集成测试（10个场景）
├── 游戏说明.md                   # 玩家手册
├── CCU_Technical_Architecture_v4.0.md  # 技术架构文档
└── CLAUDE.md                    # 本文件
```

---

## 三、各模块当前状态

### A. 智能合约 — 基本完成，已修改未编译

| 合约 | 测试网部署 | 代码修改 | 编译 | 说明 |
|------|-----------|---------|------|------|
| ClawNFA.sol | ✅ | ✅ 已修改 | ❌ 未编译 | 加了事件+storage gap |
| ClawRouter.sol | ✅ | ✅ 已修改 | ❌ 未编译 | 加了CLW/XP cap、事件、nonReentrant、storage gap |
| GenesisVault.sol | ✅ | ✅ 已修改 | ❌ 未编译 | pull-over-push退款、storage gap |
| TaskSkill.sol | ✅ | ✅ 已修改 | ❌ 未编译 | storage gap |
| PKSkill.sol | ✅ | ✅ 已修改 | ❌ 未编译 | 改进随机数、storage gap |
| MarketSkill.sol | ✅ | ✅ 已修改 | ❌ 未编译 | CEI重写buyFixedPrice、pull-over-push、storage gap |
| WorldState.sol | ✅ | ✅ 已修改 | ❌ 未编译 | storage gap |
| ClawOracle.sol | ✅ | ✅ 已修改 | ❌ 未编译 | storage gap |

**已完成的合约修改清单：**

1. **MarketSkill CEI重写**：buyFixedPrice() 严格先改状态再外部调用，BNB转账失败不revert而是存入 pendingWithdrawals
2. **Pull-over-push模式**：MarketSkill (bid退款/settleAuction) + GenesisVault (reveal超额退款) 都改为 pendingWithdrawals + claimRefund()
3. **Storage Gap**：全部8个UUPS合约都加了 `uint256[40] private __gap`
4. **Skill回调上限**：ClawRouter 新增 maxCLWPerCall / maxXPPerCall，防止被攻击的Skill无限增发
5. **事件补全**：ClawNFA + ClawRouter 所有admin函数都emit事件（含old+new值）
6. **processUpkeep nonReentrant**：防重入
7. **随机数改进**：ClawRouter._levelUpGeneBoost() 加入 xp，PKSkill._checkMutation() 加入 winner/loser/gasleft
8. **部署脚本**：Phase 1/2/3 全部加了 .wait() 和 post-deployment 验证
9. **CI/CD**：新增 .github/workflows/test.yml
10. **集成测试**：新增 test/Integration.test.ts（10个场景）

### B. 官网前端 — 展示层基本完成，交互层缺失

| 页面/功能 | 状态 | 说明 |
|-----------|------|------|
| 首页 | ✅ 已实现 | HeroSection + WorldStateDashboard + CLWTokenInfo |
| NFA 合集 | ✅ 已实现 | LobsterGrid（已加分页）+ FilterBar + LobsterCard |
| NFA 详情 | ✅ 已实现 | PersonalityRadar(5维) + DNABarChart + MutationSlots + XPProgressBar |
| Mint 面板 | ✅ 已实现 | commit-reveal 流程，已加地址校验 |
| 充值面板 | ✅ 已实现 | BNB/CLW充值，已加输入校验 |
| 钱包连接 | ✅ 已实现 | wagmi + WalletConnect |
| 游戏指南 | ✅ 已实现 | 7章玩家手册 |
| 世界观 | ✅ 已实现 | 小说内容 |
| ErrorBoundary | ✅ 已实现 | 全局错误捕获 |
| IPFS安全 | ✅ 已实现 | URL校验防XSS |
| **Task 页面** | ❌ 未实现 | 需要：任务列表、接取、完成、奖励展示 |
| **PK 页面** | ❌ 未实现 | 需要：对手搜索、策略选择、commit-reveal流程、结果展示 |
| **Market 页面** | ❌ 未实现 | 需要：挂售/拍卖/互换、浏览、购买 |
| **事件历史** | ❌ 未实现 | 链上事件日志展示（性格进化、变异、PK战绩等） |
| **ABI 更新** | ❌ 未完成 | 合约修改后需重新编译并更新前端ABI |

**已完成的前端修改清单：**

1. MintPanel：owner mint 地址校验（isAddress from viem）
2. DepositPanel：数值输入 isNaN 校验
3. LobsterGrid：分页（PAGE_SIZE=50）
4. IPFS URL：正则校验，非法输入返回占位SVG
5. GenesisVault hook：salt 存储改用 sessionStorage 优先 + localStorage 备份
6. ErrorBoundary：新增全局错误边界组件
7. layout.tsx：包裹 ErrorBoundary

### C. OpenClaw Skill 插件 — 全部未实现

| Skill | 类型 | 状态 | 优先级 | 说明 |
|-------|------|------|--------|------|
| chain.skill | 纯客户端 | ❌ 未实现 | P2 | 钱包生成、PIN加密、签名、余额查询 |
| mint.skill | 客户端+合约 | ❌ 未实现 | P2 | Telegram内Mint交互 |
| task.skill | 客户端+合约 | ❌ 未实现 | P2 | AI任务生成+提交（核心循环） |
| pk.skill | 客户端+合约 | ❌ 未实现 | P2 | PK策略分析+战斗叙事生成 |
| market.skill | 客户端+合约 | ❌ 未实现 | P2 | 市场浏览+交易 |
| oracle.skill | 客户端+合约 | ❌ 未实现 | P2 | AI预言机监听+fulfillment |
| launch.skill | 纯客户端 | ❌ 未实现 | P3 | Flap平台代币操作 |
| equip.skill | 客户端+合约 | ❌ 未实现 | P4 | 装备系统 |

### D. AI 系统 — 未实现

| 组件 | 状态 | 说明 |
|------|------|------|
| 任务AI生成 | ❌ | 本地LLM读取personality+WorldState→生成个性化任务 |
| 任务完成评判 | ❌ | AI评判任务完成质量→决定奖励 |
| PK策略建议 | ❌ | 分析对手链上数据→建议攻/防/平衡 |
| 战斗叙事 | ❌ | PK结束后AI生成个性化叙事（不上链） |
| personality注入 | ❌ | 不同性格的龙虾说话方式/建议不同 |
| IPFS存证 | ❌ | AI推理过程上传IPFS可审计 |

### E. NFT Art Pipeline — 未实现

| 步骤 | 状态 | 说明 |
|------|------|------|
| Art Bible | ❌ | 属性→视觉Trait映射规则 |
| 图片生成 | ❌ | 888创世+后创世的龙虾图片 |
| IPFS上传 | ❌ | 批量上传图片和元数据 |
| tokenURI设置 | ❌ | 链上设置每只龙虾的vaultURI |

### F. 代币经济 — 未启动

| 步骤 | 状态 | 说明 |
|------|------|------|
| Flap创建CLW | ❌ | 在Flap平台创建代币 |
| Bonding Curve启动 | ❌ | 开始交易 |
| 毕业到PancakeSwap | ❌ | 16 BNB填满后自动创建LP |
| Tax Token配置 | ❌ | 前30天最高10%交易税→Vault |

---

## 四、开发计划（按优先级）

### Phase 0：基础修复（当前阶段）
> 状态：进行中

- [ ] **0.1** 本地编译合约（`npx hardhat compile`）— 验证所有修改无语法错误
- [ ] **0.2** 运行集成测试（`npx hardhat test`）— 验证 Integration.test.ts 通过
- [ ] **0.3** 更新前端 ABI — 从编译产物复制到 `frontend/src/contracts/abis/`
- [ ] **0.4** 测试网重新部署（UUPS upgrade 或 fresh deploy）
- [ ] **0.5** 前端连接新合约地址 — 更新 `frontend/src/contracts/addresses.ts`
- [ ] **0.6** Vercel 重新部署前端

### Phase 1：核心游戏循环前端
> 状态：未开始

- [ ] **1.1** Task 页面 — 任务列表、接取、完成提交、奖励展示
- [ ] **1.2** PK 页面 — 对手搜索、策略选择、commit-reveal流程、结果+叙事展示
- [ ] **1.3** Market 页面 — 挂售/拍卖/互换、浏览列表、购买/出价
- [ ] **1.4** 事件历史组件 — 读取链上事件展示龙虾成长记录
- [ ] **1.5** 对应的 wagmi hooks — useTaskSkill, usePKSkill, useMarketSkill

### Phase 2：OpenClaw Skill 插件 + AI 系统
> 状态：未开始

- [ ] **2.1** chain.skill — 钱包生成、PIN加密、签名基础层
- [ ] **2.2** oracle.skill — AI预言机客户端（监听事件→LLM→IPFS→回写）
- [ ] **2.3** task.skill 客户端 — AI任务生成prompt模板、完成评判、personality注入
- [ ] **2.4** pk.skill 客户端 — 对手分析、策略建议（不同性格不同建议）、战斗叙事生成
- [ ] **2.5** market.skill 客户端 — 市场浏览、价格建议
- [ ] **2.6** mint.skill 客户端 — Telegram内Mint流程
- [ ] **2.7** Telegram 渠道配置和测试

### Phase 3：代币经济
> 状态：未开始

- [ ] **3.1** 在 Flap 平台创建 CLW 代币
- [ ] **3.2** 配置 Tax Token（前30天10%）
- [ ] **3.3** Bonding Curve 阶段测试
- [ ] **3.4** 毕业后 PancakeSwap 集成验证
- [ ] **3.5** buyAndDeposit 端到端测试
- [ ] **3.6** launch.skill 开发

### Phase 4：NFT Art
> 状态：未开始

- [ ] **4.1** 制定 Art Bible（属性→视觉Trait映射规则）
- [ ] **4.2** 生成888创世龙虾图片（按rarity/shelter/personality/DNA决定视觉）
- [ ] **4.3** 批量上传 IPFS
- [ ] **4.4** 链上设置 vaultURI / vaultHash
- [ ] **4.5** 后创世Mint的动态图片生成方案

### Phase 5：安全加固
> 状态：未开始

- [ ] **5.1** Chainlink VRF 集成（仅Mint属性、升级基因选择、PK变异判定）
- [ ] **5.2** Timelock 治理（管理员操作延迟执行）
- [ ] **5.3** 专业审计准备（文档整理、已知问题列表）
- [ ] **5.4** equip.skill 装备系统开发

---

## 五、环境与部署信息

| 项目 | 值 |
|------|------|
| 链 | BNB Chain（BSC Testnet 测试中） |
| 前端部署 | Vercel |
| 前端框架 | Next.js + React + wagmi + viem |
| 合约框架 | Hardhat + OpenZeppelin UUPS + ethers.js |
| 代理模式 | UUPS Upgradeable Proxy |
| 钱包连接 | WalletConnect v2 |
| Node 版本 | 18 |
| 合约地址 | 见 `frontend/src/contracts/addresses.ts` |

### 已知环境限制

- Hardhat 编译器下载在某些网络环境下会被 403 拦截（需要直接网络或代理）
- Flap 平台仅 BSC 主网，测试网需用 Mock 合约模拟

---

## 六、关键设计决策记录

1. **性格进化是玩家选择驱动**，不是随机。这是游戏核心——"你养什么样的龙虾，它就变成什么样"
2. **VRF 仅用于**：Mint属性、升级基因+2、PK变异判定。性格系统不需要VRF
3. **游戏内CLW是积分制**（合约内部记账），链上CLW是Flap发行的真实代币，两者可互转
4. **Pull-over-push**：所有BNB退款都通过 pendingWithdrawals + claimRefund()，不直接 .call()
5. **无后端**：官网直接读链上数据，AI在用户本地运行
6. **Skill回调上限**：maxCLWPerCall / maxXPPerCall 防止compromised skill无限增发
7. **Storage Gap**：所有UUPS合约保留40个slot给未来升级

---

## 七、联系与参考

- 技术架构：`CCU_Technical_Architecture_v4.0.md`
- 玩家手册：`游戏说明.md`
- 合约地址：`frontend/src/contracts/addresses.ts`
- 前端ABI：`frontend/src/contracts/abis/`
- 部署脚本：`scripts/deploy-phase1.ts`, `deploy-phase2.ts`, `deploy-phase3.ts`
- 集成测试：`test/Integration.test.ts`
- CI/CD：`.github/workflows/test.yml`
