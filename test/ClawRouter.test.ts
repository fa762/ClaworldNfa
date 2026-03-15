import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW } from "../typechain-types";
// Time helper using ethers provider
async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("ClawRouter", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let clw: MockCLW;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let skill: SignerWithAddress;

  const defaultMetadata = {
    persona: "brave",
    experience: "veteran",
    voiceHash: "0x1234",
    animationURI: "ipfs://anim",
    vaultURI: "ipfs://vault",
    vaultHash: ethers.utils.formatBytes32String("vaulthash"),
  };

  const defaultLobster = {
    rarity: 0,       // Common
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
    lastUpkeepTime: 0,  // will be set by contract
  };

  async function setupLobster(userSigner: SignerWithAddress, lobsterOverrides: Partial<typeof defaultLobster> = {}) {
    const lobster = { ...defaultLobster, ...lobsterOverrides };
    // Mint NFA
    await nfa.connect(minter).mintTo(userSigner.address, router.address, "ipfs://meta", defaultMetadata);
    const tokenId = await nfa.getTotalSupply();
    // Initialize lobster in router
    await router.connect(minter).initializeLobster(tokenId, lobster);
    return tokenId;
  }

  beforeEach(async function () {
    [owner, minter, treasury, user1, user2, skill] = await ethers.getSigners();

    // Deploy MockCLW
    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;
    await clw.deployed();

    // Deploy ClawNFA
    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(
      ClawNFA,
      ["Claw NFA", "CNFA", treasury.address],
      { kind: "uups" }
    )) as ClawNFA;
    await nfa.deployed();

    // Deploy ClawRouter
    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(
      ClawRouter,
      [clw.address, nfa.address, treasury.address],
      { kind: "uups" }
    )) as ClawRouter;
    await router.deployed();

    // Configure roles
    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);
    await router.authorizeSkill(skill.address, true);

    // Mint CLW to users for testing
    await clw.mint(user1.address, ethers.utils.parseEther("10000"));
    await clw.mint(user2.address, ethers.utils.parseEther("10000"));

    // Approve router to spend CLW
    await clw.connect(user1).approve(router.address, ethers.constants.MaxUint256);
    await clw.connect(user2).approve(router.address, ethers.constants.MaxUint256);
  });

  describe("Initialize Lobster", function () {
    it("should initialize lobster with correct state", async function () {
      await nfa.connect(minter).mintTo(user1.address, router.address, "ipfs://meta", defaultMetadata);
      await router.connect(minter).initializeLobster(1, defaultLobster);

      const state = await router.getLobsterState(1);
      expect(state.rarity).to.equal(0);
      expect(state.courage).to.equal(50);
      expect(state.str).to.equal(30);
      expect(state.level).to.equal(1);
    });

    it("should reject non-minter", async function () {
      await nfa.connect(minter).mintTo(user1.address, router.address, "ipfs://meta", defaultMetadata);
      await expect(
        router.connect(user1).initializeLobster(1, defaultLobster)
      ).to.be.revertedWith("Not minter");
    });

    it("should reject double initialization", async function () {
      await nfa.connect(minter).mintTo(user1.address, router.address, "ipfs://meta", defaultMetadata);
      await router.connect(minter).initializeLobster(1, defaultLobster);
      await expect(
        router.connect(minter).initializeLobster(1, defaultLobster)
      ).to.be.revertedWith("Already initialized");
    });
  });

  describe("Deposit CLW", function () {
    let tokenId: any;

    beforeEach(async function () {
      tokenId = await setupLobster(user1);
    });

    it("should allow anyone to deposit CLW", async function () {
      const amount = ethers.utils.parseEther("100");
      await router.connect(user1).depositCLW(tokenId, amount);
      expect(await router.clwBalances(tokenId)).to.equal(amount);
    });

    it("should allow non-owner to deposit CLW", async function () {
      const amount = ethers.utils.parseEther("50");
      await router.connect(user2).depositCLW(tokenId, amount);
      expect(await router.clwBalances(tokenId)).to.equal(amount);
    });

    it("should transfer CLW from depositor to contract", async function () {
      const amount = ethers.utils.parseEther("100");
      const balBefore = await clw.balanceOf(user1.address);
      await router.connect(user1).depositCLW(tokenId, amount);
      const balAfter = await clw.balanceOf(user1.address);

      expect(balBefore.sub(balAfter)).to.equal(amount);
      expect(await clw.balanceOf(router.address)).to.equal(amount);
    });

    it("should reject zero deposit", async function () {
      await expect(router.connect(user1).depositCLW(tokenId, 0)).to.be.revertedWith("Zero amount");
    });

    it("should reject deposit to uninitialized lobster", async function () {
      await expect(
        router.connect(user1).depositCLW(999, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Lobster not initialized");
    });

    it("should emit CLWDeposited event", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(router.connect(user1).depositCLW(tokenId, amount))
        .to.emit(router, "CLWDeposited")
        .withArgs(tokenId, user1.address, amount);
    });
  });

  describe("Withdraw CLW (6h cooldown)", function () {
    let tokenId: any;

    beforeEach(async function () {
      tokenId = await setupLobster(user1);
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));
    });

    it("should request withdrawal and lock amount", async function () {
      const amount = ethers.utils.parseEther("500");
      await router.connect(user1).requestWithdrawCLW(tokenId, amount);

      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("500"));
      const req = await router.withdrawRequests(tokenId);
      expect(req.amount).to.equal(amount);
    });

    it("should claim after cooldown", async function () {
      const amount = ethers.utils.parseEther("500");
      await router.connect(user1).requestWithdrawCLW(tokenId, amount);

      // Advance 6 hours
      await increaseTime(6 * 3600);

      const balBefore = await clw.balanceOf(user1.address);
      await router.connect(user1).claimWithdrawCLW(tokenId);
      const balAfter = await clw.balanceOf(user1.address);

      expect(balAfter.sub(balBefore)).to.equal(amount);
    });

    it("should reject claim before cooldown", async function () {
      await router.connect(user1).requestWithdrawCLW(tokenId, ethers.utils.parseEther("500"));

      // Only 3 hours
      await increaseTime(3 * 3600);

      await expect(router.connect(user1).claimWithdrawCLW(tokenId)).to.be.revertedWith("Cooldown not met");
    });

    it("should reject withdrawal by non-owner", async function () {
      await expect(
        router.connect(user2).requestWithdrawCLW(tokenId, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Not NFA owner");
    });

    it("should reject duplicate pending withdrawal", async function () {
      await router.connect(user1).requestWithdrawCLW(tokenId, ethers.utils.parseEther("100"));
      await expect(
        router.connect(user1).requestWithdrawCLW(tokenId, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Pending withdrawal exists");
    });

    it("should allow cancel and return funds", async function () {
      const amount = ethers.utils.parseEther("500");
      await router.connect(user1).requestWithdrawCLW(tokenId, amount);
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("500"));

      await router.connect(user1).cancelWithdraw(tokenId);
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1000"));
    });
  });

  describe("Daily Upkeep", function () {
    let tokenId: any;

    it("should deduct daily cost after 1 day", async function () {
      tokenId = await setupLobster(user1, { grit: 0 });
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));

      await increaseTime(86400); // 1 day
      await router.processUpkeep(tokenId);

      // Level 1, bracket 0, base cost = 10 CLW, grit=0 → cost = 10 * (200-0)/200 = 10
      const balance = await router.clwBalances(tokenId);
      expect(balance).to.equal(ethers.utils.parseEther("990"));
    });

    it("should apply grit reduction", async function () {
      tokenId = await setupLobster(user1, { grit: 100 });
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));

      await increaseTime(86400); // 1 day
      await router.processUpkeep(tokenId);

      // grit=100 → cost = 10 * (200-100)/200 = 5
      const balance = await router.clwBalances(tokenId);
      expect(balance).to.equal(ethers.utils.parseEther("995"));
    });

    it("should handle multiple days", async function () {
      tokenId = await setupLobster(user1, { grit: 0 });
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));

      await increaseTime(86400 * 3); // 3 days
      await router.processUpkeep(tokenId);

      // 3 days × 10 CLW = 30 CLW
      const balance = await router.clwBalances(tokenId);
      expect(balance).to.equal(ethers.utils.parseEther("970"));
    });

    it("should not deduct if less than 1 day", async function () {
      tokenId = await setupLobster(user1, { grit: 0 });
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));

      await increaseTime(3600); // 1 hour
      await router.processUpkeep(tokenId);

      const balance = await router.clwBalances(tokenId);
      expect(balance).to.equal(ethers.utils.parseEther("1000"));
    });

    it("should use correct daily cost by level bracket", async function () {
      // Level 15 → bracket = (15-1)/10 = 1 → 25 CLW
      tokenId = await setupLobster(user1, { level: 15, grit: 0 });
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));

      await increaseTime(86400);
      await router.processUpkeep(tokenId);

      const balance = await router.clwBalances(tokenId);
      expect(balance).to.equal(ethers.utils.parseEther("975"));
    });
  });

  describe("Dormancy (72h zero balance)", function () {
    let tokenId: any;

    beforeEach(async function () {
      tokenId = await setupLobster(user1, { grit: 0 });
      // Deposit just enough for ~1 day
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("10"));
    });

    it("should trigger dormancy after 72h with zero balance", async function () {
      // Use up all CLW via upkeep
      await increaseTime(86400); // 1 day → costs 10 CLW
      await router.processUpkeep(tokenId);
      expect(await router.clwBalances(tokenId)).to.equal(0);

      // Wait 72 hours more and process again
      await increaseTime(72 * 3600 + 1);
      await router.processUpkeep(tokenId);

      // Check NFA is now dormant (inactive)
      const state = await nfa.getAgentState(tokenId);
      expect(state.active).to.equal(false);
    });

    it("should revive when CLW deposited", async function () {
      // Drain to 0 and go dormant
      await increaseTime(86400);
      await router.processUpkeep(tokenId);
      await increaseTime(72 * 3600 + 1);
      await router.processUpkeep(tokenId);

      const stateBefore = await nfa.getAgentState(tokenId);
      expect(stateBefore.active).to.equal(false);

      // Deposit CLW → auto-revive
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("100"));

      const stateAfter = await nfa.getAgentState(tokenId);
      expect(stateAfter.active).to.equal(true);
    });
  });

  describe("Skill Callbacks", function () {
    let tokenId: any;

    beforeEach(async function () {
      tokenId = await setupLobster(user1);
      await router.connect(user1).depositCLW(tokenId, ethers.utils.parseEther("1000"));
    });

    it("should allow skill to add CLW", async function () {
      await router.connect(skill).addCLW(tokenId, ethers.utils.parseEther("50"));
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1050"));
    });

    it("should allow skill to spend CLW", async function () {
      await router.connect(skill).spendCLW(tokenId, ethers.utils.parseEther("50"));
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("950"));
    });

    it("should reject spend exceeding balance", async function () {
      await expect(
        router.connect(skill).spendCLW(tokenId, ethers.utils.parseEther("2000"))
      ).to.be.revertedWith("Insufficient CLW");
    });

    it("should reject non-skill calling addCLW", async function () {
      await expect(
        router.connect(user1).addCLW(tokenId, ethers.utils.parseEther("50"))
      ).to.be.revertedWith("Not authorized skill");
    });

    it("should add XP and level up", async function () {
      // Level 1, need 100 XP to reach level 2
      await router.connect(skill).addXP(tokenId, 200);

      const state = await router.getLobsterState(tokenId);
      expect(state.level).to.equal(2);
      expect(state.xp).to.equal(200);
    });

    it("should emit LobsterLevelUp on level change", async function () {
      await expect(router.connect(skill).addXP(tokenId, 200))
        .to.emit(router, "LobsterLevelUp")
        .withArgs(tokenId, 2);
    });

    it("should mutate DNA", async function () {
      const mutData = ethers.utils.formatBytes32String("mutation_pk_win");
      await router.connect(skill).mutateDNA(tokenId, 0, 50, mutData); // str → 50

      const state = await router.getLobsterState(tokenId);
      expect(state.str).to.equal(50);
      expect(state.mutation1).to.equal(mutData);
    });

    it("should reject invalid gene index", async function () {
      const mutData = ethers.utils.formatBytes32String("bad");
      await expect(
        router.connect(skill).mutateDNA(tokenId, 5, 50, mutData)
      ).to.be.revertedWith("Invalid gene");
    });

    it("should cycle mutation slots", async function () {
      const mut1 = ethers.utils.formatBytes32String("mut1");
      const mut2 = ethers.utils.formatBytes32String("mut2");
      const mut3 = ethers.utils.formatBytes32String("mut3");

      await router.connect(skill).mutateDNA(tokenId, 0, 40, mut1);
      await router.connect(skill).mutateDNA(tokenId, 1, 40, mut2);
      await router.connect(skill).mutateDNA(tokenId, 2, 40, mut3);

      const state = await router.getLobsterState(tokenId);
      // mut1 was in slot1, mut2 in slot2, mut3 overwrites: slot1=mut2, slot2=mut3
      expect(state.mutation1).to.equal(mut2);
      expect(state.mutation2).to.equal(mut3);
    });
  });

  describe("Skill Authorization", function () {
    it("should allow owner to authorize/deauthorize skills", async function () {
      await router.authorizeSkill(user2.address, true);
      expect(await router.authorizedSkills(user2.address)).to.equal(true);

      await router.authorizeSkill(user2.address, false);
      expect(await router.authorizedSkills(user2.address)).to.equal(false);
    });

    it("should reject non-owner authorization", async function () {
      await expect(
        router.connect(user1).authorizeSkill(user2.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("should return daily cost for lobster", async function () {
      const tokenId = await setupLobster(user1, { level: 1, grit: 50 });
      const cost = await router.getDailyCost(tokenId);
      // level 1, bracket 0, base=10, grit=50 → 10 * (200-50)/200 = 7.5
      expect(cost).to.equal(ethers.utils.parseEther("7.5"));
    });

    it("should return active status from NFA", async function () {
      const tokenId = await setupLobster(user1);
      expect(await router.isActive(tokenId)).to.equal(true);
    });
  });

  describe("Admin", function () {
    it("should allow owner to set minter", async function () {
      await router.setMinter(user2.address);
      expect(await router.minter()).to.equal(user2.address);
    });

    it("should allow owner to rescue non-CLW ERC20", async function () {
      // Deploy another token and send to router
      const MockCLW2 = await ethers.getContractFactory("MockCLW");
      const token2 = await MockCLW2.deploy();
      await token2.mint(router.address, ethers.utils.parseEther("100"));

      await router.rescueERC20(token2.address, ethers.utils.parseEther("100"));
      expect(await token2.balanceOf(owner.address)).to.equal(ethers.utils.parseEther("100"));
    });

    it("should reject rescue of CLW token", async function () {
      await expect(
        router.rescueERC20(clw.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("Cannot rescue CLW");
    });
  });
});
