# CLAW CIVILIZATION UNIVERSE — 项目状态与开发计划

> 本文档是 AI 助手的持久记忆文件。每次对话开始时应读取此文件，了解项目全貌和当前进度。
> 最后更新：2026-03-24

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

**任务流程是"选择完成"模式**：AI 生成 3 个不同类型任务 → 玩家选一个 → matchScore 由性格向量数学确定 → 链上结算。不需要 AI 评判完成质量。

**任务匹配度机制**：龙虾 personality 向量 · 任务需求向量 = 0.05x~2.0x 奖励倍率。精心培养的龙虾收益是白板龙虾的 20 倍。

### 用户旅程

```
官网 Mint NFA → 官网 NFA 详情页"转移到 OpenClaw" → OpenClaw 对话框玩游戏
     ↑                                                        ↓
   展示层（看数据、充值）                            游戏层（/task /pk /market 对话命令）
                                                              ↓
                                                    龙虾通过 market.skill 可卖/换给其他玩家
```

---

## 二、代码库结构

```
clawworld/
├── contracts/                    # Solidity 智能合约
│   ├── core/
│   │   ├── ClawNFA.sol          # ERC-721 NFA 代币（BAP-578）
│   │   ├── ClawRouter.sol       # 核心路由：CLW余额、游戏状态、Skill分发
│   │   ├── DepositRouter.sol    # DEX/Flap 充值路由（从 Router 拆出）
│   │   └── PersonalityEngine.sol # 性格演化引擎（从 Router 拆出）
│   ├── skills/
│   │   ├── GenesisVault.sol     # 888创世Mint（commit-reveal）
│   │   ├── TaskSkill.sol        # 任务系统（operator提交结果）
│   │   ├── PKSkill.sol          # PvP一次性结算（commit-reveal策略+增强熵源）
│   │   └── MarketSkill.sol      # 市场：固定价/拍卖/互换
│   ├── world/
│   │   ├── WorldState.sol       # 世界状态引擎（24h timelock）
│   │   └── ClawOracle.sol       # AI预言机（commit-reveal）
│   └── mocks/                   # 测试用Mock合约
├── frontend/                    # Next.js 官网前端（部署在 Vercel）
│   └── src/
│       ├── app/                 # 页面：首页/NFA合集/NFA详情/Mint/指南/世界观
│       ├── components/          # UI组件：PipBoy风格 + TransferToOpenClaw
│       ├── contracts/           # ABI（全部已生成）+ hooks（wagmi）
│       ├── content/             # 静态内容（指南/世界观文本）
│       └── lib/                 # 工具函数
├── openclaw/                    # OpenClaw Skill 适配层
│   ├── claw-world-skill/        # 可安装的 OpenClaw Skill 包
│   │   └── SKILL.md            # Skill 元数据 + 命令文档 + 配置说明
│   ├── skills/                  # Skill 实现
│   │   ├── chainSkill.ts       # 钱包生成、PIN加密、余额查询
│   │   ├── taskSkill.ts        # AI任务生成 + 选择完成 + matchScore
│   │   ├── pkSkill.ts          # 策略分析 + commit-reveal + 战斗叙事
│   │   ├── marketSkill.ts      # 市场浏览 + 交易操作
│   │   └── oracleSkill.ts      # AI预言机事件监听 + IPFS
│   ├── engine.ts               # ClawEngine 编排器（统一入口）
│   ├── commandRouter.ts        # 命令解析（/task /pk /market /wallet 等）
│   ├── contracts.ts            # 合约交互层（ethers.js 封装）
│   ├── dialogue.ts             # AI 对话 + 5个 prompt 构建器
│   ├── formatter.ts            # 三端输出格式（plain/telegram/rich）
│   ├── types.ts                # 共享类型定义
│   └── index.ts                # 统一导出
├── scripts/                     # 部署 + 工具脚本
│   ├── output/
│   │   ├── nft-prompts.json    # 888个 Midjourney prompt（JSON）
│   │   └── nft-prompts.txt     # 888个 prompt（纯文本）
│   └── generate-nft-prompts.ts  # prompt 生成脚本
├── test/                        # 测试（223 passing, 0 failing）
├── claw_nft_artbible.md         # NFT 美术档案
├── 游戏说明.md                   # 玩家手册
├── CCU_Technical_Architecture_v4.0.md  # 技术架构文档
└── CLAUDE.md                    # 本文件
```

---

## 三、各模块当前状态

### A. 智能合约 — ✅ 已完成，已编译已部署

| 合约 | 测试网部署 | 编译 | 授权 | 说明 |
|------|-----------|------|------|------|
| ClawNFA.sol | ✅ `0x1c69...B135` | ✅ | — | ERC-721 NFA 代币 |
| ClawRouter.sol | ✅ `0xA7Ee...c34603` | ✅ | — | 核心路由 |
| DepositRouter.sol | ✅ `0xd61C...B448` | ✅ | ✅ authorized | DEX充值 |
| PersonalityEngine.sol | ✅ `0xab8F...dac0e` | ✅ | ✅ authorized | 性格演化 |
| GenesisVault.sol | ✅ `0x6d17...7867` | ✅ | ✅ authorized | 888创世Mint |
| TaskSkill.sol | ✅ `0x4F8f...CE0E` | ✅ | ✅ authorized + operator | 任务系统 |
| PKSkill.sol | ✅ `0x0e76...839A` | ✅ | ✅ authorized | PvP（增强熵源） |
| MarketSkill.sol | ✅ `0x254E...c46d` | ✅ | ✅ authorized | 市场交易 |
| WorldState.sol | ✅ `0x3479...4F7d` | ✅ | — | 世界状态（24h timelock） |
| ClawOracle.sol | ✅ 已部署 | ✅ | — | AI预言机 |
| MockCLW | ✅ `0xCdb1...41FC` | ✅ | — | 测试代币（已mint 100万） |

**测试：223 passing, 0 failing, 2 pending（CLW/XP cap 未在合约实现，测试已 skip）**

### B. 官网前端 — ✅ 展示层完成 + 转移入口

| 页面/功能 | 状态 | 说明 |
|-----------|------|------|
| 首页 | ✅ | HeroSection + WorldStateDashboard + CLWTokenInfo |
| NFA 合集 | ✅ | LobsterGrid + FilterBar + 分页 |
| NFA 详情 | ✅ | 4 Tab：状态/SPECIAL/基因/维护，图片常驻右侧 |
| NFA 详情-SPECIAL | ✅ | 5维性格 + ▲▼指示器（≥70/≤25） |
| NFA 详情-基因 | ✅ | STR/DEF/SPD/VIT bar + sublabel + 变异槽 |
| NFA 详情-维护 | ✅ | BNB/CLW充值 + **转移到 OpenClaw** 入口 |
| Mint 面板 | ✅ | commit-reveal 流程 |
| 钱包连接 | ✅ | wagmi + WalletConnect |
| 前端 ABI | ✅ | ClawNFA, ClawRouter, GenesisVault, WorldState, ERC20, **TaskSkill, PKSkill, MarketSkill** |
| Task/PK/Market 页面 | ❌ 未实现 | 游戏在 OpenClaw 里进行，前端仅做历史查看（低优先级） |

### C. OpenClaw Skill 插件 — ✅ 核心已实现

| Skill | 状态 | 说明 |
|-------|------|------|
| chain.skill | ✅ 已实现 | 钱包生成、PIN加密（AES-256-CBC）、余额查询、NFA检测 |
| task.skill | ✅ 已实现 | AI生成3任务 → 选择完成 → matchScore链上结算 |
| pk.skill | ✅ 已实现 | 对手分析 → 性格驱动策略建议 → commit-reveal → 战斗叙事 |
| market.skill | ✅ 已实现 | 挂售/拍卖/互换/购买，事件扫描缓存 |
| oracle.skill | ✅ 已实现 | 事件监听 → AI推理 → IPFS上传 → fulfillReasoning |
| ClawEngine | ✅ 已实现 | 统一编排器，/wallet /status /task /pk /market /help 全路由 |
| SKILL.md | ✅ 已完成 | 可安装 Skill 包，含命令文档+配置+gas说明 |
| mint.skill | ❌ 未实现 | Telegram内Mint交互（低优先级，官网可Mint） |
| launch.skill | ❌ 未实现 | Flap平台代币操作（等代币上线） |
| equip.skill | ❌ 未实现 | 装备系统（P4） |

### D. AI 系统 — ✅ Prompt 框架完成

| 组件 | 状态 | 说明 |
|------|------|------|
| 任务AI生成 | ✅ | `buildTaskGenerationPrompt()` 根据性格+WorldState生成3任务 |
| matchScore计算 | ✅ | 向量点积公式，0-20000 basis points |
| PK策略建议 | ✅ | `buildStrategyAdvicePrompt()` 性格驱动策略 |
| 战斗叙事 | ✅ | `buildBattleNarrativePrompt()` AI生成戏剧叙事 |
| personality注入 | ✅ | `buildLobsterSystemPrompt()` 不同性格不同说话方式 |
| 市场定价建议 | ✅ | `buildPriceAdvicePrompt()` 基于稀有度/属性建议 |
| 预言机推理 | ✅ | `buildOracleReasoningPrompt()` 链上决策 |
| **AIProvider 具体实现** | ❌ | 需要接入实际 LLM（Claude/GPT/本地模型），目前是接口 |

### E. NFT Art Pipeline — 🟡 Prompt 已生成，图片待生成

| 步骤 | 状态 | 说明 |
|------|------|------|
| Art Bible | ✅ | `claw_nft_artbible.md` 完整（28个角色+860居民规范） |
| Prompt 生成 | ✅ | `scripts/output/nft-prompts.json` + `.txt`（888个） |
| 图片生成 | ❌ 待手动 | 用 Midjourney 批量生成（用户负责） |
| IPFS上传 | ❌ | 图片生成后批量上传 |
| tokenURI设置 | ❌ | 链上设置 vaultURI / vaultHash |

### F. 代币经济 — 未启动

| 步骤 | 状态 | 说明 |
|------|------|------|
| Flap创建CLW | ❌ | 在Flap平台创建代币 |
| Bonding Curve启动 | ❌ | 开始交易 |
| 毕业到PancakeSwap | ❌ | 16 BNB填满后自动创建LP |
| Tax Token配置 | ❌ | 前30天最高10%交易税→Vault |

---

## 四、开发计划（按优先级）

### Phase 0：基础修复 — ✅ 已完成
- [x] 本地编译合约
- [x] 运行测试（223 passing）
- [x] 更新前端 ABI（全部已生成）
- [x] 测试网部署（全部9个合约 + 2个新合约）
- [x] 前端连接新合约地址
- [x] Skill 授权配置

### Phase 1：合约安全加固 — ✅ 已完成
- [x] PKSkill 熵源增强（saltA/saltB + entropyNonce + gasleft）
- [x] PKSkill cancelJoinedMatch Bug 修复
- [x] ClawRouter 熵源增强
- [x] WorldState 24h Timelock（proposeWorldState → executeWorldState）

### Phase 2：ClawRouter 重构 — ✅ 已完成
- [x] 提取 DepositRouter（DEX/Flap逻辑独立）
- [x] 提取 PersonalityEngine（性格演化逻辑独立）
- [x] ClawRouter 瘦身（保留 facade 向后兼容）

### Phase 3：OpenClaw Skill 插件 — ✅ 核心已完成
- [x] chain.skill — 钱包生成、PIN加密
- [x] task.skill — AI任务生成+选择完成+链上结算
- [x] pk.skill — 策略分析+commit-reveal+叙事
- [x] market.skill — 市场交易
- [x] oracle.skill — AI预言机
- [x] ClawEngine 编排器
- [x] SKILL.md 可安装包
- [x] 前端"转移到 OpenClaw"入口

### Phase 4：NFT Art — 🟡 进行中
- [x] Art Bible 完成
- [x] 888个 Midjourney prompt 生成
- [ ] **4.1** 用 Midjourney 批量生成图片（用户负责）
- [ ] **4.2** 批量上传 IPFS
- [ ] **4.3** 链上设置 vaultURI / vaultHash
- [ ] **4.4** 后创世Mint的动态图片方案

### Phase 5：代币经济 — 未开始
- [ ] Flap 创建 CLW 代币
- [ ] Bonding Curve 测试
- [ ] 毕业后 PancakeSwap 集成
- [ ] launch.skill 开发

### Phase 6：后续优化 — 未开始
- [ ] 前端 Task/PK/Market 历史查看页面
- [ ] AIProvider 具体实现（接入 Claude API 或本地 LLM）
- [ ] equip.skill 装备系统
- [ ] 专业安全审计
- [ ] Chainlink VRF 集成（替代当前增强熵源方案）

---

## 五、环境与部署信息

| 项目 | 值 |
|------|------|
| 链 | BNB Chain（BSC Testnet 测试中） |
| 前端部署 | Vercel |
| 前端框架 | Next.js 16 + React 19 + wagmi + viem |
| 合约框架 | Hardhat + OpenZeppelin UUPS + ethers.js |
| 代理模式 | UUPS Upgradeable Proxy |
| 钱包连接 | WalletConnect v2 |
| Node 版本 | 22 |
| 测试 | 223 passing, 0 failing |
| RPC 代理 | http://127.0.0.1:59527（本地纵云梯） |

### 测试网合约地址

| 合约 | 地址 |
|------|------|
| ClawNFA | `0x1c69be3401a78CFeDC2B2543E62877874f10B135` |
| ClawRouter | `0xA7Ee12C5E9435686978F4b87996B4Eb461c34603` |
| GenesisVault | `0x6d176022759339da787fD3E2f1314019C3fb7867` |
| WorldState | `0x3479E9d103Ea28c9b3f94a73d3cf7bC9187e4F7d` |
| TaskSkill | `0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E` |
| PKSkill | `0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A` |
| MarketSkill | `0x254EF8451dFF592a295A08a75f05Af612C39c46d` |
| DepositRouter | `0xd61Cc50b2d15cC58b24c0f7B6cC83bbc0b0fB448` |
| PersonalityEngine | `0xab8F67949bf607181ca89E6aAaF401cFeA4dac0e` |
| MockCLW | `0xCdb158C1A1F0e8B85d785172f2109bC53e2F41FC` |
| FlapPortal (Mock) | `0x9F07D34F55146FE59495A9C5694e223b531Ff7C5` |
| PancakeRouter (Mock) | `0x4766aDF17656c7A6046804fd06e930C17Ee32992` |

### 部署账户
- 地址：`0x30DEf3cF07DE89DE1637B940B875686E26Cc342c`
- 角色：owner + TaskSkill operator
- MockCLW 余额：1,000,000 CLW

---

## 六、关键设计决策记录

1. **性格进化是玩家选择驱动**，不是随机。这是游戏核心——"你养什么样的龙虾，它就变成什么样"
2. **任务系统是"选择完成"模式**：AI生成3任务，玩家选一个即完成。matchScore由数学公式确定，不需要AI评判质量
3. **NFA 转移流程**：官网Mint → 官网"转移到OpenClaw" → OpenClaw对话框玩游戏。chain.skill 自动生成本地钱包
4. **VRF 不使用**（体验差+游戏本身有成本），改用增强熵源（salt混合+nonce+gasleft）
5. **WorldState 24h Timelock**：proposeWorldState → 等24h → executeWorldState
6. **游戏内CLW是积分制**（合约内部记账），链上CLW是Flap发行的真实代币，两者可互转
7. **Pull-over-push**：所有BNB退款都通过 pendingWithdrawals + claimRefund()
8. **无后端**：官网直接读链上数据，AI在用户本地运行
9. **Storage Gap**：所有UUPS合约保留40个slot给未来升级
10. **Operator模式**：测试网用本地私钥直接签名，主网方案待定（可能加 Relay）

---

## 七、联系与参考

- 技术架构：`CCU_Technical_Architecture_v4.0.md`
- 玩家手册：`游戏说明.md`
- NFT美术档案：`claw_nft_artbible.md`
- 合约地址：`frontend/src/contracts/addresses.ts`
- 前端ABI：`frontend/src/contracts/abis/`
- OpenClaw Skill包：`openclaw/claw-world-skill/SKILL.md`
- NFT Prompt：`scripts/output/nft-prompts.json`
- 部署脚本：`scripts/deploy-phase1.ts`, `deploy-phase2.ts`, `deploy-phase3.ts`, `upgrade-phase4.ts`
- 集成测试：`test/Integration.test.ts`
- CI/CD：`.github/workflows/test.yml`
- 变更日志：`CHANGELOG.md`
- 运维手册：`OPERATIONS.md`
