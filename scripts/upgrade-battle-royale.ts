/**
 * Upgrade BattleRoyale to V2 and initialize new config.
 *
 * Usage:
 *   BATTLE_ROYALE_ROUTER=0x... BATTLE_ROYALE_NFA=0x... BATTLE_ROYALE_SPEED_BONUS_BPS=100 \
 *   npx hardhat run scripts/upgrade-battle-royale.ts --network bscMainnet
 */
import { ethers, upgrades } from "hardhat";

const PROXY = "0x2B2182326Fd659156B2B119034A72D1C2cC9758D";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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
  const upgraded = await upgrades.upgradeProxy(PROXY, BattleRoyale, { kind: "uups" });
  await upgraded.deployed();

  console.log("\n[ok] BattleRoyale upgraded successfully");
  console.log("Proxy address (unchanged):", upgraded.address);

  const br = await ethers.getContractAt("BattleRoyale", PROXY);
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

  console.log("\nV2 features ready:");
  console.log("  [ok] changeRoom(matchId, newRoomId)");
  console.log("  [ok] claim(matchId)");
  console.log("  [ok] speed-weighted survivor prize distribution");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
