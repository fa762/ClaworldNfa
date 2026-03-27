import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW, MockFlapPortal, MockPancakeRouter, DepositRouter } from "../typechain-types";

describe("DepositRouter", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let depositRouter: DepositRouter;
  let clw: MockCLW;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;

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
    [owner, minter, treasury, user1] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" })) as ClawNFA;

    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(ClawRouter, [clw.address, nfa.address, treasury.address], { kind: "uups" })) as ClawRouter;

    const DepositRouterFactory = await ethers.getContractFactory("DepositRouter");
    depositRouter = (await upgrades.deployProxy(DepositRouterFactory, [router.address, clw.address], { kind: "uups" })) as DepositRouter;

    await nfa.setMinter(minter.address);
    await router.setMinter(minter.address);
    // DepositRouter needs to be authorized as a skill to call addCLW
    await router.authorizeSkill(depositRouter.address, true);

    // Create a lobster
    await nfa.connect(minter).mintTo(user1.address, router.address, "", defaultMetadata);
    tokenId = await nfa.getTotalSupply();
    await router.connect(minter).initializeLobster(tokenId, defaultLobster);
  });

  describe("flapBuyAndDeposit", function () {
    let mockFlap: MockFlapPortal;

    beforeEach(async function () {
      const MockFlapPortal = await ethers.getContractFactory("MockFlapPortal");
      mockFlap = (await MockFlapPortal.deploy(clw.address, ethers.utils.parseEther("2000"))) as MockFlapPortal;
      await depositRouter.setFlapPortal(mockFlap.address);
      // Mint CLW to Flap portal so it can sell
      await clw.mint(mockFlap.address, ethers.utils.parseEther("1000000"));
    });

    it("should buy CLW via Flap and deposit to lobster", async function () {
      const bnbAmount = ethers.utils.parseEther("0.5");
      await depositRouter.connect(user1).flapBuyAndDeposit(tokenId, 0, { value: bnbAmount });

      // 0.5 BNB × 2000 = 1000 CLW
      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1000"));
    });

    it("should emit FlapBuyAndDeposit event", async function () {
      const bnbAmount = ethers.utils.parseEther("1");
      await expect(depositRouter.connect(user1).flapBuyAndDeposit(tokenId, 0, { value: bnbAmount }))
        .to.emit(depositRouter, "FlapBuyAndDeposit");
    });

    it("should reject when already graduated", async function () {
      await depositRouter.setGraduated(true);
      await expect(
        depositRouter.connect(user1).flapBuyAndDeposit(tokenId, 0, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Already graduated");
    });

    it("should reject zero BNB", async function () {
      await expect(
        depositRouter.connect(user1).flapBuyAndDeposit(tokenId, 0, { value: 0 })
      ).to.be.revertedWith("Zero BNB");
    });

    it("should reject uninitialized lobster", async function () {
      await expect(
        depositRouter.connect(user1).flapBuyAndDeposit(999, 0, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Lobster not initialized");
    });
  });

  describe("buyAndDeposit", function () {
    let mockPancake: MockPancakeRouter;

    beforeEach(async function () {
      const MockCLW2 = await ethers.getContractFactory("MockCLW");
      const weth = await MockCLW2.deploy(); // fake WETH
      const MockPancakeRouter = await ethers.getContractFactory("MockPancakeRouter");
      mockPancake = (await MockPancakeRouter.deploy(weth.address, clw.address, ethers.utils.parseEther("1000"))) as MockPancakeRouter;
      await clw.mint(mockPancake.address, ethers.utils.parseEther("1000000"));
      await depositRouter.setPancakeRouter(mockPancake.address);
      await depositRouter.setGraduated(true);
    });

    it("should swap BNB for CLW and deposit to lobster", async function () {
      const bnbAmount = ethers.utils.parseEther("1");
      await depositRouter.connect(user1).buyAndDeposit(tokenId, 0, { value: bnbAmount });

      expect(await router.clwBalances(tokenId)).to.equal(ethers.utils.parseEther("1000"));
    });

    it("should reject when not graduated", async function () {
      await depositRouter.setGraduated(false);
      await expect(
        depositRouter.connect(user1).buyAndDeposit(tokenId, 0, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Not graduated to DEX");
    });
  });

  describe("previewFlapBuy", function () {
    it("should preview Flap buy amount", async function () {
      const MockFlapPortal = await ethers.getContractFactory("MockFlapPortal");
      const mockFlap = await MockFlapPortal.deploy(clw.address, ethers.utils.parseEther("2000"));
      await depositRouter.setFlapPortal(mockFlap.address);

      const preview = await depositRouter.previewFlapBuy(ethers.utils.parseEther("1"));
      expect(preview).to.equal(ethers.utils.parseEther("2000"));
    });
  });
});
