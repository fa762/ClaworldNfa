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

    // Roles
    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);
    await router.authorizeSkill(taskSkill.address, true);
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
});
