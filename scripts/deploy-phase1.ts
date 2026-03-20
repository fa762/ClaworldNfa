/**
 * Phase 1 Deployment: ClawNFA + ClawRouter + MockCLW (+ mocks for local)
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
  const flapPortalAddress = process.env.FLAP_PORTAL_ADDRESS;
  const pancakeRouterAddress = process.env.PANCAKE_ROUTER_ADDRESS;
  const isLocal = !clwTokenAddress;

  // 1. Deploy or use existing CLW token
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

  // 4. Set default logic address on NFA (so publicMint points to router)
  const tx1 = await nfa.setDefaultLogicAddress(router.address);
  await tx1.wait();
  console.log("Set default logic address on NFA to router");

  // Verify
  const logicAddr = await nfa.defaultLogicAddress();
  if (logicAddr !== router.address) {
    throw new Error(`Verification failed: defaultLogicAddress expected ${router.address}, got ${logicAddr}`);
  }
  console.log("Verified: defaultLogicAddress set correctly");

  // 5. Deploy mocks for local/testnet (PancakeSwap + Flap)
  if (isLocal) {
    // Deploy MockPancakeRouter (1000 CLW per BNB)
    const MockWBNB = await ethers.getContractFactory("MockCLW");
    const wbnb = await MockWBNB.deploy();
    await wbnb.deployed();

    const MockPancakeRouter = await ethers.getContractFactory("MockPancakeRouter");
    const mockPR = await MockPancakeRouter.deploy(
      wbnb.address, clwAddress, ethers.utils.parseEther("1000")
    );
    await mockPR.deployed();
    console.log("MockPancakeRouter deployed to:", mockPR.address);

    // Deploy MockFlapPortal (2000 CLW per BNB)
    const MockFlapPortal = await ethers.getContractFactory("MockFlapPortal");
    const mockFlap = await MockFlapPortal.deploy(
      clwAddress, ethers.utils.parseEther("2000")
    );
    await mockFlap.deployed();
    console.log("MockFlapPortal deployed to:", mockFlap.address);

    // Configure router with mocks
    await router.setFlapPortal(mockFlap.address);
    await router.setPancakeRouter(mockPR.address);
    console.log("Configured router with mock PancakeRouter and FlapPortal");
  } else {
    // Use real addresses if provided
    if (flapPortalAddress) {
      await router.setFlapPortal(flapPortalAddress);
      console.log("Set Flap portal:", flapPortalAddress);
    }
    if (pancakeRouterAddress) {
      await router.setPancakeRouter(pancakeRouterAddress);
      console.log("Set PancakeRouter:", pancakeRouterAddress);
    }
  }

  console.log("\n--- Phase 1 Deployment Complete ---");
  console.log("Treasury:", treasury);
  console.log("CLW Token:", clwAddress);
  console.log("ClawNFA:", nfa.address);
  console.log("ClawRouter:", router.address);
  console.log("\nNext: Run deploy-phase2.ts with:");
  console.log(`  NFA_ADDRESS=${nfa.address} ROUTER_ADDRESS=${router.address} CLW_TOKEN_ADDRESS=${clwAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
