/**
 * Upgrade BattleRoyale to V2 and initialize new config.
 *
 * Usage:
 *   BATTLE_ROYALE_ROUTER=0x... BATTLE_ROYALE_NFA=0x... BATTLE_ROYALE_SPEED_BONUS_BPS=100 \
 *   npx hardhat run scripts/upgrade-battle-royale.ts --network bscMainnet
 */
import { ethers, upgrades } from "hardhat";

const PROXY = "0x2B2182326Fd659156B2B119034A72D1C2cC9758D";
const REQUIRED_SELECTORS = [
  ethers.utils.id("participantForNfa(uint256)").slice(2, 10).toLowerCase(),
  ethers.utils.id("enterRoomForNfa(uint256,uint256,uint8,uint256)").slice(2, 10).toLowerCase(),
  ethers.utils.id("claimForNfa(uint256,uint256)").slice(2, 10).toLowerCase(),
];

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function implementationHasReserveSelectors(address: string): Promise<boolean> {
  const code = (await ethers.provider.getCode(address)).toLowerCase();
  return REQUIRED_SELECTORS.every((selector) => code.includes(selector));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Upgrading BattleRoyale with account:", deployer.address);
  console.log("Network:", network.name, network.chainId);
  console.log("Proxy address:", PROXY);

  const router = getRequiredEnv("BATTLE_ROYALE_ROUTER");
  const nfa = getRequiredEnv("BATTLE_ROYALE_NFA");
  const speedBonusBps = Number(getRequiredEnv("BATTLE_ROYALE_SPEED_BONUS_BPS"));

  if (!ethers.utils.isAddress(router)) {
    throw new Error(`Invalid BATTLE_ROYALE_ROUTER: ${router}`);
  }
  if (!ethers.utils.isAddress(nfa)) {
    throw new Error(`Invalid BATTLE_ROYALE_NFA: ${nfa}`);
  }
  if (!Number.isInteger(speedBonusBps) || speedBonusBps < 0) {
    throw new Error(`Invalid BATTLE_ROYALE_SPEED_BONUS_BPS: ${speedBonusBps}`);
  }

  const BattleRoyale = await ethers.getContractFactory("BattleRoyale");
  const beforeImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log("Implementation before upgrade:", beforeImpl);

  try {
    await upgrades.forceImport(PROXY, BattleRoyale, { kind: "uups" });
    console.log("forceImport completed for existing proxy");
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already been imported")) {
      throw error;
    }
    console.log("Proxy already imported in local manifest");
  }

  const preparedImpl = await upgrades.prepareUpgrade(PROXY, BattleRoyale, { kind: "uups" });
  console.log("Prepared implementation:", preparedImpl);
  const preparedHasSelectors = await implementationHasReserveSelectors(preparedImpl);
  console.log("Prepared implementation has NFA reserve selectors:", preparedHasSelectors);

  const proxy = await ethers.getContractAt("BattleRoyale", PROXY);

  if (!preparedHasSelectors) {
    console.log("Prepared implementation is stale; deploying fresh implementation directly");
    const implementation = await BattleRoyale.deploy();
    await implementation.deployed();
    console.log("Fresh implementation deployed:", implementation.address);

    const freshHasSelectors = await implementationHasReserveSelectors(implementation.address);
    console.log("Fresh implementation has NFA reserve selectors:", freshHasSelectors);
    if (!freshHasSelectors) {
      throw new Error(`Fresh implementation ${implementation.address} still missing reserve selectors`);
    }

    const upgradeTx = await proxy.upgradeTo(implementation.address);
    await upgradeTx.wait();
    console.log("Direct upgradeTo tx:", upgradeTx.hash);
  } else {
    const upgraded = await upgrades.upgradeProxy(PROXY, BattleRoyale, { kind: "uups" });
    await upgraded.deployed();
  }

  const afterImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  const afterHasSelectors = await implementationHasReserveSelectors(afterImpl);

  console.log("\n[ok] BattleRoyale upgraded successfully");
  console.log("Proxy address (unchanged):", PROXY);
  console.log("Implementation after upgrade:", afterImpl);
  console.log("Implementation after upgrade has NFA reserve selectors:", afterHasSelectors);

  const br = await ethers.getContractAt("BattleRoyale", PROXY);
  const routerContract = await ethers.getContractAt("ClawRouter", router);
  const currentRouter = await br.router();
  const currentNfa = await br.nfa();
  const currentSpeedBonusBps = await br.speedBonusBps();

  const needsInitializeV2 =
    currentRouter === ethers.constants.AddressZero &&
    currentNfa === ethers.constants.AddressZero &&
    currentSpeedBonusBps.eq(0);

  if (needsInitializeV2) {
    const initTx = await br.initializeV2(router, nfa, speedBonusBps);
    await initTx.wait();
    console.log("initializeV2 tx:", initTx.hash);
  } else {
    console.log("initializeV2 already consumed; syncing config with owner setters");

    if (currentRouter.toLowerCase() !== router.toLowerCase()) {
      const tx = await br.setRouter(router);
      await tx.wait();
      console.log("setRouter tx:", tx.hash);
    }

    if (currentNfa.toLowerCase() !== nfa.toLowerCase()) {
      const tx = await br.setNfa(nfa);
      await tx.wait();
      console.log("setNfa tx:", tx.hash);
    }

    if (!currentSpeedBonusBps.eq(speedBonusBps)) {
      const tx = await br.setSpeedBonusBps(speedBonusBps);
      await tx.wait();
      console.log("setSpeedBonusBps tx:", tx.hash);
    }
  }

  const matchCount = await br.matchCount();
  const latest = await br.latestOpenMatch();

  console.log("Current matchCount:", matchCount.toString());
  console.log("Latest open matchId:", latest.toString());
  console.log("Router:", await br.router());
  console.log("NFA:", await br.nfa());
  console.log("Speed bonus bps:", (await br.speedBonusBps()).toString());

  const battleRoyaleAuthorized = await routerContract.authorizedSkills(PROXY);
  if (!battleRoyaleAuthorized) {
    const tx = await routerContract.authorizeSkill(PROXY, true);
    await tx.wait();
    console.log("authorizeSkill(BattleRoyale) tx:", tx.hash);
  } else {
    console.log("BattleRoyale is already authorized as a Router skill");
  }

  console.log("\nV2 features ready:");
  console.log("  [ok] changeRoom(matchId, newRoomId)");
  console.log("  [ok] claim(matchId)");
  console.log("  [ok] speed-weighted survivor prize distribution");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
