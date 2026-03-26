#!/usr/bin/env node
// Claw World — submit task on-chain
// Usage: node claw-task.js <PIN> <NFA_ID> <TASK_TYPE> <XP> <CLW> <MATCH_SCORE>
// TASK_TYPE: 0=courage, 1=wisdom, 2=social, 3=create, 4=grit
// CLW: in whole units (e.g. 50 = 50 CLW)
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const home = require('os').homedir();

const [,, pin, nfaId, taskType, xp, clw, score] = process.argv;
if (!pin || !nfaId || !taskType || !xp || !clw || !score) {
  console.error('Usage: node claw-task.js <PIN> <NFA_ID> <TASK_TYPE> <XP> <CLW> <MATCH_SCORE>');
  process.exit(1);
}

let NET = 'testnet';
try { NET = fs.readFileSync(home + '/.openclaw/claw-world/network.conf', 'utf8').trim(); } catch {}

const RPC = NET === 'mainnet' ? 'https://bsc-rpc.publicnode.com' : 'https://bsc-testnet-rpc.publicnode.com';
const TASK_CA = NET === 'mainnet' ? '' : '0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E';

// Decrypt wallet
const data = JSON.parse(fs.readFileSync(home + '/.openclaw/claw-world/wallet.json', 'utf8'));
const key = crypto.scryptSync(pin, 'claw-world-salt', 32);
const iv = Buffer.from(data.iv, 'hex');
const dc = crypto.createDecipheriv('aes-256-cbc', key, iv);
let pk = dc.update(data.encrypted, 'hex', 'utf8');
pk += dc.final('utf8');

const ROUTER_CA = NET === 'mainnet' ? '' : '0xA7Ee12C5E9435686978F4b87996B4Eb461c34603';

const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(pk, provider);
const task = new ethers.Contract(TASK_CA, [
  'function ownerCompleteTypedTask(uint256,uint8,uint32,uint256,uint16)'
], wallet);
const router = new ethers.Contract(ROUTER_CA, [
  'function processUpkeep(uint256)'
], wallet);

(async () => {
  // Step 1: Process upkeep first (deduct daily CLW costs)
  try {
    const upkeepTx = await router.processUpkeep(nfaId, { gasLimit: 200000 });
    await upkeepTx.wait();
    console.log('UPKEEP_PROCESSED');
  } catch (e) {
    // Upkeep may fail if < 1 day elapsed, that's OK
    if (!e.message.includes('revert')) console.log('UPKEEP_SKIPPED: ' + e.message);
  }

  // Step 2: Submit task
  console.log('SUBMITTING task: NFA #' + nfaId + ', type=' + taskType + ', xp=' + xp + ', clw=' + clw + ', score=' + score);
  const tx = await task.ownerCompleteTypedTask(
    nfaId, taskType, xp,
    ethers.utils.parseEther(clw),
    score,
    { gasLimit: 300000 }
  );
  console.log('TX_SENT: ' + tx.hash);
  const r = await tx.wait();
  console.log('TX_CONFIRMED: block=' + r.blockNumber + ' gas=' + r.gasUsed.toString());
})().catch(e => {
  console.error('TX_FAILED: ' + e.message);
  process.exit(1);
});
