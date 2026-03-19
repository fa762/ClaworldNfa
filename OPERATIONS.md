# CLAW WORLD 运维操作手册

> 本文档记录日常升级、部署、更新的标准操作流程。每次使用 Claude Code 对话时可参考本文档。

---

## 目录

1. [环境准备](#1-环境准备)
2. [合约升级（Fetch 方式）](#2-合约升级fetch-方式)
3. [合约全新部署](#3-合约全新部署)
4. [前端构建与部署](#4-前端构建与部署)
5. [Git 工作流](#5-git-工作流)
6. [BSC Testnet 合约地址表](#6-bsc-testnet-合约地址表)
7. [常见问题](#7-常见问题)

---

## 1. 环境准备

### 拉取最新代码

```bash
git fetch origin claude/review-project-adjustments-eYt2g
git checkout claude/review-project-adjustments-eYt2g
git pull origin claude/review-project-adjustments-eYt2g
```

### 安装依赖

```bash
# 合约项目（根目录）
npm install

# 前端项目
cd frontend && npm install
```

### 环境变量

根目录 `.env` 需要：
```
PRIVATE_KEY=0x你的私钥
```

前端 `frontend/.env.testnet` 已包含所有合约地址，一般不需要改动。

---

## 2. 合约升级（Fetch 方式）

> **重要：始终使用 fetch 方式升级**，不使用 `hardhat run --network` 方式（后者有 HTTP 兼容性问题）。

### 升级 GenesisVault

```bash
# 第一步：编译合约
npx hardhat compile

# 第二步：用 fetch 方式升级
npx ts-node scripts/upgrade-vault-fetch.ts
```

脚本会自动：
1. 读取 `.env` 中的 `PRIVATE_KEY`
2. 使用 `BSC_TESTNET_RPC`（默认 `https://bsc-testnet-rpc.publicnode.com`）
3. 部署新的 implementation 合约
4. 调用 proxy 的 `upgradeTo()` 指向新 implementation

### 升级其他合约

如果需要升级 ClawNFA、ClawRouter 等其他合约，需要创建对应的 fetch 升级脚本。模板如下：

```bash
# 复制 GenesisVault 的 fetch 升级脚本作为模板
cp scripts/upgrade-vault-fetch.ts scripts/upgrade-<合约名>-fetch.ts
```

然后修改脚本中的：
- `PROXY_ADDRESS` → 对应合约的 proxy 地址
- `artifactPath` → 对应合约的编译产物路径

---

## 3. 合约全新部署

全新部署分三个阶段，必须按顺序执行：

### Phase 1：核心合约

```bash
TREASURY_ADDRESS=<国库地址> \
npx hardhat run scripts/deploy-phase1.ts --network bscTestnet
```

部署：ClawNFA + ClawRouter + MockCLW

### Phase 2：金库与世界状态

```bash
NFA_ADDRESS=<phase1输出> \
ROUTER_ADDRESS=<phase1输出> \
CLW_TOKEN_ADDRESS=<phase1输出> \
npx hardhat run scripts/deploy-phase2.ts --network bscTestnet
```

部署：GenesisVault + WorldState + ClawOracle

### Phase 3：技能合约

```bash
NFA_ADDRESS=<phase1输出> \
ROUTER_ADDRESS=<phase1输出> \
WORLD_STATE_ADDRESS=<phase2输出> \
TREASURY_ADDRESS=<国库地址> \
npx hardhat run scripts/deploy-phase3.ts --network bscTestnet
```

部署：TaskSkill + PKSkill + MarketSkill

> **注意**：全新部署后需要更新 `frontend/.env.testnet` 和 `frontend/.env.local` 中的所有合约地址。

---

## 4. 前端构建与部署

### Testnet 构建

```bash
cd frontend
npm run build:testnet
```

### 本地开发

```bash
cd frontend
npm run dev
```

### Mainnet 构建

```bash
cd frontend
npm run build:mainnet
```

---

## 5. Git 工作流

### 开发分支

主要开发在 `claude/review-project-adjustments-eYt2g` 分支上进行。

### 提交代码

```bash
git add <文件>
git commit -m "描述修改内容"
git push -u origin claude/review-project-adjustments-eYt2g
```

### 拉取最新代码

```bash
git pull origin claude/review-project-adjustments-eYt2g
```

---

## 6. BSC Testnet 合约地址表

| 合约 | Proxy 地址 |
|------|-----------|
| ClawNFA | `0x1c69be3401a78CFeDC2B2543E62877874f10B135` |
| ClawRouter | `0xA7Ee12C5E9435686978F4b87996B4Eb461c34603` |
| WorldState | `0x3479E9d103Ea28c9b3f94a73d3cf7bC9187e4F7d` |
| GenesisVault | `0x6d176022759339da787fD3E2f1314019C3fb7867` |
| CLW Token | `0xCdb158C1A1F0e8B85d785172f2109bC53e2F41FC` |
| Flap Portal | `0x9F07D34F55146FE59495A9C5694e223b531Ff7C5` |
| PancakeRouter | `0x4766aDF17656c7A6046804fd06e930C17Ee32992` |

> 这些地址也记录在 `frontend/.env.testnet` 中。

---

## 7. 常见问题

### Q: hardhat run 报 HTTP/网络错误？
**A**: 不要用 `npx hardhat run --network bscTestnet`，改用 fetch 方式的脚本：
```bash
npx ts-node scripts/upgrade-vault-fetch.ts
```

### Q: 编译报错找不到合约？
**A**: 确认你在项目根目录（`/home/user/clawworld`），然后运行 `npx hardhat compile`。

### Q: 升级后前端没变化？
**A**: 升级合约不会改变 proxy 地址，前端不需要更新地址。但如果改了 ABI（新增函数），需要重新生成前端的 ABI 文件。

### Q: 想升级 ClawNFA 而不是 GenesisVault？
**A**: 基于 `upgrade-vault-fetch.ts` 创建新脚本，修改 proxy 地址和 artifact 路径即可。

### Q: push 失败 403？
**A**: 确认分支名以 `claude/` 开头并包含正确的 session id。重试时使用指数退避（2s, 4s, 8s, 16s）。

---

## 快速参考：一次典型的合约升级流程

```bash
# 1. 拉取代码
git pull origin claude/review-project-adjustments-eYt2g

# 2. 安装依赖（如果有新增）
npm install

# 3. 修改合约代码...

# 4. 编译
npx hardhat compile

# 5. 升级（fetch 方式）
npx ts-node scripts/upgrade-vault-fetch.ts

# 6. 提交并推送
git add .
git commit -m "升级 GenesisVault: 描述修改内容"
git push -u origin claude/review-project-adjustments-eYt2g
```
