import { ethers, upgrades } from "hardhat";
async function main() {
  const PK = await ethers.getContractFactory("PKSkill");
  const tx = await upgrades.upgradeProxy("0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A", PK);
  await tx.deployed();
  console.log("✅ PKSkill upgraded");
}
main().catch(console.error);
