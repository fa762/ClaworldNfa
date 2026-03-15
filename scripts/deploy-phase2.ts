/**
 * Phase 2 Deployment: GenesisVault + WorldState + ClawOracle
 *
 * Requires Phase 1 addresses in env:
 *   NFA_ADDRESS, ROUTER_ADDRESS
 *
 * Usage:
 *   NFA_ADDRESS=0x... ROUTER_ADDRESS=0x... npx hardhat run scripts/deploy-phase2.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const nfaAddress = process.env.NFA_ADDRESS!;
  const routerAddress = process.env.ROUTER_ADDRESS!;

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

  // 3. Deploy ClawOracle
  const ClawOracle = await ethers.getContractFactory("ClawOracle");
  const oracle = await upgrades.deployProxy(ClawOracle, [], { kind: "uups" });
  await oracle.deployed();
  console.log("ClawOracle deployed to:", oracle.address);

  // 4. Configure roles
  const nfa = await ethers.getContractAt("ClawNFA", nfaAddress);
  const router = await ethers.getContractAt("ClawRouter", routerAddress);

  // Set GenesisVault as minter for both NFA and Router
  await nfa.setMinter(vault.address);
  console.log("Set GenesisVault as NFA minter");

  await router.setMinter(vault.address);
  console.log("Set GenesisVault as Router minter");

  // Authorize GenesisVault as skill (for addCLW airdrops)
  await router.authorizeSkill(vault.address, true);
  console.log("Authorized GenesisVault as skill");

  console.log("\n--- Phase 2 Deployment Complete ---");
  console.log("GenesisVault:", vault.address);
  console.log("WorldState:", worldState.address);
  console.log("ClawOracle:", oracle.address);
  console.log("\nNext: Run deploy-phase3.ts to deploy Skills");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
