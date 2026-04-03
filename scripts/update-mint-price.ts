/**
 * Upgrade mainnet mint contracts and verify the common mint price is 0.02 BNB.
 *
 * Targets:
 * - ClawNFA.POST_GENESIS_PRICE
 * - GenesisVault.PRICE_COMMON
 *
 * Usage:
 *   npx hardhat run scripts/update-mint-price.ts --network bscMainnet
 */
import { ethers, upgrades } from "hardhat";

const TARGET_PRICE = ethers.utils.parseEther("0.02");

const CONTRACTS = {
  clawNFA: "0xAa2094798B5892191124eae9D77E337544FFAE48",
  genesisVault: "0xCe04f834aC4581FD5562f6c58C276E60C624fF83",
} as const;

function formatBnb(value: any) {
  return `${ethers.utils.formatEther(value)} BNB`;
}

async function ensureOwner(contractName: string, proxyAddress: string, signerAddress: string) {
  const ownable = new ethers.Contract(proxyAddress, ["function owner() view returns (address)"], ethers.provider);
  const owner = await ownable.owner();
  console.log(`${contractName} owner:`, owner);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`${contractName} owner mismatch. Signer ${signerAddress} is not owner ${owner}`);
  }
}

async function upgradeClawNfa() {
  const beforeImpl = await upgrades.erc1967.getImplementationAddress(CONTRACTS.clawNFA);
  const before = new ethers.Contract(
    CONTRACTS.clawNFA,
    ["function POST_GENESIS_PRICE() view returns (uint256)"],
    ethers.provider
  );
  const beforePrice = await before.POST_GENESIS_PRICE();

  console.log("ClawNFA proxy:", CONTRACTS.clawNFA);
  console.log("ClawNFA implementation before:", beforeImpl);
  console.log("ClawNFA price before:", formatBnb(beforePrice));

  if (!beforePrice.eq(TARGET_PRICE)) {
    const Factory = await ethers.getContractFactory("ClawNFA");
    await upgrades.validateUpgrade(CONTRACTS.clawNFA, Factory);
    const upgraded = await upgrades.upgradeProxy(CONTRACTS.clawNFA, Factory);
    await upgraded.deployed();
  } else {
    console.log("ClawNFA already at target price, skipping upgrade.");
  }

  const afterImpl = await upgrades.erc1967.getImplementationAddress(CONTRACTS.clawNFA);
  const after = new ethers.Contract(
    CONTRACTS.clawNFA,
    ["function POST_GENESIS_PRICE() view returns (uint256)"],
    ethers.provider
  );
  const afterPrice = await after.POST_GENESIS_PRICE();

  console.log("ClawNFA implementation after:", afterImpl);
  console.log("ClawNFA price after:", formatBnb(afterPrice));

  if (!afterPrice.eq(TARGET_PRICE)) {
    throw new Error(`ClawNFA verification failed. Expected ${formatBnb(TARGET_PRICE)}, got ${formatBnb(afterPrice)}`);
  }
}

async function upgradeGenesisVault() {
  const beforeImpl = await upgrades.erc1967.getImplementationAddress(CONTRACTS.genesisVault);
  const before = new ethers.Contract(
    CONTRACTS.genesisVault,
    ["function PRICE_COMMON() view returns (uint256)"],
    ethers.provider
  );
  const beforePrice = await before.PRICE_COMMON();

  console.log("GenesisVault proxy:", CONTRACTS.genesisVault);
  console.log("GenesisVault implementation before:", beforeImpl);
  console.log("GenesisVault price before:", formatBnb(beforePrice));

  if (!beforePrice.eq(TARGET_PRICE)) {
    const Factory = await ethers.getContractFactory("GenesisVault");
    await upgrades.validateUpgrade(CONTRACTS.genesisVault, Factory);
    const upgraded = await upgrades.upgradeProxy(CONTRACTS.genesisVault, Factory);
    await upgraded.deployed();
  } else {
    console.log("GenesisVault already at target price, skipping upgrade.");
  }

  const afterImpl = await upgrades.erc1967.getImplementationAddress(CONTRACTS.genesisVault);
  const after = new ethers.Contract(
    CONTRACTS.genesisVault,
    ["function PRICE_COMMON() view returns (uint256)"],
    ethers.provider
  );
  const afterPrice = await after.PRICE_COMMON();

  console.log("GenesisVault implementation after:", afterImpl);
  console.log("GenesisVault price after:", formatBnb(afterPrice));

  if (!afterPrice.eq(TARGET_PRICE)) {
    throw new Error(
      `GenesisVault verification failed. Expected ${formatBnb(TARGET_PRICE)}, got ${formatBnb(afterPrice)}`
    );
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", (await ethers.provider.getNetwork()).name, (await ethers.provider.getNetwork()).chainId);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", formatBnb(await deployer.getBalance()));
  console.log("---");

  await ensureOwner("ClawNFA", CONTRACTS.clawNFA, deployer.address);
  await ensureOwner("GenesisVault", CONTRACTS.genesisVault, deployer.address);
  console.log("---");

  await upgradeClawNfa();
  console.log("---");
  await upgradeGenesisVault();
  console.log("---");
  console.log("Done. Common mint price is now 0.02 BNB on both contracts.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
