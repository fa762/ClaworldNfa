import { ethers, upgrades } from "hardhat";

async function main() {
  const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
  console.log("Upgrading ClawNFA at", NFA_ADDRESS);
  const NFA = await ethers.getContractFactory("ClawNFA");
  const upgraded = await upgrades.upgradeProxy(NFA_ADDRESS, NFA);
  await upgraded.deployed();
  console.log("✅ ClawNFA upgraded — setVaultURI now available");
}

main().catch(console.error);
