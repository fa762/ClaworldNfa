/**
 * Phase 3 Deployment: TaskSkill + PKSkill + MarketSkill
 *
 * Requires Phase 1+2 addresses in env:
 *   NFA_ADDRESS, ROUTER_ADDRESS, WORLD_STATE_ADDRESS, TREASURY_ADDRESS
 *
 * Usage:
 *   NFA_ADDRESS=0x... ROUTER_ADDRESS=0x... WORLD_STATE_ADDRESS=0x... \
 *   npx hardhat run scripts/deploy-phase3.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const nfaAddress = process.env.NFA_ADDRESS!;
  const routerAddress = process.env.ROUTER_ADDRESS!;
  const worldStateAddress = process.env.WORLD_STATE_ADDRESS!;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  if (!nfaAddress || !routerAddress || !worldStateAddress) {
    throw new Error("Set NFA_ADDRESS, ROUTER_ADDRESS, WORLD_STATE_ADDRESS");
  }

  // 1. Deploy TaskSkill
  const TaskSkill = await ethers.getContractFactory("TaskSkill");
  const taskSkill = await upgrades.deployProxy(
    TaskSkill,
    [routerAddress, worldStateAddress],
    { kind: "uups" }
  );
  await taskSkill.deployed();
  console.log("TaskSkill deployed to:", taskSkill.address);

  // 2. Deploy PKSkill
  const PKSkill = await ethers.getContractFactory("PKSkill");
  const pkSkill = await upgrades.deployProxy(
    PKSkill,
    [routerAddress, nfaAddress],
    { kind: "uups" }
  );
  await pkSkill.deployed();
  console.log("PKSkill deployed to:", pkSkill.address);

  // 3. Deploy MarketSkill
  const MarketSkill = await ethers.getContractFactory("MarketSkill");
  const marketSkill = await upgrades.deployProxy(
    MarketSkill,
    [nfaAddress, treasury],
    { kind: "uups" }
  );
  await marketSkill.deployed();
  console.log("MarketSkill deployed to:", marketSkill.address);

  // 4. Authorize skills in Router
  const router = await ethers.getContractAt("ClawRouter", routerAddress);
  await router.authorizeSkill(taskSkill.address, true);
  console.log("Authorized TaskSkill");
  await router.authorizeSkill(pkSkill.address, true);
  console.log("Authorized PKSkill");

  console.log("\n--- Phase 3 Deployment Complete ---");
  console.log("TaskSkill:", taskSkill.address);
  console.log("PKSkill:", pkSkill.address);
  console.log("MarketSkill:", marketSkill.address);
  console.log("\nAll contracts deployed! Enable genesis minting with:");
  console.log("  GenesisVault.setMintingActive(true)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
