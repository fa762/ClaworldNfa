/**
 * Batch set vaultURI on-chain using token→image mapping
 *
 * Reads:
 *   scripts/output/token-image-map.json  — { "1": 42, "2": 15 } (tokenId → imageNumber)
 *   scripts/output/ipfs-cids.json        — { "42": "Qm...", "15": "Qm..." } (imageNumber → CID)
 *
 * Usage:
 *   npx hardhat run scripts/set-token-uris.ts --network bscTestnet
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const mapFile = path.join(__dirname, 'output', 'token-image-map.json');
  const cidsFile = path.join(__dirname, 'output', 'ipfs-cids.json');

  if (!fs.existsSync(mapFile)) {
    console.error('No token-image-map.json. Run assign-images.ts first.');
    process.exit(1);
  }
  if (!fs.existsSync(cidsFile)) {
    console.error('No ipfs-cids.json. Run upload-ipfs.ts first.');
    process.exit(1);
  }

  const tokenMap: Record<string, number> = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const cids: Record<string, string> = JSON.parse(fs.readFileSync(cidsFile, 'utf8'));

  console.log(`Token mappings: ${Object.keys(tokenMap).length}`);
  console.log(`IPFS CIDs: ${Object.keys(cids).length}`);

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const nfaAddress = process.env.NFA_ADDRESS || '0x1c69be3401a78CFeDC2B2543E62877874f10B135';
  const nfa = await ethers.getContractAt('ClawNFA', nfaAddress);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const [tokenIdStr, imageNum] of Object.entries(tokenMap)) {
    const tokenId = parseInt(tokenIdStr);
    const cid = cids[String(imageNum)];

    if (!cid) {
      console.log(`  #${tokenId} → image ${imageNum} — ⏳ CID not yet uploaded`);
      missing++;
      continue;
    }

    try {
      const meta = await nfa.getAgentMetadata(tokenId);
      const newURI = `ipfs://${cid}`;

      if (meta.vaultURI === newURI) {
        console.log(`  #${tokenId} → image ${imageNum} — already set`);
        skipped++;
        continue;
      }

      const vaultHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));
      const tx = await nfa.setVaultURI(tokenId, newURI, vaultHash);
      await tx.wait();
      console.log(`  #${tokenId} → image ${imageNum} — ✅ ${newURI}`);
      updated++;
    } catch (e: any) {
      console.error(`  #${tokenId} — ❌ ${e.message}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Missing CID: ${missing}`);
}

main().catch(console.error);
