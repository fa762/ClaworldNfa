import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ClawNFA } from "../typechain-types";

describe("ClawNFA", function () {
  let nfa: ClawNFA;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const defaultMetadata = {
    persona: "brave",
    experience: "veteran",
    voiceHash: "0x1234",
    animationURI: "ipfs://anim",
    vaultURI: "ipfs://vault",
    vaultHash: ethers.utils.formatBytes32String("vaulthash"),
  };

  beforeEach(async function () {
    [owner, minter, treasury, user1, user2] = await ethers.getSigners();

    const ClawNFA = await ethers.getContractFactory("ClawNFA");
    nfa = (await upgrades.deployProxy(
      ClawNFA,
      ["Claw NFA", "CNFA", treasury.address],
      { kind: "uups" }
    )) as ClawNFA;
    await nfa.deployed();

    // Set minter
    await nfa.setMinter(minter.address);
  });

  describe("Initialization", function () {
    it("should initialize with correct name and symbol", async function () {
      expect(await nfa.name()).to.equal("Claw NFA");
      expect(await nfa.symbol()).to.equal("CNFA");
    });

    it("should set treasury address", async function () {
      expect(await nfa.treasuryAddress()).to.equal(treasury.address);
    });

    it("should set owner correctly", async function () {
      expect(await nfa.owner()).to.equal(owner.address);
    });

    it("should not allow re-initialization", async function () {
      await expect(
        nfa.initialize("Hack", "HCK", treasury.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Minting", function () {
    it("should allow minter to mint", async function () {
      const tx = await nfa
        .connect(minter)
        .mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta1", defaultMetadata);
      const receipt = await tx.wait();

      expect(await nfa.ownerOf(1)).to.equal(user1.address);
      expect(await nfa.tokenURI(1)).to.equal("ipfs://meta1");
    });

    it("should increment token IDs", async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://1", defaultMetadata);
      await nfa.connect(minter).mintTo(user2.address, ethers.constants.AddressZero, "ipfs://2", defaultMetadata);

      expect(await nfa.ownerOf(1)).to.equal(user1.address);
      expect(await nfa.ownerOf(2)).to.equal(user2.address);
      expect(await nfa.getTotalSupply()).to.equal(2);
    });

    it("should reject mint from non-minter", async function () {
      await expect(
        nfa.connect(user1).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata)
      ).to.be.revertedWith("Not minter");
    });

    it("should store extended metadata", async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata);

      const [metadata] = await nfa.getAgentMetadata(1);
      expect(metadata.persona).to.equal("brave");
      expect(metadata.experience).to.equal("veteran");
    });

    it("should store agent state", async function () {
      const logicAddr = user2.address;
      await nfa.connect(minter).mintTo(user1.address, logicAddr, "ipfs://meta", defaultMetadata);

      const state = await nfa.getAgentState(1);
      expect(state.balance).to.equal(0);
      expect(state.active).to.equal(true);
      expect(state.logicAddress).to.equal(logicAddr);
      expect(state.tokenOwner).to.equal(user1.address);
    });

    it("should emit AgentCreated event", async function () {
      await expect(
        nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata)
      )
        .to.emit(nfa, "AgentCreated")
        .withArgs(1, user1.address, ethers.constants.AddressZero, "ipfs://meta");
    });
  });

  describe("Post-Genesis Public Mint", function () {
    beforeEach(async function () {
      await nfa.setPostGenesisMintEnabled(true);
    });

    it("should allow public mint with correct fee", async function () {
      const fee = ethers.utils.parseEther("0.08");
      await nfa.connect(user1).publicMint("ipfs://public", defaultMetadata, { value: fee });

      expect(await nfa.ownerOf(1)).to.equal(user1.address);
    });

    it("should send fee to treasury", async function () {
      const fee = ethers.utils.parseEther("0.08");
      const balBefore = await treasury.getBalance();
      await nfa.connect(user1).publicMint("ipfs://public", defaultMetadata, { value: fee });
      const balAfter = await treasury.getBalance();

      expect(balAfter.sub(balBefore)).to.equal(fee);
    });

    it("should reject incorrect fee", async function () {
      await expect(
        nfa.connect(user1).publicMint("ipfs://public", defaultMetadata, {
          value: ethers.utils.parseEther("0.05"),
        })
      ).to.be.revertedWith("Incorrect fee");
    });

    it("should reject when not enabled", async function () {
      await nfa.setPostGenesisMintEnabled(false);
      const fee = ethers.utils.parseEther("0.08");
      await expect(
        nfa.connect(user1).publicMint("ipfs://public", defaultMetadata, { value: fee })
      ).to.be.revertedWith("Post-genesis mint not enabled");
    });
  });

  describe("Fund Agent", function () {
    beforeEach(async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata);
    });

    it("should allow anyone to fund agent", async function () {
      const amount = ethers.utils.parseEther("1");
      await nfa.connect(user2).fundAgent(1, { value: amount });

      const state = await nfa.getAgentState(1);
      expect(state.balance).to.equal(amount);
    });

    it("should accumulate funds", async function () {
      await nfa.connect(user1).fundAgent(1, { value: ethers.utils.parseEther("1") });
      await nfa.connect(user2).fundAgent(1, { value: ethers.utils.parseEther("2") });

      const state = await nfa.getAgentState(1);
      expect(state.balance).to.equal(ethers.utils.parseEther("3"));
    });

    it("should reject zero value", async function () {
      await expect(nfa.connect(user1).fundAgent(1, { value: 0 })).to.be.revertedWith("Zero value");
    });

    it("should reject funding non-existent token", async function () {
      await expect(
        nfa.connect(user1).fundAgent(999, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Withdraw From Agent", function () {
    beforeEach(async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata);
      await nfa.connect(user2).fundAgent(1, { value: ethers.utils.parseEther("5") });
    });

    it("should allow owner to withdraw", async function () {
      const balBefore = await user1.getBalance();
      const tx = await nfa.connect(user1).withdrawFromAgent(1, ethers.utils.parseEther("2"));
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const balAfter = await user1.getBalance();

      expect(balAfter.sub(balBefore).add(gasCost)).to.equal(ethers.utils.parseEther("2"));
    });

    it("should reject non-owner withdrawal", async function () {
      await expect(
        nfa.connect(user2).withdrawFromAgent(1, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Not token owner");
    });

    it("should reject insufficient balance", async function () {
      await expect(
        nfa.connect(user1).withdrawFromAgent(1, ethers.utils.parseEther("10"))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Logic Address", function () {
    beforeEach(async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata);
    });

    it("should allow owner to set logic address", async function () {
      await nfa.connect(user1).setLogicAddress(1, user2.address);
      const state = await nfa.getAgentState(1);
      expect(state.logicAddress).to.equal(user2.address);
    });

    it("should reject non-owner setting logic address", async function () {
      await expect(
        nfa.connect(user2).setLogicAddress(1, user2.address)
      ).to.be.revertedWith("Not token owner");
    });
  });

  describe("Agent Status", function () {
    beforeEach(async function () {
      await nfa.connect(minter).mintTo(user1.address, user2.address, "ipfs://meta", defaultMetadata);
    });

    it("should allow owner to toggle status", async function () {
      await nfa.connect(user1).setAgentStatus(1, false);
      let state = await nfa.getAgentState(1);
      expect(state.active).to.equal(false);

      await nfa.connect(user1).setAgentStatus(1, true);
      state = await nfa.getAgentState(1);
      expect(state.active).to.equal(true);
    });

    it("should allow logic address to set status via router call", async function () {
      await nfa.connect(user2).setAgentStatusByRouter(1, false);
      const state = await nfa.getAgentState(1);
      expect(state.active).to.equal(false);
    });

    it("should reject non-logic address router call", async function () {
      await expect(
        nfa.connect(user1).setAgentStatusByRouter(1, false)
      ).to.be.revertedWith("Not logic address");
    });
  });

  describe("Metadata Update", function () {
    beforeEach(async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta1", defaultMetadata);
    });

    it("should allow owner to update metadata", async function () {
      const newMeta = { ...defaultMetadata, persona: "wise", experience: "elder" };
      await nfa.connect(user1).updateAgentMetadata(1, "ipfs://meta2", newMeta);

      const [metadata, uri] = await nfa.getAgentMetadata(1);
      expect(metadata.persona).to.equal("wise");
      expect(uri).to.equal("ipfs://meta2");
    });
  });

  describe("Enumeration", function () {
    it("should track tokens of owner", async function () {
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://1", defaultMetadata);
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://2", defaultMetadata);
      await nfa.connect(minter).mintTo(user2.address, ethers.constants.AddressZero, "ipfs://3", defaultMetadata);

      const tokens = await nfa.tokensOfOwner(user1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1);
      expect(tokens[1]).to.equal(2);
    });
  });

  describe("Admin", function () {
    it("should allow owner to update minter", async function () {
      await nfa.setMinter(user2.address);
      expect(await nfa.minter()).to.equal(user2.address);
    });

    it("should allow owner to update treasury", async function () {
      await nfa.setTreasury(user2.address);
      expect(await nfa.treasuryAddress()).to.equal(user2.address);
    });

    it("should reject zero address treasury", async function () {
      await expect(nfa.setTreasury(ethers.constants.AddressZero)).to.be.revertedWith("Zero address");
    });

    it("should allow owner to pause/unpause", async function () {
      await nfa.setPaused(true);
      await expect(
        nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata)
      ).to.be.revertedWith("Contract is paused");

      await nfa.setPaused(false);
      await nfa.connect(minter).mintTo(user1.address, ethers.constants.AddressZero, "ipfs://meta", defaultMetadata);
      expect(await nfa.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("Burn Protection", function () {
    it("should reject receive() direct transfers", async function () {
      await expect(
        owner.sendTransaction({ to: nfa.address, value: ethers.utils.parseEther("1") })
      ).to.be.revertedWith("Use fundAgent() instead");
    });
  });
});
