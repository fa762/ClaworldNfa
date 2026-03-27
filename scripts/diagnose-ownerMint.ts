/**
 * Diagnose ownerMint failure step by step
 */
import { ethers } from "hardhat";

const VAULT = "0x6d176022759339da787fD3E2f1314019C3fb7867";
const NFA = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const CLW = "0xCdb158C1A1F0e8B85d785172f2109bC53e2F41FC";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check ownerMint caller is owner
  const vault = await ethers.getContractAt("GenesisVault", VAULT);
  const vaultOwner = await vault.owner();
  console.log("\n1. GenesisVault.owner() =", vaultOwner);
  console.log("   Deployer matches?", vaultOwner.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌");

  // Check minted count and caps
  const mintedCount = await vault.mintedCount();
  const totalGenesis = await vault.TOTAL_GENESIS();
  console.log("\n2. Minted:", mintedCount.toString(), "/", totalGenesis.toString());

  // Check rarity caps
  for (let r = 0; r <= 4; r++) {
    const minted = await vault.rarityMinted(r);
    console.log(`   Rarity ${r}: ${minted.toString()} minted`);
  }

  // Check NFA.minter
  const nfa = await ethers.getContractAt("ClawNFA", NFA);
  const nfaMinter = await nfa.minter();
  console.log("\n3. ClawNFA.minter() =", nfaMinter);
  console.log("   Is Vault?", nfaMinter.toLowerCase() === VAULT.toLowerCase() ? "✅" : "❌");

  // Check Router.minter
  const router = await ethers.getContractAt("ClawRouter", ROUTER);
  const routerMinter = await router.minter();
  console.log("\n4. ClawRouter.minter() =", routerMinter);
  console.log("   Is Vault?", routerMinter.toLowerCase() === VAULT.toLowerCase() ? "✅" : "❌");

  // Check Router.authorizedSkills(vault)
  const isSkill = await router.authorizedSkills(VAULT);
  console.log("\n5. ClawRouter.authorizedSkills(vault) =", isSkill);

  // Check CLW balance of vault (for airdrop)
  const clw = await ethers.getContractAt("MockCLW", CLW);
  const vaultCLWBalance = await clw.balanceOf(VAULT);
  const routerCLWBalance = await clw.balanceOf(ROUTER);
  console.log("\n6. CLW Balances:");
  console.log("   Vault CLW:", ethers.utils.formatEther(vaultCLWBalance));
  console.log("   Router CLW:", ethers.utils.formatEther(routerCLWBalance));

  // Check if addCLW needs actual CLW transfer (it's just a balance update, no transfer)
  // addCLW just does clwBalances[nfaId] += amount — no ERC20 transfer!
  // But wait... this means airdrop CLW is "virtual" — it's credited but not backed by real tokens
  // Unless CLW was pre-funded to the router

  // Try to simulate ownerMint
  console.log("\n7. Simulating ownerMint(0, deployer)...");
  try {
    await vault.callStatic.ownerMint(0, deployer.address);
    console.log("   ✅ Simulation succeeded!");
  } catch (e: any) {
    console.log("   ❌ Simulation failed:", e.reason || e.message);

    // Try each step individually
    console.log("\n   Trying sub-calls individually:");

    // Test mintTo
    console.log("\n   7a. Testing nfa.mintTo...");
    try {
      // We can't call mintTo directly (only minter = vault), so skip
      console.log("   (skipped - only vault can call)");
    } catch {}

    // Test initializeLobster
    console.log("\n   7b. nfa.getTotalSupply()...");
    const supply = await nfa.getTotalSupply();
    console.log("   Current supply:", supply.toString());

    // Check if nfa has default logic address set
    console.log("\n   7c. Checking NFA default logic address...");
    try {
      const defaultLogic = await nfa.defaultLogicAddress();
      console.log("   defaultLogicAddress:", defaultLogic);
      console.log("   Is Router?", defaultLogic.toLowerCase() === ROUTER.toLowerCase() ? "✅" : "❌");
    } catch (e2: any) {
      console.log("   No defaultLogicAddress function:", e2.message?.substring(0, 80));
    }
  }
}

main().catch(console.error);
