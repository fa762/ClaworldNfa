/**
 * Phase 2 Deployment: GenesisVault + WorldState + ClawOracle
 *
 * Requires Phase 1 addresses in env:
 *   NFA_ADDRESS, ROUTER_ADDRESS, CLW_TOKEN_ADDRESS
 *
 * Usage:
 *   NFA_ADDRESS=0x... ROUTER_ADDRESS=0x... CLW_TOKEN_ADDRESS=0x... \
 *   npx hardhat run scripts/deploy-phase2.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const nfaAddress = process.env.NFA_ADDRESS!;
  const routerAddress = process.env.ROUTER_ADDRESS!;
  const clwTokenAddress = process.env.CLW_TOKEN_ADDRESS;
  const pancakePairAddress = process.env.PANCAKE_PAIR_ADDRESS;

  if (!nfaAddress || !routerAddress) {
    throw new Error("Set NFA_ADDRESS and ROUTER_ADDRESS environment variables");
  }

  // 1. Deploy GenesisVault
  const GenesisVault = await ethers.getContractFactory("GenesisVault");
  const vault = await upgrades.deployProxy(
    GenesisVault,
    [nfaAddress, routerAddress],
    { kind: "uups" }
  );
  await vault.deployed();
  console.log("GenesisVault deployed to:", vault.address);

  // 2. Deploy WorldState
  const WorldState = await ethers.getContractFactory("WorldState");
  const worldState = await upgrades.deployProxy(WorldState, [], { kind: "uups" });
  await worldState.deployed();
  console.log("WorldState deployed to:", worldState.address);

  // 3. Configure WorldState
  if (clwTokenAddress) {
    await worldState.setCLWToken(clwTokenAddress);
    console.log("WorldState: set CLW token");
  }
  if (pancakePairAddress) {
    await worldState.setPancakePair(pancakePairAddress);
    console.log("WorldState: set PancakeSwap pair");
  }
  // Authorize deployer as keeper for autoUpdate
  await worldState.setKeeper(deployer.address, true);
  console.log("WorldState: authorized deployer as keeper");

  // 4. Deploy ClawOracle
  const ClawOracle = await ethers.getContractFactory("ClawOracle");
  const oracle = await upgrades.deployProxy(ClawOracle, [], { kind: "uups" });
  await oracle.deployed();
  console.log("ClawOracle deployed to:", oracle.address);

  // 5. Configure roles
  const nfa = await ethers.getContractAt("ClawNFA", nfaAddress);
  const router = await ethers.getContractAt("ClawRouter", routerAddress);

  // Set GenesisVault as minter for both NFA and Router
  await (await nfa.setMinter(vault.address)).wait();
  console.log("Set GenesisVault as NFA minter");

  await (await router.setMinter(vault.address)).wait();
  console.log("Set GenesisVault as Router minter");

  // Authorize GenesisVault as skill (for addCLW airdrops)
  await (await router.authorizeSkill(vault.address, true)).wait();
  console.log("Authorized GenesisVault as skill");

  // Set WorldState on Router (for dailyCostMultiplier)
  await (await router.setWorldState(worldState.address)).wait();
  console.log("Set WorldState on Router");

  // --- Post-deployment verification ---
  console.log("\nVerifying roles...");
  const nfaMinter = await nfa.minter();
  if (nfaMinter !== vault.address) throw new Error(`NFA minter mismatch: expected ${vault.address}, got ${nfaMinter}`);
  const routerMinter = await router.minter();
  if (routerMinter !== vault.address) throw new Error(`Router minter mismatch: expected ${vault.address}, got ${routerMinter}`);
  const isSkill = await router.authorizedSkills(vault.address);
  if (!isSkill) throw new Error("GenesisVault not authorized as skill on Router");
  const ws = await router.worldState();
  if (ws !== worldState.address) throw new Error(`WorldState mismatch: expected ${worldState.address}, got ${ws}`);
  console.log("All role verifications passed!");

  console.log("\n--- Phase 2 Deployment Complete ---");
  console.log("GenesisVault:", vault.address);
  console.log("WorldState:", worldState.address);
  console.log("ClawOracle:", oracle.address);
  console.log("\nNext: Run deploy-phase3.ts with:");
  console.log(`  NFA_ADDRESS=${nfaAddress} ROUTER_ADDRESS=${routerAddress} WORLD_STATE_ADDRESS=${worldState.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
