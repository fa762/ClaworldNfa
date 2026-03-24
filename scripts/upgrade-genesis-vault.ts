/**
 * Upgrade GenesisVault to latest implementation (new pricing)
 *
 * Requires:
 *   GENESIS_VAULT_ADDRESS - proxy address of existing GenesisVault
 *   PRIVATE_KEY - deployer/owner private key
 *
 * Usage:
 *   GENESIS_VAULT_ADDRESS=0x... \
 *   npx hardhat run scripts/upgrade-genesis-vault.ts --network bscTestnet
 */
const globalAgent = require('global-agent');
globalAgent.bootstrap();
import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  const proxyAddress = process.env.GENESIS_VAULT_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Set GENESIS_VAULT_ADDRESS environment variable (proxy address)");
  }

  console.log("GenesisVault proxy:", proxyAddress);

  const GenesisVault = await ethers.getContractFactory("GenesisVault");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, GenesisVault);
  await upgraded.deployed();

  console.log("GenesisVault upgraded successfully!");
  console.log("Proxy address (unchanged):", upgraded.address);
  console.log("New implementation deployed with updated pricing.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
