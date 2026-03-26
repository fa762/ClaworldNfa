# CLAW CIVILIZATION UNIVERSE — 项目状态与开发计划

> 本文档是 AI 助手的持久记忆文件。每次对话开始时应读取此文件，了解项目全貌和当前进度。
> 最后更新：2026-03-26（claw CLI 完整实现 + 前端修复 + IPFS 工具）

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

### 用户旅程（已验证！）

```
官网 Mint NFA → 官网 NFA 详情页"转移到 OpenClaw" → OpenClaw 对话框玩游戏
     ↑                                                        ↓
   展示层（看数据、充值）                            游戏层（/task /pk /market 对话命令）
                                                              ↓
                                                    龙虾通过 market.skill 可卖/换给其他玩家
```

**2026-03-24 实测**：已在 BSC Testnet 完成 Mint → 转移 → OpenClaw 对话 → 任务生成 → 任务选择 的完整流程。

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
│   │   ├── GenesisVault.sol     # 888创世Mint（commit-reveal + 增强熵源）
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
│       └── lib/                 # 工具函数 + i18n
├── openclaw/                    # OpenClaw Skill 适配层
│   ├── claw-world-skill/        # ⭐ 可安装的 OpenClaw Skill 包（游戏本体）
│   │   └── SKILL.md            # Skill 元数据 + 完整 ABI + 钱包流程 + 双网络配置
│   ├── skills/                  # Skill TypeScript 实现
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

### A. 智能合约 — ✅ 全部完成，测试网已部署

| 合约 | 测试网部署 | 编译 | 授权 | 说明 |
|------|-----------|------|------|------|
| ClawNFA.sol | ✅ `0x1c69...B135` | ✅ | — | ERC-721 NFA 代币 |
| ClawRouter.sol | ✅ `0xA7Ee...c34603` | ✅ | — | 核心路由（已瘦身，提取 Deposit+Personality） |
| DepositRouter.sol | ✅ `0xd61C...B448` | ✅ | ✅ authorized | DEX充值 |
| PersonalityEngine.sol | ✅ `0xab8F...dac0e` | ✅ | ✅ authorized | 性格演化 |
| GenesisVault.sol | ✅ `0x6d17...7867` | ✅ | ✅ authorized | 888创世Mint（增强熵源） |
| TaskSkill.sol | ✅ `0x4F8f...CE0E` | ✅ | ✅ authorized + **双operator** | 任务系统 |
| PKSkill.sol | ✅ `0x0e76...839A` | ✅ | ✅ authorized | PvP（增强熵源） |
| MarketSkill.sol | ✅ `0x254E...c46d` | ✅ | ✅ authorized | 市场交易 |
| WorldState.sol | ✅ `0x3479...4F7d` | ✅ | — | 世界状态（24h timelock） |
| ClawOracle.sol | ✅ 已部署 | ✅ | — | AI预言机 |
| MockCLW | ✅ `0xCdb1...41FC` | ✅ | — | 测试代币（已mint 100万） |

**TaskSkill Operator 授权：**
- 部署账户：`0x30DEf3cF07DE89DE1637B940B875686E26Cc342c` ✅
- 玩家 OpenClaw 钱包：`0x0e779680f36e3976a0eE2bFeC07FF17241b79e76` ✅（2026-03-24 新增）

**测试：223 passing, 0 failing**

### B. 官网前端 — ✅ 展示层完成 + 转移入口

| 页面/功能 | 状态 | 说明 |
|-----------|------|------|
| 首页 | ✅ | HeroSection + WorldStateDashboard + CLWTokenInfo |
| NFA 合集 | ✅ | LobsterGrid + FilterBar + 分页 |
| NFA 详情 | ✅ | 4 Tab：状态/SPECIAL/基因/维护，**图片常驻右侧所有 Tab** |
| NFA 详情-状态 | ✅ | 等级/稀有度/CLW余额/日消耗/可维持天数/职业 |
| NFA 详情-SPECIAL | ✅ | 5维性格（勇气/智慧/社交/创造/毅力），带 ▲▼ 指示器 |
| NFA 详情-基因 | ✅ | STR/DEF/SPD/VIT CSS bar（不用 Unicode）+ sublabel + 变异槽 |
| NFA 详情-维护 | ✅ | BNB/CLW充值 + **转移到 OpenClaw** 入口（含 i18n） |
| Mint 面板 | ✅ | commit-reveal 流程 |
| 钱包连接 | ✅ | wagmi + WalletConnect |
| 前端 ABI | ✅ | ClawNFA, ClawRouter, GenesisVault, WorldState, ERC20, TaskSkill, PKSkill, MarketSkill |
| i18n | ✅ | 中英文切换，所有页面已翻译 |
| CRT 特效 | ✅ | terminal-backdrop + barrel distortion + scanlines |
| Task/PK/Market 前端页面 | ❌ 不需要 | 游戏在 OpenClaw 里进行，前端仅做展示 |

**前端 Bug 已修复（2026-03-24）：**
- ✅ SPECIAL 和基因 Tab 内容不再重叠（SPECIAL 只显示性格，基因只显示 DNA）
- ✅ 基因页 TerminalBar 改用 CSS div（不用 Unicode，对齐完美）
- ✅ 图片常驻所有 Tab 右侧
- ✅ 职业显示 `job.NaN` 已修复
- ✅ 转移到 OpenClaw 入口 i18n 翻译补全
- ✅ layout.tsx CRT 特效恢复（合并冲突误覆盖已修复）

### C. OpenClaw Skill 插件 — ⭐ 游戏本体，测试网已跑通

| 模块 | 状态 | 说明 |
|------|------|------|
| SKILL.md | ✅ 完整 | 双网络配置 + 完整合约 ABI + 5步不卡住流程 + matchScore 公式 |
| 钱包创建 | ✅ 已测试 | AES-256-CBC + PIN 加密，存 `~/.openclaw/claw-world/wallet.json` |
| 钱包持久化 | ✅ | 新对话先检查 wallet.json 是否存在，不重复创建 |
| 网络选择 | ✅ | `~/.openclaw/claw-world/network.conf`，测试网/主网切换 |
| NFA 状态读取 | ✅ 已测试 | getLobsterState 字段映射精确（[0]-[15]），数据正确 |
| 任务生成 | ✅ 已测试 | AI 根据性格生成 3 个任务，匹配度正确计算 |
| 任务链上提交 | ✅ 已授权 | 玩家钱包已设为 TaskSkill operator，可直接签名提交 |
| PK commit-reveal | ✅ ABI 完整 | SKILL.md 里有完整函数签名 |
| 市场交易 | ✅ ABI 完整 | 挂售/拍卖/购买/取消 |
| NFA 转移 | ✅ ABI 完整 | safeTransferFrom |
| cast 工具 | ✅ | SKILL.md 有 cast 命令示例 |

**已知问题待修复：**
- 🟡 任务提交后的链上 tx 可能卡住（需要继续测试确认）
- 🟡 PK 和 Market 还未实际测试（ABI 已写好，等测试）
- 🟡 OpenClaw AI 偶尔会读错字段（已加精确映射，但需更多测试）

### D. AI 系统 — ✅ 通过 OpenClaw 原生 AI 驱动

| 组件 | 状态 | 说明 |
|------|------|------|
| 任务AI生成 | ✅ | OpenClaw AI 根据 SKILL.md 指令 + 链上性格数据生成任务 |
| matchScore计算 | ✅ | 向量点积公式写在 SKILL.md，AI 可计算 |
| PK策略建议 | ✅ | SKILL.md 有策略说明 |
| personality注入 | ✅ | SKILL.md 里有性格→说话方式的映射 |
| **AIProvider** | ✅ 不需要了！ | OpenClaw 自带 AI，不需要单独的 AIProvider 接口 |

**重要理解更新**：之前文档说"AIProvider 需要接入 LLM"是错的。OpenClaw 本身就是 AI 助手，SKILL.md 就是给 AI 的指令。龙虾的对话、任务生成、策略建议都由 OpenClaw 的 AI 根据 SKILL.md 自动完成。不需要额外接入 Claude/GPT API。

### E. NFT Art Pipeline — 🟡 Prompt 已生成，图片待生成

| 步骤 | 状态 | 说明 |
|------|------|------|
| Art Bible | ✅ | `claw_nft_artbible.md` 完整（28个角色+860居民规范） |
| Prompt 生成 | ✅ | `scripts/output/nft-prompts.json` + `.txt`（888个） |
| 图片生成 | ❌ **用户负责** | 用 Midjourney 批量生成 |
| IPFS上传 | ❌ | 图片生成后批量上传 |
| tokenURI设置 | ❌ | 链上设置 vaultURI / vaultHash |

### F. 代币经济 — 未启动（测试完成后启动）

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
- [x] GenesisVault 增强熵源（不用 VRF，体验优先）

### Phase 2：ClawRouter 重构 — ✅ 已完成
- [x] 提取 DepositRouter（DEX/Flap逻辑独立）
- [x] 提取 PersonalityEngine（性格演化逻辑独立）
- [x] ClawRouter 瘦身（保留 facade 向后兼容）

### Phase 3：OpenClaw Skill 插件 — ✅ 核心已完成并测试
- [x] chain.skill — 钱包生成、PIN加密
- [x] task.skill — AI任务生成+选择完成+链上结算
- [x] pk.skill — 策略分析+commit-reveal+叙事
- [x] market.skill — 市场交易
- [x] oracle.skill — AI预言机
- [x] ClawEngine 编排器
- [x] SKILL.md 可安装包（双网络+完整ABI+5步流程）
- [x] 前端"转移到 OpenClaw"入口
- [x] 玩家钱包设为 TaskSkill operator
- [x] OpenClaw 对话游戏链路跑通（2026-03-24 实测）

### Phase 3.5：测试网完整测试 — 🟡 进行中
- [x] Mint 流程（commit-reveal + tBNB）
- [x] NFA 状态查看（getLobsterState 数据正确）
- [x] 钱包创建 + 持久化
- [x] 任务生成（AI 生成 3 个任务 + matchScore）
- [ ] **3.5.1** 任务链上提交（completeTypedTask tx 成功执行）
- [ ] **3.5.2** PK 完整流程（create → join → commit → reveal → settle）
- [ ] **3.5.3** Market 完整流程（list → buy / auction → bid → settle）
- [ ] **3.5.4** 性格演化验证（完成多个任务后性格变化）
- [ ] **3.5.5** 多 NFA 测试（mint 第 2、3 只龙虾）
- [ ] **3.5.6** 世界状态影响测试（改 rewardMultiplier 后奖励变化）

### Phase 4：NFT Art — 🟡 进行中
- [x] Art Bible 完成
- [x] 888个 Midjourney prompt 生成
- [ ] **4.1** 用 Midjourney 批量生成图片（用户负责）
- [ ] **4.2** 批量上传 IPFS
- [ ] **4.3** 链上设置 vaultURI / vaultHash
- [ ] **4.4** 后创世Mint的动态图片方案

### Phase 5：代币经济 — 测试完成后启动
- [ ] Flap 创建 CLW 代币
- [ ] Bonding Curve 测试
- [ ] 毕业后 PancakeSwap 集成
- [ ] launch.skill 开发
- [ ] DepositRouter 更新真实 CLW 代币地址

### Phase 6：主网上线 — 准备中
- [ ] 主网部署所有合约
- [ ] SKILL.md 填入主网合约地址
- [ ] 前端切换到主网 RPC
- [ ] 发布 claw-world skill 到 ClawHub
- [ ] 专业安全审计

### Phase 7：后续优化
- [ ] 前端 Task/PK/Market 历史查看页面
- [ ] equip.skill 装备系统
- [ ] Chainlink VRF 集成（可选，替代当前增强熵源方案）

---

## 五、环境与部署信息

| 项目 | 值 |
|------|------|
| 链 | BNB Chain（BSC Testnet 测试中） |
| 前端部署 | Vercel（自动从 main 构建） |
| 前端框架 | Next.js 16 + React 19 + wagmi + viem |
| 合约框架 | Hardhat + OpenZeppelin UUPS + ethers.js |
| 代理模式 | UUPS Upgradeable Proxy |
| 钱包连接 | WalletConnect v2 |
| Node 版本 | 22 |
| 测试 | 223 passing, 0 failing |
| RPC 代理 | http://127.0.0.1:59527（本地纵云梯） |
| OpenClaw | v2026.3.13（WSL2 上运行） |
| Skill 位置 | `~/.openclaw/skills/claw-world/SKILL.md` |

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

### 部署/Operator 账户
- 部署账户地址：`0x30DEf3cF07DE89DE1637B940B875686E26Cc342c`
- 角色：owner + TaskSkill operator
- MockCLW 余额：1,000,000 CLW

### 测试玩家账户
- OpenClaw 钱包：`0x0e779680f36e3976a0eE2bFeC07FF17241b79e76`
- 角色：TaskSkill operator（2026-03-24 授权）
- 拥有 NFA #1（Common, Shelter-06）
- NFA #1 数据：courage=25, wisdom=40, **social=72**, create=33, grit=42, STR=20, DEF=46, SPD=27, VIT=21

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
10. **Operator模式**：测试网玩家钱包直接设为 operator；主网方案待定（可能加 Relay）
11. **AIProvider 不需要了**：OpenClaw 自带 AI，SKILL.md 就是 AI 的指令。不需要单独接 LLM API
12. **双网络设计**：SKILL.md 同时包含测试网和主网地址，通过 network.conf 切换，主网上线只需填地址
13. **Skill 包 = 游戏本体**：SKILL.md 是纯文本指令文件，告诉 OpenClaw AI 怎么玩这个游戏、怎么调合约

---

## 七、2026-03-24 工作日志（今日重大进展）

### 完成事项
1. ✅ 合约事件索引优化（indexed 关键字）
2. ✅ 前端 SPECIAL/基因 Tab 分离（不再重叠）
3. ✅ 前端基因页 TerminalBar 改用 CSS bar（完美对齐）
4. ✅ 前端图片常驻所有 Tab 右侧
5. ✅ 前端职业 `job.NaN` bug 修复
6. ✅ 前端转移到 OpenClaw i18n 补全
7. ✅ layout.tsx CRT 特效恢复
8. ✅ SKILL.md 完整重写：双网络 + 完整 ABI + 5步流程 + matchScore 公式
9. ✅ OpenClaw Skill 安装成功（`openclaw skills list` 显示 `✓ ready`）
10. ✅ 玩家 OpenClaw 钱包设为 TaskSkill operator
11. ✅ 链上数据字段映射修复（personality/DNA/level 不再错位）
12. ✅ 钱包持久化检查（新对话不重复创建钱包）
13. ✅ **完整游戏链路跑通**：Mint → 查看状态 → 生成任务 → 选择任务

### 2026-03-26 工作日志

1. ✅ TaskSkill 新增 `ownerCompleteTypedTask`（NFA owner 直接提交，无需 operator）
2. ✅ TaskSkill 测试网升级 + `setNFA` 调用
3. ✅ `claw` 统一 CLI 工具（status/task/pk/market/transfer/world 全部命令）
4. ✅ SKILL.md 从头重写（禁止 cast，强制用 claw CLI）
5. ✅ `claw-task.js` 自动调 processUpkeep
6. ✅ PK 完整 commit-reveal 流程实现（自动 salt 保存/读取）
7. ✅ Market 完整交易流程实现（自动 NFA approve）
8. ✅ 前端 processUpkeep 结算按钮
9. ✅ 前端首页 ASCII Logo 响应式修复
10. ✅ IPFS 批量上传脚本 `scripts/upload-ipfs.ts`（支持断点续传）
11. ✅ tokenURI 批量设置脚本 `scripts/set-token-uris.ts`
12. ✅ 229 passing, 0 failing

### 待完成
1. 🟡 NFT 图片（用户用 Midjourney 生成）
2. 🟡 图片上传 IPFS（脚本已就绪，等图片）
3. 🟡 tokenURI 链上设置（脚本已就绪，等 IPFS CID）
4. 🟡 CLW 代币 Flap 发行
5. 🟡 主网部署

---

## 八、联系与参考

- 技术架构：`CCU_Technical_Architecture_v4.0.md`
- 玩家手册：`游戏说明.md`
- NFT美术档案：`claw_nft_artbible.md`
- 合约地址：`frontend/src/contracts/addresses.ts`
- 前端ABI：`frontend/src/contracts/abis/`
- **OpenClaw Skill包**：`openclaw/claw-world-skill/SKILL.md`（⭐ 游戏本体）
- NFT Prompt：`scripts/output/nft-prompts.json`
- 部署脚本：`scripts/deploy-phase1.ts`, `deploy-phase2.ts`, `deploy-phase3.ts`, `upgrade-phase4.ts`
- 集成测试：`test/Integration.test.ts`
- CI/CD：`.github/workflows/test.yml`
- 变更日志：`CHANGELOG.md`
- 运维手册：`OPERATIONS.md`
