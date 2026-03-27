import { ethers, upgrades } from "hardhat";

async function main() {
  const ClawRouter = await ethers.getContractFactory("ClawRouter");
  const upgraded = await upgrades.upgradeProxy(
    "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603",
    ClawRouter
  );
  console.log("ClawRouter upgraded at:", upgraded.address);
  const rate = await upgraded.getVaultRate();
  console.log("Vault rate:", rate.toNumber(), "bps");
  const total = await upgraded.totalGameCLW();
  console.log("Total game CLW:", ethers.utils.formatEther(total));
}

main().catch(console.error);
