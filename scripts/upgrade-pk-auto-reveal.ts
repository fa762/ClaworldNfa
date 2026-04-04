/**
 * Upgrade mainnet PKSkill to the auto-custody / dual-reveal settlement version.
 *
 * Behavior after upgrade:
 * - New matches record creator/challenger participant addresses on-chain
 * - revealBothAndSettle(...) can atomically reveal both sides and settle by damage
 * - Reveal timeout no longer gives the revealed side a free win
 * - Stuck committed matches refund both sides instead
 *
 * Usage:
 *   npx hardhat run scripts/upgrade-pk-auto-reveal.ts --network bscMainnet
 */
import { ethers, upgrades } from "hardhat";

const PKSKILL_PROXY = process.env.PKSKILL_ADDRESS || "0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF";

async function ensureOwner(proxyAddress: string, signerAddress: string) {
  const ownable = new ethers.Contract(proxyAddress, ["function owner() view returns (address)"], ethers.provider);
  const owner = await ownable.owner();
  console.log("PKSkill owner:", owner);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Owner mismatch. Signer ${signerAddress} is not owner ${owner}`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network:", network.name, network.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");
  console.log("PKSkill proxy:", PKSKILL_PROXY);
  console.log("---");

  await ensureOwner(PKSKILL_PROXY, deployer.address);

  const beforeImpl = await upgrades.erc1967.getImplementationAddress(PKSKILL_PROXY);
  console.log("Implementation before:", beforeImpl);

  const PKSkill = await ethers.getContractFactory("PKSkill");
  await upgrades.validateUpgrade(PKSKILL_PROXY, PKSkill);

  const upgraded = await upgrades.upgradeProxy(PKSKILL_PROXY, PKSkill);
  await upgraded.deployed();

  const afterImpl = await upgrades.erc1967.getImplementationAddress(PKSKILL_PROXY);
  console.log("Implementation after:", afterImpl);

  const worldState = await upgraded.worldState();
  const matchCount = await upgraded.getMatchCount();
  console.log("WorldState:", worldState);
  console.log("Current match count:", matchCount.toString());

  // Smoke-check the new public mapping getter on a harmless id.
  const participantA = await upgraded.participantAOf(1);
  console.log("participantAOf(1):", participantA);

  console.log("---");
  console.log("PKSkill upgrade complete.");
  console.log("New behavior:");
  console.log("  - Auto-custody can use revealBothAndSettle(matchId, strategyA, saltA, strategyB, saltB)");
  console.log("  - Timeout no longer awards a free win");
  console.log("  - Timed-out committed matches now refund both sides");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
