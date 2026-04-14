import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BattleRoyale, ClawNFA, ClawRouter, MockCLW } from "../typechain-types";

async function mineBlocks(count: number) {
  for (let i = 0; i < count; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

describe("BattleRoyale", function () {
  let battleRoyale: BattleRoyale;
  let clw: MockCLW;
  let nfa: ClawNFA;
  let router: ClawRouter;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let players: SignerWithAddress[];

  const stake = ethers.utils.parseEther("100");
  const defaultMetadata = {
    persona: "brave",
    experience: "veteran",
    voiceHash: "0x1234",
    animationURI: "ipfs://anim",
    vaultURI: "ipfs://vault",
    vaultHash: ethers.utils.formatBytes32String("vaulthash"),
  };

  const defaultLobster = {
    rarity: 0,
    shelter: 1,
    courage: 50,
    wisdom: 50,
    social: 50,
    create: 50,
    grit: 50,
    str: 30,
    def: 30,
    spd: 30,
    vit: 30,
    mutation1: ethers.constants.HashZero,
    mutation2: ethers.constants.HashZero,
    level: 1,
    xp: 0,
    lastUpkeepTime: 0,
  };

  async function setupLobster(
    user: SignerWithAddress,
    lobsterOverrides: Partial<typeof defaultLobster> = {}
  ) {
    const lobster = { ...defaultLobster, ...lobsterOverrides };
    await nfa.connect(minter).mintTo(user.address, router.address, "ipfs://meta", defaultMetadata);
    const tokenId = await nfa.getTotalSupply();
    await router.connect(minter).initializeLobster(tokenId, lobster);
    return tokenId;
  }

  async function fillDefaultMatch(roomByPlayer: number[]) {
    for (let i = 0; i < 10; i++) {
      await battleRoyale.connect(players[i]).enterRoom(1, roomByPlayer[i], stake);
    }
  }

  async function revealMatch(matchId: number) {
    await mineBlocks(6);
    await battleRoyale.reveal(matchId);
  }

  beforeEach(async function () {
    [owner, minter, treasury, ...players] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;
    await clw.deployed();

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(
      ClawNFA,
      ["Claw NFA", "CNFA", treasury.address],
      { kind: "uups" }
    )) as ClawNFA;
    await nfa.deployed();

    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(
      ClawRouter,
      [clw.address, nfa.address, treasury.address],
      { kind: "uups" }
    )) as ClawRouter;
    await router.deployed();

    const BattleRoyale = await ethers.getContractFactory("BattleRoyale");
    battleRoyale = (await upgrades.deployProxy(
      BattleRoyale,
      [clw.address, treasury.address],
      { kind: "uups" }
    )) as BattleRoyale;
    await battleRoyale.deployed();

    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);

    for (const player of players.slice(0, 12)) {
      await clw.mint(player.address, ethers.utils.parseEther("5000"));
      await clw.connect(player).approve(battleRoyale.address, ethers.constants.MaxUint256);
    }
  });

  it("allows one room change per match", async function () {
    await battleRoyale.connect(players[0]).enterRoom(1, 1, stake);

    await battleRoyale.connect(players[0]).changeRoom(1, 2);
    expect(await battleRoyale.playerRoom(1, players[0].address)).to.equal(2);

    await expect(
      battleRoyale.connect(players[0]).changeRoom(1, 3)
    ).to.be.revertedWith("Room change limit reached");
  });

  it("settles a round and pays survivors while losers claim zero", async function () {
    await fillDefaultMatch([1, 1, 2, 2, 3, 4, 5, 6, 7, 8]);

    const matchInfoBefore = await battleRoyale.getMatchInfo(1);
    expect(matchInfoBefore.status).to.equal(1);

    await revealMatch(1);

    const matchInfoAfter = await battleRoyale.getMatchInfo(1);
    const losingRoom = matchInfoAfter.losingRoom;
    expect(matchInfoAfter.status).to.equal(2);

    let survivor: SignerWithAddress | undefined;
    let loserSigner: SignerWithAddress | undefined;

    for (const player of players.slice(0, 10)) {
      const room = await battleRoyale.playerRoom(1, player.address);
      if (room === losingRoom && !loserSigner) {
        loserSigner = player;
      }
      if (room !== losingRoom && !survivor) {
        survivor = player;
      }
    }

    expect(survivor).to.not.equal(undefined);
    expect(loserSigner).to.not.equal(undefined);

    const loserClaimable = await battleRoyale.getClaimable(1, loserSigner!.address);
    const survivorClaimable = await battleRoyale.getClaimable(1, survivor!.address);

    expect(loserClaimable).to.equal(0);
    expect(survivorClaimable).to.be.gt(stake);

    await expect(battleRoyale.connect(loserSigner!).claim(1))
      .to.emit(battleRoyale, "PlayerClaimed")
      .withArgs(1, loserSigner!.address, 0, 0, 0);

    const survivorBalanceBefore = await clw.balanceOf(survivor!.address);
    await battleRoyale.connect(survivor!).claim(1);
    const survivorBalanceAfter = await clw.balanceOf(survivor!.address);

    expect(survivorBalanceAfter.sub(survivorBalanceBefore)).to.equal(survivorClaimable);
    expect(await battleRoyale.latestOpenMatch()).to.equal(2);
  });

  it("allows any player to reveal after the blockhash window expires", async function () {
    await fillDefaultMatch([1, 1, 2, 2, 3, 4, 5, 6, 7, 8]);

    const matchInfoBefore = await battleRoyale.getMatchInfo(1);
    expect(matchInfoBefore.status).to.equal(1);

    await mineBlocks(262);
    await battleRoyale.connect(players[0]).reveal(1);

    const matchInfoAfter = await battleRoyale.getMatchInfo(1);
    const settlement = await battleRoyale.getMatchSettlement(1);

    expect(matchInfoAfter.status).to.equal(2);
    expect(settlement.fallbackEntropyUsed).to.equal(true);
    expect(await battleRoyale.latestOpenMatch()).to.equal(2);
  });

  it("can pay a manual winner from battle balance plus router treasury in a mixed-source round", async function () {
    await battleRoyale.initializeV2(router.address, nfa.address, 100);
    await battleRoyale.setTriggerCount(2);
    await router.authorizeSkill(battleRoyale.address, true);
    await battleRoyale.setAutonomousResolver(owner.address, true);
    await fillDefaultMatch([1, 1, 2, 2, 3, 4, 5, 6, 7, 8]);
    await revealMatch(1);

    const autonomousPlayer = players[0];
    const manualPlayer = players[1];
    const autonomousTokenId = await setupLobster(autonomousPlayer, { spd: 70 });

    await clw.connect(autonomousPlayer).approve(router.address, ethers.constants.MaxUint256);
    await router.connect(autonomousPlayer).depositCLW(autonomousTokenId, ethers.utils.parseEther("1000"));

    for (let attempt = 0; attempt < 5; attempt++) {
      const matchId = Number((await battleRoyale.latestOpenMatch()).toString());

      await battleRoyale
        .connect(owner)
        .autonomousEnterRoomFor(matchId, autonomousPlayer.address, autonomousTokenId, 1, stake);
      await battleRoyale.connect(manualPlayer).enterRoom(matchId, 2, stake);

      await revealMatch(matchId);

      const matchInfo = await battleRoyale.getMatchInfo(matchId);
      if (Number(matchInfo.losingRoom) === 2) {
        continue;
      }

      const claimable = await battleRoyale.getClaimable(matchId, manualPlayer.address);
      expect(claimable).to.be.gt(stake);

      const manualBalanceBefore = await clw.balanceOf(manualPlayer.address);
      await battleRoyale.connect(manualPlayer).claim(matchId);
      const manualBalanceAfter = await clw.balanceOf(manualPlayer.address);

      expect(manualBalanceAfter.sub(manualBalanceBefore)).to.equal(claimable);
      return;
    }

    expect.fail("manual entrant lost in every attempt");
  });

  it("lets one owner enter the same match with multiple NFAs and stake from reserve", async function () {
    await battleRoyale.initializeV2(router.address, nfa.address, 100);
    await router.authorizeSkill(battleRoyale.address, true);
    await battleRoyale.setTriggerCount(3);
    await fillDefaultMatch([1, 1, 2, 2, 3, 4, 5, 6, 7, 8]);
    await revealMatch(1);

    const tokenIdA = await setupLobster(players[0], { spd: 70 });
    const tokenIdB = await setupLobster(players[0], { spd: 30 });
    await clw.connect(players[0]).approve(router.address, ethers.constants.MaxUint256);
    await router.connect(players[0]).depositCLW(tokenIdA, ethers.utils.parseEther("1000"));
    await router.connect(players[0]).depositCLW(tokenIdB, ethers.utils.parseEther("1000"));

    const participantA = await battleRoyale.participantForNfa(tokenIdA);
    const participantB = await battleRoyale.participantForNfa(tokenIdB);

    await battleRoyale.connect(players[0]).enterRoomForNfa(2, tokenIdA, 1, stake);
    await battleRoyale.connect(players[0]).enterRoomForNfa(2, tokenIdB, 2, stake);

    expect(await battleRoyale.playerRoom(2, participantA)).to.equal(1);
    expect(await battleRoyale.playerRoom(2, participantB)).to.equal(2);
    expect(await router.clwBalances(tokenIdA)).to.equal(ethers.utils.parseEther("900"));
    expect(await router.clwBalances(tokenIdB)).to.equal(ethers.utils.parseEther("900"));

    await battleRoyale.connect(players[0]).changeRoomForNfa(2, tokenIdB, 3);
    expect(await battleRoyale.playerRoom(2, participantB)).to.equal(3);

    await expect(
      battleRoyale.connect(players[0]).enterRoomForNfa(2, tokenIdA, 5, stake)
    ).to.be.revertedWith("Already entered this match");

    await expect(
      battleRoyale.connect(players[0]).changeRoomForNfa(2, tokenIdB, 5)
    ).to.be.revertedWith("Room change limit reached");

    await battleRoyale.connect(players[1]).enterRoom(2, 4, stake);

    await revealMatch(2);

    const claimableA = await battleRoyale.getClaimable(2, participantA);
    const claimableB = await battleRoyale.getClaimable(2, participantB);
    const winningTokenId = claimableA > 0 ? tokenIdA : tokenIdB;
    const claimable = claimableA > 0 ? claimableA : claimableB;

    expect(claimable).to.be.gt(0);

    const beforeBalance = await router.clwBalances(winningTokenId);
    await battleRoyale.connect(players[0]).claimForNfa(2, winningTokenId);
    const afterBalance = await router.clwBalances(winningTokenId);

    expect(afterBalance.sub(beforeBalance)).to.equal(claimable);
  });

  it("gives higher-speed survivors a larger prize share", async function () {
    await battleRoyale.initializeV2(router.address, nfa.address, 100);

    const fastPlayer = players[0];
    const slowPlayer = players[1];
    await setupLobster(fastPlayer, { spd: 80 });
    await setupLobster(slowPlayer, { spd: 20 });

    let targetMatchId = 1;

    for (let attempt = 0; attempt < 5; attempt++) {
      const latestOpenMatch = await battleRoyale.latestOpenMatch();
      targetMatchId = latestOpenMatch.toNumber();

      const entrants = [
        { signer: fastPlayer, room: 1 },
        { signer: slowPlayer, room: 1 },
        { signer: players[2], room: 2 },
        { signer: players[3], room: 3 },
        { signer: players[4], room: 4 },
        { signer: players[5], room: 5 },
        { signer: players[6], room: 6 },
        { signer: players[7], room: 7 },
        { signer: players[8], room: 8 },
        { signer: players[9], room: 9 },
      ];

      for (const entrant of entrants) {
        await battleRoyale.connect(entrant.signer).enterRoom(targetMatchId, entrant.room, stake);
      }

      await revealMatch(targetMatchId);

      const matchInfo = await battleRoyale.getMatchInfo(targetMatchId);
      if (matchInfo.losingRoom !== 1) {
        const fastClaimable = await battleRoyale.getClaimable(targetMatchId, fastPlayer.address);
        const slowClaimable = await battleRoyale.getClaimable(targetMatchId, slowPlayer.address);
        const fastWeight = await battleRoyale.survivorWeight(targetMatchId, fastPlayer.address);
        const slowWeight = await battleRoyale.survivorWeight(targetMatchId, slowPlayer.address);

        expect(fastWeight).to.be.gt(slowWeight);
        expect(fastClaimable).to.be.gt(slowClaimable);
        return;
      }
    }

    expect.fail("room 1 lost in every attempt");
  });

  it("snapshots match config when a new round opens", async function () {
    const matchOneConfig = await battleRoyale.getMatchConfig(1);
    expect(matchOneConfig[0]).to.equal(ethers.utils.parseEther("100"));
    expect(matchOneConfig[1]).to.equal(10);
    expect(matchOneConfig[2]).to.equal(1000);
    expect(matchOneConfig[3]).to.equal(5);

    await battleRoyale.setMinStake(ethers.utils.parseEther("150"));
    await battleRoyale.setTriggerCount(10);
    await battleRoyale.setTreasuryBps(500);
    await battleRoyale.setRevealDelay(3);

    await fillDefaultMatch([1, 1, 2, 2, 3, 4, 5, 6, 7, 8]);
    await revealMatch(1);

    const matchTwoConfig = await battleRoyale.getMatchConfig(2);
    expect(matchTwoConfig[0]).to.equal(ethers.utils.parseEther("150"));
    expect(matchTwoConfig[1]).to.equal(10);
    expect(matchTwoConfig[2]).to.equal(500);
    expect(matchTwoConfig[3]).to.equal(3);

    const matchOneConfigAfter = await battleRoyale.getMatchConfig(1);
    expect(matchOneConfigAfter[0]).to.equal(ethers.utils.parseEther("100"));
    expect(matchOneConfigAfter[2]).to.equal(1000);
    expect(matchOneConfigAfter[3]).to.equal(5);
  });

  it("only allows initializeV2 once", async function () {
    await battleRoyale.initializeV2(router.address, nfa.address, 100);

    await expect(
      battleRoyale.initializeV2(router.address, nfa.address, 100)
    ).to.be.reverted;
  });
});
