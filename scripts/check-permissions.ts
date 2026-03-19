/**
 * Check if GenesisVault is properly registered as minter and skill.
 *
 * Usage:
 *   npx hardhat run scripts/check-permissions.ts --network bscTestnet
 */
import { ethers } from "hardhat";

const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER_ADDRESS = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const VAULT_ADDRESS = "0x6d176022759339da787fD3E2f1314019C3fb7867";

async function main() {
  console.log("=== 检查 GenesisVault 权限 ===\n");
  console.log("GenesisVault:", VAULT_ADDRESS);
  console.log("ClawNFA:     ", NFA_ADDRESS);
  console.log("ClawRouter:  ", ROUTER_ADDRESS);
  console.log("");

  // ClawNFA.minter()
  const nfa = await ethers.getContractAt(
    ["function minter() view returns (address)", "function paused() view returns (bool)"],
    NFA_ADDRESS
  );
  const nfaMinter = await nfa.minter();
  const isPaused = await nfa.paused();
  console.log(`ClawNFA.minter()          = ${nfaMinter}`);
  console.log(`  匹配 Vault? ${nfaMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅ 是" : "❌ 否 ← 问题在这里!"}`);
  console.log(`ClawNFA.paused()          = ${isPaused}${isPaused ? " ← 合约已暂停!" : ""}`);
  console.log("");

  // ClawRouter.minter()
  const router = await ethers.getContractAt(
    ["function minter() view returns (address)", "function authorizedSkills(address) view returns (bool)"],
    ROUTER_ADDRESS
  );
  const routerMinter = await router.minter();
  const isSkill = await router.authorizedSkills(VAULT_ADDRESS);
  console.log(`ClawRouter.minter()       = ${routerMinter}`);
  console.log(`  匹配 Vault? ${routerMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅ 是" : "❌ 否 ← 问题在这里!"}`);
  console.log(`ClawRouter.authorizedSkills(vault) = ${isSkill}${!isSkill ? " ← 问题在这里!" : ""}`);
  console.log("");

  // 总结
  const allGood =
    nfaMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() &&
    routerMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() &&
    isSkill &&
    !isPaused;

  if (allGood) {
    console.log("✅ 所有权限正确，ownerMint 应该可以正常工作。");
    console.log("   如果仍然回滚，检查: rarity 值 (0-4)、recipient 地址、rarity cap 是否已满。");
  } else {
    console.log("❌ 发现权限问题！需要用 owner 账户执行修复：");
    if (nfaMinter.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
      console.log(`   - ClawNFA: 调用 setMinter("${VAULT_ADDRESS}")`);
    }
    if (routerMinter.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
      console.log(`   - ClawRouter: 调用 setMinter("${VAULT_ADDRESS}")`);
    }
    if (!isSkill) {
      console.log(`   - ClawRouter: 调用 authorizeSkill("${VAULT_ADDRESS}", true)`);
    }
    if (isPaused) {
      console.log("   - ClawNFA: 合约已暂停，调用 unpause()");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
