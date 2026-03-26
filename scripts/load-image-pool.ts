/**
 * Load IPFS CIDs into GenesisVault image pools by rarity.
 * Run once before minting starts. Images auto-assigned during reveal.
 *
 * Reads: scripts/output/ipfs-cids.json + scripts/output/image-names.json
 * Groups CIDs by rarity, calls loadImagePool(rarity, cids[]) on-chain.
 *
 * Usage:
 *   npx hardhat run scripts/load-image-pool.ts --network bscTestnet
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const VAULT_ADDRESS = process.env.GENESIS_VAULT_ADDRESS || '0x6d176022759339da787fD3E2f1314019C3fb7867';

// Image ID ranges by rarity (from gen_images.py)
const RARITY_RANGES: Record<number, [number, number]> = {
  4: [1, 1],       // Mythic: #1
  3: [2, 5],       // Legendary: #2-5
  2: [6, 11],      // Epic: #6-11
  1: [12, 28],     // Rare: #12-28
  0: [29, 888],    // Common: #29-888
};

const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const BATCH_SIZE = 50; // Max CIDs per tx to avoid gas limit

async function main() {
  const cidsFile = path.join(__dirname, 'output', 'ipfs-cids.json');
  if (!fs.existsSync(cidsFile)) {
    console.error('No ipfs-cids.json. Run upload-ipfs.ts first.');
    process.exit(1);
  }

  const cids: Record<string, string> = JSON.parse(fs.readFileSync(cidsFile, 'utf8'));
  console.log(`Loaded ${Object.keys(cids).length} IPFS CIDs`);

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const vault = await ethers.getContractAt('GenesisVault', VAULT_ADDRESS);

  for (const [rarityStr, [start, end]] of Object.entries(RARITY_RANGES)) {
    const rarity = Number(rarityStr);
    const name = RARITY_NAMES[rarity];

    // Check current pool status
    const status = await vault.getImagePoolStatus(rarity);
    const alreadyLoaded = status.loaded.toNumber();

    // Collect CIDs for this rarity as ipfs:// URIs
    const uris: string[] = [];
    for (let i = start; i <= end; i++) {
      const cid = cids[String(i)];
      if (cid) {
        uris.push(`ipfs://${cid}`);
      } else {
        console.warn(`  ⚠️ Missing CID for image #${i}`);
      }
    }

    const expected = end - start + 1;
    console.log(`\n${name} (rarity ${rarity}): ${uris.length}/${expected} CIDs`);

    if (alreadyLoaded >= uris.length) {
      console.log(`  Already loaded ${alreadyLoaded} — skipping`);
      continue;
    }

    // Skip already loaded
    const toLoad = uris.slice(alreadyLoaded);
    console.log(`  Loading ${toLoad.length} new CIDs (${alreadyLoaded} already loaded)...`);

    // Batch upload
    for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
      const batch = toLoad.slice(i, i + BATCH_SIZE);
      const tx = await vault.loadImagePool(rarity, batch, { gasLimit: 5000000 });
      await tx.wait();
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} CIDs loaded ✅`);
    }

    // Verify
    const finalStatus = await vault.getImagePoolStatus(rarity);
    console.log(`  Pool: ${finalStatus.loaded.toNumber()} loaded, ${finalStatus.used.toNumber()} used`);
  }

  console.log('\n✅ All image pools loaded! Minting will auto-assign images.');
}

main().catch(console.error);
