/**
 * Upgrade all contracts modified by audit fixes + new features
 */
import { ethers, upgrades } from "hardhat";

const CONTRACTS = {
  ClawNFA: "0x1c69be3401a78CFeDC2B2543E62877874f10B135",
  ClawRouter: "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603",
  DepositRouter: "0xd61Cc50b2d15cC58b24c0f7B6cC83bbc0b0fB448",
  PersonalityEngine: "0xab8F67949bf607181ca89E6aAaF401cFeA4dac0e",
  GenesisVault: "0x6d176022759339da787fD3E2f1314019C3fb7867",
  PKSkill: "0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A",
  TaskSkill: "0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E",
  WorldState: "0x3479E9d103Ea28c9b3f94a73d3cf7bC9187e4F7d",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB\n");

  const toUpgrade = [
    "ClawNFA",        // setVaultURI once-only
    "DepositRouter",  // minAmountOut slippage
    "PersonalityEngine", // __gap
    "GenesisVault",   // DNA redistribution + image pool
    "PKSkill",        // personality bias + getMatchCount + recommit fix + stats
    "TaskSkill",      // operator cap + stats
    "WorldState",     // pkStakeLimit reset
  ];

  for (const name of toUpgrade) {
    const addr = (CONTRACTS as any)[name];
    console.log(`Upgrading ${name} at ${addr}...`);
    try {
      const Factory = await ethers.getContractFactory(name);
      const upgraded = await upgrades.upgradeProxy(addr, Factory);
      await upgraded.deployed();
      console.log(`  ✅ ${name} upgraded`);
    } catch (e: any) {
      console.log(`  ❌ ${name} failed: ${e.message?.substring(0, 100)}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
