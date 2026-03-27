# Claw System — 智能合约审计报告

> 涵盖全部 10 个合约：ClawNFA · ClawRouter · DepositRouter · PersonalityEngine · GenesisVault · MarketSkill · PKSkill · TaskSkill · ClawOracle · WorldState
>
> 综合评分：**7.9 / 10**

---

## 目录

1. [优先级总览](#1-优先级总览)
2. [ClawNFA](#2-clawnfa)
3. [ClawRouter](#3-clawrouter)
4. [DepositRouter](#4-depositrouter)
5. [PersonalityEngine](#5-personalityengine)
6. [GenesisVault](#6-genesisvault)
7. [MarketSkill](#7-marketskill)
8. [PKSkill](#8-pkskill)
9. [TaskSkill](#9-taskskill)
10. [ClawOracle](#10-claworacle)
11. [WorldState](#11-worldstate)
12. [跨合约系统性问题](#12-跨合约系统性问题)
13. [亮点总结](#13-亮点总结)

---

## 1. 优先级总览

| 优先级 | 合约 | 问题 |
|--------|------|------|
| 🔴 高危 | DepositRouter | `minAmountOut = 0`，无滑点保护，可被三明治攻击 |
| 🔴 高危 | GenesisVault | 随机数基于 `blockhash`，可被矿工/验证者操控 |
| 🔴 高危 | WorldState | 瞬时价格读取，可被闪贷操控触发极端世界参数 |
| 🔴 高危 | WorldState | `autoUpdate` 绕过 24h timelock 直接写参数 |
| 🔴 高危 | ClawOracle | 缺少 consumer 回调，链上合约无法响应 AI 结果 |
| 🔴 高危 | ClawOracle | `REQUEST_TIMEOUT` 定义但从未执行 |
| 🟠 中危 | ClawNFA | `agentStates.balance` 与合约实际 ETH 余额脱钩 |
| 🟠 中危 | ClawNFA | `setVaultURI` 可任意覆盖任何 token 元数据 |
| 🟠 中危 | ClawRouter | `addCLW()` 凭空增加余额，无实际 token 转入校验 |
| 🟠 中危 | PersonalityEngine | `setPersonalityEngine()` 无 timelock，可即时替换为恶意引擎 |
| 🟠 中危 | GenesisVault | `_distributeDNA` 截断丢失总和，高稀有度属性被压低 |
| 🟠 中危 | PKSkill | `recommitStrategy` 允许创建者在看到对手 nfaId 后重新选策略 |
| 🟠 中危 | TaskSkill | operator 路径无奖励上限，被攻陷后可无限增发 CLW/XP |
| 🟠 中危 | WorldState | 繁荣模式未重置 `pkStakeLimit`，状态永久停留在冬季值 |
| 🟡 低危 | ClawNFA | logic address 零地址未校验 |
| 🟡 低危 | ClawNFA | `_burn` 未清理 `agentMetadata` 和 learning tree mapping |
| 🟡 低危 | ClawRouter | `grit` 减费公式缺上限校验（grit=200 费用归零） |
| 🟡 低危 | ClawRouter | `zeroBalanceTimestamp` 补充余额后未及时清零 |
| 🟡 低危 | DepositRouter | `approve()` 应改用 `safeIncreaseAllowance` |
| 🟡 低危 | PersonalityEngine | 缺少 `__gap`，升级时存储槽可能被覆盖 |
| 🟡 低危 | PKSkill | Legacy 与 Arena 两套流程共享状态机，边界条件复杂 |
| 🟡 低危 | ClawOracle | `reason()` 无访问控制，任意地址可污染链上数据 |
| 🟡 低危 | ClawOracle | `prompt` 直接存 storage，gas 成本不可控 |
| 🟡 低危 | WorldState | `EVENT_GOLDEN_AGE` 定义但从未使用 |
| 🟡 低危 | WorldState | `clwToken` 未设置时价格方向判断错误 |

---

## 2. ClawNFA

**评分：7.8 / 10**

### 🟠 ETH 余额脱钩（中危）

`agentStates[tokenId].balance` 是一个独立 mapping，与合约账户实际持有的 ETH 完全脱钩。`fundAgent` 将 `msg.value` 累计到 mapping，但 ETH 实际存放在合约账户里。若多个 agent 同时存款，任意 token 的 owner 只要自己的 mapping 余额充足，理论上可以提走其他 agent 的资金。

**建议：** 考虑用独立的 per-token escrow 合约隔离资金，或引入全局 accounting 校验（`sum(agentStates[*].balance) <= address(this).balance`）。

---

### 🟠 setVaultURI 权限过宽（中危）

```solidity
function setVaultURI(uint256 tokenId, string memory vaultURI, bytes32 vaultHash) external {
    require(msg.sender == minter || msg.sender == owner(), "Not minter or owner");
    // ...
    _setTokenURI(tokenId, vaultURI);
}
```

minter 或 owner 可随时覆盖任意 token 的 `tokenURI`，持有者买入后元数据可能被项目方任意修改，违背 NFT 不变性预期。

**建议：** 加 24h timelock，或改为只允许修改未被设置过的 token（`require(bytes(agentMetadata[tokenId].vaultURI).length == 0)`）。

---

### 🟡 logic address 零地址未校验（低危）

`setLogicAddress` 和 `_mintAgent` 都允许传入 `address(0)`，导致依赖 `logicAddress` 的 `setAgentStatusByRouter` 和 `updateLearningTree` 的 `require` 检查永久失效。

**建议：**
```solidity
require(newLogicAddress != address(0), "Zero address");
```

---

### 🟡 _burn 未清理 mapping（低危）

`_burn` 只检查 `balance == 0`，销毁后 `agentMetadata`、`learningTreeRoot`、`learningVersion`、`lastLearningUpdate` 等 mapping 数据全部残留，既浪费 storage 也可能引发逻辑混乱。

**建议：** 在 `_burn` 中补充：
```solidity
delete agentMetadata[tokenId];
delete agentStates[tokenId];
delete learningTreeRoot[tokenId];
delete learningVersion[tokenId];
delete lastLearningUpdate[tokenId];
```

---

### 🟡 receive() 拒绝但 ETH 可能被锁（低危）

合约 `receive()` 直接 `revert`，但 `withdrawFromAgent` 用低级 `call` 转出 ETH。若目标地址是合约且 fallback 消耗 gas 超限，ETH 会被永久锁死，没有任何 admin 救援路径。

**建议：** 补充 owner 紧急提款函数，或改用 push 转账失败后记录 pending refund（pull-over-push 模式）。

---

## 3. ClawRouter

**评分：7.5 / 10**

### 🟠 addCLW 凭空增加余额（中危）

```solidity
function addCLW(uint256 nfaId, uint256 amount) external onlySkill lobsterExists(nfaId) {
    clwBalances[nfaId] += amount;
    // ...
}
```

没有任何实际 token 转入的校验。整个机制依赖 skill 合约在调用前已将 token 转给 ClawRouter，但合约本身不验证这一点。任意 skill 合约 bug 或被攻击都可以无限增发余额。

**建议：** 改为让 `addCLW` 自己做 `safeTransferFrom`，明确要求 skill 合约先 approve：
```solidity
function addCLW(uint256 nfaId, uint256 amount) external onlySkill lobsterExists(nfaId) {
    clwToken.safeTransferFrom(msg.sender, address(this), amount);
    clwBalances[nfaId] += amount;
    // ...
}
```

---

### 🟡 grit 减费公式缺上限（低危）

```solidity
uint256 cost = baseCost * (200 - uint256(grit)) / 200;
```

`grit` 合法范围 0–100，代入后费用最低 50%。但若未来升级引入 `grit > 100` 的突变，`grit = 200` 时费用归零。

**建议：**
```solidity
uint256 effectiveGrit = grit > 100 ? 100 : grit;
uint256 cost = baseCost * (200 - uint256(effectiveGrit)) / 200;
```

---

### 🟡 zeroBalanceTimestamp 未及时清零（低危）

`depositCLW` 调用 `_checkRevival`，但 `_checkRevival` 只在 `clwBalances > 0 && !active` 时才清零 `zeroBalanceTimestamp`。若 lobster 是 active 状态但余额短暂归零后被补充，时间戳不会被清，可能误触发 dormancy 计时。

**建议：** 在余额从零变为非零时无条件清零时间戳：
```solidity
if (clwBalances[nfaId] > 0 && zeroBalanceTimestamp[nfaId] != 0) {
    zeroBalanceTimestamp[nfaId] = 0;
}
```

---

## 4. DepositRouter

**评分：8.2 / 10**

### 🔴 minAmountOut = 0，无滑点保护（高危）

```solidity
uint256[] memory amounts = IDRPancakeRouter(pancakeRouter).swapExactETHForTokens{value: msg.value}(
    0, path, address(this), block.timestamp + 300  // ← 0 = 无保护
);
```

在 BNB Chain 上，MEV bot 可以在用户 tx 前后各插入一笔交易（三明治攻击），几乎榨干用户存入的 BNB。

**建议：** 让调用者传入 `minAmountOut` 参数，或链下计算后作为参数传入：
```solidity
function buyAndDeposit(uint256 nfaId, uint256 minAmountOut) external payable nonReentrant {
    // ...
    IDRPancakeRouter(pancakeRouter).swapExactETHForTokens{value: msg.value}(
        minAmountOut, path, address(this), block.timestamp + 300
    );
}
```

---

### 🟡 approve 应改用 safeIncreaseAllowance（低危）

```solidity
clwToken.approve(address(router), clwReceived);
```

部分 ERC20（如 BSC 上的 USDT 变体）对非零到非零的 `approve` 会 revert。

**建议：**
```solidity
clwToken.safeIncreaseAllowance(address(router), clwReceived);
```

---

## 5. PersonalityEngine

**评分：8.0 / 10**

### 🟠 setPersonalityEngine 无 timelock（中危）

`ClawRouter.setPersonalityEngine()` 由 owner 单次调用即可生效，无任何延迟。因为 `setPersonalityByEngine()` 允许引擎直接写任意 lobster 的人格属性，owner 一旦替换为恶意合约，可立刻操控所有角色属性，对游戏经济造成毁灭性影响。

**建议：** 给 `setPersonalityEngine` 加 48h timelock，或要求多签（Gnosis Safe）批准。

---

### 🟡 缺少 __gap（低危）

`PersonalityEngine` 没有留 `uint256[N] private __gap`，未来升级新增状态变量时会覆盖 proxy 的存储槽。

**建议：**
```solidity
uint256[40] private __gap;
```

---

## 6. GenesisVault

**评分：7.5 / 10**

### 🔴 随机数可被矿工操控（高危）

```solidity
bytes32 seed = keccak256(abi.encodePacked(
    blockhash(block.number - 1), salt, msg.sender, mintedCount
));
```

`salt` 在 commit 阶段就已固定，`blockhash` 在 reveal 时才确定。BNB Chain 的验证者可以在同一区块内反复模拟 reveal，选择产生理想属性的 `blockhash` 后才广播。对 3.88 BNB 的 Mythic，攻击成本极低。

**建议：**
- 接入 Chainlink VRF 作为随机源
- 或将 seed 绑定到 commit 之后至少 2 个 epoch 的区块 hash（使攻击无法在同一区块完成）

---

### 🟠 _distributeDNA 截断丢失总和（中危）

```solidity
for (uint256 i = 0; i < 4; i++) {
    dna[i] = segments[i] > 100 ? 100 : uint8(segments[i]);  // 截断但不补偿
}
```

截断后总和会小于 `totalTarget`，高稀有度 lobster 的实际属性总和被系统性压低。

**建议：** 截断后将超出部分重新分配给未满的基因：
```solidity
uint16 remaining = total;
for (uint256 i = 0; i < 4; i++) {
    uint16 val = segments[i] > 100 ? 100 : segments[i];
    dna[i] = uint8(val);
    remaining -= val;
}
// 将 remaining 按顺序补充给未满 100 的基因
```

---

### 🟠 ownerMint 无配额记录（中危）

owner 可以免费 mint，CLW airdrop 来自 `router.addCLW()`（凭空增发），项目方可借此稀释经济模型，且链上无法追溯 owner 累计 mint 了多少。

**建议：** 记录 owner mint 数量，并设置上限（如不超过总量的 5%）。

---

## 7. MarketSkill

**评分：8.5 / 10**

这是整套系统里写得最扎实的合约，无高危或中危问题。

### 亮点

- CEI 模式严格（状态写入先于所有外部调用）
- pull-over-push 退款覆盖买家、卖家、treasury 三条路径
- swap 无需信任双方，由合约原子完成 NFA 互换
- 拍卖有最低加价 5% 限制（防垃圾出价）
- `activeListingOf` 防止同一 NFA 被重复上架

---

## 8. PKSkill

**评分：7.8 / 10**

### 🟠 recommitStrategy 破坏公平性（中危）

Arena 模式允许创建者在 OPEN 阶段随时修改 commit hash。由于对手的 nfaId（及其公开属性 str/def/spd/vit）在 join 时就上链，创建者可以：
1. 看到对手 `nfaId` → 查链上属性
2. 计算最优克制策略
3. 调用 `recommitStrategy` 更新 hash
4. 再正常 reveal

这使创建者拥有事实上的"后手"优势，commit-reveal 的公平性保障被完全破坏。

**建议：** 一旦有 challenger join，禁止 `recommitStrategy`：
```solidity
function recommitStrategy(uint256 matchId, bytes32 newCommitHash) external {
    PKMatch storage m = matches[matchId];
    require(m.phase == Phase.OPEN, "Not open");
    require(m.nfaB == 0, "Challenger already joined");  // ← 新增
    // ...
}
```

---

### 🟡 两套流程共享状态机（低危）

Legacy 和 Arena 两套创建流程共享同一个 `Phase` 枚举，边界条件复杂（Arena 直接从 OPEN 跳到 COMMITTED 跳过 JOINED）。`cancelCommittedMatch` 与 `settle()` 的超时路径存在逻辑重叠，容易出现意外状态。

**建议：** 考虑废弃 Legacy 流程，统一使用 Arena 模式，或在 `PKMatch` 结构中加 `isArena` 标志位明确区分。

---

## 9. TaskSkill

**评分：7.2 / 10**

### 🟠 operator 路径无奖励上限（中危）

```solidity
function completeTask(uint256 nfaId, uint32 xpReward, uint256 clwReward, uint16 matchScore) external {
    require(operators[msg.sender], "Not authorized operator");
    // 无任何上限校验
    router.addCLW(nfaId, actualClw);
    router.addXP(nfaId, xpReward);
}
```

对比 `ownerCompleteTypedTask` 有 50 XP / 100 CLW 的 cap，operator 路径完全没有。一个被攻陷的 operator 地址可以单次调用 `clwReward = type(uint256).max`，令整个经济系统瞬间崩溃。

**建议：** 给 operator 路径加每次上限，并加 per-nfa 速率限制：
```solidity
uint256 public constant OPERATOR_MAX_CLW_PER_TASK = 10000 * 1e18;
uint256 public constant OPERATOR_MAX_XP_PER_TASK = 500;

require(clwReward <= OPERATOR_MAX_CLW_PER_TASK, "CLW cap exceeded");
require(xpReward <= OPERATOR_MAX_XP_PER_TASK, "XP cap exceeded");
```

---

## 10. ClawOracle

**评分：7.5 / 10**

### 🔴 缺少 consumer 回调（高危）

标准 oracle 模式（参考 Chainlink）的核心是 fulfill 时主动回调 consumer 合约。目前 `fulfillReasoning` 只写存储和 emit 事件，consumer 合约必须自己轮询——在链上合约间场景中，合约没有"等待"能力，AI 决策结果无法被链上逻辑使用。

**建议：** 定义回调接口并在 fulfill 时调用：
```solidity
interface IClawOracleConsumer {
    function onReasoningFulfilled(uint256 requestId, uint8 choice) external;
}

// 在 fulfillReasoning 末尾
if (req.consumer.code.length > 0) {
    try IClawOracleConsumer(req.consumer).onReasoningFulfilled(requestId, choice) {} catch {}
}
```

---

### 🔴 REQUEST_TIMEOUT 从未执行（高危）

```solidity
uint256 public constant REQUEST_TIMEOUT = 1 hours;
// 但 fulfillReasoning 中没有任何时间检查
```

`EXPIRED` 状态永远无法被设置，fulfiller 可以在任意时间回填任意历史请求。

**建议：**
```solidity
// 在 fulfillReasoning 中
require(block.timestamp <= req.timestamp + REQUEST_TIMEOUT, "Request expired");

// 新增 expireRequest 函数
function expireRequest(uint256 requestId) external {
    OracleRequest storage req = requests[requestId];
    require(req.status == RequestStatus.PENDING, "Not pending");
    require(block.timestamp > req.timestamp + REQUEST_TIMEOUT, "Not expired");
    req.status = RequestStatus.EXPIRED;
}
```

---

### 🟡 prompt 直接存 storage（低危）

任意长度的字符串完整写入链上 storage，gas 成本不可控，AI 推理上下文本就不适合上链。

**建议：** 只存储 prompt 的 IPFS CID 或 `keccak256(prompt)`，完整内容存链下：
```solidity
bytes32 promptHash;  // 替代 string prompt
```

---

### 🟡 reason() 无访问控制（低危）

任何地址都可以为任意 `nfaId` 发起推理请求，填入任意 prompt，污染链上数据并浪费 fulfiller 算力。

**建议：** 限制为授权 skill 合约或 lobster owner 才能调用：
```solidity
require(
    authorizedSkills[msg.sender] || nfa.ownerOf(nfaId) == msg.sender,
    "Not authorized"
);
```

---

## 11. WorldState

**评分：7.8 / 10**

### 🔴 瞬时价格可被闪贷操控（高危）

```solidity
function _getCLWPrice() internal view returns (uint256) {
    (uint112 reserve0, uint112 reserve1, ) = IPancakePair(pancakePair).getReserves();
    // 直接使用瞬时储备量，无 TWAP 保护
}
```

攻击流程（单个区块内完成）：
1. 闪贷大量 BNB 砸低 CLW 价格
2. 调用 `autoUpdate` → 触发 EVENT_WINTER（1.5x 奖励、0.8x 费用）
3. 批量完成任务/PK 榨取高额奖励
4. 归还闪贷

`1 hours` 速率限制对此完全无效。

**建议：** 使用 TWAP 替代瞬时价格。UniswapV2 风格的池子自带 `price0CumulativeLast`，可实现简单 TWAP；或接入 Chainlink price feed：
```solidity
// 使用 Chainlink（推荐）
AggregatorV3Interface priceFeed;
(, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
require(block.timestamp - updatedAt < 1 hours, "Stale price");
```

---

### 🔴 autoUpdate 绕过 timelock（高危）

手动更新需要 24h 等待，而 `autoUpdate` 可直接写入 `rewardMultiplier`、`dailyCostMultiplier`、`mutationBonus`——与手动路径写的是同一批变量，timelock 的保护形同虚设。

**建议：** 严格区分两类参数：
- timelock 保护"人工设置参数"（阈值、上下限）
- `autoUpdate` 只允许修改"价格联动参数"，并加硬边界约束：

```solidity
uint256 public constant AUTO_REWARD_MAX = 15000;   // 最高 1.5x
uint256 public constant AUTO_REWARD_MIN = 7000;    // 最低 0.7x
uint256 public constant AUTO_COST_MAX = 13000;
uint256 public constant AUTO_COST_MIN = 7000;
```

---

### 🟠 繁荣模式未重置 pkStakeLimit（中危）

进入 EVENT_WINTER 时 `pkStakeLimit` 降到 500 ether，但进入繁荣模式时代码里没有重置该值，导致上限永久停留在 500 ether（直到触发正常模式或手动修改）。

**建议：** 在 prosperity 分支补一行：
```solidity
pkStakeLimit = 1000 ether;  // 与正常模式保持一致
```

---

### 🟡 clwToken 未设置时价格方向错误（低危）

`_getCLWPrice` 用 `token0 == clwToken` 判断储备方向，若 `clwToken` 为 `address(0)`，`token0 == address(0)` 可能恰好为 true（某些池子的 token0 确实是 address(0) 排序的结果），导致价格方向判断错误，触发错误的世界事件。

**建议：** 在 `autoUpdate` 和 `_getCLWPrice` 入口处加校验：
```solidity
require(clwToken != address(0), "CLW token not set");
```

---

## 12. 跨合约系统性问题

### owner 单点控制风险

以下关键操作全部由单个 EOA owner 控制，无多签保护：
- `setPersonalityEngine()`：可立即替换人格引擎
- `setMinter()`：可更换 mint 权限
- `authorizeSkill()`：可授权任意合约调用 `addCLW`
- `setFulfiller()`：可替换 AI oracle 节点
- `_authorizeUpgrade()`：所有 10 个合约的升级权限

**建议：** 将 owner 替换为 Gnosis Safe 多签（建议 3-of-5），对升级和关键参数变更实施链上治理。

---

### addCLW 信任链薄弱

`ClawRouter.addCLW()` 是整个经济系统的增发入口，被授权的 skill 合约可无需提供实际 token 即可调用。被授权的合约列表包括：DepositRouter、PKSkill、TaskSkill、GenesisVault 等。任意一个合约出现漏洞，整个 CLW 经济都可能被无限增发。

**建议：** `addCLW` 改为要求调用方实际转入 token（见 ClawRouter 章节），从根本上消除这条攻击面。

---

## 13. 亮点总结

尽管存在上述问题，整套系统在工程化层面有相当多值得肯定的地方：

| 亮点 | 涉及合约 |
|------|---------|
| UUPS + `__gap` 升级保护规范 | 全部 10 个合约 |
| `SafeERC20` 全覆盖 | ClawRouter、DepositRouter |
| pull-over-push 退款模式 | MarketSkill、GenesisVault |
| commit-reveal 防前跑 | GenesisVault、PKSkill |
| 提款两步走 + 6h 冷却期 | ClawRouter |
| 24h timelock 手动更新 | WorldState |
| keeper 与 owner 职责分离 | WorldState |
| deprecated 函数直接 revert | ClawRouter |
| 职责拆分清晰（10 合约分层） | 整体架构 |
| CEI 模式严格（状态先于转账） | MarketSkill |
| 用户盐值 + 全局 nonce + gasleft 熵组合 | PKSkill |
| 三段价格区间联动游戏参数 | WorldState |

---

*审计基于代码静态分析，不涵盖部署配置、链下组件（OpenClaw nodes、oracle backend）及经济模型的动态博弈分析。建议在主网部署前进行专业第三方审计。*
