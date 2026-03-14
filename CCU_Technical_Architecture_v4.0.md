# CLAW CIVILIZATION UNIVERSE
# 龙虾文明宇宙

## Technical Architecture
### Based on BAP-578 NFA Standard + OpenClaw Framework

**Version 4.0 | 2026-03 | BSC Mainnet | Draft**

> **v4.0 变更摘要**：
> - 发币方案从自部署 CLW.sol + FairLaunch.sol **改为 Flap 蝴蝶平台发行**
> - 新增**龙虾 AI 预言机**系统（本地 LLM + 链上全局规则混合架构）
> - 完善 NFA 属性体系：**Personality 5 维性格 + DNA 4 战斗基因 + 变异槽 + SHELTER 加权分配**
> - PK 机制改为**一次性结算模型**
> - 新增**世界状态引擎**（链上数据驱动游戏事件）
> - 新增**属性→NFT 视觉映射**规则

---

# PART I: FOUNDATIONS

## 1. BAP-578 是什么

BAP-578 是 BNB Chain 官方 BEP 体系下的第一个 BAP（BNB Application Proposal），由 ChatAndBuild 团队提出，收录在 bnb-chain/BEPs 官方仓库。状态 Draft，已部署 BSC 主网，生态内 58+ 项目。

BAP-578 定义了 NFA（Non-Fungible Agent）代币标准。在 ERC-721 基础上扩展，让链上实体能持有资产、执行逻辑、学习进化。双路径架构：JSON Light Memory（简单代理）和 Merkle Tree Learning（可进化代理）。

### 1.1 核心接口 IBAP578

```solidity
interface IBAP578 {
  enum Status { Active, Paused, Terminated }
  struct State { uint256 balance; Status status; address owner;
                 address logicAddress; uint256 lastActionTimestamp; }
  struct AgentMetadata { string persona; string experience;
    string voiceHash; string animationURI; string vaultURI; bytes32 vaultHash; }
  function executeAction(uint256 tokenId, bytes calldata data) external;
  function setLogicAddress(uint256 tokenId, address newLogic) external;
  function fundAgent(uint256 tokenId) external payable;
  function withdrawFromAgent(uint256 tokenId, uint256 amount) external;
  function setAgentStatus(uint256 tokenId, Status status) external;
  function updateAgentMetadata(uint256 tokenId, AgentMetadata calldata) external;
}
```

### 1.2 Merkle Tree Learning（龙虾使用此路径）

```solidity
struct EnhancedAgentMetadata {
  // 继承 AgentMetadata 全部字段...
  bool learningEnabled; address learningModule;
  bytes32 learningTreeRoot; uint256 learningVersion; uint256 lastLearningUpdate;
}
```

龙虾的性格进化、PK 经验、DNA 变异都通过 learningModule 处理，更新 learningTreeRoot。任何人可通过 Merkle proof 验证历史记录。

### 1.3 与传统方案对比

| 维度 | ERC-721 + ERC-6551 | BAP-578 NFA |
| --- | --- | --- |
| 架构 | 两个合约需同步 | 单合约统一身份+钱包+执行 |
| 钱包 | 外部 TBA，通过 Registry 间接访问 | 内置 balance，原生 fundAgent()/withdraw() |
| 执行逻辑 | 需自己实现 | 标准 executeAction() + logicAddress 路由 |
| 学习/进化 | 无标准支持 | Merkle Tree Learning 原生支持 |
| 生态 | BSC 58+ 项目直接兼容 | Gas 最高省 90%（Messari 报告） |

---

## 2. OpenClaw 框架

OpenClaw 是一个开源的个人 AI 助手框架，运行在用户自己的设备上。GitHub 300K Star，18,000+ 次提交，200+ 贡献者。支持 22 个通信渠道（Telegram、WhatsApp、Discord、Slack 等）。

龙虾文明不是从零写客户端。它以 OpenClaw Skill 插件形式运行在 OpenClaw 框架之上。

### 2.1 OpenClaw 提供了什么

| 功能 | 说明 |
| --- | --- |
| 本地 Gateway | 用户设备上运行的控制平面，WebSocket 协议，无云服务器 |
| 多渠道通信 | Telegram/WhatsApp/Discord/Slack/Signal 等 22 个渠道开箱即用 |
| AI 代理引擎 | 支持 Claude、GPT、Gemini 等多模型，内置 NLP 解析 |
| Skills 插件体系 | ~/.openclaw/workspace/skills/<skill>/SKILL.md，模块化加载 |
| 安全模型 | DM 配对、白名单、Docker 沙箱、提权控制 |
| 跨平台 | macOS/Linux/Windows(WSL2)/iOS/Android，Node ≥22 |

### 2.2 龙虾文明的 Skill 插件

玩家安装 OpenClaw，然后加载龙虾文明的 Skill 包。每个 Skill 是一个目录，包含 SKILL.md（描述和配置）+ 实现代码。

| Skill | 类型 | 状态 | 职责 |
| --- | --- | --- | --- |
| chain.skill | OpenClaw Skill | V1 | 钱包生成、PIN 加密、签名、余额查询、多 NFA 管理 |
| mint.skill | OpenClaw Skill + 链上合约 | V1 | Genesis/后创世 Mint |
| task.skill | OpenClaw Skill + 链上合约 | V2 | 日常任务、XP、匹配度、**AI 动态生成** |
| pk.skill | OpenClaw Skill + 链上合约 | V2 | PvP、质押、DNA 变异、**一次性结算** |
| market.skill | OpenClaw Skill + 链上合约 | V1 | 去中心化市场 |
| equip.skill | OpenClaw Skill + 链上合约 | 预留 | 装备系统 |
| launch.skill | OpenClaw Skill | V2 | **Flap 平台代币发行**（替代 FairLaunch） |
| oracle.skill | OpenClaw Skill + 链上合约 | **V1 新增** | **龙虾 AI 预言机** |

OpenClaw Skill = 客户端逻辑（自然语言解析、交易构造、签名）。链上合约 = BSC 上部署的 Solidity 合约。大多数 Skill 两部分都有：客户端负责解析和签名，合约负责执行和存储。

### 2.3 用户完整流程

1. 玩家在自己的设备上安装 OpenClaw：`npm install -g openclaw@latest`
2. 运行向导：`openclaw onboard --install-daemon`
3. 配置 Telegram 渠道（或 WhatsApp/Discord 等任意渠道）
4. 加载龙虾文明 Skill 包（复制到 `~/.openclaw/workspace/skills/` 目录）
5. chain.skill 自动生成 BSC 钱包，显示地址，玩家往里转 BNB
6. 开始对话：Mint 龙虾 / 做任务 / PK / 交易

全程无中心化服务器。OpenClaw Gateway 跑在玩家自己的机器上。私钥在本地生成、本地加密、本地签名。Telegram 只是消息通道。

---

# PART II: ON-CHAIN ARCHITECTURE

## 3. 系统架构总览

| 层级 | 组件 | 职责 |
| --- | --- | --- |
| 客户端 | OpenClaw + Claw Skills | 本地运行：钱包、签名、NLP、多渠道通信、**龙虾 AI 预言机** |
| 底层合约 | BAP578.sol | 继承参考实现：NFA 身份、BNB 钱包、executeAction、元数据 |
| 中间层合约 | ClawRouter.sol | Skill 分发、CLW 余额、游戏状态、日消耗、buyAndDeposit |
| 上层合约 | TaskSkill/PKSkill/MarketSkill/EquipSkill | 具体游戏逻辑 |
| 代币 | **CLW（通过 Flap 平台发行）** | Flap Bonding Curve 发行，毕业后上 PancakeSwap |
| 预言机合约 | **ClawOracle.sol（自建）** | commit-and-reveal AI 预言机，链上记录+IPFS 存证 |
| 世界状态合约 | **WorldState.sol（新增）** | 链上全局规则引擎，可升级 |
| 创世合约 | GenesisVault.sol | 888 只创世龙虾稀有度+属性+SHELTER 分配 |

每只龙虾的 logicAddress 统一指向 ClawRouter。Router 根据 calldata 前 4 字节（function selector）分发到对应 Skill 合约。

---

## 4. ClawRouter.sol

### 4.1 游戏状态存储

```solidity
struct LobsterState {
    // ═══ 固定属性（Mint 时确定，不可变）═══
    uint8 rarity;           // 稀有度 0=Common, 1=Rare, 2=Epic, 3=Legendary, 4=Mythic
    uint8 shelter;          // SHELTER 归属 0-7（按世界观比例加权随机）

    // ═══ 性格属性（Personality，可缓慢进化）═══
    uint8 courage;          // 勇气 0-100 → 高风险任务加成，PK 策略激进
    uint8 wisdom;           // 智慧 0-100 → 技术/解谜任务加成
    uint8 social;           // 社交 0-100 → 交易/谈判任务加成
    uint8 create;           // 创造 0-100 → 独特策略，变异概率提升
    uint8 grit;             // 韧性 0-100 → 日消耗降低，持久战加成

    // ═══ 战斗基因（DNA，升级成长 + PK 变异）═══
    uint8 str;              // 力量 0-100 → 攻击伤害
    uint8 def;              // 防御 0-100 → 减伤比例
    uint8 spd;              // 速度 0-100 → 闪避率 + 先手伤害加成
    uint8 vit;              // 生命 0-100 → 血量上限
    bytes32 mutation1;      // 变异槽1（特殊能力，PK触发解锁）
    bytes32 mutation2;      // 变异槽2（更高条件触发）

    // ═══ 动态状态 ═══
    uint16 level;           // 等级
    uint32 xp;              // 经验值
    uint64 lastUpkeepTime;  // 上次维护时间
}

mapping(uint256 => LobsterState) public lobsters;
mapping(uint256 => uint256) public clwBalances;  // 游戏内 CLW 积分（内部记账）
```

#### Personality 性格系统

5 个维度，Mint 时随机初始化。通过 learningTree 缓慢进化——做对应类型任务 +1，每月上限 ±5。

| 维度 | 高分效果 | 低分效果 |
| --- | --- | --- |
| 勇气 Courage | 敢接高风险任务，PK 策略激进 | 保守稳健，偏防御 |
| 智慧 Wisdom | 技术/解谜任务加成高 | 直觉型，体力任务更强 |
| 社交 Social | 交易/谈判任务加成高 | 独行侠，单人任务更强 |
| 创造 Create | 生成独特策略，变异概率高 | 执行力强，稳定输出 |
| 韧性 Grit | 日消耗低（省CLW），持久战强 | 爆发力强但消耗快 |

#### DNA 战斗基因

4 个基因决定 PK 战斗力。Mint 时随机初始化，总和范围按稀有度限定。

| 稀有度 | 4基因总和范围 | 变异槽上限 |
| --- | --- | --- |
| Mythic | 320-400 | 3 |
| Legendary | 260-320 | 3 |
| Epic | 200-260 | 2 |
| Rare | 140-200 | 2 |
| Common | 80-140 | 1 |

- **升级成长**：每升 10 级，随机一个基因 +2
- **变异触发**：PK 打赢比自己高 5+ 级的对手（10% 概率）→ 解锁变异槽

#### 职业系统（动态推导，不存链上）

不单独存储职业字段。根据 personality 最高两个维度自动推导显示标签：

| 性格组合 | 职业标签 |
| --- | --- |
| 勇气 + STR | 战士 |
| 智慧 + 创造 | 研究员 |
| 社交 + 韧性 | 商人 |
| 韧性 + VIT | 矿工 |
| 创造 + 智慧 | 黑客 |

随性格进化可自然变化。

#### SHELTER 分配

28 个命名角色 SHELTER 按小说固定。860 个普通居民 Mint 时按世界观比例加权随机：

| SHELTER | 定位 | 分配比例 | 约数量 |
| --- | --- | --- | --- |
| 01 | 科研中心 | 15% | ~129 |
| 02 | 军事堡垒 | 12% | ~103 |
| 03 | 宗教避难所 | 10% | ~86 |
| 04 | 市场经济 | 20% | ~172 |
| 05 | 透明协议 | 12% | ~103 |
| 06 | 儿童庇护所 | 8% | ~69 |
| 废土 | 流浪者 | 18% | ~155 |
| 00 | 远古洞穴 | 5% | ~43 |

#### BAP-578 属性映射

| 我们的属性 | 存储位置 | BAP-578 对应 |
| --- | --- | --- |
| rarity, shelter | ClawRouter LobsterState | 游戏层扩展，通过 logicAddress 路由 |
| personality（5维具体值） | ClawRouter LobsterState | personalityHash 存哈希到 BAP-578 |
| DNA（4基因+变异槽具体值） | ClawRouter LobsterState | dnaHash 存哈希到 BAP-578 |
| 性格进化/DNA变异记录 | learningTreeRoot（Merkle 树） | BAP-578 原生支持 |
| 视觉 Trait | IPFS 元数据 | vaultURI / vaultHash |
| status（ALIVE/DORMANT） | BAP-578 Status（Active/Paused） | 直接映射 |

### 4.2 双层钱包

| 层 | 币种 | 存储 | 充值 | 提现 |
| --- | --- | --- | --- | --- |
| BAP-578 | BNB | State.balance | fundAgent(tokenId){value:x} | withdrawFromAgent() |
| 游戏层 | CLW（内部积分） | clwBalances[tokenId] | depositCLW() 或 buyAndDeposit() | withdrawCLW()（6h冷却） |

> **v4.0 变更**：游戏内 CLW 为合约内部记账（积分制）。充值时真实链上 CLW 转入合约，提现时从合约转出。游戏奖励是合约直接记账，不需要真实代币支撑。

### 4.3 CLW 充值（开放充值）

任何人可给任何龙虾充 CLW。社交玩法：送礼物、帮续命、众筹复活。

```solidity
function depositCLW(uint256 nfaId, uint256 amount) external { // 不限owner
    clwToken.transferFrom(msg.sender, address(this), amount);
    clwBalances[nfaId] += amount;
    // 休眠龙虾余额达标 → 自动复活
}
```

### 4.4 buyAndDeposit：一步到位充值

新玩家手里只有 BNB，没有 CLW。合约集成 PancakeSwap，一笔交易完成 BNB→CLW 兑换+充值：

```solidity
function buyAndDeposit(uint256 nfaId) external payable {
    // msg.value (BNB) → PancakeSwap 买 CLW → clwBalances[nfaId] += amount
}
```

> **注意**：buyAndDeposit 需要 CLW 在 PancakeSwap 上有流动性。CLW 通过 Flap Bonding Curve 毕业到 PancakeSwap 后，此功能自动可用。

玩家说"用 0.1 BNB 买 CLW"，一句话搞定。不需要离开 Telegram，不需要做 approve。

### 4.5 提现（仅 owner + 6h 冷却）

```solidity
function requestWithdrawCLW(uint256 nfaId, uint256 amount) external onlyNFAOwner;
function claimWithdrawCLW(uint256 nfaId) external onlyNFAOwner; // 6h 后
```

充值开放 + 提现锁定 + rescueERC20 误转兜底。三层资金安全。

> **提现限额**：提现时需要合约内有足够的真实 CLW（来自玩家充值）。如果合约内真实 CLW 余额不足，提现排队等待。

### 4.6 交易签名机制

所有链上操作的统一流程：

1. OpenClaw Skill 构造交易数据（目标合约、calldata、BNB 金额）
2. 玩家输入 PIN
3. chain.skill 用 PIN + 机器指纹解密本地私钥（内存中只存在毫秒级）
4. 签名交易 → 广播到 BSC 网络（公共 RPC）
5. BSC 验证签名 → 扣款 → 执行合约逻辑

### 4.7 余额显示

玩家说"查余额"，chain.skill 同时展示两个层面：

- 玩家个人钱包：本地生成的 BSC 地址上的 BNB/CLW（"口袋里的钱"）
- 龙虾钱包：合约内部记录的每只龙虾名下的 CLW 积分（"龙虾肚子里的钱"）

### 4.8 完整资金流向图

```
交易所/朋友 ─[提现BNB]─▶ 玩家个人钱包
  ├─ Mint费(BNB) ─▶ mint.skill ─▶ 协议金库
  ├─ buyAndDeposit(BNB) ─▶ PancakeSwap换CLW ─▶ 龙虾CLW余额（内部记账）
  ├─ fundAgent(BNB) ─▶ 龙虾BNB余额
  ├─ depositCLW(CLW) ─▶ 龙虾CLW余额（内部记账）
  └─ Gas费(BNB) ─▶ BSC网络

Flap 平台：
  ├─ Bonding Curve 买入(BNB) ─▶ 铸造 CLW 代币
  ├─ Bonding Curve 卖出(CLW) ─▶ 销毁 CLW，返还 BNB
  ├─ 毕业（16 BNB 填满）─▶ PancakeSwap 流动性池
  └─ Tax（前30天最高10%）─▶ Vault 合约

龙虾CLW余额流出（内部记账）：
  ├─ 日消耗 ─▶ 销毁
  ├─ 任务消耗 ─▶ 游戏逻辑
  ├─ PK质押 ─▶ 赢家50% / 销毁10%
  └─ 提现(6h) ─▶ 回到玩家钱包（真实CLW转出）─▶ 可DEX卖掉

新手路径：Binance提现BNB → Mint(0.18BNB) → buyAndDeposit(0.1BNB换CLW) → 做任务
```

### 4.9 状态机映射

| 龙虾状态 | BAP-578状态 | 触发 | 允许操作 |
| --- | --- | --- | --- |
| EMBRYO | Paused | Genesis Mint后待揭示 | 无 |
| ALIVE | Active | Reveal/充值CLW达标 | 全部Skill |
| DORMANT | Paused | CLW=0超过72h | 仅充值和提现 |

无 Terminated。龙虾文明不使用永久死亡。休眠是最重惩罚，充CLW随时复活。

### 4.10 日消耗

| 等级 | 每日CLW | 月成本 |
| --- | --- | --- |
| 1-10 | 10 | 300 |
| 11-30 | 25 | 750 |
| 31-60 | 50 | 1,500 |
| 61-90 | 100 | 3,000 |
| 91-100 | 200 | 6,000 |

> 韧性（Grit）属性可降低日消耗。公式：实际日消耗 = 基础消耗 × (1 - Grit/200)。Grit=100 的龙虾日消耗减半。

---

## 5. Skill 合约详解

### 5.1 chain.skill

纯 OpenClaw Skill，无链上合约。在玩家宿主机本地执行：

- 首次运行自动生成 BSC 密钥对，AES-256-GCM + PBKDF2(PIN+机器指纹) 加密
- 显示钱包地址，引导玩家从交易所提现 BNB
- 助记词显示一次用于备份（换设备恢复用）
- 管理多只龙虾，自然语言切换活跃角色
- 构造所有链上交易、签名、广播

### 5.2 mint.skill

#### Genesis Mint（888只）

Commit-Reveal 防抢跑。定价：

| 等级 | 数量 | Mint价格 | CLW空投 |
| --- | --- | --- | --- |
| Mythic | 1 | 8.88BNB | 88,888 |
| Legendary | 4 | 3.88BNB | 38,888 |
| Epic | 6 | 1.88BNB | 18,888 |
| Rare | 17 | 0.88BNB | 8,888 |
| Common | 860 | 0.18BNB | 1,888 |

Mint 时自动分配：
- **rarity**：由 Mint 价格决定
- **shelter**：按世界观比例加权随机（见 4.1 节）
- **personality**（5维）：随机初始化
- **DNA**（4基因）：随机初始化（总和范围按稀有度限定）
- **NFT 视觉**：由上述属性决定 Trait 权重（见 Art Bible 属性→视觉映射章节）

#### 后创世 Mint

0.08BNB 平价，永远 Common，无空投。稀有以上只能靠 PK 变异。

### 5.3 task.skill（v2 — AI 驱动）

> **v4.0 变更**：任务不再从固定池抽取，改为龙虾 AI 预言机动态生成。

#### 任务生成流程

```
WorldState 合约读取全局参数（CLW价格/交易量/事件标志）
    ↓
龙虾 LLM（OpenClaw 本地）读取全局参数 + 龙虾 personality/DNA/经验
    ↓
AI 动态生成个性化任务（难度、类型、奖励由属性+全局参数决定）
    ↓
玩家与龙虾对话完成任务 → AI 评判完成质量
    ↓
结果回写链上（XP/CLW奖励）+ IPFS 存证
```

#### 匹配度算法

保留 personality 向量匹配度机制：龙虾 personality 向量与任务需求向量点积 → 0.1x–2.0x 奖励修正。白板龙虾做任务只赚精心培养龙虾的 1/20。任务完成后写入 Merkle 树。

#### 全局参数影响

| 世界状态 | 任务效果 |
| --- | --- |
| CLW 价格高 | 高难度任务，低 CLW 奖励（通缩压力） |
| CLW 价格低 | 简单任务，高 CLW 奖励（刺激活跃） |
| 持有人数增长 | 解锁新任务类型 |
| 特殊事件（泡沫/寒冬） | 限时特殊任务 |

### 5.4 pk.skill（v2 — 一次性结算）

> **v4.0 变更**：PK 改为一次性结算模型。龙虾 AI 帮玩家选策略+生成战斗叙事。

#### 战斗流程

```
玩家A commit(策略哈希) → 玩家B commit(策略哈希)
→ 双方 reveal(策略) → 合约一次性计算 → 出结果
→ 龙虾 AI 生成战斗叙事（本地，不上链）
```

#### 策略类型

| 策略 | 倍率 | 特点 |
| --- | --- | --- |
| 全攻 (0) | STR ×1.5，DEF ×0.5 | 高伤害低防御 |
| 平衡 (1) | STR ×1.0，DEF ×1.0 | 均衡 |
| 全防 (2) | STR ×0.5，DEF ×1.5 | 低伤害高防御 |

#### 战斗公式

```
攻击方伤害 = 攻方STR × 策略攻击倍率 × (1 + 先手加成)
防御减伤 = 守方DEF × 策略防御倍率
闪避判定 = 守方SPD / (攻方SPD + 守方SPD)  → 随机数 < 闪避率则 miss
先手加成 = SPD 高的一方 +10% 伤害，SPD 低的一方 +0%
血量 = VIT × 10

双方各算一次攻击 → 比较剩余血量 → 高的赢
平局 → SPD 高者胜（速度决胜）
```

#### 结算

- 输家丢 50% 质押给赢家，10% 永久销毁
- 打赢比自己高 5+ 级的对手，10% 概率 DNA 变异 → 解锁变异槽
- 变异记录到 Merkle 树

#### AI 预言机参与

龙虾 LLM 帮玩家分析对手链上数据（等级/DNA/历史战绩），建议攻/防/平衡策略。不同性格的龙虾建议不同——勇气高的龙虾倾向全攻，韧性高的倾向全防。

战斗结束后，龙虾 AI 生成个性化战斗叙事（本地渲染，不上链）。

### 5.5 market.skill（全链上，无后端）

合约内 activeListings 数组就是订单簿。OpenClaw Skill 直接读取合约状态来浏览市场。筛选排序在客户端本地完成。

| 交易类型 | 机制 | 费率 |
| --- | --- | --- |
| 固定价 | 卖家设BNB价格，先到先得 | 2.5% |
| 拍卖 | 英式24h，加价5% | 2.5% |
| NFA互换 | 双方确认 | 1% |

买家验证：从 vaultURI 拉 Merkle 数据，本地算 root 与链上比对，匹配显示"已验证✓"。不花 Gas。

NFA 转移时，内部 CLW/等级/XP/DNA/personality/learningTreeRoot 全部绑定 tokenId，自动跟随过户。

### 5.6 equip.skill [预留]

空壳已部署，逻辑开发中。装备数据用 BAP-578 的 vaultURI/vaultHash。

### 5.7 launch.skill（Flap 平台发行）

> **v4.0 变更**：删除 FairLaunch.sol，改为通过 Flap 蝴蝶平台发行 CLW 代币。

#### Flap 平台简介

Flap 是 BNB Chain 上的去中心化代币发射台。一键创建代币，通过 Bonding Curve 机制从零启动流动性，毕业后自动上 PancakeSwap。

#### CLW 发行流程

1. **创建代币**：在 Flap 平台创建 CLW，成本 ~0.001 BNB
2. **Bonding Curve 阶段**：
   - 买入 → BNB 作为储备金注入曲线，曲线铸造 CLW 给买家
   - 卖出 → 曲线销毁 CLW，返还储备金 BNB
   - 基于常数乘积公式（与 Uniswap V2 相同），价格随供给自动上涨
3. **毕业**：买入达到 80% 供应量 + 16 BNB → 自动在 PancakeSwap 创建流动性池
4. **DEX 交易**：毕业后 CLW 在 PancakeSwap 自由交易

#### Tax Token 配置

| 参数 | 值 |
| --- | --- |
| 税率 | 最高 10%（可自定义） |
| 有效期 | 毕业后前 30 天 |
| 税收流向 | Vault 合约（用于 AI 预言机费用/游戏运营） |
| 迁移器 | V2_MIGRATOR（Tax Token 必须用 V2） |

#### FLAPSHARE

创作者从 CLW 交易活动中持续获得收入分成，无需额外操作。

---

# PART III: LOBSTER AI ORACLE（龙虾 AI 预言机）

> **v4.0 新增章节**

## 6. 龙虾 AI 预言机系统

### 6.1 设计哲学

每只龙虾本身就是一个运行在玩家设备上的 AI agent（通过 OpenClaw）。龙虾不是调用外部 AI 服务——**龙虾本身就是预言机**。

这与小说世界观中的"选择助手"完全一致：龙虾根据自己的 AI 能力 + 链上数据帮主人分析决策。

### 6.2 架构：方案 D（混合模式）

```
┌─────────────────────────────────────────────────────┐
│               链上（确定性，全局统一）                  │
│                                                     │
│  WorldState.sol ← 链上数据（CLW价格/交易量/持有人数）  │
│       ↓                                             │
│  合约公式 → 全局参数（奖励系数、事件标志、质押上限）      │
│       ↓                                             │
│  所有玩家看到统一的世界状态                             │
│  项目方可更新合约添加新规则                             │
├─────────────────────────────────────────────────────┤
│               链下（AI，个人化）                       │
│                                                     │
│  龙虾 LLM（OpenClaw 本地运行）                        │
│       ↓ 读取全局参数 + 龙虾属性                        │
│  ① 动态生成个性化任务                                  │
│  ② 选择 PK 策略 + 生成战斗叙事                        │
│  ③ 分析市场数据建议买卖                                │
│       ↓                                             │
│  结果回写链上（ClawOracle.sol）+ IPFS 存证             │
└─────────────────────────────────────────────────────┘
```

**核心原则**：
- **合约管"发生了什么"** — 纯数学，确定性，可升级
- **龙虾 AI 管"怎么体验"** — 个性化，有温度，每只龙虾不同

### 6.3 世界状态引擎（WorldState.sol）

可升级合约，项目方可随时添加新的世界规则。读取链上数据，输出全局游戏参数。

```solidity
contract WorldState is UUPSUpgradeable {
    // 全局参数（所有玩家统一）
    uint256 public rewardMultiplier;    // 任务奖励系数 (basis points)
    uint256 public pkStakeLimit;        // PK 质押上限
    uint256 public mutationBonus;       // 变异概率加成
    uint256 public dailyCostMultiplier; // 日消耗系数
    bytes32 public activeEvents;        // 当前活跃事件标志位

    // 规则引擎：项目方可更新
    function updateWorldState() external {
        uint256 clwPrice = _getCLWPrice();        // 从 PancakeSwap 读取
        uint256 holders = _getHolderCount();       // 从链上读取
        uint256 volume24h = _getVolume24h();       // 从链上读取

        // 规则1：CLW价格影响奖励
        if (clwPrice > priceThresholdHigh) {
            rewardMultiplier = 5000;  // 0.5x 奖励（通缩压力）
        } else if (clwPrice < priceThresholdLow) {
            rewardMultiplier = 20000; // 2.0x 奖励（刺激活跃）
        } else {
            rewardMultiplier = 10000; // 1.0x 正常
        }

        // 规则2：交易量影响PK
        if (volume24h > volumeThresholdHigh) {
            pkStakeLimit = highStakeLimit;
            mutationBonus = 500; // +5% 变异概率
        }

        // 规则3：事件触发
        // ... 项目方可通过升级合约添加新规则
    }
}
```

#### 世界事件示例

| 触发条件 | 事件名称 | 游戏效果 |
| --- | --- | --- |
| CLW 价格 24h 涨超 50% | 泡沫事件 | 任务奖励翻倍 + PK 销毁比例翻倍 |
| 持有人数突破里程碑 | 新领地开放 | 解锁新 SHELTER 区域/任务类型 |
| BNB 链 Gas 暴涨 | 能源危机 | 日消耗临时增加 |
| CLW 价格跌破阈值 | 经济寒冬 | 市场手续费降低，鼓励交易 |
| 交易量持续高位 | 繁荣时期 | PK 质押上限提高，变异概率提升 |

### 6.4 自建预言机合约（ClawOracle.sol）

参考 Flap AI Oracle 的 commit-and-reveal 模式自建，但后端是玩家自己的 OpenClaw 节点。

```solidity
contract ClawOracle {
    struct OracleRequest {
        uint256 nfaId;           // 发起请求的龙虾
        address consumer;        // 回调合约
        string prompt;           // LLM 提示词
        uint8 numOfChoices;      // 选项数量
        uint8 choice;            // LLM 选择结果
        string reasoningCid;     // IPFS 存证 CID
        RequestStatus status;    // PENDING / FULFILLED
        uint64 timestamp;
    }

    // 龙虾发起 AI 推理请求
    function reason(
        uint256 nfaId,
        string calldata prompt,
        uint8 numOfChoices
    ) external returns (uint256 requestId);

    // OpenClaw 节点回写结果
    function fulfillReasoning(
        uint256 requestId,
        uint8 choice,
        string calldata reasoningCid  // IPFS CID，存储完整推理过程
    ) external;
}
```

#### 信任模型

- 龙虾 AI 的决策**只影响龙虾主人自己**（任务选择、PK 策略）
- 全局状态由 WorldState.sol **链上公式**决定，不依赖 AI
- 每次 AI 决策的完整推理过程上传 IPFS 存证（可审计但不防篡改）
- 玩家篡改自己龙虾的 AI 输出 = 骗自己，没有动机

### 6.5 oracle.skill（OpenClaw 预言机 Skill）

OpenClaw Skill 层面的预言机执行逻辑：

1. 监听链上 `OracleRequestMade` 事件
2. 读取 prompt + 龙虾属性 + 全局参数
3. 注入龙虾 personality/DNA 到 prompt（不同龙虾给出不同回答）
4. 调用 OpenClaw 内置 LLM（Claude/GPT/Gemini，玩家自选）
5. 获取 choice + 完整 reasoning
6. 上传 reasoning 到 IPFS
7. 调用 `fulfillReasoning()` 回写链上

### 6.6 与世界观的映射

| 小说设定 | 现实实现 |
| --- | --- |
| 龙虾用 AI 能力分析最优方案 | OpenClaw LLM 本地推理 |
| 龙虾扫链上行为记录，吐出信任评分 | AI 读取链上数据 + personality 做决策 |
| "选择助手"应用蔓延废土 | oracle.skill 分发给所有玩家 |
| 不同龙虾给出不同建议 | personality 注入 prompt 产生差异化回答 |
| 楚门从不用选择助手 | 玩家可以选择不使用 AI 建议，自己做决策 |

---

# PART IV: CLW TOKENOMICS

## 7. CLW 代币经济模型

> **v4.0 变更**：CLW 从自部署改为通过 Flap 平台发行。游戏内使用积分制（内部记账）。

### 7.1 基本信息

| 参数 | 值 |
| --- | --- |
| 代币 | CLW（Claw Token） |
| 发行方式 | **Flap 蝴蝶平台**（Bonding Curve → 毕业到 PancakeSwap） |
| 链 | BNB Chain (BSC) |
| 创建成本 | ~0.001 BNB |
| 毕业条件 | Bonding Curve 填满 16 BNB |
| 模型 | 通缩（游戏内日消耗销毁 + PK 销毁） |

### 7.2 发行机制

#### Bonding Curve 阶段

- 用户用 BNB 购买 CLW → 曲线铸造 CLW，BNB 作为储备金
- 用户卖出 CLW → 曲线销毁 CLW，返还 BNB
- 基于常数乘积公式，价格随买入量自动上涨
- **无预分配**，所有代币通过市场购买产生

#### 毕业阶段

- 买入达到 80% 供应量 + 储备金达 16 BNB
- 自动在 PancakeSwap 创建 CLW/BNB 流动性池
- 此后 CLW 在 DEX 自由交易

#### Tax Token

- 毕业后前 30 天可征收最高 10% 交易税
- 税收自动进入 Vault 合约
- Vault 资金用于：游戏运营、AI 预言机费用、生态建设

#### FLAPSHARE

创作者从 CLW 交易活动中持续获得收入分成。

### 7.3 游戏内 CLW 流转（积分制）

```
链上 CLW（Flap 发行的真实代币，PancakeSwap 交易）
    ↕ depositCLW()  /  withdrawCLW(6h冷却)
游戏内 CLW（ClawRouter 合约内部 clwBalances mapping 记账）
    ├── 任务奖励 ←── 合约直接 clwBalances[nfaId] += reward
    ├── PK 质押/结算 ←── 合约内部转移
    ├── 日消耗 ←── 合约 clwBalances[nfaId] -= dailyCost（销毁）
    └── 市场手续费 ←── 合约内扣除
```

- 游戏奖励是合约**凭空记账**，不需要真实代币支撑
- 提现时消耗合约内真实 CLW（来自其他玩家的充值）
- 日消耗/PK销毁 消除积分 CLW（通缩）
- 形成内循环经济：充值（真钱进）→ 游戏赚积分 → 提现（真钱出）

### 7.4 收入流向

| 来源 | 分配 |
| --- | --- |
| Genesis Mint (BNB) | 100% 协议金库 |
| 后创世 Mint (BNB) | 100% 协议金库 |
| Flap Tax（前30天） | Vault 合约 |
| FLAPSHARE | 创作者持续收入 |
| 市场交易费 | 2.5% 协议金库 |
| PK 销毁 | 输家质押 10% 永久销毁 |

### 7.5 反女巫经济防线

| 防线 | 机制 | 效果 |
| --- | --- | --- |
| Mint成本 | 每只花真BNB | 多开花真钱 |
| 日消耗 | 每天消耗CLW | 养机器人军团成本高 |
| 匹配度 | 低匹配低奖励 | 白板龙虾每花1CLW只赚0.1倍XP |
| PK风险 | 输了丢CLW+10%销毁 | 机器人打PVP亏钱 |
| 递进成本 | 等级越高每日越贵 | 练级机器人指数级贵 |

---

# PART V: SECURITY & DEPLOYMENT

## 8. 安全模型

### 8.1 链上安全

BAP-578 UUPS可升级 + Pause + 紧急提现。ClawRouter + 所有Skill合约 ReentrancyGuard。CLW提现6h冷却。rescueERC20误转兜底。

### 8.2 密钥安全

私钥在 OpenClaw 宿主机本地生成、AES-256-GCM加密存储。机器指纹绑定让被盗 keystore 在其他设备无法解密。私钥永远不离开宿主机。

### 8.3 经济安全

不用服务器反作弊。经济设计让作弊亏钱：单个精心培养的龙虾 > 10只白板机器人。

### 8.4 OpenClaw 安全

OpenClaw 自带 DM 配对机制、白名单、Docker 沙箱。未授权的 Telegram 用户发消息会被配对码拦截，不会触发任何链上操作。

### 8.5 AI 预言机安全

- 龙虾 AI 决策只影响自己，无公共信任问题
- 全局世界状态由链上公式决定，确定性，不可篡改
- 每次 AI 推理结果上传 IPFS 存证，可审计
- WorldState.sol 使用 UUPS 可升级模式，项目方可及时修复规则

---

## 9. 部署计划

| 阶段 | 组件 | 时间 |
| --- | --- | --- |
| Phase 0 | **Flap 平台创建 CLW** → Bonding Curve 启动 → 毕业到 PancakeSwap | Month 1 |
| Phase 1 | 部署 BAP578 + ClawRouter + GenesisVault + mint.skill → Genesis Mint | Month 1-2 |
| Phase 2 | WorldState.sol + ClawOracle.sol + oracle.skill 部署 | Month 2 |
| Phase 3 | task.skill(v2) + pk.skill(v2) + learningModule | Month 3 |
| Phase 4 | market.skill + Tax 期 Vault 运营 | Month 4 |
| Phase 5 | equip.skill 逻辑集成 | TBD |

---

## A. 事件索引

| 事件 | 发出方 | 关键字段 |
| --- | --- | --- |
| ActionExecuted | BAP578 | agent, result |
| AgentFunded | BAP578 | agent, funder, amount |
| StatusChanged | BAP578 | agent, newStatus |
| CLWDeposited | ClawRouter | nfaId, depositor, amount |
| CLWSpent | ClawRouter | nfaId, amount, skill |
| WithdrawRequested | ClawRouter | nfaId, amount |
| LobsterLevelUp | ClawRouter | nfaId, newLevel |
| PersonalityEvolved | ClawRouter | nfaId, dimension, oldValue, newValue |
| DnaMutated | ClawRouter | nfaId, oldDna, newDna, mutationSlot |
| TaskCompleted | task.skill | nfaId, taskId, xpEarned, clwReward |
| PKResolved | pk.skill | winnerId, loserId, stake, mutated, strategyA, strategyB |
| Listed | market.skill | nfaId, seller, price |
| Sold | market.skill | nfaId, buyer, seller, price |
| OracleRequestMade | ClawOracle | requestId, nfaId, prompt, numOfChoices |
| OracleRequestFulfilled | ClawOracle | requestId, nfaId, choice, reasoningCid |
| WorldStateUpdated | WorldState | rewardMultiplier, pkStakeLimit, activeEvents |

---

## B. 术语表

| 术语 | 定义 |
| --- | --- |
| BAP-578 | BNB Chain 官方 NFA 代币标准（Draft） |
| NFA | Non-Fungible Agent，能持有资产、执行逻辑、学习进化的链上实体 |
| OpenClaw | 开源个人 AI 助手框架，300K Star，龙虾文明的运行平台 |
| Skill | OpenClaw 插件模块，客户端逻辑 + 链上合约配合 |
| ClawRouter | 游戏中间层合约，Skill路由/CLW余额/游戏状态/NFA属性 |
| CLW | Claw Token，**通过 Flap 平台发行**，Bonding Curve → PancakeSwap |
| Flap | BNB Chain 去中心化代币发射台，Bonding Curve 机制 |
| Bonding Curve | 自动做市曲线，买入铸造/卖出销毁，价格随供给变化 |
| FLAPSHARE | Flap 创作者收入分享机制 |
| Tax Token | Flap 支持的交易税代币（前30天最高10%） |
| Vault | 接收 Tax 收入的合约，用于游戏运营和 AI 预言机费用 |
| ClawOracle | 自建 AI 预言机合约，commit-and-reveal 模式 |
| WorldState | 链上全局规则引擎，读取链上数据输出游戏参数 |
| Personality | 龙虾 5 维性格：勇气/智慧/社交/创造/韧性 |
| DNA | 龙虾 4 战斗基因：STR/DEF/SPD/VIT + 变异槽 |
| learningTreeRoot | Merkle树根哈希，记录NFA全部学习/进化历史 |
| Genesis NFA | 888只创世龙虾，永久稀有度加成 |
| CCU | Claw Civilization Universe，龙虾文明宇宙 |

---

Claw Civilization Universe · Technical Architecture v4.0 · BAP-578 + OpenClaw + Flap + Lobster AI Oracle

*"Every lobster is a sovereign."*
