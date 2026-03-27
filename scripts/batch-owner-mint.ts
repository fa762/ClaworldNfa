/**
 * Batch ownerMint — mint N Common NFAs for airdrop.
 * Then auto-assign images + set tokenURIs.
 *
 * Usage:
 *   MINT_COUNT=99 npx hardhat run scripts/batch-owner-mint.ts --network bscMainnet
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const MINT_COUNT = Number(process.env.MINT_COUNT || '99');
const RARITY = 0; // Common

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.utils.formatEther(await deployer.getBalance()), 'BNB');
  console.log(`Minting ${MINT_COUNT} Common NFAs for airdrop...\n`);

  const vaultAddress = process.env.GENESIS_VAULT_ADDRESS || '0x6d176022759339da787fD3E2f1314019C3fb7867';
  const vault = await ethers.getContractAt('GenesisVault', vaultAddress);

  let minted = 0;
  const startId = (await (await ethers.getContractAt('ClawNFA',
    process.env.NFA_ADDRESS || '0x1c69be3401a78CFeDC2B2543E62877874f10B135'
  )).getTotalSupply()).toNumber() + 1;

  for (let i = 0; i < MINT_COUNT; i++) {
    try {
      const tx = await vault.ownerMint(RARITY, deployer.address, { gasLimit: 500000 });
      const receipt = await tx.wait();
      minted++;
      const tokenId = startId + i;
      if (minted % 10 === 0 || minted === MINT_COUNT) {
        console.log(`  Minted ${minted}/${MINT_COUNT} (tokenId ~${tokenId})`);
      }
    } catch (e: any) {
      console.error(`  #${i + 1} failed: ${e.reason || e.message?.substring(0, 60)}`);
    }
  }

  console.log(`\n✅ Minted ${minted} NFAs`);
  console.log(`\nNext steps:`);
  console.log(`  1. npx hardhat run scripts/assign-images.ts --network bscMainnet`);
  console.log(`  2. npx hardhat run scripts/set-token-uris.ts --network bscMainnet`);
  console.log(`  3. Transfer to airdrop recipients`);
}

main().catch(console.error);
