/**
 * Upgrade PKSkill to add Arena Mode (createMatchWithCommit, joinMatchWithCommit, recommitStrategy)
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-pkskill-arena.ts --network bscTestnet
 */
import { ethers, upgrades } from "hardhat";

const PKSKILL_ADDRESS = "0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB\n");

  console.log("Upgrading PKSkill at", PKSKILL_ADDRESS, "...");
  const PKSkill = await ethers.getContractFactory("PKSkill");
  const upgraded = await upgrades.upgradeProxy(PKSKILL_ADDRESS, PKSkill);
  await upgraded.deployed();
  console.log("✅ PKSkill upgraded! Arena mode functions now available.");
  console.log("   - createMatchWithCommit(nfaId, stake, commitHash)");
  console.log("   - joinMatchWithCommit(matchId, nfaId, commitHash)");
  console.log("   - recommitStrategy(matchId, newCommitHash)");
  console.log("   - cancelCommittedMatch(matchId)");
}

main().catch(console.error);
