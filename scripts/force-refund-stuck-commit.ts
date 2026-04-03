/**
 * Upgrade GenesisVault to latest implementation and force-refund a stuck commitment.
 *
 * Usage:
 *   FORCE_REFUND_USER=0x... npx hardhat run scripts/force-refund-stuck-commit.ts --network bscMainnet
 */
import { ethers, upgrades } from "hardhat";

const GENESIS_VAULT = "0xCe04f834aC4581FD5562f6c58C276E60C624fF83";

async function main() {
  const user = process.env.FORCE_REFUND_USER;
  if (!user || !ethers.utils.isAddress(user)) {
    throw new Error("Set FORCE_REFUND_USER to a valid address");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Target user:", user);
  console.log("GenesisVault:", GENESIS_VAULT);

  const ownerView = new ethers.Contract(
    GENESIS_VAULT,
    ["function owner() view returns (address)"],
    ethers.provider
  );
  const owner = await ownerView.owner();
  console.log("Vault owner:", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Owner mismatch: signer ${deployer.address}, vault owner ${owner}`);
  }

  const before = new ethers.Contract(
    GENESIS_VAULT,
    [
      "function commitments(address) view returns (bytes32 hash, uint256 value, uint64 timestamp, bool revealed)",
      "function forceRefundCommitment(address user) external",
    ],
    deployer
  );
  const beforeCommit = await before.commitments(user);
  console.log("Before commitment:", {
    hash: beforeCommit.hash,
    value: ethers.utils.formatEther(beforeCommit.value),
    timestamp: Number(beforeCommit.timestamp),
    revealed: beforeCommit.revealed,
  });

  const GenesisVault = await ethers.getContractFactory("GenesisVault");
  const upgraded = await upgrades.upgradeProxy(GENESIS_VAULT, GenesisVault);
  await upgraded.deployed();
  console.log("Upgraded proxy:", upgraded.address);
  console.log("Implementation:", await upgrades.erc1967.getImplementationAddress(GENESIS_VAULT));

  const tx = await before.forceRefundCommitment(user);
  console.log("Force refund tx:", tx.hash);
  await tx.wait();

  const afterCommit = await before.commitments(user);
  console.log("After commitment:", {
    hash: afterCommit.hash,
    value: ethers.utils.formatEther(afterCommit.value),
    timestamp: Number(afterCommit.timestamp),
    revealed: afterCommit.revealed,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
