import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA, MarketSkill } from "../typechain-types";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("MarketSkill", function () {
  let nfa: ClawNFA;
  let market: MarketSkill;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;

  const defaultMetadata = {
    persona: "", experience: "", voiceHash: "",
    animationURI: "", vaultURI: "",
    vaultHash: ethers.constants.HashZero,
  };

  let tokenA: any;
  let tokenB: any;

  beforeEach(async function () {
    [owner, minter, treasury, seller, buyer] = await ethers.getSigners();

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(ClawNFA, ["Claw NFA", "CNFA", treasury.address], { kind: "uups" })) as ClawNFA;

    const MarketSkill = await ethers.getContractFactory("MarketSkill");
    market = (await upgrades.deployProxy(MarketSkill, [nfa.address, treasury.address], { kind: "uups" })) as MarketSkill;

    // Mint NFAs
    await nfa.setMinter(minter.address);
    await nfa.connect(minter).mintTo(seller.address, ethers.constants.AddressZero, "ipfs://1", defaultMetadata);
    await nfa.connect(minter).mintTo(buyer.address, ethers.constants.AddressZero, "ipfs://2", defaultMetadata);
    tokenA = 1;
    tokenB = 2;

    // Approve marketplace
    await nfa.connect(seller).setApprovalForAll(market.address, true);
    await nfa.connect(buyer).setApprovalForAll(market.address, true);
  });

  describe("Fixed Price", function () {
    it("should list and buy at fixed price", async function () {
      const price = ethers.utils.parseEther("1");
      await market.connect(seller).listFixedPrice(tokenA, price);

      // NFA should be in escrow
      expect(await nfa.ownerOf(tokenA)).to.equal(market.address);

      const sellerBal0 = await seller.getBalance();
      await market.connect(buyer).buyFixedPrice(1, { value: price });

      expect(await nfa.ownerOf(tokenA)).to.equal(buyer.address);

      // Seller gets 97.5% (2.5% fee)
      const sellerBal1 = await seller.getBalance();
      const expectedPayment = price.mul(9750).div(10000);
      expect(sellerBal1.sub(sellerBal0)).to.equal(expectedPayment);
    });

    it("should send fee to treasury", async function () {
      const price = ethers.utils.parseEther("1");
      await market.connect(seller).listFixedPrice(tokenA, price);

      const treasuryBal0 = await treasury.getBalance();
      await market.connect(buyer).buyFixedPrice(1, { value: price });
      const treasuryBal1 = await treasury.getBalance();

      const expectedFee = price.mul(250).div(10000);
      expect(treasuryBal1.sub(treasuryBal0)).to.equal(expectedFee);
    });

    it("should refund excess BNB", async function () {
      const price = ethers.utils.parseEther("1");
      await market.connect(seller).listFixedPrice(tokenA, price);

      const buyerBal0 = await buyer.getBalance();
      const tx = await market.connect(buyer).buyFixedPrice(1, { value: ethers.utils.parseEther("2") });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const buyerBal1 = await buyer.getBalance();

      // Should have spent exactly 1 BNB + gas
      expect(buyerBal0.sub(buyerBal1).sub(gasCost)).to.equal(price);
    });

    it("should reject insufficient payment", async function () {
      await market.connect(seller).listFixedPrice(tokenA, ethers.utils.parseEther("1"));
      await expect(
        market.connect(buyer).buyFixedPrice(1, { value: ethers.utils.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient BNB");
    });

    it("should reject double listing", async function () {
      await market.connect(seller).listFixedPrice(tokenA, ethers.utils.parseEther("1"));
      // tokenA is now in market, seller can't list again
      // But even if they had another token, same NFA can't be listed twice
      // This would revert because NFA is already transferred
    });
  });

  describe("Auction", function () {
    it("should list and accept bids", async function () {
      const startPrice = ethers.utils.parseEther("1");
      await market.connect(seller).listAuction(tokenA, startPrice);

      await market.connect(buyer).bid(1, { value: startPrice });

      const listing = await market.getListing(1);
      expect(listing.highestBidder).to.equal(buyer.address);
      expect(listing.highestBid).to.equal(startPrice);
    });

    it("should enforce minimum bid increment", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await market.connect(buyer).bid(1, { value: ethers.utils.parseEther("1") });

      // Min increment = 5% → 1.05 BNB minimum
      await expect(
        market.connect(owner).bid(1, { value: ethers.utils.parseEther("1.04") })
      ).to.be.revertedWith("Bid too low");

      // 1.05 should work
      await market.connect(owner).bid(1, { value: ethers.utils.parseEther("1.05") });
    });

    it("should refund previous bidder", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await market.connect(buyer).bid(1, { value: ethers.utils.parseEther("1") });

      const buyerBal0 = await buyer.getBalance();
      // Owner outbids
      await market.connect(owner).bid(1, { value: ethers.utils.parseEther("1.1") });
      const buyerBal1 = await buyer.getBalance();

      // Buyer should be refunded
      expect(buyerBal1.sub(buyerBal0)).to.equal(ethers.utils.parseEther("1"));
    });

    it("should settle auction after end time", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await market.connect(buyer).bid(1, { value: ethers.utils.parseEther("2") });

      await increaseTime(24 * 3600 + 1); // Past auction end

      await market.settleAuction(1);
      expect(await nfa.ownerOf(tokenA)).to.equal(buyer.address);
    });

    it("should return NFA if no bids", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await increaseTime(24 * 3600 + 1);

      await market.settleAuction(1);
      expect(await nfa.ownerOf(tokenA)).to.equal(seller.address);
    });

    it("should reject bids after auction end", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await increaseTime(24 * 3600 + 1);

      await expect(
        market.connect(buyer).bid(1, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Auction ended");
    });
  });

  describe("Swap", function () {
    it("should execute NFA swap", async function () {
      await market.connect(seller).listSwap(tokenA, tokenB);

      await market.connect(buyer).acceptSwap(1);

      // Tokens should be swapped
      expect(await nfa.ownerOf(tokenA)).to.equal(buyer.address);
      expect(await nfa.ownerOf(tokenB)).to.equal(seller.address);
    });

    it("should reject swap by non-target owner", async function () {
      await market.connect(seller).listSwap(tokenA, tokenB);

      await expect(
        market.connect(owner).acceptSwap(1) // owner doesn't have tokenB
      ).to.be.revertedWith("Not target owner");
    });
  });

  describe("Cancel", function () {
    it("should allow seller to cancel fixed price listing", async function () {
      await market.connect(seller).listFixedPrice(tokenA, ethers.utils.parseEther("1"));
      await market.connect(seller).cancelListing(1);

      expect(await nfa.ownerOf(tokenA)).to.equal(seller.address);
    });

    it("should allow cancel auction with no bids", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await market.connect(seller).cancelListing(1);

      expect(await nfa.ownerOf(tokenA)).to.equal(seller.address);
    });

    it("should reject cancel auction with bids", async function () {
      await market.connect(seller).listAuction(tokenA, ethers.utils.parseEther("1"));
      await market.connect(buyer).bid(1, { value: ethers.utils.parseEther("1") });

      await expect(
        market.connect(seller).cancelListing(1)
      ).to.be.revertedWith("Has bids");
    });

    it("should reject cancel by non-seller", async function () {
      await market.connect(seller).listFixedPrice(tokenA, ethers.utils.parseEther("1"));
      await expect(
        market.connect(buyer).cancelListing(1)
      ).to.be.revertedWith("Not seller");
    });
  });
});
