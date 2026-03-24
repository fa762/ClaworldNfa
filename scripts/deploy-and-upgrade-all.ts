/**
 * Full deployment: upgrade existing + deploy skills + deploy new contracts
 *
 * Usage:
 *   npx hardhat run scripts/deploy-and-upgrade-all.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB\n");

  // Known testnet addresses
  const nfaAddress = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
  const routerAddress = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
  const worldStateAddress = "0x3479E9d103Ea28c9b3f94a73d3cf7bC9187e4F7d";
  const clwAddress = "0xCdb158C1A1F0e8B85d785172f2109bC53e2F41FC";
  const flapPortalAddress = "0x9F07D34F55146FE59495A9C5694e223b531Ff7C5";
  const pancakeRouterAddress = "0x4766aDF17656c7A6046804fd06e930C17Ee32992";

  // ============================================
  // 1. Upgrade existing contracts
  // ============================================
  console.log("=== Upgrading Existing Contracts ===\n");

  console.log("Upgrading ClawRouter...");
  const ClawRouter = await ethers.getContractFactory("ClawRouter");
  await upgrades.upgradeProxy(routerAddress, ClawRouter);
  console.log("  ClawRouter upgraded at:", routerAddress);

  console.log("Upgrading WorldState...");
  const WorldState = await ethers.getContractFactory("WorldState");
  await upgrades.upgradeProxy(worldStateAddress, WorldState);
  console.log("  WorldState upgraded at:", worldStateAddress);

  // ============================================
  // 2. Deploy Skills (if not yet deployed)
  // ============================================
  console.log("\n=== Deploying Skill Contracts ===\n");

  const TaskSkill = await ethers.getContractFactory("TaskSkill");
  const taskSkill = await upgrades.deployProxy(
    TaskSkill, [routerAddress, worldStateAddress], { kind: "uups" }
  );
  await taskSkill.deployed();
  console.log("  TaskSkill:", taskSkill.address);

  const PKSkill = await ethers.getContractFactory("PKSkill");
  const pkSkill = await upgrades.deployProxy(
    PKSkill, [routerAddress, nfaAddress], { kind: "uups" }
  );
  await pkSkill.deployed();
  console.log("  PKSkill:", pkSkill.address);

  const MarketSkill = await ethers.getContractFactory("MarketSkill");
  const marketSkill = await upgrades.deployProxy(
    MarketSkill, [nfaAddress, deployer.address], { kind: "uups" }
  );
  await marketSkill.deployed();
  console.log("  MarketSkill:", marketSkill.address);

  // ============================================
  // 3. Deploy new Phase 4 contracts
  // ============================================
  console.log("\n=== Deploying New Contracts ===\n");

  const DepositRouter = await ethers.getContractFactory("DepositRouter");
  const depositRouter = await upgrades.deployProxy(
    DepositRouter, [routerAddress, clwAddress], { kind: "uups" }
  );
  await depositRouter.deployed();
  console.log("  DepositRouter:", depositRouter.address);

  const PersonalityEngine = await ethers.getContractFactory("PersonalityEngine");
  const personalityEngine = await upgrades.deployProxy(
    PersonalityEngine, [routerAddress, nfaAddress], { kind: "uups" }
  );
  await personalityEngine.deployed();
  console.log("  PersonalityEngine:", personalityEngine.address);

  // ============================================
  // 4. Configure permissions
  // ============================================
  console.log("\n=== Configuring Permissions ===\n");

  const router = await ethers.getContractAt("ClawRouter", routerAddress);

  // Authorize skills
  await router.authorizeSkill(taskSkill.address, true);
  console.log("  Authorized TaskSkill");
  await router.authorizeSkill(pkSkill.address, true);
  console.log("  Authorized PKSkill");
  await router.authorizeSkill(depositRouter.address, true);
  console.log("  Authorized DepositRouter");

  // Set PersonalityEngine
  await router.setPersonalityEngine(personalityEngine.address);
  console.log("  Set PersonalityEngine on Router");

  // Authorize Router on PersonalityEngine (for facade)
  await personalityEngine.setAuthorizedCaller(router.address, true);
  console.log("  Authorized Router on PersonalityEngine");

  // Set WorldState on PKSkill
  await pkSkill.setWorldState(worldStateAddress);
  console.log("  Set WorldState on PKSkill");

  // Set deployer as TaskSkill operator
  await taskSkill.setOperator(deployer.address, true);
  console.log("  Set deployer as TaskSkill operator");

  // Configure DepositRouter with DEX
  await depositRouter.setFlapPortal(flapPortalAddress);
  await depositRouter.setPancakeRouter(pancakeRouterAddress);
  console.log("  Configured DepositRouter with DEX addresses");

  // ============================================
  // Summary
  // ============================================
  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE - BSC TESTNET");
  console.log("========================================\n");
  console.log("Upgraded:");
  console.log("  ClawNFA:           ", nfaAddress);
  console.log("  ClawRouter:        ", routerAddress);
  console.log("  WorldState:        ", worldStateAddress);
  console.log("\nNew Deployments:");
  console.log("  TaskSkill:         ", taskSkill.address);
  console.log("  PKSkill:           ", pkSkill.address);
  console.log("  MarketSkill:       ", marketSkill.address);
  console.log("  DepositRouter:     ", depositRouter.address);
  console.log("  PersonalityEngine: ", personalityEngine.address);
  console.log("\nAdd to .env.testnet:");
  console.log(`  NEXT_PUBLIC_PKSKILL_ADDRESS=${pkSkill.address}`);
  console.log(`  NEXT_PUBLIC_DEPOSIT_ROUTER_ADDRESS=${depositRouter.address}`);
  console.log(`  NEXT_PUBLIC_PERSONALITY_ENGINE_ADDRESS=${personalityEngine.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
