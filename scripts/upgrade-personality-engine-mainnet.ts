import { ethers, upgrades } from "hardhat";

const PERSONALITY_ENGINE_PROXY = "0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E";
const ROUTER = "0x60C0D5276c007Fd151f2A615c315cb364EF81BD5";

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) {
    throw new Error("PRIVATE_KEY is required to run this mainnet upgrade.");
  }

  const PersonalityEngine = await ethers.getContractFactory("PersonalityEngine");
  const engine = await ethers.getContractAt("PersonalityEngine", PERSONALITY_ENGINE_PROXY);
  const gasPriceGwei = process.env.GAS_PRICE_GWEI || "0.05";
  const txOverrides = { gasPrice: ethers.utils.parseUnits(gasPriceGwei, "gwei") };

  console.log("PersonalityEngine proxy:", PERSONALITY_ENGINE_PROXY);
  console.log("Expected router:", ROUTER);
  console.log("Deployer:", deployer.address);
  console.log("Gas price override:", `${gasPriceGwei} gwei`);

  const owner = await engine.owner();
  const currentRouter = await engine.router();
  const routerAuthorized = await engine.authorizedCallers(ROUTER);
  console.log("PersonalityEngine owner:", owner);
  console.log("Current router:", currentRouter);
  console.log("Router authorized:", routerAuthorized);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Deployer is not PersonalityEngine owner. owner=${owner}, deployer=${deployer.address}`);
  }
  if (currentRouter.toLowerCase() !== ROUTER.toLowerCase()) {
    throw new Error(`Unexpected PersonalityEngine.router(). current=${currentRouter}, expected=${ROUTER}`);
  }
  if (!routerAuthorized) {
    throw new Error(`Router ${ROUTER} is not authorized on PersonalityEngine.`);
  }

  await upgrades.validateImplementation(PersonalityEngine, { kind: "uups" });
  console.log("Implementation validation passed.");

  if (process.env.UPGRADE_CONFIRM !== "1") {
    console.log("Dry run only. Set UPGRADE_CONFIRM=1 to deploy the implementation and send upgradeTo.");
    return;
  }

  const implementation = await PersonalityEngine.deploy(txOverrides);
  await implementation.deployed();
  console.log("PersonalityEngine implementation:", implementation.address);
  console.log("Implementation deploy tx:", implementation.deployTransaction.hash);

  const upgradeTx = await engine.upgradeTo(implementation.address, txOverrides);
  console.log("upgradeTo tx:", upgradeTx.hash);
  await upgradeTx.wait();
  console.log("PersonalityEngine upgraded at proxy:", PERSONALITY_ENGINE_PROXY);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
