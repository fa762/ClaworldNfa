/**
 * Phase 4 Upgrade: Entropy + Timelock + Refactoring
 *
 * Upgrades existing contracts and deploys new ones:
 *   1. Upgrade PKSkill (entropy + cancelJoinedMatch)
 *   2. Upgrade ClawRouter (entropy + deprecate DEX + PersonalityEngine facade)
 *   3. Upgrade WorldState (timelock)
 *   4. Deploy DepositRouter (new)
 *   5. Deploy PersonalityEngine (new)
 *   6. Configure permissions
 *
 * Requires env:
 *   NFA_ADDRESS, ROUTER_ADDRESS, WORLD_STATE_ADDRESS, PKSKILL_ADDRESS,
 *   CLW_ADDRESS, PANCAKE_ROUTER_ADDRESS (optional), FLAP_PORTAL_ADDRESS (optional)
 *
 * Usage:
 *   NFA_ADDRESS=0x... ROUTER_ADDRESS=0x... WORLD_STATE_ADDRESS=0x... \
 *   PKSKILL_ADDRESS=0x... CLW_ADDRESS=0x... \
 *   npx hardhat run scripts/upgrade-phase4.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB\n");

  const nfaAddress = process.env.NFA_ADDRESS!;
  const routerAddress = process.env.ROUTER_ADDRESS!;
  const worldStateAddress = process.env.WORLD_STATE_ADDRESS!;
  const pkSkillAddress = process.env.PKSKILL_ADDRESS!;
  const clwAddress = process.env.CLW_ADDRESS!;

  if (!nfaAddress || !routerAddress || !worldStateAddress || !pkSkillAddress || !clwAddress) {
    throw new Error("Set NFA_ADDRESS, ROUTER_ADDRESS, WORLD_STATE_ADDRESS, PKSKILL_ADDRESS, CLW_ADDRESS");
  }

  // ============================================
  // 1. Upgrade PKSkill
  // ============================================
  console.log("--- Upgrading PKSkill ---");
  const PKSkill = await ethers.getContractFactory("PKSkill");
  const pkSkill = await upgrades.upgradeProxy(pkSkillAddress, PKSkill);
  console.log("PKSkill upgraded at:", pkSkill.address);

  // ============================================
  // 2. Upgrade ClawRouter
  // ============================================
  console.log("\n--- Upgrading ClawRouter ---");
  const ClawRouter = await ethers.getContractFactory("ClawRouter");
  const router = await upgrades.upgradeProxy(routerAddress, ClawRouter);
  console.log("ClawRouter upgraded at:", router.address);

  // ============================================
  // 3. Upgrade WorldState
  // ============================================
  console.log("\n--- Upgrading WorldState ---");
  const WorldState = await ethers.getContractFactory("WorldState");
  const worldState = await upgrades.upgradeProxy(worldStateAddress, WorldState);
  console.log("WorldState upgraded at:", worldState.address);

  // ============================================
  // 4. Deploy DepositRouter
  // ============================================
  console.log("\n--- Deploying DepositRouter ---");
  const DepositRouter = await ethers.getContractFactory("DepositRouter");
  const depositRouter = await upgrades.deployProxy(
    DepositRouter,
    [routerAddress, clwAddress],
    { kind: "uups" }
  );
  await depositRouter.deployed();
  console.log("DepositRouter deployed at:", depositRouter.address);

  // Configure DepositRouter with DEX addresses if provided
  if (process.env.PANCAKE_ROUTER_ADDRESS) {
    await depositRouter.setPancakeRouter(process.env.PANCAKE_ROUTER_ADDRESS);
    console.log("  Set PancakeRouter:", process.env.PANCAKE_ROUTER_ADDRESS);
  }
  if (process.env.FLAP_PORTAL_ADDRESS) {
    await depositRouter.setFlapPortal(process.env.FLAP_PORTAL_ADDRESS);
    console.log("  Set FlapPortal:", process.env.FLAP_PORTAL_ADDRESS);
  }

  // ============================================
  // 5. Deploy PersonalityEngine
  // ============================================
  console.log("\n--- Deploying PersonalityEngine ---");
  const PersonalityEngine = await ethers.getContractFactory("PersonalityEngine");
  const personalityEngine = await upgrades.deployProxy(
    PersonalityEngine,
    [routerAddress, nfaAddress],
    { kind: "uups" }
  );
  await personalityEngine.deployed();
  console.log("PersonalityEngine deployed at:", personalityEngine.address);

  // ============================================
  // 6. Configure Permissions
  // ============================================
  console.log("\n--- Configuring Permissions ---");

  // Authorize DepositRouter as skill on Router (to call addCLW)
  await router.authorizeSkill(depositRouter.address, true);
  console.log("  Authorized DepositRouter as skill");

  // Set PersonalityEngine on Router
  await router.setPersonalityEngine(personalityEngine.address);
  console.log("  Set PersonalityEngine on Router");

  // Authorize Router as caller on PersonalityEngine (for facade delegation)
  await personalityEngine.setAuthorizedCaller(router.address, true);
  console.log("  Authorized Router as PersonalityEngine caller");

  // ============================================
  // Summary
  // ============================================
  console.log("\n=== Phase 4 Upgrade Complete ===");
  console.log("Upgraded:");
  console.log("  PKSkill:           ", pkSkill.address);
  console.log("  ClawRouter:        ", router.address);
  console.log("  WorldState:        ", worldState.address);
  console.log("New deployments:");
  console.log("  DepositRouter:     ", depositRouter.address);
  console.log("  PersonalityEngine: ", personalityEngine.address);
  console.log("\nChanges:");
  console.log("  - PKSkill: Enhanced entropy (salts), cancelJoinedMatch bug fix");
  console.log("  - ClawRouter: Enhanced gene boost entropy, DEX deprecated, personality facade");
  console.log("  - WorldState: 24h timelock (proposeWorldState/executeWorldState)");
  console.log("  - DepositRouter: Handles BNB→CLW via PancakeSwap/Flap");
  console.log("  - PersonalityEngine: Personality evolution + job class derivation");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
