/**
 * Upgrade TaskSkill + PKSkill to add NFA stats (履历)
 */
import { ethers, upgrades } from "hardhat";

const TASK_ADDRESS = "0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E";
const PK_ADDRESS = "0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  console.log("\n1. Upgrading TaskSkill...");
  const TaskSkill = await ethers.getContractFactory("TaskSkill");
  await upgrades.upgradeProxy(TASK_ADDRESS, TaskSkill);
  console.log("   ✅ TaskSkill upgraded — getTaskStats() available");

  console.log("\n2. Upgrading PKSkill...");
  const PKSkill = await ethers.getContractFactory("PKSkill");
  await upgrades.upgradeProxy(PK_ADDRESS, PKSkill);
  console.log("   ✅ PKSkill upgraded — getPkStats() available");

  console.log("\nDone! Both contracts now track NFA stats.");
}

main().catch(console.error);
