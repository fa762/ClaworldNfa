/**
 * Phase 1 Deployment: ClawNFA + ClawRouter + MockCLW
 *
 * Usage:
 *   npx hardhat run scripts/deploy-phase1.ts --network bscTestnet
 *   npx hardhat run scripts/deploy-phase1.ts --network hardhat
 */
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const clwTokenAddress = process.env.CLW_TOKEN_ADDRESS;

  // 1. Deploy MockCLW (only if no CLW token provided)
  let clwAddress: string;
  if (clwTokenAddress) {
    clwAddress = clwTokenAddress;
    console.log("Using existing CLW token:", clwAddress);
  } else {
    const MockCLW = await ethers.getContractFactory("MockCLW");
    const mockCLW = await MockCLW.deploy();
    await mockCLW.deployed();
    clwAddress = mockCLW.address;
    console.log("MockCLW deployed to:", clwAddress);
  }

  // 2. Deploy ClawNFA (UUPS proxy)
  const ClawNFA = await ethers.getContractFactory("ClawNFA");
  const nfa = await upgrades.deployProxy(
    ClawNFA,
    ["Claw NFA", "CNFA", treasury],
    { kind: "uups" }
  );
  await nfa.deployed();
  console.log("ClawNFA deployed to:", nfa.address);

  // 3. Deploy ClawRouter (UUPS proxy)
  const ClawRouter = await ethers.getContractFactory("ClawRouter");
  const router = await upgrades.deployProxy(
    ClawRouter,
    [clwAddress, nfa.address, treasury],
    { kind: "uups" }
  );
  await router.deployed();
  console.log("ClawRouter deployed to:", router.address);

  console.log("\n--- Phase 1 Deployment Complete ---");
  console.log("Treasury:", treasury);
  console.log("CLW Token:", clwAddress);
  console.log("ClawNFA:", nfa.address);
  console.log("ClawRouter:", router.address);
  console.log("\nNext: Run deploy-phase2.ts to deploy GenesisVault");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
