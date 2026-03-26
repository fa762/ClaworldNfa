import { ethers, upgrades } from "hardhat";

async function main() {
  const TASK_SKILL_PROXY = "0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E";
  const CLAW_NFA = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";

  console.log("Upgrading TaskSkill...");
  const TaskSkill = await ethers.getContractFactory("TaskSkill");
  const upgraded = await upgrades.upgradeProxy(TASK_SKILL_PROXY, TaskSkill);
  console.log("TaskSkill upgraded at:", upgraded.address);

  // Set NFA address for ownerCompleteTypedTask
  console.log("Setting NFA address...");
  const tx = await upgraded.setNFA(CLAW_NFA);
  await tx.wait();
  console.log("NFA set to:", CLAW_NFA);

  // Verify
  const nfaAddr = await upgraded.nfa();
  console.log("Verified NFA:", nfaAddr);
  console.log("Done!");
}

main().catch(console.error);
