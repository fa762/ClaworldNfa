/**
 * Check and fix GenesisVault permissions. Pure ethers.js, no hardhat needed.
 *
 * Usage:
 *   node scripts/fix-permissions.mjs
 */
import { ethers } from "ethers";

const RPC_URL = "https://bsc-testnet-rpc.publicnode.com";
const PRIVATE_KEY = "0xfe1d20174ddd8f0c5ae97725742dad6086f513c108c9669f8be80c960d7d8c78";

const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER_ADDRESS = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const VAULT_ADDRESS = "0x6d176022759339da787fD3E2f1314019C3fb7867";

const MINTER_ABI = [
  "function minter() view returns (address)",
  "function setMinter(address) external",
];

const ROUTER_ABI = [
  ...MINTER_ABI,
  "function authorizedSkills(address) view returns (bool)",
  "function authorizeSkill(address skill, bool authorized) external",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log("Using account:", wallet.address);

  const nfa = new ethers.Contract(NFA_ADDRESS, MINTER_ABI, wallet);
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

  // --- Check ---
  const nfaMinter = await nfa.minter();
  const routerMinter = await router.minter();
  const isSkill = await router.authorizedSkills(VAULT_ADDRESS);

  const eq = (a, b) => a.toLowerCase() === b.toLowerCase();

  console.log("\n=== Current Permissions ===");
  console.log(`ClawNFA.minter()                    = ${nfaMinter}`);
  console.log(`  expected                           = ${VAULT_ADDRESS}`);
  console.log(`  ${eq(nfaMinter, VAULT_ADDRESS) ? "OK" : "NEEDS FIX"}`);

  console.log(`ClawRouter.minter()                 = ${routerMinter}`);
  console.log(`  expected                           = ${VAULT_ADDRESS}`);
  console.log(`  ${eq(routerMinter, VAULT_ADDRESS) ? "OK" : "NEEDS FIX"}`);

  console.log(`ClawRouter.authorizedSkills(vault)   = ${isSkill}`);
  console.log(`  ${isSkill ? "OK" : "NEEDS FIX"}`);

  // --- Fix ---
  let fixed = 0;

  if (!eq(nfaMinter, VAULT_ADDRESS)) {
    console.log("\n-> Fixing ClawNFA.setMinter(vault)...");
    const tx = await nfa.setMinter(VAULT_ADDRESS);
    await tx.wait();
    console.log("   Done, tx:", tx.hash);
    fixed++;
  }

  if (!eq(routerMinter, VAULT_ADDRESS)) {
    console.log("\n-> Fixing ClawRouter.setMinter(vault)...");
    const tx = await router.setMinter(VAULT_ADDRESS);
    await tx.wait();
    console.log("   Done, tx:", tx.hash);
    fixed++;
  }

  if (!isSkill) {
    console.log("\n-> Fixing ClawRouter.authorizeSkill(vault, true)...");
    const tx = await router.authorizeSkill(VAULT_ADDRESS, true);
    await tx.wait();
    console.log("   Done, tx:", tx.hash);
    fixed++;
  }

  if (fixed === 0) {
    console.log("\nAll permissions are correct. Nothing to fix.");
  } else {
    console.log(`\nFixed ${fixed} permission(s). ownerMint should work now.`);
  }
}

main().catch(console.error);
