/**
 * Batch set vaultURI on-chain for minted NFAs
 *
 * Usage:
 *   npx hardhat run scripts/set-token-uris.ts --network bscTestnet
 *
 * Reads:
 *   ./scripts/output/ipfs-cids.json — { "1": "Qm...", "2": "Qm...", ... }
 *
 * Sets:
 *   ClawNFA.setAgentMetadataByOwner(tokenId, { ..., vaultURI: "ipfs://Qm...", vaultHash: keccak256(cid) })
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const IPFS_GATEWAY = 'ipfs://';

async function main() {
  const cidsFile = path.join(__dirname, 'output', 'ipfs-cids.json');
  if (!fs.existsSync(cidsFile)) {
    console.error('No ipfs-cids.json found. Run upload-ipfs.ts first.');
    process.exit(1);
  }

  const cids: Record<string, string> = JSON.parse(fs.readFileSync(cidsFile, 'utf8'));
  console.log(`Loaded ${Object.keys(cids).length} CIDs`);

  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  // Get ClawNFA contract
  const nfaAddress = process.env.NFA_ADDRESS || '0x1c69be3401a78CFeDC2B2543E62877874f10B135';
  const nfa = await ethers.getContractAt('ClawNFA', nfaAddress);

  const totalSupply = await nfa.getTotalSupply();
  console.log(`Total minted: ${totalSupply}`);

  let updated = 0;
  let skipped = 0;

  for (const [idStr, cid] of Object.entries(cids)) {
    const tokenId = parseInt(idStr);
    if (isNaN(tokenId) || tokenId < 1 || tokenId > totalSupply.toNumber()) {
      console.log(`  #${idStr} — skipped (not minted yet)`);
      skipped++;
      continue;
    }

    try {
      // Check current URI
      const meta = await nfa.getAgentMetadata(tokenId);
      const currentURI = meta.vaultURI || '';
      const newURI = `${IPFS_GATEWAY}${cid}`;

      if (currentURI === newURI) {
        console.log(`  #${tokenId} — already set`);
        skipped++;
        continue;
      }

      const vaultHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));

      const tx = await nfa.setAgentMetadataByOwner(tokenId, {
        persona: meta.persona || '',
        experience: meta.experience || '',
        voiceHash: meta.voiceHash || '',
        animationURI: meta.animationURI || '',
        vaultURI: newURI,
        vaultHash: vaultHash,
      });
      await tx.wait();
      console.log(`  #${tokenId} — ✅ ${newURI}`);
      updated++;
    } catch (e: any) {
      console.error(`  #${tokenId} — ❌ ${e.message}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
