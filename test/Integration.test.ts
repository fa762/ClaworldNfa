import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Integration Tests", function () {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;

  let nfa: any, router: any, vault: any, worldState: any, oracle: any;
  let taskSkill: any, pkSkill: any, marketSkill: any;
  let clw: any, mockFlap: any, mockPR: any;

  async function deployAll() {
    [deployer, user1, user2, treasury] = await ethers.getSigners();

    // Deploy MockCLW
    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = await MockCLW.deploy();
    await clw.deployed();

    // Deploy ClawNFA
    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" });
    await nfa.deployed();

    // Deploy ClawRouter
    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = await upgrades.deployProxy(ClawRouter, [clw.address, nfa.address, treasury.address], { kind: "uups" });
    await router.deployed();

    // Deploy WorldState
    const WorldState = await ethers.getContractFactory("WorldState");
    worldState = await upgrades.deployProxy(WorldState, [], { kind: "uups" });
    await worldState.deployed();

    // Deploy GenesisVault
    const GenesisVault = await ethers.getContractFactory("GenesisVault");
    vault = await upgrades.deployProxy(GenesisVault, [nfa.address, router.address], { kind: "uups" });
    await vault.deployed();

    // Deploy ClawOracle
    const ClawOracle = await ethers.getContractFactory("ClawOracle");
    oracle = await upgrades.deployProxy(ClawOracle, [], { kind: "uups" });
    await oracle.deployed();

    // Deploy TaskSkill
    const TaskSkill = await ethers.getContractFactory("TaskSkill");
    taskSkill = await upgrades.deployProxy(TaskSkill, [router.address, worldState.address], { kind: "uups" });
    await taskSkill.deployed();

    // Deploy PKSkill
    const PKSkill = await ethers.getContractFactory("PKSkill");
    pkSkill = await upgrades.deployProxy(PKSkill, [router.address, nfa.address], { kind: "uups" });
    await pkSkill.deployed();

    // Deploy MarketSkill
    const MarketSkill = await ethers.getContractFactory("MarketSkill");
    marketSkill = await upgrades.deployProxy(MarketSkill, [nfa.address, treasury.address], { kind: "uups" });
    await marketSkill.deployed();

    // Deploy mocks
    const MockWBNB = await ethers.getContractFactory("MockCLW");
    const wbnb = await MockWBNB.deploy();
    await wbnb.deployed();

    const MockPancakeRouter = await ethers.getContractFactory("MockPancakeRouter");
    mockPR = await MockPancakeRouter.deploy(wbnb.address, clw.address, ethers.utils.parseEther("1000"));
    await mockPR.deployed();

    const MockFlapPortal = await ethers.getContractFactory("MockFlapPortal");
    mockFlap = await MockFlapPortal.deploy(clw.address, ethers.utils.parseEther("2000"));
    await mockFlap.deployed();

    // Configure roles
    await nfa.setDefaultLogicAddress(router.address);
    await nfa.setMinter(vault.address);
    await router.setMinter(vault.address);
    await router.authorizeSkill(vault.address, true);
    await router.authorizeSkill(taskSkill.address, true);
    await router.authorizeSkill(pkSkill.address, true);
    await router.setWorldState(worldState.address);
    await router.setFlapPortal(mockFlap.address);
    await router.setPancakeRouter(mockPR.address);
    await pkSkill.setWorldState(worldState.address);
    await taskSkill.setOperator(deployer.address, true);
    await vault.setMintingActive(true);

    // Mint CLW to flap portal for buyAndDeposit
    await clw.mint(mockFlap.address, ethers.utils.parseEther("1000000"));
  }

  // Helper: mint a genesis lobster via commit-reveal
  async function mintLobster(user: SignerWithAddress, rarity: number = 0) {
    const prices = [
      ethers.utils.parseEther("0.08"),
      ethers.utils.parseEther("0.38"),
      ethers.utils.parseEther("0.88"),
      ethers.utils.parseEther("1.88"),
      ethers.utils.parseEther("3.88"),
    ];
    const salt = ethers.utils.randomBytes(32);
    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(["uint8", "bytes32", "address"], [rarity, salt, user.address])
    );

    await vault.connect(user).commit(hash, { value: prices[rarity] });

    // Advance time past reveal delay (1 min)
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);

    const tx = await vault.connect(user).reveal(rarity, salt);
    const receipt = await tx.wait();

    // Find the GenesisRevealed event to get nfaId
    const event = receipt.events?.find((e: any) => e.event === "GenesisRevealed");
    return event?.args?.nfaId?.toNumber() ?? 1;
  }

  beforeEach(async function () {
    await deployAll();
  });

  // ===================================
  // 1. Full Genesis Flow
  // ===================================
  describe("Full Genesis Flow", function () {
    it("should mint a lobster via commit-reveal and initialize state", async function () {
      const nfaId = await mintLobster(user1, 0);

      // Verify NFA exists and owned by user1
      expect(await nfa.ownerOf(nfaId)).to.equal(user1.address);
      expect(await nfa.exists(nfaId)).to.be.true;

      // Verify lobster state initialized
      const lob = await router.getLobsterState(nfaId);
      expect(lob.rarity).to.equal(0); // Common
      expect(lob.level).to.equal(1);
      expect(await router.initialized(nfaId)).to.be.true;

      // Verify CLW airdrop (Common = 1000 CLW)
      const balance = await router.clwBalances(nfaId);
      expect(balance).to.equal(ethers.utils.parseEther("1000"));

      // Verify agent state active
      const isActive = await router.isActive(nfaId);
      expect(isActive).to.be.true;
    });

    it("should allow rare mint with higher CLW airdrop", async function () {
      const nfaId = await mintLobster(user1, 1); // Rare
      const lob = await router.getLobsterState(nfaId);
      expect(lob.rarity).to.equal(1);
      const balance = await router.clwBalances(nfaId);
      expect(balance).to.equal(ethers.utils.parseEther("3000")); // Rare airdrop
    });
  });

  // ===================================
  // 2. Task → Level Up Flow
  // ===================================
  describe("Task → Level Up Flow", function () {
    let nfaId: number;

    beforeEach(async function () {
      nfaId = await mintLobster(user1, 0);
    });

    it("should complete task and gain XP + CLW", async function () {
      const xpReward = 50;
      const clwReward = ethers.utils.parseEther("100");
      const matchScore = 10000; // 1.0x

      await taskSkill.completeTask(nfaId, xpReward, clwReward, matchScore);

      const lob = await router.getLobsterState(nfaId);
      expect(lob.xp).to.be.gte(xpReward);

      // CLW should increase (1000 airdrop + 100 reward)
      const balance = await router.clwBalances(nfaId);
      expect(balance).to.equal(ethers.utils.parseEther("1100"));
    });

    it("should level up with enough XP", async function () {
      // XP_PER_LEVEL = 100, level 1 needs 200 XP total (100 * (1+1))
      await taskSkill.completeTask(nfaId, 200, ethers.utils.parseEther("10"), 10000);

      const lob = await router.getLobsterState(nfaId);
      expect(lob.level).to.be.gte(2);
    });

    it("should trigger personality drift on typed task with high score", async function () {
      // Type 0 = courage dimension
      await taskSkill.completeTypedTask(nfaId, 0, 30, ethers.utils.parseEther("50"), 10000);

      // We can't easily check the exact personality value changed,
      // but we verify no revert and the task completed
    });
  });

  // ===================================
  // 3. PK Flow
  // ===================================
  describe("PK Flow", function () {
    let nfaA: number, nfaB: number;

    beforeEach(async function () {
      nfaA = await mintLobster(user1, 0);
      nfaB = await mintLobster(user2, 0);
    });

    it("should complete full PK match flow", async function () {
      const stake = ethers.utils.parseEther("100");
      const balanceA_before = await router.clwBalances(nfaA);
      const balanceB_before = await router.clwBalances(nfaB);

      // Create match
      const createTx = await pkSkill.connect(user1).createMatch(nfaA, stake);
      const createReceipt = await createTx.wait();
      const matchId = createReceipt.events?.find((e: any) => e.event === "MatchCreated")?.args?.matchId?.toNumber() ?? 1;

      // Join match
      await pkSkill.connect(user2).joinMatch(matchId, nfaB);

      // Both commit strategies
      const saltA = ethers.utils.randomBytes(32);
      const saltB = ethers.utils.randomBytes(32);
      const stratA = 0; // AllAttack
      const stratB = 1; // Balanced

      const commitA = ethers.utils.keccak256(
        ethers.utils.solidityPack(["uint8", "bytes32", "address"], [stratA, saltA, user1.address])
      );
      const commitB = ethers.utils.keccak256(
        ethers.utils.solidityPack(["uint8", "bytes32", "address"], [stratB, saltB, user2.address])
      );

      await pkSkill.connect(user1).commitStrategy(matchId, commitA);
      await pkSkill.connect(user2).commitStrategy(matchId, commitB);

      // Both reveal
      await pkSkill.connect(user1).revealStrategy(matchId, stratA, saltA);
      await pkSkill.connect(user2).revealStrategy(matchId, stratB, saltB);

      // Settle
      const settleTx = await pkSkill.settle(matchId);
      const settleReceipt = await settleTx.wait();
      const settledEvent = settleReceipt.events?.find((e: any) => e.event === "MatchSettled");

      expect(settledEvent).to.not.be.undefined;

      // Verify rewards distributed (total 200 stake, 10% burned = 20, winner gets 180)
      const balanceA_after = await router.clwBalances(nfaA);
      const balanceB_after = await router.clwBalances(nfaB);

      // One gained, one lost. Combined should be 200 less (burn)
      const totalBefore = balanceA_before.add(balanceB_before);
      const totalAfter = balanceA_after.add(balanceB_after);
      const burned = totalBefore.sub(totalAfter);
      expect(burned).to.equal(ethers.utils.parseEther("20")); // 10% of 200
    });

    it("should cancel match if no one joins within timeout", async function () {
      const stake = ethers.utils.parseEther("50");
      const balanceBefore = await router.clwBalances(nfaA);

      const tx = await pkSkill.connect(user1).createMatch(nfaA, stake);
      const receipt = await tx.wait();
      const matchId = receipt.events?.find((e: any) => e.event === "MatchCreated")?.args?.matchId?.toNumber() ?? 1;

      // Cancel (owner can cancel immediately)
      await pkSkill.connect(user1).cancelMatch(matchId);

      // Stake returned
      const balanceAfter = await router.clwBalances(nfaA);
      expect(balanceAfter).to.equal(balanceBefore);
    });
  });

  // ===================================
  // 4. Market Flow — Fixed Price
  // ===================================
  describe("Market Flow — Fixed Price", function () {
    let nfaId: number;

    beforeEach(async function () {
      nfaId = await mintLobster(user1, 0);
    });

    it("should list and buy NFA at fixed price", async function () {
      const price = ethers.utils.parseEther("1");

      // Approve market to transfer NFA
      await nfa.connect(user1).approve(marketSkill.address, nfaId);

      // List
      const listTx = await marketSkill.connect(user1).listFixedPrice(nfaId, price);
      const listReceipt = await listTx.wait();
      const listingId = listReceipt.events?.find((e: any) => e.event === "Listed")?.args?.listingId?.toNumber() ?? 1;

      // NFA now in escrow
      expect(await nfa.ownerOf(nfaId)).to.equal(marketSkill.address);

      // Buy
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await marketSkill.connect(user2).buyFixedPrice(listingId, { value: price });

      // NFA transferred to buyer
      expect(await nfa.ownerOf(nfaId)).to.equal(user2.address);

      // Treasury got 2.5% fee
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const fee = price.mul(250).div(10000);
      expect(treasuryAfter.sub(treasuryBefore)).to.equal(fee);
    });
  });

  // ===================================
  // 5. Market Flow — Auction
  // ===================================
  describe("Market Flow — Auction", function () {
    let nfaId: number;

    beforeEach(async function () {
      nfaId = await mintLobster(user1, 0);
    });

    it("should list auction, accept bid, and settle", async function () {
      const startPrice = ethers.utils.parseEther("0.5");

      await nfa.connect(user1).approve(marketSkill.address, nfaId);
      const listTx = await marketSkill.connect(user1).listAuction(nfaId, startPrice);
      const listReceipt = await listTx.wait();
      const listingId = listReceipt.events?.find((e: any) => e.event === "Listed")?.args?.listingId?.toNumber() ?? 1;

      // Bid
      await marketSkill.connect(user2).bid(listingId, { value: startPrice });

      // Advance time past auction (24h)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Settle
      await marketSkill.settleAuction(listingId);

      // NFA transferred to highest bidder
      expect(await nfa.ownerOf(nfaId)).to.equal(user2.address);
    });
  });

  // ===================================
  // 6. Dormancy & Revival
  // ===================================
  describe("Dormancy & Revival", function () {
    let nfaId: number;

    beforeEach(async function () {
      nfaId = await mintLobster(user1, 0);
    });

    it("should go dormant after 72h with zero CLW", async function () {
      // Drain CLW via a skill (deployer is authorized as vault skill)
      const balance = await router.clwBalances(nfaId);
      await router.connect(deployer).spendCLW(nfaId, balance);

      // Advance time past dormancy threshold (72h)
      await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);

      // Process upkeep triggers dormancy check
      await router.processUpkeep(nfaId);

      const isActive = await router.isActive(nfaId);
      expect(isActive).to.be.false;
    });

    it("should revive after depositing CLW when dormant", async function () {
      // Drain and trigger dormancy
      const balance = await router.clwBalances(nfaId);
      await router.connect(deployer).spendCLW(nfaId, balance);
      await ethers.provider.send("evm_increaseTime", [72 * 3600 + 1]);
      await ethers.provider.send("evm_mine", []);
      await router.processUpkeep(nfaId);
      expect(await router.isActive(nfaId)).to.be.false;

      // Deposit CLW to revive
      await clw.mint(user1.address, ethers.utils.parseEther("500"));
      await clw.connect(user1).approve(router.address, ethers.utils.parseEther("500"));
      await router.connect(user1).depositCLW(nfaId, ethers.utils.parseEther("500"));

      expect(await router.isActive(nfaId)).to.be.true;
    });
  });

  // ===================================
  // 7. World State Integration
  // ===================================
  describe("World State Integration", function () {
    let nfaId: number;

    beforeEach(async function () {
      nfaId = await mintLobster(user1, 0);
    });

    it("should apply reward multiplier from WorldState", async function () {
      // Set 2x rewards
      await worldState.updateWorldState(20000, 1000, 10000, 10000, ethers.constants.HashZero);

      const clwReward = ethers.utils.parseEther("100");
      await taskSkill.completeTask(nfaId, 10, clwReward, 10000);

      // With 2x multiplier: 100 * 10000/10000 * 20000/10000 = 200
      const balance = await router.clwBalances(nfaId);
      const expected = ethers.utils.parseEther("1000").add(ethers.utils.parseEther("200"));
      expect(balance).to.equal(expected);
    });
  });

  // ===================================
  // 8. Role Authorization
  // ===================================
  describe("Role Authorization", function () {
    it("should revert unauthorized skill calls", async function () {
      const nfaId = await mintLobster(user1, 0);

      await expect(
        router.connect(user1).addCLW(nfaId, ethers.utils.parseEther("1000"))
      ).to.be.revertedWith("Not authorized skill");

      await expect(
        router.connect(user1).spendCLW(nfaId, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Not authorized skill");

      await expect(
        router.connect(user1).addXP(nfaId, 100)
      ).to.be.revertedWith("Not authorized skill");
    });

    it("should revert non-owner admin calls", async function () {
      await expect(
        router.connect(user1).setMinter(user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        router.connect(user1).authorizeSkill(user1.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should enforce CLW cap per call when set", async function () {
      const nfaId = await mintLobster(user1, 0);
      await router.setMaxCLWPerCall(ethers.utils.parseEther("500"));

      // This should fail — vault airdrop of 1000 is above cap
      // But the vault is an authorized skill, let's test via taskSkill
      await expect(
        taskSkill.completeTask(nfaId, 0, ethers.utils.parseEther("600"), 10000)
      ).to.be.revertedWith("Exceeds CLW cap per call");
    });

    it("should enforce XP cap per call when set", async function () {
      const nfaId = await mintLobster(user1, 0);
      await router.setMaxXPPerCall(50);

      await expect(
        taskSkill.completeTask(nfaId, 100, 0, 10000)
      ).to.be.revertedWith("Exceeds XP cap per call");
    });
  });

  // ===================================
  // 9. Pull-over-push Refunds
  // ===================================
  describe("Pull-over-push Refunds", function () {
    it("should have claimRefund function on MarketSkill", async function () {
      // Just verify the function exists and reverts with no pending refund
      await expect(
        marketSkill.connect(user1).claimRefund()
      ).to.be.revertedWith("No pending refund");
    });

    it("should have claimRefund function on GenesisVault", async function () {
      await expect(
        vault.connect(user1).claimRefund()
      ).to.be.revertedWith("No pending refund");
    });
  });

  // ===================================
  // 10. Storage Gaps
  // ===================================
  describe("Upgrade Safety", function () {
    it("should have storage gaps in all contracts", async function () {
      // This test just verifies contracts deploy correctly with gaps
      // Actual storage gap validation is done by the upgrade plugin
      expect(nfa.address).to.not.be.undefined;
      expect(router.address).to.not.be.undefined;
      expect(vault.address).to.not.be.undefined;
      expect(worldState.address).to.not.be.undefined;
      expect(taskSkill.address).to.not.be.undefined;
      expect(pkSkill.address).to.not.be.undefined;
      expect(marketSkill.address).to.not.be.undefined;
      expect(oracle.address).to.not.be.undefined;
    });
  });
});
