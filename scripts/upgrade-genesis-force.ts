import { ethers, upgrades } from "hardhat";

async function main() {
  const VAULT = "0x6d176022759339da787fD3E2f1314019C3fb7867";

  // Force import the proxy so OpenZeppelin recognizes it
  console.log("Force importing GenesisVault proxy...");
  const GenesisVault = await ethers.getContractFactory("GenesisVault");
  try {
    await upgrades.forceImport(VAULT, GenesisVault, { kind: "uups" });
    console.log("  Imported");
  } catch (e: any) {
    console.log("  Already imported or:", e.message?.substring(0, 80));
  }

  console.log("Upgrading GenesisVault...");
  const upgraded = await upgrades.upgradeProxy(VAULT, GenesisVault);
  await upgraded.deployed();
  console.log("✅ GenesisVault upgraded");
}

main().catch(console.error);
