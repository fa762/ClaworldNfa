/**
 * Batch upload NFT images to IPFS via Pinata
 *
 * Usage:
 *   PINATA_JWT=<your-jwt> npx ts-node scripts/upload-ipfs.ts ./images/
 *
 * Expects:
 *   ./images/1.png, ./images/2.png, ... ./images/888.png
 *
 * Output:
 *   ./scripts/output/ipfs-cids.json — { "1": "Qm...", "2": "Qm...", ... }
 */

import * as fs from 'fs';
import * as path from 'path';

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  console.error('Set PINATA_JWT env variable. Get one at https://app.pinata.cloud/');
  process.exit(1);
}

const imageDir = process.argv[2];
if (!imageDir || !fs.existsSync(imageDir)) {
  console.error('Usage: PINATA_JWT=xxx npx ts-node scripts/upload-ipfs.ts ./images/');
  process.exit(1);
}

const outputFile = path.join(__dirname, 'output', 'ipfs-cids.json');

async function uploadFile(filePath: string, name: string): Promise<string> {
  const FormData = (await import('form-data')).default;
  const fetch = (await import('node-fetch')).default;

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('pinataMetadata', JSON.stringify({ name }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form as any,
  });

  if (!res.ok) throw new Error(`Pinata error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.IpfsHash;
}

async function main() {
  // Load existing progress
  let cids: Record<string, string> = {};
  if (fs.existsSync(outputFile)) {
    cids = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    console.log(`Resuming — ${Object.keys(cids).length} already uploaded`);
  }

  // Find all image files
  const files = fs.readdirSync(imageDir)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a);
      const nb = parseInt(b);
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
    });

  console.log(`Found ${files.length} images in ${imageDir}`);

  for (const file of files) {
    const id = path.parse(file).name; // "1", "2", etc.
    if (cids[id]) {
      console.log(`  #${id} — already uploaded (${cids[id]})`);
      continue;
    }

    try {
      const cid = await uploadFile(path.join(imageDir, file), `claw-nfa-${id}`);
      cids[id] = cid;
      console.log(`  #${id} — ${cid}`);

      // Save after each upload (resume-safe)
      fs.writeFileSync(outputFile, JSON.stringify(cids, null, 2));
    } catch (e: any) {
      console.error(`  #${id} — FAILED: ${e.message}`);
      // Continue with next file
    }

    // Rate limit: 100ms between uploads
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! ${Object.keys(cids).length} CIDs saved to ${outputFile}`);
}

main();
