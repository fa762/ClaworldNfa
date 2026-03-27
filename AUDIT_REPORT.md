# ClawWorld 智能合约安全审计报告

> 审计日期：2026-03-27
> 审计范围：contracts/ 目录下全部 10 个 Solidity 合约
> 审计方法：人工逐行代码审查
> Solidity 版本：^0.8.20（自带溢出保护）
> 框架：OpenZeppelin UUPS Upgradeable

---

## 综合评分：78 / 100（良好）

| 维度 | 得分 | 满分 | 说明 |
|------|------|------|------|
| 访问控制 | 16 | 20 | 角色体系完善，部分 setter 缺少零地址检查 |
| 重入防护 | 19 | 20 | 全面使用 ReentrancyGuard + CEI 模式 |
| 经济安全 | 12 | 20 | CLW 通胀风险、ownerCompleteTypedTask 可被滥用 |
| 随机数安全 | 8 | 10 | commit-reveal 正确，链上熵源可被矿工操纵（游戏可接受） |
| 升级安全 | 9 | 10 | UUPS + storage gap + disableInitializers，规范 |
| 代码质量 | 14 | 20 | 测试覆盖好（229 passing），但缺少 NatSpec、部分重复状态 |

---

## 一、审计范围

| # | 合约 | 路径 | 行数 |
|---|------|------|------|
| 1 | ClawNFA | contracts/core/ClawNFA.sol | 428 |
| 2 | ClawRouter | contracts/core/ClawRouter.sol | 638 |
| 3 | DepositRouter | contracts/core/DepositRouter.sol | 158 |
| 4 | PersonalityEngine | contracts/core/PersonalityEngine.sol | 211 |
| 5 | GenesisVault | contracts/skills/GenesisVault.sol | 560 |
| 6 | TaskSkill | contracts/skills/TaskSkill.sol | 237 |
| 7 | PKSkill | contracts/skills/PKSkill.sol | 565 |
| 8 | MarketSkill | contracts/skills/MarketSkill.sol | 349 |
| 9 | WorldState | contracts/world/WorldState.sol | 279 |
| 10 | ClawOracle | contracts/world/ClawOracle.sol | 112 |

---

## 二、发现问题汇总

### 严重（Critical）— 0 个

无。

### 高危（High）— 2 个

#### H-1：CLW 虚拟余额无上限增发，提现依赖实际代币余额

**位置**：`ClawRouter.sol:389-393` (`addCLW`)、`TaskSkill.sol:99-103`

**描述**：`addCLW()` 仅增加 `clwBalances[nfaId]` 映射值，不需要实际转入 CLW 代币。任务奖励、PK 奖励都通过 `addCLW` 凭空增加余额。但 `claimWithdrawCLW()` (L286) 调用 `clwToken.safeTransfer()` 尝试转出真实代币。

**风险**：如果合约中实际 CLW 代币余额 < 所有虚拟余额之和，后提现的用户将失败。系统存在「挤兑」风险。

**建议**：
- 明确文档说明 CLW 是积分制还是需要代币背书
- 如果需要代币背书，`addCLW` 应从 treasury/vault 转入等额真实代币
- 或者取消 `claimWithdrawCLW`，CLW 余额仅作为链上积分

---

#### H-2：`ownerCompleteTypedTask` 经济通胀漏洞

**位置**：`TaskSkill.sol:159-191`

**描述**：NFA owner 可以每 4 小时自行提交任务，参数由调用者自己设定：
- `clwReward` 最高 100 CLW
- `matchScore` 最高 20000（2x）
- `worldMul` 默认 10000（1x）

实际每次最高获得：`100 * 20000 * 10000 / (10000 * 10000) = 200 CLW`

每天最多 6 次 = **1200 CLW/天**，无需任何外部验证。

**风险**：玩家可以写脚本自动刷任务，无限通胀 CLW 余额。尽管有 4 小时冷却，但仍然是一个无成本的印钞机。

**建议**：
- 降低 owner 模式上限（如 max 20 CLW/次，matchScore 上限 10000）
- 或增加 CLW 消耗门槛（完成任务需要先花费一定 CLW）
- 或改为需要 operator 签名验证

---

### 中危（Medium）— 6 个

#### M-1：GenesisVault 随机数可被矿工操纵

**位置**：`GenesisVault.sol:233-235`

```solidity
bytes32 seed = keccak256(abi.encodePacked(
    blockhash(block.number - 1), salt, msg.sender, mintedCount
));
```

**描述**：属性生成使用 `blockhash(block.number - 1)`，BSC 验证者可以选择性出块来操纵 Mythic/Legendary 龙虾的 DNA 分配。

**风险**：高稀有度龙虾（价值 1.88-3.88 BNB）的属性可被操纵。Common 龙虾影响较小。

**建议**：对于游戏来说可接受（已在设计决策中说明不用 VRF），但建议在 README 中明确声明。

---

#### M-2：`setVaultURI` 可覆盖 NFT 元数据

**位置**：`ClawNFA.sol:260-268`

```solidity
function setVaultURI(uint256 tokenId, string memory vaultURI, bytes32 vaultHash) external {
    require(msg.sender == minter || msg.sender == owner(), "Not minter or owner");
    require(bytes(agentMetadata[tokenId].vaultURI).length == 0, "URI already set");
```

**描述**：虽然有 `URI already set` 检查，但 minter（GenesisVault）和 owner 都能调用。如果 minter 地址被更换为恶意合约，可以在用户 mint 后抢先设置 URI。

**风险**：在 URI 未设置的窗口期，恶意 minter 可以设置虚假的 IPFS URI。

**建议**：考虑仅允许 `onlyOwner` 调用，或添加 tokenOwner 确认机制。

---

#### M-3：PersonalityEngine 与 ClawRouter 状态重复

**位置**：
- `ClawRouter.sol:135-136`：`personalityChangesThisMonth`、`personalityMonthStart`
- `PersonalityEngine.sol:49-50`：同名映射

**描述**：两个合约各自维护月度性格变化计数器。实际只有 PersonalityEngine 的被使用（ClawRouter 的是重构前遗留），但增加了认知负担和潜在的混淆风险。

**建议**：ClawRouter 中的两个 mapping 标注 `DEPRECATED` 注释，或在下次升级时移除逻辑引用。

---

#### M-4：WorldState 乘数无上限

**位置**：`WorldState.sol:117-141` (`proposeWorldState`)

**描述**：`rewardMultiplier`、`dailyCostMultiplier` 等参数无上限校验。Owner 可以提议设为极大值（如 `type(uint256).max`），24h 后执行。

**风险**：如果 owner 密钥泄露，攻击者可以将 dailyCostMultiplier 设为天文数字，24h 后所有龙虾迅速进入休眠。

**建议**：增加合理范围限制，如 `require(_rewardMul <= 50000 && _rewardMul >= 1000)`（0.1x ~ 5x）。

---

#### M-5：MarketSkill 缺少 treasury 零地址检查

**位置**：`MarketSkill.sol:65-72`

**描述**：`initialize` 和后续使用中未检查 `treasury != address(0)`。如果 treasury 为零地址，交易手续费将发送到 `address(0)` 导致 BNB 永久丢失（虽然 pull-over-push 会将失败的转账存入 pendingWithdrawals）。

**建议**：在 `initialize` 中添加 `require(_treasury != address(0))`。

---

#### M-6：`processUpkeep` 无权限限制，可被恶意调用

**位置**：`ClawRouter.sol:310`

**描述**：任何人都可以调用 `processUpkeep(nfaId)` 来触发某个龙虾的日常消耗。虽然不会导致资金损失（只是时间推进），但攻击者可以在用户充值前抢先调用，确保龙虾进入休眠。

**风险**：配合 MEV，攻击者可以 front-run 用户的 `depositCLW` 交易，先调用 `processUpkeep` 使龙虾休眠。

**建议**：由于休眠需要 72h 零余额，实际利用难度较大。可在文档中说明或限制为 keeper/owner 调用。

---

### 低危（Low）— 7 个

#### L-1：`cancelWithdraw` 无事件

**位置**：`ClawRouter.sol:291-300`

**描述**：取消提现操作没有 emit 事件，链下无法追踪。

---

#### L-2：拍卖可被 front-run

**位置**：`MarketSkill.sol:204-234`

**描述**：出价交易在 mempool 中可见，竞争者可以 front-run 出更高的价。这是 DEX/拍卖的常见问题。

**建议**：游戏场景可接受。可考虑 commit-reveal 竞拍，但会增加复杂度。

---

#### L-3：ClawOracle 依赖可信 fulfiller

**位置**：`ClawOracle.sol:72-88`

**描述**：Oracle 结果完全信任 fulfiller 地址，无链上验证机制。

**建议**：当前设计合理（AI 预言机本身就需要链下计算）。主网上线时确保 fulfiller 密钥安全管理。

---

#### L-4：`tokensOfOwner` 无上限循环

**位置**：`ClawNFA.sol:369-376`

**描述**：如果某地址持有大量 NFT，此函数会消耗大量 gas，可能超出 block gas limit。

**建议**：仅用于 view 调用（不消耗 gas），但前端应做分页。

---

#### L-5：PKSkill 平局规则偏向 nfaA

**位置**：`PKSkill.sol:388`

```solidity
if (damageA >= damageB) {  // >= 意味着平局时 A 赢
    winner = m.nfaA;
```

**描述**：平局时创建者（nfaA）自动获胜，给创建者先手优势。

**建议**：平局时退还双方 stake，或使用 entropy 决定。

---

#### L-6：DepositRouter `approve` 每次调用而非一次性 infinite approve

**位置**：`DepositRouter.sol:98`

**描述**：每次 buyAndDeposit 都调用 `clwToken.approve(address(router), clwReceived)`。更高效的方式是一次性 approve `type(uint256).max`。

**建议**：小优化，不影响安全。

---

#### L-7：`refundExpired` 不使用 pull-over-push

**位置**：`GenesisVault.sol:304-317`

**描述**：`refundExpired()` 直接 `require(ok, "Refund failed")`，如果用户地址是无法接收 BNB 的合约，BNB 将被永久锁定。而 `_reveal()` 中的退款正确使用了 pull-over-push。

**建议**：统一使用 `pendingRefunds` 模式。

---

### 信息（Informational）— 4 个

#### I-1：已废弃函数保留得当
`ClawRouter` 中 `buyAndDeposit`/`flapBuyAndDeposit` 等函数正确使用 `revert("DEPRECATED")` 处理，防止误调用。✅

#### I-2：Storage Gap 一致
所有 10 个可升级合约均保留 `uint256[40] private __gap`（TaskSkill 为 33，因为新增了字段）。✅

#### I-3：事件索引合理
关键事件参数使用了 `indexed`，便于链下过滤查询。✅

#### I-4：缺少 NatSpec 文档
大部分函数缺少 `@param`、`@return` NatSpec 注释。建议在主网发布前补全。

---

## 三、各合约详细评分

| 合约 | 安全 | 设计 | 代码 | 总分 | 等级 |
|------|------|------|------|------|------|
| ClawNFA | 8/10 | 8/10 | 8/10 | 24/30 | A- |
| ClawRouter | 7/10 | 7/10 | 7/10 | 21/30 | B+ |
| DepositRouter | 9/10 | 8/10 | 8/10 | 25/30 | A |
| PersonalityEngine | 8/10 | 7/10 | 8/10 | 23/30 | A- |
| GenesisVault | 7/10 | 8/10 | 8/10 | 23/30 | A- |
| TaskSkill | 6/10 | 6/10 | 7/10 | 19/30 | B |
| PKSkill | 8/10 | 8/10 | 7/10 | 23/30 | A- |
| MarketSkill | 8/10 | 8/10 | 8/10 | 24/30 | A- |
| WorldState | 7/10 | 8/10 | 8/10 | 23/30 | A- |
| ClawOracle | 8/10 | 7/10 | 8/10 | 23/30 | A- |

---

## 四、优秀实践 ✅

1. **UUPS 升级模式规范**：所有合约正确使用 `_disableInitializers()`、`onlyOwner` 守护 `_authorizeUpgrade`
2. **ReentrancyGuard 全面覆盖**：ClawNFA/ClawRouter/DepositRouter/GenesisVault/MarketSkill/PKSkill 所有涉及外部调用的函数都用了 `nonReentrant`
3. **Pull-over-push 退款模式**：GenesisVault 和 MarketSkill 正确实现了 `pendingRefunds`/`pendingWithdrawals` + `claimRefund()`
4. **CEI 模式**：所有合约遵循 Checks-Effects-Interactions 模式
5. **Commit-Reveal 防前跑**：GenesisVault mint 和 PKSkill 策略选择都使用了 commit-reveal
6. **提现冷却期**：CLW 提现需 6 小时冷却，防止瞬间提取
7. **WorldState Timelock**：世界状态修改需 24 小时时间锁，给玩家反应时间
8. **Skill 白名单**：ClawRouter 通过 `authorizedSkills` 映射控制哪些合约可以操作余额
9. **休眠/复活机制**：72h 零余额 → 休眠，充值 → 自动复活，设计巧妙
10. **Solidity 0.8.20**：自带算术溢出保护，无需 SafeMath

---

## 五、建议优先修复顺序

| 优先级 | 编号 | 修复建议 |
|--------|------|----------|
| 🔴 P0 | H-2 | 降低 ownerCompleteTypedTask 的奖励上限，或增加消耗门槛 |
| 🔴 P0 | H-1 | 明确 CLW 积分制/代币制模型，确保提现不会挤兑 |
| 🟡 P1 | M-4 | WorldState 参数增加上下限校验 |
| 🟡 P1 | M-5 | MarketSkill initialize 增加 treasury 零地址检查 |
| 🟡 P1 | L-7 | refundExpired 改用 pull-over-push |
| 🟢 P2 | M-3 | ClawRouter 废弃字段添加 DEPRECATED 注释 |
| 🟢 P2 | L-1 | cancelWithdraw 添加事件 |
| 🟢 P2 | L-5 | PK 平局改为退还 stake |
| ⚪ P3 | I-4 | 补全 NatSpec 文档 |

---

## 六、结论

ClawWorld 合约整体质量**良好**，架构设计合理，安全基础扎实。主要亮点是全面的重入防护、规范的升级模式和巧妙的游戏经济设计。

**两个高危问题需在主网上线前解决**：
1. CLW 虚拟余额的代币背书问题
2. ownerCompleteTypedTask 的通胀控制

其余中低风险问题可在迭代中逐步修复。对于一个 AI NFT 游戏项目来说，当前安全水平已超过大多数同类项目。

---

*本报告基于静态代码审查，不包含形式化验证或动态模糊测试。建议主网上线前进行专业第三方审计。*
