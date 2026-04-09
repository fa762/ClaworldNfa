import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function mineBlocks(count: number) {
  for (let i = 0; i < count; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

describe("BattleRoyale autonomy direct flow", function () {
  let owner: SignerWithAddress;
  let fulfiller: SignerWithAddress;
  let dispatcher: SignerWithAddress;
  let player: SignerWithAddress;
  let rival: SignerWithAddress;
  let treasury: SignerWithAddress;
  let fillers: SignerWithAddress[];

  let clw: any;
  let nfa: any;
  let router: any;
  let oracle: any;
  let registry: any;
  let hub: any;
  let battleRoyale: any;
  let adapter: any;

  const ACTION_BATTLE_ROYALE = 3;
  const PROTOCOL_BATTLE_ROYALE = ethers.utils.id("clawworld:existing:battle-royale");
  const ASSET_CLAWORLD = ethers.utils.id("asset:claworld");
  const stake = ethers.utils.parseEther("100");

  async function fillLegacyMatchOne() {
    const rooms = [1, 1, 2, 2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 10; i++) {
      await battleRoyale.connect(fillers[i]).enterRoom(1, rooms[i], stake);
    }
    await mineBlocks(6);
    await battleRoyale.reveal(1);
  }

  beforeEach(async function () {
    [owner, fulfiller, dispatcher, player, rival, treasury, ...fillers] =
      await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = await MockCLW.deploy();

    const MockAutonomyNFA = await ethers.getContractFactory("MockAutonomyNFA");
    nfa = await MockAutonomyNFA.deploy();
    await nfa.mint(player.address, 1);

    const MockAutonomyRouter = await ethers.getContractFactory("MockAutonomyRouter");
    router = await MockAutonomyRouter.deploy();
    await router.setClwBalance(1, ethers.utils.parseEther("1000"));
    await router.setLobsterMeta(1, 1, 1, 10);
    await router.setLobsterProfile(1, 62, 44, 51, 36, 48);
    await router.setLobsterCombat(1, 58, 33, 47, 42);

    const ClawOracle = await ethers.getContractFactory("ClawOracle");
    oracle = await upgrades.deployProxy(ClawOracle, [], { kind: "uups" });

    const ClawAutonomyRegistry = await ethers.getContractFactory("ClawAutonomyRegistry");
    registry = await upgrades.deployProxy(ClawAutonomyRegistry, [nfa.address], {
      kind: "uups",
    });

    const ClawOracleActionHub = await ethers.getContractFactory("ClawOracleActionHub");
    hub = await upgrades.deployProxy(
      ClawOracleActionHub,
      [oracle.address, registry.address, nfa.address],
      { kind: "uups" }
    );

    const BattleRoyale = await ethers.getContractFactory("BattleRoyale");
    battleRoyale = await upgrades.deployProxy(
      BattleRoyale,
      [clw.address, treasury.address],
      { kind: "uups" }
    );
    await battleRoyale.initializeV2(router.address, nfa.address, 100);

    const BattleRoyaleAdapter = await ethers.getContractFactory("BattleRoyaleAdapter");
    adapter = await BattleRoyaleAdapter.deploy(hub.address, battleRoyale.address, nfa.address);

    for (const signer of [rival, ...fillers.slice(0, 10)]) {
      await clw.mint(signer.address, ethers.utils.parseEther("5000"));
      await clw.connect(signer).approve(battleRoyale.address, ethers.constants.MaxUint256);
    }

    await oracle.setFulfiller(fulfiller.address, true);
    await registry.setExecutor(hub.address, true);
    await registry.setBalanceSource(router.address);
    await hub.setDispatcher(dispatcher.address, true);
    await hub.setAdapter(ACTION_BATTLE_ROYALE, adapter.address);
    await hub.setAdapterProtocol(ACTION_BATTLE_ROYALE, PROTOCOL_BATTLE_ROYALE);
    await battleRoyale.setAutonomousResolver(adapter.address, true);

    await registry.connect(player).setPolicy(
      1,
      ACTION_BATTLE_ROYALE,
      true,
      1,
      2,
      stake
    );
    await registry.connect(player).setRiskControls(1, ACTION_BATTLE_ROYALE, 0, 0);
    await registry
      .connect(player)
      .setApprovedAdapter(1, ACTION_BATTLE_ROYALE, adapter.address, true);
    await registry
      .connect(player)
      .setApprovedProtocol(1, PROTOCOL_BATTLE_ROYALE, true);
    await registry.connect(player).setAssetBudget(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      true,
      stake,
      0,
      ethers.utils.parseEther("1000")
    );
  });

  it("enters and claims through the existing BattleRoyale contract", async function () {
    const participant = await adapter.participantForNfa(1);
    await battleRoyale.setTriggerCount(2);
    await fillLegacyMatchOne();

    expect(await battleRoyale.latestOpenMatch()).to.equal(2);
    const matchTwoConfig = await battleRoyale.getMatchConfig(2);
    expect(matchTwoConfig[1]).to.equal(2);

    const enterPayload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [
        0,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint8[]", "uint256[]"],
          [2, [1, 2, 3], [stake, stake, stake]]
        ),
      ]
    );

    const enterRequestId = await hub.connect(dispatcher).callStatic.requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      stake,
      enterPayload,
      "Review the live Battle Royale arena, pick the best room, and enter with a bounded stake.",
      3
    );

    await hub.connect(dispatcher).requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      stake,
      enterPayload,
      "Review the live Battle Royale arena, pick the best room, and enter with a bounded stake.",
      3
    );

    await oracle
      .connect(fulfiller)
      .fulfillReasoning(enterRequestId, 0, "ipfs://battle-royale-enter-reasoning");
    await hub.syncOracleResult(enterRequestId);
    await hub.connect(dispatcher).executeSyncedAction(enterRequestId);

    const playerInfo = await battleRoyale.getPlayerInfo(2, participant);
    expect(playerInfo.roomId).to.equal(1);
    expect(playerInfo.stake).to.equal(stake);
    expect(await battleRoyale.autonomousPlayerNfa(2, participant)).to.equal(1);
    expect(await battleRoyale.getEffectivePlayerNfa(2, participant)).to.equal(1);
    expect(await router.clwBalances(1)).to.equal(ethers.utils.parseEther("900"));

    await battleRoyale.connect(rival).enterRoom(2, 2, stake);

    let matchInfo = await battleRoyale.getMatchInfo(2);
    expect(matchInfo.status).to.equal(1); // PENDING_REVEAL

    await mineBlocks(6);
    await battleRoyale.reveal(2);
    matchInfo = await battleRoyale.getMatchInfo(2);
    expect(matchInfo.status).to.equal(2); // SETTLED

    const claimable = await battleRoyale.getClaimable(2, participant);

    const claimPayload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [3, ethers.utils.defaultAbiCoder.encode(["uint256"], [2])]
    );

    const claimRequestId = await hub.connect(dispatcher).callStatic.requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      0,
      claimPayload,
      "Claim the finished Battle Royale result for this NFA if the arena round is settled.",
      2
    );

    await hub.connect(dispatcher).requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      0,
      claimPayload,
      "Claim the finished Battle Royale result for this NFA if the arena round is settled.",
      2
    );

    await oracle
      .connect(fulfiller)
      .fulfillReasoning(claimRequestId, 0, "ipfs://battle-royale-claim-reasoning");
    await hub.syncOracleResult(claimRequestId);
    await hub.connect(dispatcher).executeSyncedAction(claimRequestId);

    const claimReceipt = await hub.getActionReceipt(claimRequestId);
    expect(claimReceipt.status).to.equal(4);
    expect(claimReceipt.clwCredit).to.equal(claimable);
    expect(await router.clwBalances(1)).to.equal(
      ethers.utils.parseEther("900").add(claimable)
    );
    expect(await battleRoyale.claimed(2, participant)).to.equal(true);
  });

  it("can choose to wait instead of claiming immediately", async function () {
    const participant = await adapter.participantForNfa(1);
    await battleRoyale.setTriggerCount(2);
    await fillLegacyMatchOne();

    const enterPayload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [
        0,
        ethers.utils.defaultAbiCoder.encode(
          ["uint256", "uint8[]", "uint256[]"],
          [2, [1, 2, 3], [stake, stake, stake]]
        ),
      ]
    );

    const enterRequestId = await hub.connect(dispatcher).callStatic.requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      stake,
      enterPayload,
      "Enter the live Battle Royale arena with a bounded stake.",
      3
    );

    await hub.connect(dispatcher).requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      stake,
      enterPayload,
      "Enter the live Battle Royale arena with a bounded stake.",
      3
    );

    await oracle
      .connect(fulfiller)
      .fulfillReasoning(enterRequestId, 0, "ipfs://battle-royale-enter-reasoning");
    await hub.syncOracleResult(enterRequestId);
    await hub.connect(dispatcher).executeSyncedAction(enterRequestId);

    await battleRoyale.connect(rival).enterRoom(2, 2, stake);
    await mineBlocks(6);
    await battleRoyale.reveal(2);

    const claimable = await battleRoyale.getClaimable(2, participant);

    const claimPayload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [3, ethers.utils.defaultAbiCoder.encode(["uint256"], [2])]
    );

    const claimRequestId = await hub.connect(dispatcher).callStatic.requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      0,
      claimPayload,
      "Claim the settled Battle Royale result now or wait for a later turn.",
      2
    );

    await hub.connect(dispatcher).requestAutonomousAction(
      1,
      ACTION_BATTLE_ROYALE,
      ASSET_CLAWORLD,
      0,
      claimPayload,
      "Claim the settled Battle Royale result now or wait for a later turn.",
      2
    );

    await oracle
      .connect(fulfiller)
      .fulfillReasoning(claimRequestId, 1, "ipfs://battle-royale-claim-wait");
    await hub.syncOracleResult(claimRequestId);
    await hub.connect(dispatcher).executeSyncedAction(claimRequestId);

    const claimReceipt = await hub.getActionReceipt(claimRequestId);
    expect(claimReceipt.status).to.equal(4);
    expect(claimReceipt.clwCredit).to.equal(0);
    expect(await battleRoyale.claimed(2, participant)).to.equal(false);
    expect(await battleRoyale.getClaimable(2, participant)).to.equal(claimable);
    expect(await router.clwBalances(1)).to.equal(ethers.utils.parseEther("900"));
  });
});
