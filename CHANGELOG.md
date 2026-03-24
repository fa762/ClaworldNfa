# Claw World Changelog

## v2.1.0 — Phase 4 Upgrade (2026-03-24)

### 合约安全加固 (Phase 1)

**PKSkill 熵源增强**
- `_checkMutation()` 随机数混入用户 salt（来自 commit-reveal）+ `gasleft()` + 全局 `entropyNonce`
- PKMatch 结构体新增 `saltA`/`saltB` 字段，在 `revealStrategy()` 时自动存储
- 基因选择使用独立 hash 避免与概率判断相关

**ClawRouter 熵源增强**
- `_levelUpGeneBoost()` 混入龙虾自身 5 维性格 + 2 突变槽 + XP + `gasleft()` + 全局 `geneBoostNonce`

**PKSkill Bug 修复**
- 新增 `cancelJoinedMatch()` — 修复了双方加入 PK 后都不提交策略导致 stake 永久锁定的 Bug
- 条件：JOINED 阶段 + 超过 COMMIT_TIMEOUT (1h)

### WorldState 时间锁 (Phase 2)

- 原 `updateWorldState()` 替换为 `proposeWorldState()` → 等待 24h → `executeWorldState()` 流程
- 新增 `cancelProposal()` 取消待执行提案
- `autoUpdate()` 保持不变（算法驱动，1h 频率限制）
- 玩家可通过 `pendingState()` 查看即将生效的参数变更

### ClawRouter 重构 (Phase 3)

**DepositRouter (新合约)**
- 从 ClawRouter 提取 BNB→CLW 买入+存款逻辑
- 支持 PancakeSwap (毕业后) 和 Flap Portal (毕业前)
- 作为 ClawRouter 的 authorizedSkill 运作

**PersonalityEngine (新合约)**
- 从 ClawRouter 提取性格演化和职业派生逻辑
- 月度上限 (±5/维度/月)、值域 [0,100] clamp
- ClawRouter 保留 `evolvePersonality()` 作为 facade（向后兼容）

**ClawRouter 变更**
- DEX 相关变量标记为 DEPRECATED（存储槽位保留）
- `buyAndDeposit()`/`flapBuyAndDeposit()` 改为 revert "DEPRECATED: Use DepositRouter"
- 新增 `setPersonalityByEngine()` 供 PersonalityEngine 回写

### 事件索引优化 (Phase 5)

- `PKSkill.MatchSettled`: winner, loser 加 indexed
- `ClawRouter.CLWSpent/CLWRewarded`: skill 地址加 indexed

### OpenClaw 游戏适配层 (Phase 4)

新增 `openclaw/` 目录：
- `commandRouter.ts` — 命令解析 (/status, /pk, /task, /market, /deposit, /help)
- `formatter.ts` — 三格式输出 (rich/telegram/plain)
- `contracts.ts` — 合约交互封装 (ethers.js)
- `dialogue.ts` — AI 对话集成 (性格化 system prompt)
- `types.ts` — 共享类型定义

### 测试网部署地址 (BSC Testnet)

| 合约 | 地址 | 状态 |
|------|------|------|
| ClawNFA | 0x1c69be3401a78CFeDC2B2543E62877874f10B135 | 升级 |
| ClawRouter | 0xA7Ee12C5E9435686978F4b87996B4Eb461c34603 | 升级 |
| WorldState | 0x3479E9d103Ea28c9b3f94a73d3cf7bC9187e4F7d | 升级 |
| GenesisVault | 0x6d176022759339da787fD3E2f1314019C3fb7867 | 不变 |
| CLW Token | 0xCdb158C1A1F0e8B85d785172f2109bC53e2F41FC | 不变 |
| TaskSkill | 0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E | 新部署 |
| PKSkill | 0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A | 新部署 |
| MarketSkill | 0x254EF8451dFF592a295A08a75f05Af612C39c46d | 新部署 |
| DepositRouter | 0xd61Cc50b2d15cC58b24c0f7B6cC83bbc0b0fB448 | 新部署 |
| PersonalityEngine | 0xab8F67949bf607181ca89E6aAaF401cFeA4dac0e | 新部署 |

### 部署经验

1. **BSC Testnet RPC 不稳定** — `data-seed-prebsc-*.binance.org` 和 `bsc-testnet-rpc.publicnode.com` 经常连接重置。推荐用 `bsc-testnet.bnbchain.org`
2. **代理环境部署** — ethers.js v5 不读 `HTTP_PROXY` 环境变量。解决方案：启动本地 RPC 代理服务器 (`scripts/local-rpc-proxy.js`)，hardhat config 指向 `http://127.0.0.1:8546`
3. **UUPS 存储布局** — 升级合约时废弃的状态变量不能删除，必须保留为 dead slot 以保持存储布局兼容
4. **PersonalityEngine 权限** — NFA 的 `updateLearningTree()` 只允许 logic address (router) 调用，因此 PersonalityEngine 不能直接更新学习树，需要通过 Router facade 转发

### 测试结果

- 206 个测试全部通过
- 所有合约大小均在 24KB 限制内
