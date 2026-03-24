import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { WorldState, MockCLW, MockPancakePair } from "../typechain-types";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("WorldState", function () {
  let worldState: WorldState;
  let clw: MockCLW;
  let pair: MockPancakePair;
  let owner: SignerWithAddress;
  let keeper: SignerWithAddress;
  let user1: SignerWithAddress;
  let wbnb: MockCLW; // Using another ERC20 as fake WBNB

  beforeEach(async function () {
    [owner, keeper, user1] = await ethers.getSigners();

    const MockCLW = await ethers.getContractFactory("MockCLW");
    clw = (await MockCLW.deploy()) as MockCLW;
    wbnb = (await MockCLW.deploy()) as MockCLW;

    const MockPancakePair = await ethers.getContractFactory("MockPancakePair");
    pair = (await MockPancakePair.deploy(clw.address, wbnb.address)) as MockPancakePair;

    const WorldState = await ethers.getContractFactory("WorldState");
    worldState = (await upgrades.deployProxy(WorldState, [], { kind: "uups" })) as WorldState;

    // Configure
    await worldState.setCLWToken(clw.address);
    await worldState.setPancakePair(pair.address);
    await worldState.setKeeper(keeper.address, true);
  });

  describe("Initialization", function () {
    it("should initialize with default values", async function () {
      expect(await worldState.rewardMultiplier()).to.equal(10000);
      expect(await worldState.pkStakeLimit()).to.equal(ethers.utils.parseEther("1000"));
      expect(await worldState.mutationBonus()).to.equal(10000);
      expect(await worldState.dailyCostMultiplier()).to.equal(10000);
    });
  });

  describe("Timelock: Propose & Execute", function () {
    it("should propose and execute after delay", async function () {
      const events = ethers.utils.formatBytes32String("test");
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, events);

      // Values should NOT change yet
      expect(await worldState.rewardMultiplier()).to.equal(10000);

      // Wait for timelock delay (24 hours)
      await increaseTime(24 * 3600 + 1);
      await worldState.executeWorldState();

      // Now values should be updated
      expect(await worldState.rewardMultiplier()).to.equal(15000);
      expect(await worldState.pkStakeLimit()).to.equal(2000);
      expect(await worldState.mutationBonus()).to.equal(12000);
      expect(await worldState.dailyCostMultiplier()).to.equal(8000);
      expect(await worldState.activeEvents()).to.equal(events);
    });

    it("should reject execute before delay", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);

      await expect(
        worldState.executeWorldState()
      ).to.be.revertedWith("Timelock not expired");
    });

    it("should reject non-owner propose", async function () {
      await expect(
        worldState.connect(user1).proposeWorldState(10000, 1000, 10000, 10000, ethers.constants.HashZero)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should reject second proposal while one is pending", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);
      await expect(
        worldState.proposeWorldState(20000, 3000, 15000, 9000, ethers.constants.HashZero)
      ).to.be.revertedWith("Proposal already pending");
    });

    it("should emit WorldStateProposed event", async function () {
      await expect(
        worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero)
      ).to.emit(worldState, "WorldStateProposed");
    });

    it("should emit WorldStateExecuted and WorldStateUpdated on execute", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);
      await increaseTime(24 * 3600 + 1);
      const tx = worldState.executeWorldState();
      await expect(tx).to.emit(worldState, "WorldStateExecuted");
      await expect(tx).to.emit(worldState, "WorldStateUpdated");
    });

    it("should reject execute when no proposal exists", async function () {
      await expect(
        worldState.executeWorldState()
      ).to.be.revertedWith("No pending proposal");
    });
  });

  describe("Timelock: Cancel", function () {
    it("should cancel a pending proposal", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);
      await worldState.cancelProposal();

      // Should be able to propose again
      await worldState.proposeWorldState(20000, 3000, 15000, 9000, ethers.constants.HashZero);
    });

    it("should emit WorldStateCancelled", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);
      await expect(worldState.cancelProposal()).to.emit(worldState, "WorldStateCancelled");
    });

    it("should reject cancel when no proposal exists", async function () {
      await expect(
        worldState.cancelProposal()
      ).to.be.revertedWith("No pending proposal");
    });

    it("should not affect live state on cancel", async function () {
      await worldState.proposeWorldState(15000, 2000, 12000, 8000, ethers.constants.HashZero);
      await worldState.cancelProposal();

      // Values should still be defaults
      expect(await worldState.rewardMultiplier()).to.equal(10000);
      expect(await worldState.pkStakeLimit()).to.equal(ethers.utils.parseEther("1000"));
    });
  });

  describe("AutoUpdate independence from Timelock", function () {
    it("autoUpdate should still work independently of timelock", async function () {
      // Propose a manual change (not yet executed)
      await worldState.proposeWorldState(20000, 5000, 20000, 5000, ethers.constants.HashZero);

      // autoUpdate should still work
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("10")
      );
      await worldState.connect(keeper).autoUpdate();

      // autoUpdate values should take effect immediately (bubble mode)
      expect(await worldState.rewardMultiplier()).to.equal(8000);

      // Pending proposal still exists
      const pending = await worldState.pendingState();
      expect(pending.exists).to.equal(true);
    });
  });

  describe("Auto Update", function () {
    it("should enter bubble mode when price is high", async function () {
      // Set reserves: 1000 CLW, 10 WBNB → price = 10/1000 = 0.01 BNB/CLW
      // token0 = CLW, so reserve0 = CLW, reserve1 = WBNB
      await pair.setReserves(
        ethers.utils.parseEther("1000"),  // CLW reserve
        ethers.utils.parseEther("10")     // WBNB reserve (high price: 0.01 per CLW)
      );

      await worldState.connect(keeper).autoUpdate();

      // Price 0.01 > threshold high 0.001 → bubble mode
      expect(await worldState.rewardMultiplier()).to.equal(8000);      // 0.8x
      expect(await worldState.dailyCostMultiplier()).to.equal(12000);  // 1.2x
      expect(await worldState.mutationBonus()).to.equal(15000);        // 1.5x
    });

    it("should enter winter mode when price is low", async function () {
      // Set reserves: 1000000 CLW, 0.01 WBNB → price = 0.01/1000000 = very low
      await pair.setReserves(
        ethers.utils.parseEther("1000000"),  // CLW
        ethers.utils.parseEther("0.01")      // WBNB (very low price)
      );

      await worldState.connect(keeper).autoUpdate();

      // Price very low < threshold low → winter mode
      expect(await worldState.rewardMultiplier()).to.equal(15000);     // 1.5x
      expect(await worldState.dailyCostMultiplier()).to.equal(8000);   // 0.8x
      expect(await worldState.mutationBonus()).to.equal(8000);         // 0.8x
      expect(await worldState.pkStakeLimit()).to.equal(ethers.utils.parseEther("500"));
    });

    it("should enter normal mode for mid-range price", async function () {
      // Price = 0.5 BNB / 1000 CLW = 0.0005 BNB per CLW (between thresholds)
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("0.5")
      );

      await worldState.connect(keeper).autoUpdate();

      expect(await worldState.rewardMultiplier()).to.equal(10000);
      expect(await worldState.dailyCostMultiplier()).to.equal(10000);
    });

    it("should reject unauthorized caller", async function () {
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1")
      );

      await expect(
        worldState.connect(user1).autoUpdate()
      ).to.be.revertedWith("Not authorized");
    });

    it("should enforce 1-hour rate limit", async function () {
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1")
      );

      await worldState.connect(keeper).autoUpdate();

      await expect(
        worldState.connect(keeper).autoUpdate()
      ).to.be.revertedWith("Too frequent");

      // After 1 hour it should work
      await increaseTime(3601);
      await worldState.connect(keeper).autoUpdate();
    });

    it("should reject when pair not set", async function () {
      const WorldState = await ethers.getContractFactory("WorldState");
      const fresh = (await upgrades.deployProxy(WorldState, [], { kind: "uups" })) as WorldState;
      await fresh.setKeeper(keeper.address, true);

      await expect(
        fresh.connect(keeper).autoUpdate()
      ).to.be.revertedWith("Pair not set");
    });

    it("should emit AutoUpdateTriggered event", async function () {
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1")
      );

      await expect(worldState.connect(keeper).autoUpdate())
        .to.emit(worldState, "AutoUpdateTriggered");
    });
  });

  describe("Price Reading", function () {
    it("should return CLW price from pair", async function () {
      // 1000 CLW, 1 WBNB → price = 1e18/1000 = 0.001 per CLW
      await pair.setReserves(
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1")
      );

      const price = await worldState.getCLWPrice();
      expect(price).to.equal(ethers.utils.parseEther("0.001"));
    });

    it("should return 0 when pair not set", async function () {
      const WorldState = await ethers.getContractFactory("WorldState");
      const fresh = (await upgrades.deployProxy(WorldState, [], { kind: "uups" })) as WorldState;
      expect(await fresh.getCLWPrice()).to.equal(0);
    });
  });

  describe("Admin", function () {
    it("should set thresholds", async function () {
      await worldState.setThresholds(
        ethers.utils.parseEther("0.01"),
        ethers.utils.parseEther("0.001")
      );
      expect(await worldState.priceThresholdHigh()).to.equal(ethers.utils.parseEther("0.01"));
      expect(await worldState.priceThresholdLow()).to.equal(ethers.utils.parseEther("0.001"));
    });

    it("should reject high <= low thresholds", async function () {
      await expect(
        worldState.setThresholds(
          ethers.utils.parseEther("0.001"),
          ethers.utils.parseEther("0.01")
        )
      ).to.be.revertedWith("High must exceed low");
    });

    it("should manage keepers", async function () {
      await worldState.setKeeper(user1.address, true);
      expect(await worldState.keepers(user1.address)).to.equal(true);

      await worldState.setKeeper(user1.address, false);
      expect(await worldState.keepers(user1.address)).to.equal(false);
    });
  });
});
