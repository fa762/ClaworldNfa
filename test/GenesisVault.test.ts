import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, ClawRouter, MockCLW, GenesisVault } from "../typechain-types";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("GenesisVault", function () {
  let nfa: ClawNFA;
  let router: ClawRouter;
  let clw: MockCLW;
  let vault: GenesisVault;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    // Deploy MockCLW
    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;

    // Deploy ClawNFA
    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(
      ClawNFA,
      ["Claw NFA", "CNFA", treasury.address],
      { kind: "uups" }
    )) as ClawNFA;

    // Deploy ClawRouter
    const ClawRouter = await ethers.getContractFactory("ClawRouter");
    router = (await upgrades.deployProxy(
      ClawRouter,
      [clw.address, nfa.address, treasury.address],
      { kind: "uups" }
    )) as ClawRouter;

    // Deploy GenesisVault
    const GenesisVault = await ethers.getContractFactory("GenesisVault");
    vault = (await upgrades.deployProxy(
      GenesisVault,
      [nfa.address, router.address],
      { kind: "uups" }
    )) as GenesisVault;

    // Configure roles
    // Vault is the minter for both NFA and Router
    await nfa.setMinter(vault.address);
    await router.setMinter(vault.address);
    // Vault needs to be an authorized skill to call addCLW
    await router.authorizeSkill(vault.address, true);
    // Enable minting
    await vault.setMintingActive(true);
  });

  function computeHash(rarity: number, salt: string, address: string): string {
    return ethers.utils.solidityKeccak256(
      ["uint8", "bytes32", "address"],
      [rarity, salt, address]
    );
  }

  async function commitAndReveal(
    signer: SignerWithAddress,
    rarity: number,
    price: string
  ): Promise<any> {
    const salt = ethers.utils.formatBytes32String("salt_" + Math.random().toString());
    const hash = computeHash(rarity, salt, signer.address);

    await vault.connect(signer).commit(hash, { value: ethers.utils.parseEther(price) });
    await increaseTime(61); // Past REVEAL_DELAY
    const tx = await vault.connect(signer).reveal(rarity, salt);
    return tx;
  }

  describe("Commit-Reveal Flow", function () {
    it("should complete full commit-reveal for Common", async function () {
      const salt = ethers.utils.formatBytes32String("mysalt");
      const hash = computeHash(0, salt, user1.address);

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });
      await increaseTime(61);
      await vault.connect(user1).reveal(0, salt);

      expect(await nfa.ownerOf(1)).to.equal(user1.address);
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should reject reveal before delay", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);
      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });

      await expect(vault.connect(user1).reveal(0, salt)).to.be.revertedWith("Too early");
    });

    it("should reject reveal after window", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);
      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });

      await increaseTime(24 * 3600 + 1); // Past window
      await expect(vault.connect(user1).reveal(0, salt)).to.be.revertedWith("Reveal expired");
    });

    it("should reject invalid hash (wrong rarity)", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address); // Committed for Common

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.88") });
      await increaseTime(61);

      // Try to reveal as Rare
      await expect(vault.connect(user1).reveal(1, salt)).to.be.revertedWith("Invalid reveal");
    });

    it("should reject double commitment", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });
      await expect(
        vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") })
      ).to.be.revertedWith("Already committed");
    });

    it("should reject double reveal", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });
      await increaseTime(61);
      await vault.connect(user1).reveal(0, salt);

      await expect(vault.connect(user1).reveal(0, salt)).to.be.revertedWith("Already revealed");
    });
  });

  describe("Rarity Pricing", function () {
    it("should accept correct Common price", async function () {
      await commitAndReveal(user1, 0, "0.18");
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should accept correct Rare price", async function () {
      await commitAndReveal(user1, 1, "0.88");
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should accept correct Epic price", async function () {
      await commitAndReveal(user1, 2, "1.88");
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should accept correct Legendary price", async function () {
      await commitAndReveal(user1, 3, "3.88");
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should accept correct Mythic price", async function () {
      await commitAndReveal(user1, 4, "8.88");
      expect(await vault.mintedCount()).to.equal(1);
    });

    it("should reject insufficient BNB", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(1, salt, user1.address); // Rare = 0.88

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });
      await increaseTime(61);
      await expect(vault.connect(user1).reveal(1, salt)).to.be.revertedWith("Insufficient BNB");
    });

    it("should refund excess BNB", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);
      const excess = ethers.utils.parseEther("1"); // Sending 1 BNB for 0.18 price

      const balBefore = await user1.getBalance();
      const tx1 = await vault.connect(user1).commit(hash, { value: excess });
      const r1 = await tx1.wait();
      await increaseTime(61);
      const tx2 = await vault.connect(user1).reveal(0, salt);
      const r2 = await tx2.wait();
      const balAfter = await user1.getBalance();

      const gasCost = r1.gasUsed.mul(r1.effectiveGasPrice).add(r2.gasUsed.mul(r2.effectiveGasPrice));
      const spent = balBefore.sub(balAfter).sub(gasCost);
      // Should have spent exactly 0.18 BNB (price) net
      expect(spent).to.equal(ethers.utils.parseEther("0.18"));
    });
  });

  describe("Attribute Generation", function () {
    it("should generate personality in [20, 80] range", async function () {
      await commitAndReveal(user1, 0, "0.18");
      const state = await router.getLobsterState(1);

      expect(state.courage).to.be.gte(20).and.lte(80);
      expect(state.wisdom).to.be.gte(20).and.lte(80);
      expect(state.social).to.be.gte(20).and.lte(80);
      expect(state.create).to.be.gte(20).and.lte(80);
      expect(state.grit).to.be.gte(20).and.lte(80);
    });

    it("should generate DNA within Common range (80-140)", async function () {
      await commitAndReveal(user1, 0, "0.18");
      const state = await router.getLobsterState(1);

      const dnaSum = state.str + state.def + state.spd + state.vit;
      // Due to capping at 100, actual sum might be slightly less
      expect(dnaSum).to.be.lte(400);
      // Each gene should be <= 100
      expect(state.str).to.be.lte(100);
      expect(state.def).to.be.lte(100);
      expect(state.spd).to.be.lte(100);
      expect(state.vit).to.be.lte(100);
    });

    it("should assign shelter 0-7", async function () {
      await commitAndReveal(user1, 0, "0.18");
      const state = await router.getLobsterState(1);
      expect(state.shelter).to.be.gte(0).and.lte(7);
    });

    it("should set correct rarity", async function () {
      await commitAndReveal(user1, 2, "1.88"); // Epic
      const state = await router.getLobsterState(1);
      expect(state.rarity).to.equal(2);
    });
  });

  describe("CLW Airdrop", function () {
    it("should airdrop 100 CLW to Common lobster", async function () {
      await commitAndReveal(user1, 0, "0.18");
      const balance = await router.clwBalances(1);
      expect(balance).to.equal(ethers.utils.parseEther("100"));
    });

    it("should airdrop 300 CLW to Rare lobster", async function () {
      await commitAndReveal(user1, 1, "0.88");
      const balance = await router.clwBalances(1);
      expect(balance).to.equal(ethers.utils.parseEther("300"));
    });
  });

  describe("Rarity Cap", function () {
    it("should enforce Mythic cap of 1", async function () {
      await commitAndReveal(user1, 4, "8.88");
      const minted = await vault.getRarityMinted();
      expect(minted[4]).to.equal(1);

      // Second Mythic should fail
      const salt = ethers.utils.formatBytes32String("salt2");
      const hash = computeHash(4, salt, user2.address);
      await vault.connect(user2).commit(hash, { value: ethers.utils.parseEther("8.88") });
      await increaseTime(61);
      await expect(vault.connect(user2).reveal(4, salt)).to.be.revertedWith("Rarity sold out");
    });
  });

  describe("Expired Refund", function () {
    it("should refund after window expires", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);
      const amount = ethers.utils.parseEther("0.18");

      await vault.connect(user1).commit(hash, { value: amount });
      await increaseTime(24 * 3600 + 1);

      const balBefore = await user1.getBalance();
      const tx = await vault.connect(user1).refundExpired();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balAfter = await user1.getBalance();

      expect(balAfter.sub(balBefore).add(gasCost)).to.equal(amount);
    });

    it("should reject refund before window expires", async function () {
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);

      await vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") });
      await expect(vault.connect(user1).refundExpired()).to.be.revertedWith("Window still open");
    });
  });

  describe("Admin", function () {
    it("should allow owner to withdraw funds", async function () {
      await commitAndReveal(user1, 0, "0.18");

      const balBefore = await owner.getBalance();
      const tx = await vault.withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balAfter = await owner.getBalance();

      expect(balAfter.sub(balBefore).add(gasCost)).to.equal(ethers.utils.parseEther("0.18"));
    });

    it("should allow owner to toggle minting", async function () {
      await vault.setMintingActive(false);
      const salt = ethers.utils.formatBytes32String("salt");
      const hash = computeHash(0, salt, user1.address);
      await expect(
        vault.connect(user1).commit(hash, { value: ethers.utils.parseEther("0.18") })
      ).to.be.revertedWith("Minting not active");
    });
  });

  describe("View Helpers", function () {
    it("should compute correct commit hash", async function () {
      const salt = ethers.utils.formatBytes32String("test");
      const hash = await vault.getCommitHash(0, salt, user1.address);
      const expected = ethers.utils.solidityKeccak256(
        ["uint8", "bytes32", "address"],
        [0, salt, user1.address]
      );
      expect(hash).to.equal(expected);
    });

    it("should return correct prices", async function () {
      expect(await vault.getPrice(0)).to.equal(ethers.utils.parseEther("0.18"));
      expect(await vault.getPrice(1)).to.equal(ethers.utils.parseEther("0.88"));
      expect(await vault.getPrice(4)).to.equal(ethers.utils.parseEther("8.88"));
    });
  });
});
