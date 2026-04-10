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

  await upgrades.validateImplementation(TaskSkill, { kind: "uups" });
  console.log("Implementation validation passed.");

  if (process.env.UPGRADE_CONFIRM !== "1") {
    console.log("Dry run only. Set UPGRADE_CONFIRM=1 to deploy the implementation and send upgradeTo.");
    return;
  }

  const implementation = await TaskSkill.deploy(txOverrides);
  await implementation.deployed();
  console.log("TaskSkill implementation:", implementation.address);
  console.log("Implementation deploy tx:", implementation.deployTransaction.hash);

  const upgradeTx = await taskSkill.upgradeTo(implementation.address, txOverrides);
  console.log("upgradeTo tx:", upgradeTx.hash);
  await upgradeTx.wait();
  console.log("TaskSkill upgraded at proxy:", TASK_SKILL_PROXY);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
