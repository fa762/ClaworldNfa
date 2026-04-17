import { ethers, upgrades } from "hardhat";

function parseRequiredAddress(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value || !ethers.utils.isAddress(value)) {
    throw new Error(`Set ${name} to a valid address`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("PRIVATE_KEY is required.");
  }

  const routerAddress = parseRequiredAddress("ROUTER_PROXY", "0x60C0D5276c007Fd151f2A615c315cb364EF81BD5");
  const sweepTo = parseRequiredAddress("SWEEP_TO");
  const keepClwRaw = process.env.KEEP_CLW || "500000";
  const keepAmount = ethers.utils.parseUnits(keepClwRaw, 18);

  const ownerView = new ethers.Contract(routerAddress, ["function owner() view returns (address)"], ethers.provider);
  const owner = await ownerView.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Signer is not router owner. owner=${owner}, signer=${deployer.address}`);
  }

  console.log("Deployer:", deployer.address);
  console.log("Router proxy:", routerAddress);
  console.log("Sweep target:", sweepTo);
  console.log("Keep amount:", keepClwRaw, "Claworld");

  const ClawRouter = await ethers.getContractFactory("ClawRouter");
  const upgraded = await upgrades.upgradeProxy(routerAddress, ClawRouter);
  await upgraded.deployed();

  const router = await ethers.getContractAt("ClawRouter", routerAddress, deployer);
  const clwTokenAddress = await router.clwToken();
  const token = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    clwTokenAddress,
    deployer
  );

  const beforeBalance = await token.balanceOf(routerAddress);
  const totalGame = await router.totalGameCLW();
  console.log("Router balance before:", ethers.utils.formatUnits(beforeBalance, 18));
  console.log("Router totalGameCLW:", ethers.utils.formatUnits(totalGame, 18));

  const tx = await router.sweepExcessCLW(sweepTo, keepAmount);
  console.log("Sweep tx:", tx.hash);
  await tx.wait();

  const afterBalance = await token.balanceOf(routerAddress);
  console.log("Router balance after:", ethers.utils.formatUnits(afterBalance, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
