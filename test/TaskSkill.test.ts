import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW, TaskSkill, WorldState } from "../typechain-types";

describe("TaskSkill", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let clw: MockCLW;
  let worldState: WorldState;
  let taskSkill: TaskSkill;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let operator: SignerWithAddress;

  const defaultMetadata = {
    persona: "", experience: "", voiceHash: "",
    animationURI: "", vaultURI: "",
    vaultHash: ethers.constants.HashZero,
  };

  const defaultLobster = {
    rarity: 0, shelter: 1,
    courage: 50, wisdom: 50, social: 50, create: 50, grit: 50,
    str: 30, def: 30, spd: 30, vit: 30,
    mutation1: ethers.constants.HashZero,
    mutation2: ethers.constants.HashZero,
    level: 1, xp: 0, lastUpkeepTime: 0,
  };

  let tokenId: any;

  beforeEach(async function () {
    [owner, minter, treasury, user1, operator] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" })) as ClawNFA;

    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(ClawRouter, [clw.address, nfa.address, treasury.address], { kind: "uups" })) as ClawRouter;

    const WorldState = await ethers.getContractFactory("WorldState");
    worldState = (await upgrades.deployProxy(WorldState, [], { kind: "uups" })) as WorldState;

    const TaskSkillFactory = await ethers.getContractFactory("TaskSkill");
    taskSkill = (await upgrades.deployProxy(TaskSkillFactory, [router.address, worldState.address], { kind: "uups" })) as TaskSkill;

    // Deploy PersonalityEngine
    const PE = await ethers.getContractFactory("PersonalityEngine");
    const pe = await upgrades.deployProxy(PE, [router.address, nfa.address], { kind: "uups" });

    // Roles
    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);
    await router.authorizeSkill(taskSkill.address, true);
    await router.setPersonalityEngine(pe.address);
    await pe.setAuthorizedCaller(router.address, true);
    await taskSkill.setOperator(operator.address, true);

    // Create lobster
    await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
    tokenId = await nfa.getTotalSupply();
    await router.connect(minter).initializeLobster(tokenId, defaultLobster);

    // Give CLW for initial balance
    await clw.mint(user1.address, ethers.utils.parseEther("1000"));
    await clw.connect(user1).approve(router.address, ethers.constants.MaxUint256);
    await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));
  });

  it("should reward CLW and XP on task completion", async function () {
    const clwReward = ethers.utils.parseEther("50");
    await taskSkill.connect(operator).completeTask(tokenId, 30, clwReward, 10000); // 100% match

    expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1050"));
    const state = await router.getLobsterState(tokenId);
    expect(state.xp).to.equal(30);
  });

  it("should apply match score multiplier", async function () {
    const clwReward = ethers.utils.parseEther("100");
    // 50% match score → 50 CLW actual
    await taskSkill.connect(operator).completeTask(tokenId, 10, clwReward, 5000);

    expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1050"));
  });

  it("should apply world state reward multiplier", async function () {
    // Set 2x reward multiplier via timelock
    await worldState.proposeWorldState(20000, 1000, 10000, 10000, ethers.constants.HashZero);
    await ethers.provider.send("evm_increaseTime", [24 * 3600 + 1]);
    await ethers.provider.send("evm_mine", []);
    await worldState.executeWorldState();

    const clwReward = ethers.utils.parseEther("50");
    // 100% match × 2x world = 100 CLW actual
    await taskSkill.connect(operator).completeTask(tokenId, 10, clwReward, 10000);

    expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1100"));
  });

  it("should reject non-operator", async function () {
    await expect(
      taskSkill.connect(user1).completeTask(tokenId, 10, ethers.utils.parseEther("50"), 10000)
    ).to.be.revertedWith("Not authorized operator");
  });

  it("should reject score too high", async function () {
    await expect(
      taskSkill.connect(operator).completeTask(tokenId, 10, ethers.utils.parseEther("50"), 30000)
    ).to.be.revertedWith("Score too high");
  });

  it("should emit TaskCompleted event", async function () {
    const clwReward = ethers.utils.parseEther("50");
    await expect(taskSkill.connect(operator).completeTask(tokenId, 20, clwReward, 10000))
      .to.emit(taskSkill, "TaskCompleted")
      .withArgs(tokenId, 20, clwReward, clwReward, 10000);
  });

  // ─── ownerCompleteTypedTask tests ───

  describe("ownerCompleteTypedTask", function () {
    beforeEach(async function () {
      await taskSkill.setNFA(nfa.address);
    });

    it("should allow NFA owner to complete task directly", async function () {
      const clwReward = ethers.utils.parseEther("50");
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 0, 30, clwReward, 10000);

      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1050"));
      const state = await router.getLobsterState(tokenId);
      expect(state.xp).to.equal(30);
    });

    it("should reject non-owner", async function () {
      await expect(
        taskSkill.connect(operator).ownerCompleteTypedTask(tokenId, 0, 30, ethers.utils.parseEther("50"), 10000)
      ).to.be.revertedWith("Not NFA owner");
    });

    it("should enforce XP cap (max 50)", async function () {
      await expect(
        taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 0, 51, ethers.utils.parseEther("50"), 10000)
      ).to.be.revertedWith("XP cap exceeded");
    });

    it("should enforce CLW cap (max 100)", async function () {
      await expect(
        taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 0, 30, ethers.utils.parseEther("101"), 10000)
      ).to.be.revertedWith("CLW cap exceeded");
    });

    it("should enforce 4-hour cooldown", async function () {
      const clwReward = ethers.utils.parseEther("50");
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 0, 30, clwReward, 10000);

      await expect(
        taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 1, 20, clwReward, 10000)
      ).to.be.revertedWith("Cooldown active");

      // Fast forward 4 hours
      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 1, 20, clwReward, 10000);
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1100"));
    });

    it("should trigger personality evolution on high match", async function () {
      const clwReward = ethers.utils.parseEther("50");
      // social=50 → matchScore=10000 (1.0x) → triggers personality drift
      await expect(
        taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 2, 30, clwReward, 0) // param ignored, on-chain calc
      ).to.emit(taskSkill, "TaskPersonalityDrift").withArgs(tokenId, 2, 1);

      const state = await router.getLobsterState(tokenId);
      expect(state.social).to.equal(51); // was 50, +1
    });

    it("should calculate matchScore on-chain, ignore player input", async function () {
      // Lobster has courage=50, so courage matchScore = 50*200 = 10000 = 1.0x
      // clwReward=100 CLW * 1.0x * worldMul(1.0x) = 100 CLW
      const clwReward = ethers.utils.parseEther("100");

      // Player tries to pass matchScore=20000 (2.0x) — should be ignored
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId, 0, 30, clwReward, 20000);

      // Should get 100 CLW (1.0x from courage=50), NOT 200 CLW (2.0x)
      const bal = await router.clwBalances(tokenId);
      expect(bal).to.equal(ethers.utils.parseEther("1100")); // 1000 + 100
    });

    it("should give less reward for low personality dimension", async function () {
      // Create lobster with courage=10, wisdom=90
      await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
      const tokenId2 = await nfa.getTotalSupply();
      await router.connect(minter).initializeLobster(tokenId2, {
        ...defaultLobster, courage: 10, wisdom: 90,
      });
      // Fund user1 with more CLW for deposit
      await clw.mint(user1.address, ethers.utils.parseEther("1000"));
      await router.connect(user1).depositCLW(tokenId2, ethers.utils.parseEther("1000"));

      const clwReward = ethers.utils.parseEther("100");

      // Do courage task (courage=10, matchScore=2000=0.2x) → expect 20 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId2, 0, 10, clwReward, 0);
      const bal1 = await router.clwBalances(tokenId2);
      expect(bal1).to.equal(ethers.utils.parseEther("1020")); // 1000 + 20

      // Wait cooldown
      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Do wisdom task (wisdom=90, matchScore=18000=1.8x) → expect 180 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId2, 1, 10, clwReward, 0);
      const bal2 = await router.clwBalances(tokenId2);
      expect(bal2).to.equal(ethers.utils.parseEther("1200")); // 1020 + 180
    });

    it("should apply diminishing returns for consecutive same-type tasks", async function () {
      // Use a lobster with courage=40 so matchScore=8000 (below 10000 drift threshold)
      // This prevents personality drift from changing matchScore between tasks
      await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
      const tokenId3 = await nfa.getTotalSupply();
      await router.connect(minter).initializeLobster(tokenId3, {
        ...defaultLobster, courage: 40, wisdom: 40,
      });
      await clw.mint(user1.address, ethers.utils.parseEther("2000"));
      await router.connect(user1).depositCLW(tokenId3, ethers.utils.parseEther("2000"));

      const clwReward = ethers.utils.parseEther("100");
      // courage=40 → matchScore=8000=0.8x → base reward = 80 CLW

      // Task 1: courage, streak=1, 100% → 80 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId3, 0, 10, clwReward, 0);
      expect(await router.clwBalances(tokenId3)).to.equal(ethers.utils.parseEther("2080"));

      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Task 2: courage, streak=2, 80% → 80*0.8 = 64 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId3, 0, 10, clwReward, 0);
      expect(await router.clwBalances(tokenId3)).to.equal(ethers.utils.parseEther("2144"));

      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Task 3: courage, streak=3, 60% → 80*0.6 = 48 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId3, 0, 10, clwReward, 0);
      expect(await router.clwBalances(tokenId3)).to.equal(ethers.utils.parseEther("2192"));

      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Task 4: courage, streak=4, 50% → 80*0.5 = 40 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId3, 0, 10, clwReward, 0);
      expect(await router.clwBalances(tokenId3)).to.equal(ethers.utils.parseEther("2232"));

      await ethers.provider.send("evm_increaseTime", [4 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Task 5: switch to WISDOM → streak resets! wisdom=40, 0.8x, 100% → 80 CLW
      await taskSkill.connect(user1).ownerCompleteTypedTask(tokenId3, 1, 10, clwReward, 0);
      expect(await router.clwBalances(tokenId3)).to.equal(ethers.utils.parseEther("2312"));
    });
  });
});
