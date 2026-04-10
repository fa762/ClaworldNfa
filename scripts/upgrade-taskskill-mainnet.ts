import { ethers, upgrades } from "hardhat";

const TASK_SKILL_PROXY = "0xaed370784536e31BE4A5D0Dbb1bF275c98179D10";
const CLAW_NFA = "0xAa2094798B5892191124eae9D77E337544FFAE48";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error("PRIVATE_KEY is required to run this mainnet upgrade check.");
  }

  const TaskSkill = await ethers.getContractFactory("TaskSkill");
  const taskSkill = await ethers.getContractAt("TaskSkill", TASK_SKILL_PROXY);
  const gasPriceGwei = process.env.GAS_PRICE_GWEI || "0.05";
  const txOverrides = { gasPrice: ethers.utils.parseUnits(gasPriceGwei, "gwei") };

  console.log("TaskSkill proxy:", TASK_SKILL_PROXY);
  console.log("Expected NFA:", CLAW_NFA);
  console.log("Deployer:", deployer.address);
  console.log("Gas price override:", `${gasPriceGwei} gwei`);

  const owner = await taskSkill.owner();
  const currentNfa = await taskSkill.nfa();
  console.log("TaskSkill owner:", owner);
  console.log("Current NFA:", currentNfa);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not TaskSkill owner. owner=${owner}, deployer=${deployer.address}`);
  }
  if (currentNfa.toLowerCase() !== CLAW_NFA.toLowerCase()) {
    throw new Error(`Unexpected TaskSkill.nfa(). current=${currentNfa}, expected=${CLAW_NFA}`);
  }

  await upgrades.validateUpgrade(TASK_SKILL_PROXY, TaskSkill);
  console.log("Upgrade validation passed.");

  if (process.env.UPGRADE_CONFIRM !== "1") {
    console.log("Dry run only. Set UPGRADE_CONFIRM=1 to send the UUPS upgrade transaction.");
    return;
  }

  const upgraded = await upgrades.upgradeProxy(TASK_SKILL_PROXY, TaskSkill, {
    kind: "uups",
    txOverrides,
  });
  await upgraded.deployed();
  console.log("TaskSkill upgraded at:", upgraded.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
