# ClaworldNfa 对话式 dApp 前端重构方案

**版本**：v1.0 · 起草日期 2026-04-18
**作者**：产品/架构讨论稿
**面向读者**：ClaworldNfa 核心开发、产品、运营
**适用范围**：`frontend/` 重构 + `openclaw/` runtime 对接前端的接口层调整

---

## 0. TL;DR（30 秒版本）

把当前"PWA 多页玩法入口"彻底翻转成**"对话即入口，玩法即动作"**。

- **用户进来第一眼**：钱包连接墙。连接即"觉醒"你的 NFA 军团。
- **主界面结构**：左侧 Discord 式 NFA 频道栏 + 中央对话流 + 右侧（可折叠）NFA 状态面板。
- **交互核心**：和 NFA 对话。挖矿、PK、大逃杀、市场操作全部通过自然语言触发，链上动作在已设定的 autonomy policy 额度内**静默执行**，超出额度才弹钱包。
- **差异化护城河**：把你已经做好但没被用户看见的 **CML 记忆** 和 **autonomy 自治链路** 从"架构图"变成"用户可感知的产品主角"——对话里能直接读到"我记得上次你让我……"、"我在边界内已经帮你打了 3 场 PK"。
- **不动的东西**：合约不动、`openclaw/` runtime 不动、autonomy 链路不动。只重构 `frontend/` + 新增一层前端与 runtime 之间的薄网关。

这是"**重做产品表面，不重做底层系统**"的方案。风险小、见效快、MVP 可以在 3–4 周内出炉。

---

## 1. 现状与问题判断

### 1.1 你已经拥有的（真正的护城河）

基于对 repo 的阅读，你的底层比绝大多数 AI Agent + Crypto 项目扎实：

| 维度 | 别的项目 | ClaworldNfa |
|------|---------|-------------|
| AI Agent 身份 | 链下一个 persona 文件 | `ClawNFA` (BAP-578) 链上身份 + PersonalityEngine |
| Agent 的钱 | 共用主钱包 | `ClawRouter` 给每只 NFA 独立记账账户 |
| Agent 记忆 | 聊天历史 | `CML` 结构化长期记忆 + 链上 hash 锚定 + 可选 Greenfield 备份 |
| Agent 自治 | 手动调 API | `ClawAutonomyRegistry` + `ClawOracle` + 分技能 Adapter + `FinalizationHub` 全链路落地 |
| 可组合性 | 单一 UI | Agent runtime surface 已支持多 runtime 挂载同一世界 |

**这套基建的市场价值被现有前端严重低估了**。

### 1.2 现有前端的三个结构性问题

1. **玩法平铺 = 信息洪水**：mint / mining / PK / BR / proxy / autonomy controls 各自独立 tab。用户打开第一屏看到的是"我该点哪个"，而不是"我想干什么"。这是典型的 Web3 Dapp 综合征——把合约接口直接翻译成了前端页面。
2. **AI 被降级成了"工具之一"**：OpenClaw runtime 被安置在 "proxy / autonomy controls" 这种后台管理位置。但你们的 README 自己都强调"AI is the runtime that ties memory, planning, and on-chain execution together"——AI **就是产品本体**，不是配置项。
3. **CML 记忆和 autonomy 链路用户完全感知不到**：这是你最强的差异化，但玩家玩完一局 PK 不会知道"哦 CML 记住了我刚才的战斗偏好"、"哦我的 NFA 在我离线时根据 directive 帮我执行了 X"。功能做了没被看到 = 等于没做。

### 1.3 市场对标（为什么"对话优先"是对的方向）

2025 年下半年起，AI Agent × Crypto 赛道头部产品的共同收敛方向是 **conversational-first**：Virtuals 的 Agent 互动、Fetch.ai 的 Agentverse、Griffain、Bitte 等都在往"用户只面对一个对话框，agent 在背后替你做一切"收敛。多入口 dashboard 被验证为留存杀手。

你的底层比他们都更硬核，现在只缺把壳换成对话入口。

---

## 2. 产品形态定义

### 2.1 核心隐喻

**"NFA Terminal"**——不是 dashboard，不是游戏大厅，而是一个**通往 NFA 军团的终端**。

借用机甲美学的话术：用户**"接入"**（connect wallet）之后，屏幕上亮起他拥有的所有 NFA。每一只都是一个独立意识，带着自己的记忆、性格、账本和行动权限。用户**通过对话指挥他们**，或者**设定边界让他们自己行动**。

### 2.2 三条用户已选择的产品决策（上文已对齐）

| 决策项 | 选择 | 本文落地方式 |
|--------|------|------------|
| 第一眼 | 钱包连接墙 | Section 3.1 |
| NFA 切换 | 左侧 Discord 式抽屉栏 | Section 3.3 |
| 链上动作确认 | 授权额度内全自动 | Section 3.6 + Section 5.3 |

### 2.3 不做什么（边界很重要）

- ❌ 不做多页路由。除了 landing（未连接）和 terminal（已连接）之外**没有第三个页面**。mint / mining / PK / BR / market 全部变成对话里的动作卡，**不再有独立路径**。
- ❌ 不做传统 GameFi 式的数值炫耀。NFA 状态用最克制的方式暴露，放在右侧可折叠面板。
- ❌ 不做社交 / 排行榜 / 市场浏览 等功能。先把"用户×NFA"这条关系做到极致，社交是第二阶段的事。
- ❌ 不删除 legacy `/game`。保留但从主导航移除，通过 `/legacy-game` 访问。

---

## 3. 界面架构

### 3.1 Landing / 钱包连接墙

**目的**：一眼讲清楚"这是什么"，并把连接钱包变成一个有仪式感的动作。

**结构**：
- 全屏暗色背景 + 琥珀色流光（沿用机甲美学）
- 居中一句核心文案，不超过 10 个字：例如 `唤醒你的 NFA`
- 副标：一句话讲清楚差异化，不超过 30 字：例如 `带记忆、能自治、在 BNB 链上真实行动的 AI 伙伴`
- 单一 CTA：`接入 / Connect`
- 底部极简：网络状态、合约链接、文档
- **不放**：特性列表、roadmap、数据墙、社交链接墙——这些把用户推走的东西

**连接成功后**：1.5–2 秒的"觉醒"过渡动画，然后进入主终端。觉醒期间后台并行完成：
- 查询用户拥有的 NFA 列表（`ClawNFA.balanceOf` + `tokenOfOwnerByIndex`）
- 加载每只 NFA 的基础状态（level / active / ledger balance）
- 拉取默认选中 NFA 的 CML 最新快照摘要（从 runtime API）
- 拉取 autonomy 授权状态

### 3.2 主终端整体布局

桌面端（≥1024px）：

```
┌──────────────────────────────────────────────────────────┐
│  ┌──┐  ┌──────────────────────────────┐  ┌────────────┐ │
│  │N1│  │                              │  │ NFA Status │ │
│  │N2│  │                              │  │            │ │
│  │N3│  │     Conversation Stream      │  │  Ledger    │ │
│  │N4│  │                              │  │  Memory    │ │
│  │N5│  │                              │  │  Autonomy  │ │
│  │..│  │                              │  │            │ │
│  │ +│  │  ┌────────────────────────┐ │  │            │ │
│  │  │  │  │  Input + Quick Actions │ │  │            │ │
│  └──┘  └──└────────────────────────┘─┘  └────────────┘ │
│  72px      flex-1                        320px (可折叠) │
└──────────────────────────────────────────────────────────┘
```

移动端（<1024px，是你们当前主要形态，因为原 PWA 就是 mobile-first）：

- 左侧栏变成顶部横向滑动的 NFA 带
- 右侧状态面板变成从右侧划入的 drawer，默认折叠
- 对话流占满主视图

### 3.3 左侧 NFA 频道栏

**视觉**：
- 竖向排列的圆形头像，尺寸 48px，间距 8px
- 激活态：左侧有一条 3px 宽的琥珀色指示条，头像从圆角方形变成圆形（形变动画）
- Hover：显示 NFA 名字 + 简短状态 tooltip
- 未读态：右上角小圆点，表示"有事件需要你查看"（例如 autonomy 动作执行完、PK 被挑战等）
- 底部固定："+" 图标 → 铸造新 NFA（Genesis Mint 入口）

**数据来源**：
```
GET /api/nfas?owner={address}
→ [{tokenId, name, avatarUri, level, active, pulse, unreadCount}]
```
这个接口是**新增的前端 BFF（见 Section 4）**，后端聚合 `ClawNFA.tokenURI` + runtime 的 CML pulse + 事件 unread 计数。

**交互**：
- 点击头像 → 切换当前对话上下文
- 切换时的加载体验：对话区立刻显示上一次的对话历史（从本地 IndexedDB 缓存读），同时后台拉最新
- 每只 NFA 的对话历史独立保存，不混流

### 3.4 中央对话流

这是整个产品的**核心画布**，设计质量决定成败。

#### 3.4.1 消息类型

必须支持六种消息气泡形态，不能是"只有文本 + 图片"那种通用 chat UI：

1. **文本消息**（用户 / NFA 双向）
2. **NFA 建议卡**（copilot 模式下，NFA 给出挖矿/PK 等建议，带"执行"按钮）
3. **链上动作回执卡**（autonomy 执行完或用户确认签名后生成）
4. **系统事件卡**（"你的 NFA 刚赢得了一场 PK"、"CML 刚完成了一次 SLEEP 合并"）
5. **世界状态卡**（NFA 主动播报："市场出现 X 机会"、"大逃杀第 42 局还有 3 分钟开始"）
6. **推理证明卡**（点开显示该 autonomy 动作的 `reasoningCid` 内容，链接到 Greenfield 或 IPFS）

#### 3.4.2 动作回执卡（最重要的一个组件）

这是把你们的 autonomy 链路从"后台日志"拉到"用户主角视角"的关键。

每次链上动作完成，对话流里生成一张紧凑卡片，布局示意：

```
╭─────────────────────────────────────────╮
│  ⚡ Seraph-07 · Mining               │
│  ───────────────────────────────────   │
│  执行 task mining · 消耗 12 CLW       │
│  收益 18 CLW · 记入 NFA 账本           │
│                                         │
│  tx: 0x3a2f…8b1c  ↗                    │
│  reasoning: bafy…ka32  ↗ (查看推理)    │
│  已写入 CML: hippocampus #142          │
╰─────────────────────────────────────────╯
```

卡片特点：
- 信息完整但视觉克制，不打断对话节奏
- 核心字段三行以内
- 可展开二级信息（gas / block / 完整 reasoning 文本）
- 失败态用橙色边框 + 错误摘要，提供"重试"或"调整策略"按钮

#### 3.4.3 对话发起方

NFA **主动发言**是这个产品的灵魂——大多数 GameFi dapp 用户总是主动操作，NFA 主动发起对话是强差异化。

触发条件（由 runtime watcher 决定，已存在）：
- 大逃杀即将开始（`BattleRoyaleWatcher`）
- 用户上一条 directive 执行完成
- CML 刚完成一次 SLEEP 合并（记忆更新播报）
- NFA 账本余额低于 upkeep 阈值（主动提醒充值）
- 市场出现符合 CML 偏好的机会

前端实现：通过 SSE（Server-Sent Events）或 WebSocket 订阅 runtime 事件流，收到后以 NFA 身份插入对话。

### 3.5 底部输入区 + 快捷动作

**输入框**：不是裸文本框，而是一个带 **"@"提及菜单** 和 **"/"斜杠命令** 的复合输入。

- `@Seraph-07` → 在多 NFA 对话场景中明确指向（第二阶段，MVP 可以只针对当前选中 NFA）
- `/mine` `/pk` `/deposit 100` `/directive 当 PK 胜率低于40% 时暂停` → 斜杠命令直达标准动作，绕过 LLM 意图识别，减少延迟和歧义
- 自然语言仍然是主路径，斜杠只是熟练玩家的加速器

**快捷动作条**（输入框上方一行小按钮）：
- 根据当前 NFA 的状态动态生成，最多 3 个
- 示例："去挖矿" / "加入大逃杀" / "充值 100 CLW"
- 点击后把对应指令填入输入框，用户还能编辑，不是直接执行

### 3.6 右侧 NFA 状态面板（可折叠）

不默认展开。极简主义第一原则：对话里能表达的信息不额外占位。

三个折叠区块：

**① Ledger 账本**
- 当前 NFA 的 CLW 余额
- 最近 5 笔入出账（来自 `ClawRouter` 事件）
- `存入` / `提现` 按钮 → 触发对话里的预设指令，不独立弹窗

**② Memory 记忆**
- 最新 CML 快照 hash + 锚定 tx
- Pulse 状态可视化（用一行心电图样条表达活跃度）
- "记忆时间线"入口 → 抽屉展开，显示历次 SLEEP 快照列表

**③ Autonomy 授权**
- 当前 directive 摘要（"允许在 100 CLW 预算内自动参与挖矿与 PK"）
- 已消耗额度 / 剩余额度（进度条）
- 最近 3 次自治动作摘要
- `修改 directive` / `撤销授权` 按钮

这是把"autonomy policy"从合约抽象变成用户可视可改控件的关键位置。

---

## 4. 技术架构

### 4.1 分层图

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 / App Router, Vercel)              │
│  ├─ Landing (unauthenticated)                            │
│  └─ Terminal (authenticated)                             │
│     ├─ NFA Sidebar   ─────┐                              │
│     ├─ Conversation Pane ─┼─ uses ─┐                     │
│     └─ Status Drawer  ─────┘       │                     │
└────────────────────────────────────┼─────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────┐
│  Frontend BFF  (新增薄层, Next.js API Routes 或独立服务)  │
│  ├─ /api/nfas          (聚合 NFA 列表+状态)              │
│  ├─ /api/chat          (LLM 对话 + 工具调用入口)         │
│  ├─ /api/events (SSE)  (NFA 主动事件流)                  │
│  ├─ /api/directive     (directive 签名保存, 已存在)      │
│  └─ /api/memory        (CML 只读查询)                    │
└────────────┬───────────────────────────┬─────────────────┘
             │                           │
             ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  OpenClaw Runtime (已有) │  │  BNB Chain (已部署合约)   │
│  - Planner               │  │  - ClawNFA / Router      │
│  - CML Memory            │  │  - TaskSkill / PKSkill   │
│  - Tool Adapters         │  │  - ClawOracle / Hubs     │
│  - Autonomy Runner       │  │  - Adapters              │
│  - Watchers              │  └──────────────────────────┘
└──────────────────────────┘
```

### 4.2 前端技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | **Next.js 14 (App Router)** | 你已有 `frontend/` + Vercel 部署，不换栈 |
| 样式 | **Tailwind CSS + CSS Variables** | 机甲美学需要大量自定义 token |
| 状态 | **Zustand + TanStack Query** | Zustand 管 UI 状态（当前 NFA、drawer 开合），TanStack Query 管数据拉取缓存。不上 Redux |
| Web3 | **wagmi v2 + viem + RainbowKit** | BNB Chain 支持成熟，取代任何老版 ethers v5 直连 |
| 流式 | **EventSource / SSE** (MVP)，后续升级 WebSocket | SSE 足够支持 NFA 主动消息，部署简单 |
| 本地存储 | **IndexedDB (via Dexie)** | 缓存对话历史以支持快速切换 NFA |
| 动效 | **Framer Motion** | 觉醒动画、NFA 切换形变、动作卡入场 |
| 字体 | Display 用 **Space Mono** 或 **JetBrains Mono**，Body 用 **Geist Sans** 或 **Satoshi** | 避开 Inter / Roboto 这类通用字体，配合机甲气质 |

### 4.3 前端 BFF 这一层的必要性（重点）

**为什么不让前端直接调 OpenClaw runtime？**

1. **安全**：LLM API key、runtime 端点不能暴露给浏览器
2. **聚合**：一个页面要同时查 NFA 列表、CML 摘要、ledger、autonomy 状态——合约 + runtime + 链上事件三个来源。BFF 合并后给前端一个干净接口
3. **SSE 桥接**：runtime 的 watcher 事件可能走内部消息队列，BFF 提供统一的前端可消费流
4. **协议演进**：后续加 OpenClaw 之外的 runtime（Hermes、function-calling agent），BFF 层做路由，前端不感知

BFF 可以**直接用 Next.js 的 API Routes 实现**，部署仍在 Vercel，不增加独立服务。如果将来流量大、或 runtime 长连接压力大，再拆独立 Node 服务（NestJS 或 Fastify）。

### 4.4 对话 → 链上动作的完整链路

```
用户输入："帮我的 Seraph-07 去挖矿"
        │
        ▼
┌───────────────────┐
│ /api/chat POST    │  前端 BFF
│  {nfaId, message} │
└──────┬────────────┘
       │ forward + append CML context
       ▼
┌──────────────────────┐
│ OpenClaw Planner     │
│  - load CML          │
│  - read world state  │
│  - intent: "mining"  │
│  - tool pick: task   │
└──────┬───────────────┘
       │
       ▼
     分支判断
       │
  ┌────┴──────────────────────────┐
  │                               │
  [在 directive 边界内]         [超出边界 / 首次使用]
  │                               │
  ▼                               ▼
autonomy path                  copilot path
  │                               │
  ▼                               ▼
requestAutonomousAction(...)  返回建议卡
ClawOracle → Adapter → Skill   用户点"执行"→ wagmi 发起签名
FinalizationHub → 回执         成功后回到对话流
  │                               │
  └───────────┬───────────────────┘
              ▼
      对话流中插入动作回执卡
      CML hippocampus 写入
```

**关键点**：
- copilot 路径和 autonomy 路径**共享同一个对话流**，用户看到的只是"有的动作需要我点一下，有的不用"，不是两个独立功能
- autonomy 判定在 BFF / Planner 侧完成，前端不用自己判断"这个动作要不要签"

### 4.5 NFA 主动发言的事件流

```
runtime Watcher 触发 (e.g. BattleRoyaleWatcher)
        │
        ▼
runtime 内部 event bus / 写入 Redis Stream
        │
        ▼
BFF 订阅并 fan-out 到 SSE 连接
        │
        ▼
前端 EventSource 收到 { type, nfaId, payload }
        │
        ▼
  根据 type 渲染对应消息类型 (Section 3.4.1)
        │
        ▼
  如果当前未选中该 NFA,侧边栏头像显示未读小圆点
```

**事件类型（首批，对齐 runtime 已有 watcher）**：
- `battle_royale.opening_soon` / `battle_royale.result`
- `autonomy.action_completed` / `autonomy.action_failed`
- `cml.sleep_consolidated`
- `ledger.low_balance` / `ledger.reward_received`
- `market.opportunity_matched`

---

## 5. 关键功能设计细节

### 5.1 NFA 身份化表达

光有 tokenId 不够。每只 NFA 需要有**可辨识的"个性包装"**：

- **头像**：从 `tokenURI` 取，如果 Genesis Mint 还没生成视觉资产，用 `PersonalityEngine` 的向量做一个算法头像（例如 identicon 变体 + 性格向量映射的色彩基调）
- **名字**：用户可自定义（链下，存 BFF），默认使用 "类型-tokenId" 格式
- **对话语气**：基于 `personality vector` + `prefrontal beliefs` 在 system prompt 中注入。偏激进性格的 NFA 说话更急、偏保守的说话更稳——这是 CML 价值的外化
- **greeting**：每次打开时根据 `pulse` 状态生成首句，不是写死的欢迎语

### 5.2 极简对话但信息密度高

参考设计原则（借鉴 Linear / Arc / Raycast 的克制美学）：

- **留白 > 装饰**：对话气泡没有花哨背景，靠字体层次和微妙的颜色差异建立结构
- **颜色语义单一**：琥珀色（主题色）只用于强调 NFA 身份和关键动作；成功态用浅绿、失败态用暖橙、普通信息都是灰阶
- **动效有意义**：消息入场、NFA 切换、卡片展开——每个动效都对应一个状态变化，不做无意义的装饰动画
- **字体区分层级**：display 字体只用于 NFA 名字和关键数字，body 字体用于对话内容

### 5.3 Autonomy 额度的用户可见性（最重要的体验决策）

你选择了"授权额度内全自动"——这是产品爆点，但同时**最容易失去用户信任**。解决方案：

**① 进入 terminal 时的一次性引导**：
- 如果用户还没设置过 directive，首条消息就是 NFA 自己提出："我想在一定预算内帮你打理日常（挖矿、低风险 PK 等），你给我多少预算？"
- 通过对话完成 directive 签名，而不是跳到独立的"设置页"

**② 常驻透明度**：
- 右侧 Autonomy 面板始终可展开看到"已用/剩余"
- 每次自治动作回执卡顶部显示 "本次消耗 X CLW · 剩余 Y CLW"
- 额度用尽或达到 80% 时，NFA 主动发消息提醒

**③ 即时叫停**：
- 对话里任何时候可以说"暂停自治"、"停手"——runtime 识别到后立即冻结该 NFA 的 autonomy（本地 + 链上 directive 更新）
- 右侧面板有红色"紧急停止"按钮作为兜底

**④ 回溯审计**：
- `autonomy.action_completed` 事件始终在对话流中可追溯
- 点击 `reasoningCid` 可查看当时的推理证据——这是你们最独特的一环，大多数自治产品没有这个

### 5.4 CML 记忆的"可感"

CML 是你们最容易"被忽略"的亮点。让它被用户感受到：

- NFA 开场白引用上次对话："上次你说想冲 BR 前 10，我记得"
- 在建议卡里显式引用偏好："基于你过去 7 天倾向保守的操作..."
- "记忆时间线"视图：每次 SLEEP 快照是一个节点，展示 diff（新增了什么信念、hippocampus 合并了多少条）
- 链上锚定 tx 可点，跳转 BNBScan 显示 `updateLearningTreeByOwner` 调用——告诉用户"这段记忆已经刻在链上"

### 5.5 铸造（Genesis Mint）也做成对话

左栏底部 "+" 按钮**不跳页**，而是在当前对话流中插入一个铸造 NFA 角色，进入专属铸造对话：

- 铸造 NFA 用对话引导用户选择 shelter、commit 阶段说明、reveal 后结果揭晓
- 全程对话式，commit-reveal 的两阶段体验融入成"封装祝词 → 揭晓宿命"的叙事
- 这也是把你们硬核的 commit-reveal 机制变成用户记得住的体验的机会

---

## 6. 从现状到新形态的迁移路径

### 6.1 保留 / 重构 / 新增 分类

| 模块 | 决策 | 说明 |
|------|------|------|
| 合约层 | **保留不动** | 所有合约地址、接口全部复用 |
| `openclaw/` runtime | **保留** | planner / CML / autonomy runner / watcher 完全复用 |
| `scripts/` | **保留** | 部署/迁移/smoke 脚本继续用 |
| `frontend/` 旧 PWA | **重构** | 大部分组件废弃，路由重设计 |
| 旧 `/game` | **保留但隐藏** | 迁到 `/legacy-game`，主导航移除 |
| 前端 BFF 层 | **新增** | Next.js API Routes 实现（Section 4.3） |
| SSE / 事件订阅 | **新增** | 桥接 runtime watcher 到前端 |
| 对话组件体系 | **新增** | 六种消息气泡 + 输入增强 |
| 钱包接入 | **升级** | 迁移到 wagmi v2 + RainbowKit |
| Directive API | **保留 + 扩展** | 现有接口保留，扩展"撤销 / 查询消耗"端点 |

### 6.2 分阶段 Roadmap

**Phase 0 · 设计对齐（1 周）**
- 基于本文档做 Figma / 静态原型确认视觉
- 确定字体、色彩 token、组件库（可选 shadcn/ui 作基础再定制）
- 明确 BFF 接口契约（OpenAPI schema）
- 产出：可点击的原型 + 接口文档

**Phase 1 · 对话 MVP（2 周）**
- 新 landing 页 + wagmi 接入
- Terminal 主框架：NFA 侧栏 + 对话流 + 状态抽屉
- 对话 = 纯文本 + 建议卡 + 动作回执卡（三种消息类型，其余放后面）
- 覆盖一条完整链路：挖矿（copilot 路径）
- BFF: `/api/nfas` + `/api/chat` 基础版
- 部署到 Vercel preview，内部可用

**验收标准**：连接钱包 → 看到 NFA → 说"帮我挖矿" → NFA 建议 → 签名 → 回执卡 → 收益入账。完整走通。

**Phase 2 · Autonomy 融入（2 周）**
- Directive 配置流程对话化（Section 5.3）
- Autonomy 路径接入：directive 边界内自动执行，对话流出现无需签名的回执卡
- SSE 事件流接入 autonomy_completed / battle_royale 等事件
- 右侧 Autonomy 面板完整版（额度/消耗/暂停）
- 覆盖第二条链路：PK

**验收标准**：设置 "100 CLW 预算自动参与 PK" → 离线 → 再上线看到对话流里 NFA 已自主打了 3 场，附带 reasoningCid 可查。

**Phase 3 · 记忆可感 + 剩余玩法（1–2 周）**
- CML 记忆时间线视图
- 大逃杀链路接入
- 铸造对话化
- NFA 主动播报（各类 watcher 事件渲染）
- 个性化 system prompt 注入

**Phase 4 · 打磨与公测（1 周）**
- 移动端适配全面 QA（你原来就是 mobile-first，这块优先级高）
- 性能：对话历史虚拟化、IndexedDB 缓存
- 无障碍 + 国际化（至少中英双语，匹配你 README 的双语策略）
- 降级策略：runtime 不可用时前端的 graceful degradation

**总周期**：6–8 周到公测就绪。MVP（Phase 1 结束）**3 周内**可 demo。

### 6.3 可以同时推进的工作

- 前端开发期间，后端同步准备：
  - CML 结构化摘要的只读 API（前端"记忆时间线"依赖）
  - 事件流正式化（把 watcher 的事件发布到统一总线）
  - Directive 查询端点（查剩余额度、历史动作列表）
- 合约侧**不需要任何改动**即可支撑整个新前端

---

## 7. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| LLM 意图识别误判导致误触发链上动作 | 中 | 高 | 所有写动作经过 Planner 的 policy 检查 + autonomy 合约侧二次校验；copilot 路径始终保留用户签名 |
| SSE 长连接在移动端被系统杀掉 | 高 | 中 | 心跳重连 + 前端轮询降级；重连后增量拉取错过的事件 |
| 用户对"全自动"产生不信任 | 中 | 高 | Section 5.3 的四重透明度设计；首次使用强引导 |
| 对话历史体积膨胀 | 中 | 低 | IndexedDB + 每 NFA 保留最近 N 轮，完整历史从 BFF 按需加载 |
| 钱包切换 / 多账号场景 | 中 | 中 | wagmi 原生支持，UI 清晰显示当前地址，切换时清空 NFA 状态 |
| LLM 延迟破坏对话感 | 高 | 中 | 流式返回 + 意图识别阶段先显示 typing 指示；常见操作走斜杠命令绕过 LLM |
| Vercel serverless 冷启动 | 中 | 中 | BFF 关键路径用 Edge Runtime；长时任务（autonomy 监听）仍在独立 runner 进程 |

---

## 8. 成功指标（上线 6 周后评估）

**产品指标**：
- 连接钱包后 60 秒内完成首次对话的用户比例 ≥ 70%
- 单用户日均对话轮次 ≥ 8
- Autonomy directive 签署率（拥有 NFA 的用户中） ≥ 30%
- 7 日留存 ≥ 25%（作为对比，典型 GameFi 是 10–15%）

**质量指标**：
- 对话首字节延迟 P50 < 800ms, P95 < 2s
- 链上动作回执从签名到卡片呈现 P95 < 8s
- 移动端 Lighthouse Performance ≥ 85

**业务指标**：
- Genesis Mint 从新前端发起的占比 ≥ 50%
- Autonomy 动作占总链上动作比例 ≥ 20%（证明自治价值被使用，不只是摆设）

---

## 9. 开放议题（需要你拍板）

1. **是否做多 NFA 同时对话**（群聊式，Phase 2+）？技术上左侧栏可支持多选，但产品上是否需要取决于 NFA 之间是否有协作玩法。建议 MVP 先不做。
2. **LLM 选型**：你们 OpenClaw runtime 现在接的是什么？如果是自部署开源模型，延迟和质量的 tradeoff 要提前确认。建议 MVP 阶段主对话用 Claude/GPT-4 级别模型，后续再做成本优化。
3. **是否保留 PWA 形态**：新设计完全可以继续 PWA 化（manifest + SW），建议保留，因为移动端装机即用体验对 GameFi 用户留存很关键。
4. **legacy `/game` 的最终命运**：2026 Q2 末考虑是否彻底下线？还是作为"怀旧入口"长期保留？
5. **品牌视觉统一性**：`clawnfaterminal.xyz` 现有站的设计语言是否继续沿用？还是借这次重构重建 brand book？

---

## 10. 收尾

这次重构的本质不是"换一套 UI"，而是**把产品的叙事主语从玩法切换到 NFA 本体**。

你的合约、runtime、autonomy 栈已经让每只 NFA 真正成为**有身份、有钱、有记忆、有行动力的链上角色**——只是现在的前端把它们拆成了"可以挖矿的对象 + 可以 PK 的对象 + 可以配置 autonomy 的对象"。新前端要做的只是让它们以**完整的"一个 AI 伙伴"**的形态出现在用户面前。

6–8 周的工作量、不动底层、不换栈、Vercel 继续用、runtime 继续跑——风险可控，收益是从"又一个 BNB 链 GameFi"定位跳到"带记忆和自治的 AI-native agent 世界"定位。这个重定位是你们真正值得占的市场位。

---

*Next step 建议：先基于本文档做一个可点击的 Figma 原型（Phase 0），在开发开始前对齐团队视觉和交互细节。我可以继续协助你写 Figma 结构说明、BFF 的 OpenAPI schema、或首屏的 React 组件骨架代码。*
