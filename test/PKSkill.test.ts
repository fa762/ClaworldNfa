import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW, PKSkill } from "../typechain-types";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("PKSkill", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let clw: MockCLW;
  let pk: PKSkill;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let playerA: SignerWithAddress;
  let playerB: SignerWithAddress;

  const defaultMetadata = {
    persona: "", experience: "", voiceHash: "",
    animationURI: "", vaultURI: "",
    vaultHash: ethers.constants.HashZero,
  };

  let tokenA: any;
  let tokenB: any;

  async function setupLobster(
    user: SignerWithAddress,
    overrides: any = {}
  ) {
    const lobster = {
      rarity: 0, shelter: 1,
      courage: 50, wisdom: 50, social: 50, create: 50, grit: 50,
      str: 50, def: 30, spd: 40, vit: 40,
      mutation1: ethers.constants.HashZero,
      mutation2: ethers.constants.HashZero,
      level: 10, xp: 0, lastUpkeepTime: 0,
      ...overrides,
    };
    await nfa.connect(minter).mintTo(user.address, router.address, "", defaultMetadata);
    const id = await nfa.getTotalSupply();
    await router.connect(minter).initializeLobster(id, lobster);
    // Fund with CLW
    await clw.mint(user.address, ethers.utils.parseEther("10000"));
    await clw.connect(user).approve(router.address, ethers.constants.MaxUint256);
    await router.connect(user).depositCLW(id, ethers.utils.parseEther("5000"));
    return id;
  }

  function strategyHash(strategy: number, salt: string, address: string): string {
    return ethers.utils.solidityKeccak256(
      ["uint8", "bytes32", "address"],
      [strategy, salt, address]
    );
  }

  beforeEach(async function () {
    [owner, minter, treasury, playerA, playerB] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" })) as ClawNFA;

    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(ClawRouter, [clw.address, nfa.address, treasury.address], { kind: "uups" })) as ClawRouter;

    const PKSkill = await ethers.getContractFactory("PKSkill");
    pk = (await upgrades.deployProxy(PKSkill, [router.address, nfa.address], { kind: "uups" })) as PKSkill;

    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);
    await router.authorizeSkill(pk.address, true);

    tokenA = await setupLobster(playerA);
    tokenB = await setupLobster(playerB);
  });

  async function fullPKFlow(
    stratA: number,
    stratB: number,
    stake: string = "100"
  ) {
    const stakeAmount = ethers.utils.parseEther(stake);
    const saltA = ethers.utils.formatBytes32String("saltA");
    const saltB = ethers.utils.formatBytes32String("saltB");

    // Create & join
    await pk.connect(playerA).createMatch(tokenA, stakeAmount);
    const matchId = 1;
    await pk.connect(playerB).joinMatch(matchId, tokenB);

    // Commit
    const hashA = strategyHash(stratA, saltA, playerA.address);
    const hashB = strategyHash(stratB, saltB, playerB.address);
    await pk.connect(playerA).commitStrategy(matchId, hashA);
    await pk.connect(playerB).commitStrategy(matchId, hashB);

    // Reveal
    await pk.connect(playerA).revealStrategy(matchId, stratA, saltA);
    await pk.connect(playerB).revealStrategy(matchId, stratB, saltB);

    // Settle
    await pk.settle(matchId);

    return matchId;
  }

  describe("Match Lifecycle", function () {
    it("should create a match and lock stake", async function () {
      const stake = ethers.utils.parseEther("100");
      const balBefore = await router.clwBalances(tokenA);
      await pk.connect(playerA).createMatch(tokenA, stake);
      const balAfter = await router.clwBalances(tokenA);

      expect(balBefore.sub(balAfter)).to.equal(stake);
    });

    it("should allow join and lock opponent stake", async function () {
      const stake = ethers.utils.parseEther("100");
      await pk.connect(playerA).createMatch(tokenA, stake);

      const balBefore = await router.clwBalances(tokenB);
      await pk.connect(playerB).joinMatch(1, tokenB);
      const balAfter = await router.clwBalances(tokenB);

      expect(balBefore.sub(balAfter)).to.equal(stake);
    });

    it("should complete full PK flow (Balanced vs Balanced)", async function () {
      await fullPKFlow(1, 1); // Both balanced

      const match = await pk.getMatch(1);
      expect(match.phase).to.equal(4); // SETTLED
    });

    it("should distribute rewards correctly (10% burn)", async function () {
      const stake = ethers.utils.parseEther("100");
      const balA0 = await router.clwBalances(tokenA);
      const balB0 = await router.clwBalances(tokenB);

      await fullPKFlow(1, 1); // Balanced vs Balanced

      const balA1 = await router.clwBalances(tokenA);
      const balB1 = await router.clwBalances(tokenB);

      // Total stake = 200, burned = 20, winner gets 180
      // One gained 80 (net: +180 - 100 stake), other lost 100
      const totalChange = balA1.add(balB1).sub(balA0).sub(balB0);
      // Total change should be -200 (staked) + 180 (winner reward) = -20 (burned)
      expect(totalChange).to.equal(ethers.utils.parseEther("-20"));
    });

    it("should give XP to both players", async function () {
      const stateA0 = await router.getLobsterState(tokenA);
      const stateB0 = await router.getLobsterState(tokenB);

      await fullPKFlow(1, 1);

      const stateA1 = await router.getLobsterState(tokenA);
      const stateB1 = await router.getLobsterState(tokenB);

      // Winner gets 50 XP, loser gets 25 XP
      const xpA = stateA1.xp - stateA0.xp;
      const xpB = stateB1.xp - stateB0.xp;
      expect([xpA, xpB]).to.include(50);
      expect([xpA, xpB]).to.include(25);
    });
  });

  describe("Strategy Impact", function () {
    it("should favor AllAttack vs AllDefense when ATK >> DEF", async function () {
      // Player A: high STR, low DEF → AllAttack optimal
      // Player B: low STR, high DEF → AllDefense optimal
      // With identical stats and AllAttack(A) vs AllDefense(B):
      // A: effStr = 50*1.5=75, effDef = 30*0.5=15
      // B: effStr = 50*0.5=25, effDef = 30*1.5=45
      // A attacks B: 75 - 45 = 30
      // B attacks A: 25 - 15 = 10
      // A deals more damage → A wins

      const balA0 = await router.clwBalances(tokenA);
      await fullPKFlow(0, 2); // AllAttack vs AllDefense
      const balA1 = await router.clwBalances(tokenA);

      // A should win (gained CLW net)
      expect(balA1).to.be.gt(balA0.sub(ethers.utils.parseEther("100")));
    });
  });

  describe("Commit-Reveal Security", function () {
    it("should reject invalid reveal", async function () {
      const stake = ethers.utils.parseEther("100");
      const saltA = ethers.utils.formatBytes32String("saltA");
      const saltB = ethers.utils.formatBytes32String("saltB");

      await pk.connect(playerA).createMatch(tokenA, stake);
      await pk.connect(playerB).joinMatch(1, tokenB);

      const hashA = strategyHash(0, saltA, playerA.address);
      const hashB = strategyHash(1, saltB, playerB.address);
      await pk.connect(playerA).commitStrategy(1, hashA);
      await pk.connect(playerB).commitStrategy(1, hashB);

      // Try to reveal wrong strategy
      await expect(
        pk.connect(playerA).revealStrategy(1, 1, saltA) // committed 0, revealing 1
      ).to.be.revertedWith("Invalid reveal");
    });

    it("should reject non-participant commit", async function () {
      const stake = ethers.utils.parseEther("100");
      await pk.connect(playerA).createMatch(tokenA, stake);
      await pk.connect(playerB).joinMatch(1, tokenB);

      await expect(
        pk.connect(owner).commitStrategy(1, ethers.constants.HashZero)
      ).to.be.revertedWith("Not a participant");
    });
  });

  describe("Timeout", function () {
    it("should allow cancel if no one joins", async function () {
      const stake = ethers.utils.parseEther("100");
      const balBefore = await router.clwBalances(tokenA);
      await pk.connect(playerA).createMatch(tokenA, stake);

      // Creator can cancel immediately
      await pk.connect(playerA).cancelMatch(1);

      const balAfter = await router.clwBalances(tokenA);
      expect(balAfter).to.equal(balBefore);
    });

    it("should settle in favor of revealer on timeout", async function () {
      const stake = ethers.utils.parseEther("100");
      const saltA = ethers.utils.formatBytes32String("saltA");
      const saltB = ethers.utils.formatBytes32String("saltB");

      await pk.connect(playerA).createMatch(tokenA, stake);
      await pk.connect(playerB).joinMatch(1, tokenB);

      // Both commit
      const hashA = strategyHash(0, saltA, playerA.address);
      const hashB = strategyHash(1, saltB, playerB.address);
      await pk.connect(playerA).commitStrategy(1, hashA);
      await pk.connect(playerB).commitStrategy(1, hashB);

      // Only A reveals
      await pk.connect(playerA).revealStrategy(1, 0, saltA);
      // B doesn't reveal → wait for timeout

      // Can't settle yet
      await expect(pk.settle(1)).to.be.revertedWith("Reveal window open");

      await increaseTime(31 * 60); // 31 minutes

      const balA0 = await router.clwBalances(tokenA);
      await pk.settle(1);
      const balA1 = await router.clwBalances(tokenA);

      // A wins by timeout, gets 180 (200 - 20 burned)
      expect(balA1.sub(balA0)).to.equal(ethers.utils.parseEther("180"));
    });
  });

  describe("Self-fight Prevention", function () {
    it("should reject fighting self", async function () {
      const stake = ethers.utils.parseEther("100");
      await pk.connect(playerA).createMatch(tokenA, stake);
      await expect(
        pk.connect(playerA).joinMatch(1, tokenA)
      ).to.be.revertedWith("Cannot fight self");
    });
  });

  describe("View Functions", function () {
    it("should return match state", async function () {
      const stake = ethers.utils.parseEther("100");
      await pk.connect(playerA).createMatch(tokenA, stake);

      const match = await pk.getMatch(1);
      expect(match.nfaA).to.equal(tokenA);
      expect(match.stake).to.equal(stake);
      expect(match.phase).to.equal(0); // OPEN
    });

    it("should compute strategy hash correctly", async function () {
      const salt = ethers.utils.formatBytes32String("test");
      const hash = await pk.getStrategyHash(1, salt, playerA.address);
      const expected = ethers.utils.solidityKeccak256(
        ["uint8", "bytes32", "address"],
        [1, salt, playerA.address]
      );
      expect(hash).to.equal(expected);
    });
  });
});
