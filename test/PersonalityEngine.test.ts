import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW, PersonalityEngine } from "../typechain-types";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("PersonalityEngine", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let engine: PersonalityEngine;
  let clw: MockCLW;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let skill: SignerWithAddress;

  const defaultMetadata = {
    persona: "", experience: "", voiceHash: "",
    animationURI: "", vaultURI: "",
    vaultHash: ethers.constants.HashZero,
  };

  const defaultLobster = {
    rarity: 0, shelter: 1,
    courage: 50, wisdom: 60, social: 40, create: 70, grit: 30,
    str: 30, def: 30, spd: 30, vit: 30,
    mutation1: ethers.constants.HashZero,
    mutation2: ethers.constants.HashZero,
    level: 1, xp: 0, lastUpkeepTime: 0,
  };

  let tokenId: any;

  beforeEach(async function () {
    [owner, minter, treasury, user1, skill] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" })) as ClawNFA;

    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(ClawRouter, [clw.address, nfa.address, treasury.address], { kind: "uups" })) as ClawRouter;

    const PersonalityEngineFactory = await ethers.getContractFactory("PersonalityEngine");
    engine = (await upgrades.deployProxy(PersonalityEngineFactory, [router.address, nfa.address], { kind: "uups" })) as PersonalityEngine;

    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);

    // Set up PersonalityEngine as the engine on router
    await router.setPersonalityEngine(engine.address);

    // Authorize skill to call router.evolvePersonality (facade)
    await router.authorizeSkill(skill.address, true);

    // Authorize callers on engine: skill (direct) and router (facade delegation)
    await engine.setAuthorizedCaller(skill.address, true);
    await engine.setAuthorizedCaller(router.address, true);

    // Create a lobster
    await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
    tokenId = await nfa.getTotalSupply();
    await router.connect(minter).initializeLobster(tokenId, defaultLobster);
  });

  describe("evolvePersonality via Engine", function () {
    it("should evolve courage via engine", async function () {
      await engine.connect(skill).evolvePersonality(tokenId, 0, 3); // courage +3
      const state = await router.getLobsterState(tokenId);
      expect(state.courage).to.equal(53);
    });

    it("should emit PersonalityEvolved", async function () {
      await expect(engine.connect(skill).evolvePersonality(tokenId, 1, -2))
        .to.emit(engine, "PersonalityEvolved")
        .withArgs(tokenId, 1, 60, 58); // wisdom: 60 → 58
    });

    it("should enforce monthly cap (±10)", async function () {
      await engine.connect(skill).evolvePersonality(tokenId, 0, 10); // +10 → at cap
      await expect(
        engine.connect(skill).evolvePersonality(tokenId, 0, 1) // +1 → exceeds
      ).to.be.revertedWith("Monthly cap exceeded");
    });

    it("should reset monthly cap after 30 days", async function () {
      await engine.connect(skill).evolvePersonality(tokenId, 0, 10); // at cap
      await increaseTime(30 * 86400 + 1); // 30 days
      await engine.connect(skill).evolvePersonality(tokenId, 0, 3); // should work
      const state = await router.getLobsterState(tokenId);
      expect(state.courage).to.equal(63); // 50 + 10 + 3
    });

    it("should clamp to 0 on negative overflow", async function () {
      // Create lobster with courage=2
      await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
      const lowId = await nfa.getTotalSupply();
      await router.connect(minter).initializeLobster(lowId, { ...defaultLobster, courage: 2 });

      await engine.connect(skill).evolvePersonality(lowId, 0, -5); // 2 - 5 → clamp to 0
      const state = await router.getLobsterState(lowId);
      expect(state.courage).to.equal(0);
    });

    it("should clamp to 100 on positive overflow", async function () {
      await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
      const highId = await nfa.getTotalSupply();
      await router.connect(minter).initializeLobster(highId, { ...defaultLobster, courage: 98 });

      await engine.connect(skill).evolvePersonality(highId, 0, 5); // 98 + 5 → clamp to 100
      const state = await router.getLobsterState(highId);
      expect(state.courage).to.equal(100);
    });

    it("should reject unauthorized caller", async function () {
      await expect(
        engine.connect(user1).evolvePersonality(tokenId, 0, 1)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Facade: router.evolvePersonality delegates to engine", function () {
    it("should delegate to PersonalityEngine when set", async function () {
      // Call via router facade (skill → router.evolvePersonality → engine)
      await router.connect(skill).evolvePersonality(tokenId, 2, 4); // social +4
      const state = await router.getLobsterState(tokenId);
      expect(state.social).to.equal(44); // 40 + 4
    });
  });

  describe("getJobClass", function () {
    it("should return Scholar for wisdom+create dominant", async function () {
      // defaultLobster: courage=50, wisdom=60, social=40, create=70, grit=30
      // top1 = create(70), top2 = wisdom(60) → (1,3) = Scholar
      const [jobClass, jobName] = await engine.getJobClass(tokenId);
      expect(jobClass).to.equal(4);
      expect(jobName).to.equal("Scholar");
    });

    it("should return Explorer for courage+wisdom dominant", async function () {
      await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
      const id = await nfa.getTotalSupply();
      await router.connect(minter).initializeLobster(id, {
        ...defaultLobster, courage: 80, wisdom: 70, social: 30, create: 20, grit: 10
      });

      const [jobClass, jobName] = await engine.getJobClass(id);
      expect(jobClass).to.equal(0);
      expect(jobName).to.equal("Explorer");
    });
  });
});
