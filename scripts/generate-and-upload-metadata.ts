/**
 * Generate JSON metadata for each token and upload to Pinata IPFS.
 *
 * Flow:
 *   1. Read token-names.json, token-image-map.json, ipfs-cids.json
 *   2. For each tokenId, build OpenSea-compatible metadata JSON
 *   3. Upload to Pinata, save metadata CIDs to scripts/output/metadata-cids.json
 *   4. (Optional) set tokenURIs on-chain via --set-uris flag
 *
 * Usage:
 *   npx ts-node scripts/generate-and-upload-metadata.ts
 *   npx ts-node scripts/generate-and-upload-metadata.ts --set-uris
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';

// ─── Config ──────────────────────────────────────────────────────────────────

const PINATA_JWT = process.env.PINATA_JWT || '';
const NFA_CONTRACT = '0xAa2094798B5892191124eae9D77E337544FFAE48';
const TOTAL_TOKENS = 888;

// Rarity descriptions
const RARITY_DESC: Record<string, string> = {
  Legendary:  'One of the 8 legendary founders of the Claw Civilization.',
  Epic:       'An elite operative of the post-war BNB wasteland.',
  Rare:       'A veteran survivor with exceptional traits.',
  Uncommon:   'A skilled resident of the underground shelters.',
  Common:     'A resilient citizen of the Claw Civilization.',
};

// Shelter descriptions (based on imageId ranges or name prefix)
const SHELTER_LABELS = ['SHELTER-01', 'SHELTER-02', 'SHELTER-03', 'SHELTER-04', 'SHELTER-05', 'SHELTER-06'];

function getShelter(tokenId: number): string {
  return SHELTER_LABELS[(tokenId - 1) % 6];
}

// ─── Load data ────────────────────────────────────────────────────────────────

const OUT = path.join(__dirname, 'output');
const tokenNames: Record<string, { name: string; rarity: string; imageId: number }> =
  JSON.parse(fs.readFileSync(path.join(OUT, 'token-names.json'), 'utf8'));
const imageCids: Record<string, string> =
  JSON.parse(fs.readFileSync(path.join(OUT, 'ipfs-cids.json'), 'utf8'));
const tokenImageMap: Record<string, number> =
  JSON.parse(fs.readFileSync(path.join(OUT, 'token-image-map.json'), 'utf8'));

// ─── Build metadata JSON ──────────────────────────────────────────────────────

function buildMetadata(tokenId: number) {
  const entry = tokenNames[String(tokenId)];
  const imageNum = tokenImageMap[String(tokenId)];
  const imageCid = imageCids[String(imageNum)];

  if (!entry || !imageCid) {
    throw new Error(`Missing data for tokenId ${tokenId}`);
  }

  const { name, rarity } = entry;
  const shelter = getShelter(tokenId);

  return {
    name,
    description: `${name} is a ${rarity} NFA from ${shelter}. ${RARITY_DESC[rarity] || ''} Part of the Claw Civilization Universe on BNB Chain — an AI NFT game powered by OpenClaw.`,
    image: `ipfs://${imageCid}`,
    external_url: `https://clawnfaterminal.xyz/nfa/${tokenId}`,
    attributes: [
      { trait_type: 'Rarity',   value: rarity },
      { trait_type: 'Shelter',  value: shelter },
      { trait_type: 'Token ID', value: tokenId, display_type: 'number' },
    ],
  };
}

// ─── Pinata upload ────────────────────────────────────────────────────────────

async function uploadJson(tokenId: number, metadata: object): Promise<string> {
  const form = new FormData();
  const blob = Buffer.from(JSON.stringify(metadata, null, 2));
  form.append('file', blob, { filename: `${tokenId}.json`, contentType: 'application/json' });
  form.append('pinataMetadata', JSON.stringify({ name: `claw-nfa-${tokenId}.json` }));
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
    maxBodyLength: Infinity,
    headers: { ...form.getHeaders(), Authorization: `Bearer ${PINATA_JWT}` },
  });
  return res.data.IpfsHash;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!PINATA_JWT) {
    console.error('❌ Set PINATA_JWT env var');
    process.exit(1);
  }

  const cidFile = path.join(OUT, 'metadata-cids.json');
  const existing: Record<string, string> = fs.existsSync(cidFile)
    ? JSON.parse(fs.readFileSync(cidFile, 'utf8'))
    : {};

  const setUris = process.argv.includes('--set-uris');
  let uploaded = 0;
  let skipped = 0;

  for (let id = 1; id <= TOTAL_TOKENS; id++) {
    if (existing[String(id)]) {
      skipped++;
      continue;
    }

    try {
      const meta = buildMetadata(id);
      const cid = await uploadJson(id, meta);
      existing[String(id)] = cid;
      uploaded++;
      console.log(`✅ #${id} ${meta.name} → ipfs://${cid}`);

      // Save progress every 10 uploads
      if (uploaded % 10 === 0) {
        fs.writeFileSync(cidFile, JSON.stringify(existing, null, 2));
      }
    } catch (e: any) {
      console.error(`❌ #${id} failed: ${e.message}`);
    }

    // Rate limit: 3 uploads/sec
    await new Promise(r => setTimeout(r, 350));
  }

  fs.writeFileSync(cidFile, JSON.stringify(existing, null, 2));
  console.log(`\n🎉 Done. Uploaded: ${uploaded}, Skipped: ${skipped}`);
  console.log(`Metadata CIDs saved to scripts/output/metadata-cids.json`);

  if (setUris) {
    console.log('\n📝 Setting tokenURIs on-chain...');
    await setTokenUris(existing);
  } else {
    console.log('\n💡 Run with --set-uris to update tokenURIs on-chain.');
  }
}

// ─── On-chain tokenURI update ─────────────────────────────────────────────────

async function setTokenUris(cids: Record<string, string>) {
  const { ethers } = await import('ethers');
  const RPC = process.env.BSC_RPC || 'https://bsc-dataseed1.bnbchain.org';
  const PK  = process.env.DEPLOYER_PK || '';
  if (!PK) { console.error('❌ Set DEPLOYER_PK env var'); return; }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(PK, provider);

  const abi = [
    'function adminSetVaultURI(uint256 tokenId, string memory uri, bytes32 hash) external',
  ];
  const nfa = new ethers.Contract(NFA_CONTRACT, abi, wallet);

  for (const [tokenId, cid] of Object.entries(cids)) {
    const uri = `ipfs://${cid}`;
    try {
      const tx = await nfa.adminSetVaultURI(Number(tokenId), uri, ethers.constants.HashZero, {
        gasLimit: 200000,
      });
      await tx.wait();
      console.log(`✅ tokenId #${tokenId} → ${uri}`);
    } catch (e: any) {
      console.error(`❌ #${tokenId}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
