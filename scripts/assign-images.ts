/**
 * Assign NFT images to minted NFAs based on rarity
 *
 * Image pools (from gen_images.py):
 *   #1       = Mythic (ZERO)
 *   #2-5     = Legendary
 *   #6-11    = Epic
 *   #12-28   = Rare
 *   #29-888  = Common
 *
 * For each minted tokenId, reads its on-chain rarity,
 * then assigns a random unused image from the matching rarity pool.
 *
 * Output: scripts/output/token-image-map.json
 *   { "1": 42, "2": 15, ... }  (tokenId → imageNumber)
 *
 * Usage:
 *   npx hardhat run scripts/assign-images.ts --network bscTestnet
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// Image pools by rarity
const IMAGE_POOLS: Record<number, number[]> = {
  4: [1],                                          // Mythic
  3: [2, 3, 4, 5],                                 // Legendary
  2: [6, 7, 8, 9, 10, 11],                         // Epic
  1: Array.from({ length: 17 }, (_, i) => i + 12), // Rare: 12-28
  0: Array.from({ length: 860 }, (_, i) => i + 29), // Common: 29-888
};

function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const outputFile = path.join(__dirname, 'output', 'token-image-map.json');

  // Load existing assignments (resume-safe)
  let assignments: Record<string, number> = {};
  if (fs.existsSync(outputFile)) {
    assignments = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    console.log(`Resuming — ${Object.keys(assignments).length} already assigned`);
  }

  // Track used images
  const usedImages = new Set(Object.values(assignments));

  // Shuffle pools (deterministic per pool, but random assignment)
  const availablePools: Record<number, number[]> = {};
  for (const [rarity, pool] of Object.entries(IMAGE_POOLS)) {
    availablePools[Number(rarity)] = shuffle(pool.filter(img => !usedImages.has(img)));
  }

  // Get contract
  const nfaAddress = process.env.NFA_ADDRESS || '0x1c69be3401a78CFeDC2B2543E62877874f10B135';
  const routerAddress = process.env.ROUTER_ADDRESS || '0xA7Ee12C5E9435686978F4b87996B4Eb461c34603';

  const router = await ethers.getContractAt('ClawRouter', routerAddress);
  const nfa = await ethers.getContractAt('ClawNFA', nfaAddress);

  const totalSupply = (await nfa.getTotalSupply()).toNumber();
  console.log(`Total minted: ${totalSupply}`);

  let newAssignments = 0;

  for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
    if (assignments[String(tokenId)]) {
      console.log(`  #${tokenId} — already assigned to image ${assignments[String(tokenId)]}`);
      continue;
    }

    const state = await router.getLobsterState(tokenId);
    const rarity = state.rarity;

    const pool = availablePools[rarity];
    if (!pool || pool.length === 0) {
      console.error(`  #${tokenId} — ❌ No images left for rarity ${rarity}!`);
      continue;
    }

    const imageNum = pool.pop()!;
    assignments[String(tokenId)] = imageNum;
    newAssignments++;

    const rarityNames = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    console.log(`  #${tokenId} (${rarityNames[rarity]}) → image ${imageNum}`);

    // Save after each (resume-safe)
    fs.writeFileSync(outputFile, JSON.stringify(assignments, null, 2));
  }

  console.log(`\nDone! ${newAssignments} new assignments. Total: ${Object.keys(assignments).length}`);
  console.log(`Saved to: ${outputFile}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Generate images: python imgclaw/gen_images.py`);
  console.log(`  2. Upload to IPFS: PINATA_JWT=xxx npx ts-node scripts/upload-ipfs.ts ./imgclaw/claw_nft_images/`);
  console.log(`  3. Set tokenURIs: npx hardhat run scripts/set-token-uris.ts --network bscTestnet`);
  console.log(`     (set-token-uris.ts will use token-image-map.json to map tokenId → correct image CID)`);
}

main().catch(console.error);
