/**
 * Check and fix GenesisVault permissions on NFA and Router contracts.
 *
 * Usage:
 *   npx hardhat run scripts/fix-permissions.ts --network bscTestnet
 */
import { ethers } from "hardhat";

const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER_ADDRESS = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const VAULT_ADDRESS = "0x6d176022759339da787fD3E2f1314019C3fb7867";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const nfa = await ethers.getContractAt("ClawNFA", NFA_ADDRESS);
  const router = await ethers.getContractAt("ClawRouter", ROUTER_ADDRESS);

  // --- Check current state ---
  const nfaMinter = await nfa.minter();
  const routerMinter = await router.minter();
  const isSkill = await router.authorizedSkills(VAULT_ADDRESS);

  console.log("\n=== 当前权限状态 ===");
  console.log(`ClawNFA.minter()          = ${nfaMinter}`);
  console.log(`  期望值                   = ${VAULT_ADDRESS}`);
  console.log(`  状态: ${nfaMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅ 正确" : "❌ 需要修复"}`);

  console.log(`ClawRouter.minter()       = ${routerMinter}`);
  console.log(`  期望值                   = ${VAULT_ADDRESS}`);
  console.log(`  状态: ${routerMinter.toLowerCase() === VAULT_ADDRESS.toLowerCase() ? "✅ 正确" : "❌ 需要修复"}`);

  console.log(`ClawRouter.authorizedSkills(vault) = ${isSkill}`);
  console.log(`  状态: ${isSkill ? "✅ 正确" : "❌ 需要修复"}`);

  // --- Fix if needed ---
  let fixed = 0;

  if (nfaMinter.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
    console.log("\n→ 修复: ClawNFA.setMinter(vault)...");
    const tx = await nfa.setMinter(VAULT_ADDRESS);
    await tx.wait();
    console.log("  ✅ 完成, tx:", tx.hash);
    fixed++;
  }

  if (routerMinter.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
    console.log("\n→ 修复: ClawRouter.setMinter(vault)...");
    const tx = await router.setMinter(VAULT_ADDRESS);
    await tx.wait();
    console.log("  ✅ 完成, tx:", tx.hash);
    fixed++;
  }

  if (!isSkill) {
    console.log("\n→ 修复: ClawRouter.authorizeSkill(vault, true)...");
    const tx = await router.authorizeSkill(VAULT_ADDRESS, true);
    await tx.wait();
    console.log("  ✅ 完成, tx:", tx.hash);
    fixed++;
  }

  if (fixed === 0) {
    console.log("\n所有权限都正确，无需修复。");
  } else {
    console.log(`\n共修复 ${fixed} 项权限。ownerMint 现在应该可以正常工作了。`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
