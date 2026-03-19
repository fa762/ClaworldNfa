/**
 * 全面诊断 ownerMint 回滚原因
 * 检查权限、存储状态、rarity cap 等
 *
 * Usage:
 *   npx ts-node scripts/check-permissions.ts
 */
import { ethers } from "ethers";

// 多个 RPC 备选，按顺序尝试
const RPC_URLS = [
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
  "https://bsc-testnet-rpc.publicnode.com",
];
const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER_ADDRESS = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const VAULT_ADDRESS = "0x6d176022759339da787fD3E2f1314019C3fb7867";

const RARITY_NAMES = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
const RARITY_CAPS = [860, 17, 6, 4, 1];

async function tryConnect(): Promise<ethers.providers.JsonRpcProvider> {
  for (const url of RPC_URLS) {
    try {
      const p = new ethers.providers.JsonRpcProvider(url);
      await p.getBlockNumber();
      console.log("RPC 连接成功:", url);
      return p;
    } catch {
      console.log("RPC 连接失败:", url);
    }
  }
  throw new Error("所有 RPC 节点都无法连接");
}

async function main() {
  const provider = await tryConnect();

  console.log("\n=== 1. 基本信息 ===\n");
  console.log("GenesisVault:", VAULT_ADDRESS);
  console.log("ClawNFA:     ", NFA_ADDRESS);
  console.log("ClawRouter:  ", ROUTER_ADDRESS);

  // ============================================
  // 2. 检查 Vault 存储的 nfa/router 地址
  // ============================================
  console.log("\n=== 2. Vault 内部存储的合约地址 ===\n");
  const vault = new ethers.Contract(
    VAULT_ADDRESS,
    [
      "function nfa() view returns (address)",
      "function router() view returns (address)",
      "function owner() view returns (address)",
      "function mintedCount() view returns (uint256)",
      "function rarityMinted(uint8) view returns (uint256)",
      "function TOTAL_GENESIS() view returns (uint256)",
      "function DNA_RANGES(uint256,uint256) view returns (uint16)",
      "function SHELTER_WEIGHTS(uint256) view returns (uint8)",
    ],
    provider
  );

  const vaultNfa: string = await vault.nfa();
  const vaultRouter: string = await vault.router();
  const vaultOwner: string = await vault.owner();
  console.log(`vault.nfa()    = ${vaultNfa}`);
  console.log(`  匹配? ${vaultNfa.toLowerCase() === NFA_ADDRESS.toLowerCase() ? "✅" : "❌ 不匹配!"}`);
  console.log(`vault.router() = ${vaultRouter}`);
  console.log(`  匹配? ${vaultRouter.toLowerCase() === ROUTER_ADDRESS.toLowerCase() ? "✅" : "❌ 不匹配!"}`);
  console.log(`vault.owner()  = ${vaultOwner}`);

  // ============================================
  // 3. 权限检查
  // ============================================
  console.log("\n=== 3. 权限检查 ===\n");
  const nfa = new ethers.Contract(
    NFA_ADDRESS,
    [
      "function minter() view returns (address)",
      "function paused() view returns (bool)",
    ],
    provider
  );
  const router = new ethers.Contract(
    ROUTER_ADDRESS,
    [
      "function minter() view returns (address)",
      "function authorizedSkills(address) view returns (bool)",
      "function nfa() view returns (address)",
    ],
    provider
  );

  const nfaMinter: string = await nfa.minter();
  const isPaused: boolean = await nfa.paused();
  const routerMinter: string = await router.minter();
  const isSkill: boolean = await router.authorizedSkills(VAULT_ADDRESS);
  const routerNfa: string = await router.nfa();

  console.log(`ClawNFA.minter()       = ${nfaMinter} ${nfaMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅" : "❌"}`);
  console.log(`ClawNFA.paused()       = ${isPaused} ${isPaused ? "❌ 已暂停!" : "✅"}`);
  console.log(`ClawRouter.minter()    = ${routerMinter} ${routerMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅" : "❌"}`);
  console.log(`ClawRouter.skills(vault) = ${isSkill} ${isSkill ? "✅" : "❌"}`);
  console.log(`ClawRouter.nfa()       = ${routerNfa} ${routerNfa.toLowerCase() === NFA_ADDRESS.toLowerCase() ? "✅" : "❌"}`);

  // ============================================
  // 4. 铸造状态 & Rarity Cap
  // ============================================
  console.log("\n=== 4. 铸造状态 ===\n");
  const mintedCount = await vault.mintedCount();
  const totalGenesis = await vault.TOTAL_GENESIS();
  console.log(`已铸造: ${mintedCount} / ${totalGenesis}`);

  for (let r = 0; r < 5; r++) {
    const minted = await vault.rarityMinted(r);
    const cap = RARITY_CAPS[r];
    const full = minted.gte(cap);
    console.log(`  ${RARITY_NAMES[r].padEnd(10)} : ${minted} / ${cap} ${full ? "❌ 已满!" : "✅"}`);
  }

  // ============================================
  // 5. 检查 initialize 数据是否完整 (DNA_RANGES / SHELTER_WEIGHTS)
  // ============================================
  console.log("\n=== 5. 初始化数据检查 ===\n");
  let initDataOk = true;
  for (let r = 0; r < 5; r++) {
    const min = await vault.DNA_RANGES(r, 0);
    const max = await vault.DNA_RANGES(r, 1);
    const ok = min > 0 && max > min;
    if (!ok) initDataOk = false;
    console.log(`  DNA_RANGES[${r}] = [${min}, ${max}] ${ok ? "✅" : "❌ 未初始化或为零!"}`);
  }

  let shelterTotal = 0;
  const weights: number[] = [];
  for (let i = 0; i < 8; i++) {
    const w = await vault.SHELTER_WEIGHTS(i);
    weights.push(w);
    shelterTotal += w;
  }
  console.log(`  SHELTER_WEIGHTS = [${weights.join(", ")}] (总和=${shelterTotal}) ${shelterTotal > 0 ? "✅" : "❌ 全为零!"}`);

  if (!initDataOk || shelterTotal === 0) {
    console.log("\n⚠️  初始化数据丢失！这很可能是 ownerMint 回滚的原因。");
    console.log("   升级合约后，如果存储布局变了，initialize() 里设置的数据可能被覆盖/归零。");
    console.log("   需要添加一个 reinitialize 函数来重新设置 DNA_RANGES 和 SHELTER_WEIGHTS。");
  }

  // ============================================
  // 6. 模拟 ownerMint 调用
  // ============================================
  console.log("\n=== 6. 模拟 ownerMint(0, owner) ===\n");
  const vaultWithSigner = new ethers.Contract(
    VAULT_ADDRESS,
    ["function ownerMint(uint8 rarity, address recipient)"],
    provider
  );
  try {
    await vaultWithSigner.callStatic.ownerMint(0, vaultOwner, { from: vaultOwner });
    console.log("✅ 模拟成功！ownerMint(0, owner) 不会回滚。");
  } catch (err: any) {
    console.log("❌ 模拟失败！");
    console.log(`   reason: ${err.reason || "无"}`);
    console.log(`   code: ${err.code || "无"}`);
    console.log(`   data: ${err.data || "无"}`);
    if (err.error?.data) {
      console.log(`   error.data: ${err.error.data}`);
    }
    console.log(`   message: ${err.message?.slice(0, 200)}`);
  }

  console.log("\n=== 诊断完成 ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
