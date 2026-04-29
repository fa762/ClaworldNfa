import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8787);
const MODEL_BASE_URL = String(process.env.CLAWORLD_CHAT_MODEL_BASE_URL || process.env.AUTONOMY_MODEL_BASE_URL || '').replace(/\/+$/, '');
const MODEL_API_KEY = String(process.env.CLAWORLD_CHAT_MODEL_API_KEY || process.env.AUTONOMY_MODEL_API_KEY || '');
const MODEL_NAME = String(process.env.CLAWORLD_CHAT_MODEL_NAME || process.env.AUTONOMY_MODEL_NAME || 'gpt-5.5');
const API_TOKEN = String(process.env.CLAWORLD_API_TOKEN || '');
const WEB_TOOLS = !/^(0|false|no)$/i.test(String(process.env.CLAWORLD_ENABLE_WEB_TOOLS || '1'));
const RPC_URL = String(process.env.BSC_RPC_URL || process.env.AUTONOMY_RPC_URL || 'https://bsc-rpc.publicnode.com');
const ROUTER = normalizeAddress(process.env.CLAWORLD_ROUTER_ADDRESS || process.env.AUTONOMY_ROUTER_ADDRESS || '');
const TASK = normalizeAddress(process.env.CLAWORLD_TASK_SKILL_ADDRESS || process.env.AUTONOMY_TASK_SKILL_ADDRESS || '');
const PK = normalizeAddress(process.env.CLAWORLD_PK_SKILL_ADDRESS || process.env.AUTONOMY_PK_SKILL_ADDRESS || '');
const BSCSCAN_API_KEY = String(process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '');
const SCAN_BLOCK_RANGE = clampInt(Number(process.env.CA_SCAN_BLOCK_RANGE || 12000), 500, 12000);
const SCAN_MAX_LOGS = clampInt(Number(process.env.CA_SCAN_MAX_LOGS || 900), 100, 3000);
const MEMORY_ROOT = String(
  process.env.CLAWORLD_CML_DIR ||
    process.env.CLAWORLD_MEMORY_DIR ||
    process.env.AUTONOMY_CML_DIR ||
    '/data/cml',
);

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESSES = new Set([
  ZERO_ADDRESS,
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000001',
]);

const COMMON_SELECTORS = new Map([
  ['0x06fdde03', 'name()'],
  ['0x95d89b41', 'symbol()'],
  ['0x313ce567', 'decimals()'],
  ['0x18160ddd', 'totalSupply()'],
  ['0x70a08231', 'balanceOf(address)'],
  ['0xdd62ed3e', 'allowance(address,address)'],
  ['0x095ea7b3', 'approve(address,uint256)'],
  ['0xa9059cbb', 'transfer(address,uint256)'],
  ['0x23b872dd', 'transferFrom(address,address,uint256)'],
  ['0x8da5cb5b', 'owner()'],
  ['0x893d20e8', 'getOwner()'],
  ['0xf2fde38b', 'transferOwnership(address)'],
  ['0x715018a6', 'renounceOwnership()'],
  ['0x8456cb59', 'pause()'],
  ['0x3f4ba83a', 'unpause()'],
  ['0x40c10f19', 'mint(address,uint256)'],
  ['0x42966c68', 'burn(uint256)'],
  ['0x79cc6790', 'burnFrom(address,uint256)'],
  ['0x5c975abb', 'paused()'],
  ['0x3659cfe6', 'upgradeTo(address)'],
  ['0x4f1ef286', 'upgradeToAndCall(address,bytes)'],
]);

function normalizeAddress(value) {
  const match = String(value || '').match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0].toLowerCase() : '';
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const text = raw.replace(/^\uFEFF/, '').trim();
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        if (error instanceof Error) error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function authed(req) {
  if (!API_TOKEN) return true;
  return String(req.headers.authorization || '') === `Bearer ${API_TOKEN}`;
}
function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMemoryText(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(target, value) {
  ensureDir(path.dirname(target));
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}

function cmlFilePath(tokenId) {
  return path.join(MEMORY_ROOT, `nfa-${tokenId}.cml`);
}

function cmlArchiveDir(tokenId) {
  return path.join(MEMORY_ROOT, 'archive', `nfa-${tokenId}`);
}

function cmlArchivePath(tokenId, iso) {
  return path.join(cmlArchiveDir(tokenId), `${iso.replace(/[:.]/g, '-')}.cml`);
}

function normalizeCmlShape(tokenId, raw) {
  const cml = raw && typeof raw === 'object' ? raw : {};
  cml.VERSION = cml.VERSION || 1;
  cml.IDENTITY = cml.IDENTITY && typeof cml.IDENTITY === 'object' ? cml.IDENTITY : {};
  cml.IDENTITY.name = normalizeMemoryText(cml.IDENTITY.name || `NFA #${tokenId}`, 80);
  cml.PREFRONTAL = cml.PREFRONTAL && typeof cml.PREFRONTAL === 'object' ? cml.PREFRONTAL : {};
  cml.PREFRONTAL.beliefs = Array.isArray(cml.PREFRONTAL.beliefs) ? cml.PREFRONTAL.beliefs : [];
  cml.BASAL = cml.BASAL && typeof cml.BASAL === 'object' ? cml.BASAL : {};
  cml.CORTEX = cml.CORTEX && typeof cml.CORTEX === 'object' ? cml.CORTEX : {};
  cml.CORTEX.vivid = Array.isArray(cml.CORTEX.vivid) ? cml.CORTEX.vivid : [];
  cml.CORTEX.sediment = Array.isArray(cml.CORTEX.sediment) ? cml.CORTEX.sediment : [];
  cml.PULSE = cml.PULSE && typeof cml.PULSE === 'object' ? cml.PULSE : {};
  return cml;
}

function readCml(tokenId) {
  const target = cmlFilePath(tokenId);
  if (!fs.existsSync(target)) return null;
  return normalizeCmlShape(tokenId, readJson(target));
}

function computeMemoryPulse(rawPulse) {
  if (!rawPulse || typeof rawPulse !== 'object') return 0;
  const valence = Number(rawPulse.valence || 0);
  const arousal = Number(rawPulse.arousal || 0);
  const longing = Number(rawPulse.longing || 0);
  const normalizedValence = (Math.max(-1, Math.min(1, valence)) + 1) / 2;
  const pulse = normalizedValence * 0.25 + Math.max(0, Math.min(1, arousal)) * 0.45 + Math.max(0, Math.min(1, longing)) * 0.3;
  return Number(Math.max(0, Math.min(1, pulse)).toFixed(2));
}

function latestMemoryEntryText(cml) {
  const vivid = Array.isArray(cml?.CORTEX?.vivid) ? cml.CORTEX.vivid : [];
  for (const entry of vivid) {
    if (typeof entry === 'string' && normalizeMemoryText(entry)) return normalizeMemoryText(entry, 160);
    if (entry && typeof entry === 'object') {
      const text = normalizeMemoryText(entry.content || entry.text || entry.summary || entry.memory || '', 160);
      if (text) return text;
    }
  }
  return '';
}

function cmlToSummary(tokenId, cml, rawText = '') {
  const raw = rawText || JSON.stringify(cml);
  const identity =
    normalizeMemoryText(cml.IDENTITY?.soul || '', 180) ||
    normalizeMemoryText(cml.IDENTITY?.voice || '', 180) ||
    normalizeMemoryText(cml.IDENTITY?.name || '', 180) ||
    latestMemoryEntryText(cml) ||
    `NFA #${tokenId}`;
  const beliefs = Array.isArray(cml.PREFRONTAL?.beliefs)
    ? cml.PREFRONTAL.beliefs.map((item) => normalizeMemoryText(item, 160)).filter(Boolean).slice(0, 6)
    : [];
  const habits = [];
  if (Array.isArray(cml.BASAL?.preferred_tasks) && cml.BASAL.preferred_tasks.length) {
    habits.push(`preferred tasks: ${cml.BASAL.preferred_tasks.slice(0, 3).join(' / ')}`);
  }
  if (cml.BASAL?.pk_tendency) habits.push(`PK tendency: ${normalizeMemoryText(cml.BASAL.pk_tendency, 80)}`);
  if (cml.BASAL?.speech_length) habits.push(`speech length: ${normalizeMemoryText(cml.BASAL.speech_length, 80)}`);
  const vividCount = Array.isArray(cml.CORTEX?.vivid) ? cml.CORTEX.vivid.length : 0;
  return {
    latestSnapshotHash: sha256Hex(raw),
    latestAnchorTxHash: cml.latestAnchorTxHash || null,
    pulse: computeMemoryPulse(cml.PULSE),
    hippocampusSize: vividCount,
    identity,
    prefrontalBeliefs: beliefs,
    basalHabits: habits,
  };
}

function getBackendMemorySummary(tokenId) {
  const target = cmlFilePath(tokenId);
  if (!fs.existsSync(target)) return null;
  const raw = fs.readFileSync(target, 'utf8');
  const cml = normalizeCmlShape(tokenId, JSON.parse(raw));
  return cmlToSummary(tokenId, cml, raw);
}

function memorySnapshotFromFile(tokenId, target, fallbackIso = null) {
  const raw = fs.readFileSync(target, 'utf8');
  const cml = normalizeCmlShape(tokenId, JSON.parse(raw));
  const summary = cmlToSummary(tokenId, cml, raw);
  const stat = fs.statSync(target);
  return {
    snapshotId: path.basename(target),
    hash: summary.latestSnapshotHash,
    consolidatedAt: cml.UPDATED_AT || fallbackIso || stat.mtime.toISOString(),
    anchorTxHash: cml.latestAnchorTxHash || null,
    greenfieldUri: cml.greenfieldUri || null,
    diffSummary: latestMemoryEntryText(cml) || summary.identity,
    hippocampusMerged: summary.hippocampusSize,
  };
}

function getBackendMemoryTimeline(tokenId, limit) {
  const snapshots = [];
  const current = cmlFilePath(tokenId);
  if (fs.existsSync(current)) snapshots.push(memorySnapshotFromFile(tokenId, current));
  const archive = cmlArchiveDir(tokenId);
  if (fs.existsSync(archive)) {
    const files = fs
      .readdirSync(archive)
      .filter((file) => file.endsWith('.cml'))
      .sort()
      .reverse()
      .slice(0, Math.max(0, limit - snapshots.length));
    for (const file of files) snapshots.push(memorySnapshotFromFile(tokenId, path.join(archive, file)));
  }
  return snapshots.slice(0, limit);
}

function maybeUpdateIdentityFromMemory(cml, content) {
  if (/name|call me|identity|voice|personality|你叫|叫你|名字|身份|性格|口癖|以后你/i.test(content)) {
    if (!normalizeMemoryText(cml.IDENTITY.soul || '')) cml.IDENTITY.soul = content;
    const beliefs = Array.isArray(cml.PREFRONTAL.beliefs) ? cml.PREFRONTAL.beliefs : [];
    cml.PREFRONTAL.beliefs = [content, ...beliefs.filter((item) => normalizeMemoryText(item) !== content)].slice(0, 12);
  }
}

function writeBackendMemory({ tokenId, content, owner = null, memoryRoot = null }) {
  const normalized = normalizeMemoryText(content, 800);
  if (!normalized) {
    const error = new Error('Memory content is required');
    error.statusCode = 400;
    throw error;
  }
  const acceptedAt = new Date().toISOString();
  const contentHash = sha256Hex(normalized);
  const current = readCml(tokenId) || normalizeCmlShape(tokenId, null);
  const entry = {
    id: `memory-${Date.now().toString(36)}`,
    source: 'terminal',
    owner,
    content: normalized,
    contentHash,
    memoryRoot: memoryRoot || null,
    createdAt: acceptedAt,
    weight: 1,
  };
  current.CORTEX.vivid = [entry, ...current.CORTEX.vivid].slice(0, 100);
  current.PULSE = {
    ...current.PULSE,
    valence: Number.isFinite(Number(current.PULSE.valence)) ? Number(current.PULSE.valence) : 0.2,
    arousal: Math.min(1, Math.max(0.2, Number(current.PULSE.arousal || 0.35))),
    longing: Math.max(0, Math.min(1, Number(current.PULSE.longing || 0))),
  };
  current.UPDATED_AT = acceptedAt;
  current.latestAnchorTxHash = current.latestAnchorTxHash || null;
  maybeUpdateIdentityFromMemory(current, normalized);

  ensureDir(cmlArchiveDir(tokenId));
  writeJsonAtomic(cmlArchivePath(tokenId, acceptedAt), current);
  writeJsonAtomic(cmlFilePath(tokenId), current);

  const raw = JSON.stringify(current, null, 2);
  const summary = cmlToSummary(tokenId, current, raw);
  const snapshot = {
    snapshotId: entry.id,
    hash: summary.latestSnapshotHash,
    consolidatedAt: acceptedAt,
    anchorTxHash: null,
    greenfieldUri: null,
    diffSummary: normalized.slice(0, 160),
    hippocampusMerged: summary.hippocampusSize,
  };
  return { ok: true, acceptedAt, contentHash, persisted: true, storage: 'backend', summary, snapshot };
}

function pickLang(body) {
  return body?.lang === 'en' || body?.language === 'en' || body?.uiLang === 'en' ? 'en' : 'zh';
}

function lowerText(value) {
  return String(value || '').trim().toLowerCase();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function cardId(prefix, tokenId = 'x') {
  return `${prefix}-${tokenId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function detail(label, value, tone) {
  return { label, value: String(value ?? '--'), tone };
}

function shortAddress(address) {
  const value = normalizeAddress(address);
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : '--';
}

function hexQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function hexArgUint(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function word(hex, index) {
  const body = String(hex || '0x').replace(/^0x/, '');
  const part = body.slice(index * 64, (index + 1) * 64) || '0';
  return BigInt(`0x${part}`);
}

function wordHex(hex, index) {
  const body = String(hex || '0x').replace(/^0x/, '');
  return `0x${(body.slice(index * 64, (index + 1) * 64) || '').padEnd(64, '0')}`;
}

function wordAddress(hex, index) {
  return normalizeAddress(`0x${wordHex(hex, index).replace(/^0x/, '').slice(24)}`);
}

function u8(hex, index) {
  return Number(word(hex, index) & 255n);
}

function u16(hex, index) {
  return Number(word(hex, index) & 65535n);
}

function u32(hex, index) {
  return Number(word(hex, index) & 4294967295n);
}

function int8(hex) {
  const value = Number(BigInt(hex) & 255n);
  return value > 127 ? value - 256 : value;
}

function formatUnits(raw, decimals = 18, precision = 2) {
  let value = BigInt(raw || 0);
  const negative = value < 0n;
  if (negative) value = -value;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}

function compactUsd(raw) {
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) return '--';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function yes(value) {
  return value === '1' || value === 1 || value === true || String(value).toLowerCase() === 'true';
}

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pct(value) {
  if (value === undefined || value === null || value === '') return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return `${n.toFixed(n >= 10 ? 0 : 2)}%`;
}

function timeout(ms) {
  return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
    signal: options.signal || timeout(options.timeoutMs || 12000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'claworldnfa-CA-Scanner/1.0',
      ...(options.headers || {}),
    },
    signal: options.signal || timeout(options.timeoutMs || 12000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: timeout(18000),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'rpc error');
  return payload.result;
}

async function ethCall(to, data) {
  return rpc('eth_call', [{ to, data }, 'latest']);
}

async function callSafe(to, data) {
  try {
    return await ethCall(to, data);
  } catch {
    return '0x';
  }
}

async function supportsInterface(address, interfaceId) {
  const encoded = interfaceId.replace(/^0x/, '').padEnd(64, '0');
  const raw = await callSafe(address, `0x01ffc9a7${encoded}`);
  return raw && raw !== '0x' && word(raw, 0) === 1n;
}

async function assetKind(address, meta, gp, pair) {
  const [erc721, erc1155] = await Promise.all([
    supportsInterface(address, '0x80ac58cd').catch(() => false),
    supportsInterface(address, '0xd9b67a26').catch(() => false),
  ]);
  if (erc721) return 'nft721';
  if (erc1155) return 'nft1155';
  if (meta.symbol || meta.totalSupply > 0n || gp || pair?.pairAddress) return 'token';
  return 'contract';
}

async function getCode(address) {
  return rpc('eth_getCode', [address, 'latest']);
}

async function getStorageAt(address, slot) {
  return rpc('eth_getStorageAt', [address, slot, 'latest']).catch(() => '0x');
}

async function latestBlockNumber() {
  return Number(BigInt(await rpc('eth_blockNumber', [])));
}

function decodeString(ret) {
  if (!ret || ret === '0x') return '';
  try {
    const offset = Number(word(ret, 0));
    if (offset === 32) {
      const length = Number(word(ret, 1));
      const hex = ret.replace(/^0x/, '').slice(128, 128 + length * 2);
      return Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '').trim();
    }
    return Buffer.from(ret.replace(/^0x/, '').slice(0, 64), 'hex').toString('utf8').replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

async function erc20Meta(address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    callSafe(address, '0x06fdde03'),
    callSafe(address, '0x95d89b41'),
    callSafe(address, '0x313ce567'),
    callSafe(address, '0x18160ddd'),
  ]);
  const dec = decimals && decimals !== '0x' ? Number(word(decimals, 0)) : 18;
  return {
    name: decodeString(name),
    symbol: decodeString(symbol),
    decimals: Number.isFinite(dec) ? dec : 18,
    totalSupply: totalSupply && totalSupply !== '0x' ? word(totalSupply, 0) : 0n,
  };
}

async function getOwner(address) {
  const owner = wordAddress(await callSafe(address, '0x8da5cb5b'), 0);
  if (owner && owner !== ZERO_ADDRESS) return owner;
  const getOwner = wordAddress(await callSafe(address, '0x893d20e8'), 0);
  return getOwner && getOwner !== ZERO_ADDRESS ? getOwner : '';
}

async function goplus(address) {
  try {
    const payload = await fetchJson(`https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${address}`, { timeoutMs: 14000 });
    return payload?.result?.[address.toLowerCase()] || null;
  } catch {
    return null;
  }
}

async function dexscreener(address) {
  try {
    const payload = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { timeoutMs: 14000 });
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    return pairs.sort((a, b) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0))[0] || null;
  } catch {
    return null;
  }
}

async function geckoTerminalToken(address) {
  try {
    const payload = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${address}`, { timeoutMs: 14000 });
    const attr = payload?.data?.attributes || null;
    const pools = Array.isArray(payload?.data?.relationships?.top_pools?.data)
      ? payload.data.relationships.top_pools.data
      : [];
    if (!attr && !pools.length) return null;
    return {
      attributes: attr,
      priceUsd: Number(attr?.price_usd || 0),
      fdvUsd: Number(attr?.fdv_usd || 0),
      reserveUsd: Number(attr?.total_reserve_in_usd || 0),
      volume24hUsd: Number(attr?.volume_usd?.h24 || 0),
      topPools: pools.map((item) => normalizeAddress(String(item?.id || '').split('_').pop())).filter(Boolean),
      raw: payload,
    };
  } catch {
    return null;
  }
}

async function geckoTerminalPool(poolAddress) {
  const pool = normalizeAddress(poolAddress);
  if (!pool) return null;
  try {
    const payload = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/bsc/pools/${pool}`, { timeoutMs: 14000 });
    const attr = payload?.data?.attributes || null;
    if (!attr) return null;
    return {
      address: pool,
      dexId: attr?.dex_id || '',
      reserveUsd: Number(attr?.reserve_in_usd || 0),
      volume24hUsd: Number(attr?.volume_usd?.h24 || 0),
      tx24h: Number(attr?.transactions?.h24?.buys || 0) + Number(attr?.transactions?.h24?.sells || 0),
      buys24h: Number(attr?.transactions?.h24?.buys || 0),
      sells24h: Number(attr?.transactions?.h24?.sells || 0),
      priceChange24h: Number(attr?.price_change_percentage?.h24 || 0),
      raw: payload,
    };
  } catch {
    return null;
  }
}

async function defillamaPrice(address) {
  const token = normalizeAddress(address);
  if (!token) return null;
  try {
    const payload = await fetchJson(`https://coins.llama.fi/prices/current/bsc:${token}`, { timeoutMs: 12000 });
    return payload?.coins?.[`bsc:${token}`] || null;
  } catch {
    return null;
  }
}

async function honeypotScan(address, pairAddress = '') {
  const token = normalizeAddress(address);
  if (!token) return null;
  const pair = normalizeAddress(pairAddress);
  const url = new URL('https://api.honeypot.is/v2/IsHoneypot');
  url.searchParams.set('address', token);
  url.searchParams.set('chainID', '56');
  if (pair) url.searchParams.set('pair', pair);
  try {
    const payload = await fetchJson(url.toString(), { timeoutMs: 16000 });
    return payload || null;
  } catch {
    return null;
  }
}

function flapNumber(html, key) {
  const escaped = new RegExp(`\\\\"${key}\\\\":\\\\"([^\\\\"]*)\\\\"`).exec(html);
  const plain = escaped || new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(html);
  if (!plain?.[1]) return null;
  const numeric = Number(plain?.[1] || '');
  return Number.isFinite(numeric) ? numeric : null;
}

function flapString(html, key) {
  const escaped = new RegExp(`\\\\"${key}\\\\":\\\\"([^\\\\"]*)\\\\"`).exec(html);
  const plain = escaped || new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`).exec(html);
  if (!plain?.[1]) return '';
  return plain[1]
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .trim();
}

function flapBool(html, key) {
  const escaped = new RegExp(`\\\\"${key}\\\\":(true|false)`).exec(html);
  const plain = escaped || new RegExp(`"${key}"\\s*:\\s*(true|false)`).exec(html);
  return plain?.[1] === 'true' ? true : plain?.[1] === 'false' ? false : null;
}

function flapAddress(html, key) {
  return normalizeAddress(flapString(html, key));
}

function flapLinkItems(html) {
  const raw = [
    { type: 'website', url: flapString(html, 'website') },
    { type: 'twitter', url: flapString(html, 'twitter') },
    { type: 'telegram', url: flapString(html, 'telegram') },
  ];
  return raw.filter((item) => /^https?:\/\//i.test(item.url));
}

async function flapPageData(address) {
  const token = normalizeAddress(address);
  if (!token) return null;
  try {
    const url = `https://flap.sh/bnb/${token}`;
    const html = await fetchText(url, { timeoutMs: 18000 });
    if (!html.toLowerCase().includes(token)) return null;
    const buyTax = flapNumber(html, 'buyTax');
    const sellTax = flapNumber(html, 'sellTax');
    const reserveBnb = flapNumber(html, 'reserve');
    const marketCapBnb = flapNumber(html, 'marketcap');
    const supply = flapNumber(html, 'supply');
    const dexThreshSupply = flapNumber(html, 'dexThreshSupply');
    const progress = supply && dexThreshSupply ? Math.min(100, Math.max(0, (supply / dexThreshSupply) * 100)) : null;
    const boughtCount = (html.match(/bought [0-9.]+ BNB/g) || []).length;
    const soldCount = (html.match(/sold [0-9.]+ BNB/g) || []).length;
    const links = flapLinkItems(html);
    const pool = flapAddress(html, 'pool');
    return {
      platform: 'flap',
      url,
      token,
      creator: flapAddress(html, 'creator'),
      description: flapString(html, 'description'),
      website: links.find((item) => item.type === 'website')?.url || '',
      twitter: links.find((item) => item.type === 'twitter')?.url || '',
      telegram: links.find((item) => item.type === 'telegram')?.url || '',
      links,
      buyTax: buyTax === null ? null : buyTax * 100,
      sellTax: sellTax === null ? null : sellTax * 100,
      reserveBnb,
      marketCapBnb,
      supply,
      dexThreshSupply,
      progress,
      listed: flapBool(html, 'listed'),
      merged: flapBool(html, 'merged'),
      pool,
      messagesCount: flapNumber(html, 'messagesCount'),
      bondingCurvePct: /Bonding curve[\s\S]{0,600}>100</i.test(html) ? 100 : null,
      recentBuys: boughtCount,
      recentSells: soldCount,
    };
  } catch {
    return null;
  }
}

async function bscscan(action, params = {}) {
  if (!BSCSCAN_API_KEY) return null;
  const query = new URLSearchParams({
    chainid: '56',
    module: params.module || 'contract',
    action,
    apikey: BSCSCAN_API_KEY,
  });
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'module' && value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  try {
    const payload = await fetchJson(`https://api.etherscan.io/v2/api?${query.toString()}`, { timeoutMs: 16000 });
    return payload?.result || null;
  } catch {
    return null;
  }
}

async function explorerActivity(address) {
  if (!BSCSCAN_API_KEY) {
    return { enabled: false, normal: [], internal: [], selectors: [], counterparties: [] };
  }
  const [normalRaw, internalRaw] = await Promise.all([
    bscscan('txlist', {
      module: 'account',
      address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 50,
      sort: 'desc',
    }).catch(() => null),
    bscscan('txlistinternal', {
      module: 'account',
      address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 50,
      sort: 'desc',
    }).catch(() => null),
  ]);
  const normal = Array.isArray(normalRaw) ? normalRaw : [];
  const internal = Array.isArray(internalRaw) ? internalRaw : [];
  const selectorCounts = new Map();
  const counterpartyCounts = new Map();
  let bnbIn = 0n;
  let bnbOut = 0n;

  for (const tx of normal) {
    const input = String(tx.input || '').toLowerCase();
    if (input && input !== '0x' && input.length >= 10) {
      const selector = input.slice(0, 10);
      selectorCounts.set(selector, (selectorCounts.get(selector) || 0) + 1);
    }
    const from = normalizeAddress(tx.from);
    const to = normalizeAddress(tx.to);
    const value = BigInt(tx.value || '0');
    const other = from === address ? to : from;
    if (other) counterpartyCounts.set(other, (counterpartyCounts.get(other) || 0) + 1);
    if (to === address) bnbIn += value;
    if (from === address) bnbOut += value;
  }

  for (const tx of internal) {
    const from = normalizeAddress(tx.from);
    const to = normalizeAddress(tx.to);
    const value = BigInt(tx.value || '0');
    if (to === address) bnbIn += value;
    if (from === address) bnbOut += value;
  }

  return {
    enabled: true,
    normal,
    internal,
    bnbIn,
    bnbOut,
    selectors: [...selectorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    counterparties: [...counterpartyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

function parseBscSource(result) {
  const item = Array.isArray(result) ? result[0] : null;
  if (!item || typeof item !== 'object') return null;
  const raw = String(item.SourceCode || '');
  if (!raw.trim()) return {
    verified: false,
    name: item.ContractName || '',
    compiler: item.CompilerVersion || '',
    source: '',
    files: [],
  };

  let source = raw;
  const files = [];
  const maybeJson = raw.startsWith('{{') && raw.endsWith('}}') ? raw.slice(1, -1) : raw;
  if (maybeJson.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(maybeJson);
      const sources = parsed.sources || {};
      for (const [name, value] of Object.entries(sources)) {
        const content = typeof value === 'object' ? String(value.content || '') : '';
        if (content) {
          files.push(name);
          source += `\n\n// FILE: ${name}\n${content}`;
        }
      }
    } catch {
      // Keep raw source.
    }
  }

  return {
    verified: true,
    name: item.ContractName || '',
    compiler: item.CompilerVersion || '',
    source,
    files,
  };
}

async function sourceFromBscscan(address) {
  return parseBscSource(await bscscan('getsourcecode', { address }));
}

async function sourceFromSourcify(address) {
  const variants = ['full_match', 'partial_match'];
  for (const variant of variants) {
    const base = `https://repo.sourcify.dev/contracts/${variant}/56/${address}`;
    try {
      const metadata = await fetchJson(`${base}/metadata.json`, { timeoutMs: 12000 });
      const files = Object.keys(metadata?.sources || {});
      const chunks = [];
      for (const file of files.slice(0, 12)) {
        try {
          const response = await fetch(`${base}/sources/${encodeURIComponent(file)}`, { signal: timeout(12000) });
          if (response.ok) chunks.push(`// FILE: ${file}\n${await response.text()}`);
        } catch {
          // Ignore individual source misses.
        }
      }
      return {
        verified: true,
        name: metadata?.settings?.compilationTarget ? Object.values(metadata.settings.compilationTarget)[0] : '',
        compiler: metadata?.compiler?.version || '',
        source: chunks.join('\n\n'),
        files,
        sourceProvider: `Sourcify ${variant}`,
      };
    } catch {
      // Try next variant.
    }
  }
  return null;
}

async function sourceInfo(address) {
  const [bsc, sourcify] = await Promise.all([
    sourceFromBscscan(address).catch(() => null),
    sourceFromSourcify(address).catch(() => null),
  ]);
  if (bsc?.verified) return { ...bsc, sourceProvider: 'BscScan' };
  if (sourcify?.verified) return sourcify;
  return bsc || { verified: false, source: '', files: [], sourceProvider: 'none' };
}

function extractSelectors(bytecode) {
  const out = new Set();
  const body = String(bytecode || '').replace(/^0x/, '');
  for (const match of body.matchAll(/63([0-9a-fA-F]{8})/g)) {
    out.add(`0x${match[1].toLowerCase()}`);
    if (out.size >= 100) break;
  }
  return [...out];
}

async function selectorNames(selectors) {
  const names = new Map();
  for (const selector of selectors) {
    if (COMMON_SELECTORS.has(selector)) names.set(selector, COMMON_SELECTORS.get(selector));
  }

  const unknown = selectors.filter((selector) => !names.has(selector)).slice(0, 18);
  if (!unknown.length) return names;

  try {
    const payload = await fetchJson(`https://api.openchain.xyz/signature-database/v1/lookup?function=${unknown.join(',')}`, { timeoutMs: 7000 });
    const result = payload?.result?.function || {};
    for (const selector of unknown) {
      const candidates = result[selector]?.map((item) => item?.name).filter(Boolean) || [];
      if (candidates[0]) names.set(selector, candidates[0]);
    }
  } catch {
    // Keep common selector map only.
  }
  return names;
}

function sourceFlags(source) {
  const text = String(source || '').toLowerCase();
  const has = (patterns) => patterns.some((pattern) => text.includes(pattern));
  return {
    taxControl: has(['settax', 'set_tax', 'setfee', 'set_fee', 'buytax', 'selltax', 'taxfee', 'liquidityfee', 'marketingfee']),
    blacklist: has(['blacklist', 'isblacklisted', 'botlist', 'bots[', 'setbot']),
    whitelist: has(['whitelist', 'excludedfromfee', 'excludefromfee', 'isexcludedfromfee', 'excludeaddress']),
    maxTx: has(['maxtx', 'maxtransaction', 'maxwallet', 'walletlimit']),
    tradingGate: has(['tradingenabled', 'opentrading', 'enabletrading', 'tradingactive', 'launch']),
    pause: has(['pausable', 'pause()', 'unpause()']),
    mint: has(['mint(', '_mint(', 'minter']),
    upgrade: has(['upgradeTo(', 'upgradeable', 'delegatecall']),
    swapBack: has(['swapback', 'swapandliquify', 'swapTokensForEth'.toLowerCase(), 'swapexacttokens']),
    onlyOwnerCount: (text.match(/onlyowner/g) || []).length,
  };
}

async function proxyInfo(address) {
  const [implementationRaw, adminRaw] = await Promise.all([
    getStorageAt(address, IMPLEMENTATION_SLOT),
    getStorageAt(address, ADMIN_SLOT),
  ]);
  const implementation = wordAddress(implementationRaw, 0);
  const admin = wordAddress(adminRaw, 0);
  return {
    isProxy: implementation && implementation !== ZERO_ADDRESS,
    implementation: implementation && implementation !== ZERO_ADDRESS ? implementation : '',
    admin: admin && admin !== ZERO_ADDRESS ? admin : '',
  };
}

function decodeTransferLog(log) {
  const from = normalizeAddress(`0x${log.topics?.[1]?.slice(-40) || ''}`);
  const to = normalizeAddress(`0x${log.topics?.[2]?.slice(-40) || ''}`);
  let value = 0n;
  try {
    value = BigInt(log.data || '0x0');
  } catch {
    value = 0n;
  }
  return { txHash: log.transactionHash, from, to, value, blockNumber: Number(BigInt(log.blockNumber || '0x0')) };
}

async function transferLogs(address, latest, range) {
  let currentRange = range;
  while (currentRange >= 500) {
    try {
      const logs = await rpc('eth_getLogs', [{
        fromBlock: hexQuantity(BigInt(Math.max(0, latest - currentRange))),
        toBlock: 'latest',
        address,
        topics: [TRANSFER_TOPIC],
      }]);
      return logs.slice(-SCAN_MAX_LOGS).map(decodeTransferLog);
    } catch {
      currentRange = Math.floor(currentRange / 2);
    }
  }
  return [];
}

function groupByTx(logs) {
  const map = new Map();
  for (const log of logs) {
    if (!map.has(log.txHash)) map.set(log.txHash, []);
    map.get(log.txHash).push(log);
  }
  return map;
}

async function classifyAddress(address, known) {
  const lower = normalizeAddress(address);
  if (!lower) return '未知地址';
  if (DEAD_ADDRESSES.has(lower)) return '销毁地址';
  if (lower === known.pair) return 'LP 池子';
  if (lower === known.token) return '代币合约自收税';
  if (lower === known.owner) return 'owner 钱包';
  if (known.flap?.has(lower)) return 'Flap / Four 相关地址';
  const code = await getCode(lower).catch(() => '0x');
  return code && code !== '0x' ? '合约 / 金库' : '个人钱包';
}

async function taxFlow(address, pairAddress, ownerAddress, decimals) {
  const latest = await latestBlockNumber().catch(() => 0);
  if (!latest) return { logs: [], suspects: [], sampleTxs: 0, range: 0 };

  const logs = await transferLogs(address, latest, SCAN_BLOCK_RANGE);
  const pair = normalizeAddress(pairAddress);
  const token = normalizeAddress(address);
  const owner = normalizeAddress(ownerAddress);
  const groups = groupByTx(logs);
  const stats = new Map();
  let sampleTxs = 0;

  for (const txLogs of groups.values()) {
    if (!pair) continue;
    const pairInvolved = txLogs.some((log) => log.from === pair || log.to === pair);
    if (!pairInvolved) continue;
    sampleTxs += 1;
    const recipients = txLogs.filter((log) => log.to && log.to !== pair);
    for (const log of recipients) {
      if (DEAD_ADDRESSES.has(log.to)) continue;
      const current = stats.get(log.to) || { address: log.to, count: 0, total: 0n };
      current.count += 1;
      current.total += log.value;
      stats.set(log.to, current);
    }
  }

  const flap = new Set([
    normalizeAddress(process.env.NEXT_PUBLIC_FLAP_PORTAL_ADDRESS || process.env.AUTONOMY_FLAP_PORTAL_ADDRESS || ''),
    normalizeAddress(process.env.CLAWORLD_FLAP_PORTAL_ADDRESS || ''),
  ].filter(Boolean));

  const raw = [...stats.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || Number(b.total - a.total))
    .slice(0, 8);

  const suspects = [];
  for (const item of raw) {
    suspects.push({
      ...item,
      label: await classifyAddress(item.address, { pair, token, owner, flap }),
      selfTax: item.address === token,
      totalText: formatUnits(item.total, decimals, 2),
    });
  }
  return { logs, suspects, sampleTxs, range: SCAN_BLOCK_RANGE };
}

function riskFromSignals({ gp, pair, gecko, geckoPool, honeypot, source, proxy, owner, flow, flap }) {
  const flags = sourceFlags(source?.source || '');
  let score = 100;
  const risks = [];
  const positives = [];
  const hasExternalPool = Boolean(pair?.pairAddress || gecko?.topPools?.length || geckoPool?.address);
  const activeFlap = Boolean(flap && !hasExternalPool && !flap.pool && flap.listed !== true);
  const hpBuyTax = firstFinite(honeypot?.simulationResult?.buyTax, honeypot?.buyTax);
  const hpSellTax = firstFinite(honeypot?.simulationResult?.sellTax, honeypot?.sellTax);
  const buyTax = gp && gp.buy_tax !== '' ? Number(gp.buy_tax || 0) * 100 : (flap?.buyTax ?? hpBuyTax ?? null);
  const sellTax = gp && gp.sell_tax !== '' ? Number(gp.sell_tax || 0) * 100 : (flap?.sellTax ?? hpSellTax ?? null);
  const maxTax = Math.max(buyTax || 0, sellTax || 0);
  const liquidity = Number(pair?.liquidity?.usd || geckoPool?.reserveUsd || gecko?.reserveUsd || 0);

  if (source?.verified) positives.push(`源码已验证${source.sourceProvider ? `(${source.sourceProvider})` : ''}`);
  else { score -= 16; risks.push('源码未验证，进入无源码推断模式'); }

  if (proxy.isProxy) { score -= 8; risks.push('代理合约，逻辑可升级或需继续看 implementation'); }
  if (owner && owner !== ZERO_ADDRESS) risks.push(`owner 仍存在: ${shortAddress(owner)}`);
  else positives.push('未读到 owner 或 owner 已清空');

  if (gp) {
    if (yes(gp.is_honeypot)) { score -= 38; risks.push('GoPlus 标记 honeypot'); }
    if (yes(gp.is_blacklisted) || yes(gp.blacklist)) { score -= 22; risks.push('存在黑名单风险'); }
    if (yes(gp.is_mintable)) { score -= 15; risks.push('可增发'); }
    if (yes(gp.can_take_back_ownership)) { score -= 16; risks.push('owner 可取回权限'); }
    if (yes(gp.hidden_owner)) { score -= 16; risks.push('隐藏 owner'); }
    if (!yes(gp.is_open_source)) { score -= 10; risks.push('GoPlus 未确认开源'); }
  }
  if (honeypot) {
    if (honeypot?.honeypotResult?.isHoneypot === true) {
      score -= 45;
      risks.push('Honeypot.is 模拟交易失败');
    } else {
      positives.push('Honeypot.is 模拟未标记蜜罐');
    }
    const hpRisk = String(honeypot?.summary?.risk || '').toLowerCase();
    if (hpRisk && hpRisk !== 'low') {
      score -= hpRisk === 'high' ? 18 : 8;
      risks.push(`Honeypot.is risk: ${honeypot.summary.risk}`);
    }
  }

  if (maxTax > 20) { score -= 28; risks.push('买卖税非常高'); }
  else if (maxTax > 10) { score -= 18; risks.push('买卖税偏高'); }
  else if (maxTax > 5) { score -= 8; risks.push('有明显交易税'); }
  else if (buyTax !== null || sellTax !== null) positives.push(activeFlap ? 'Flap 内盘税率已读取' : '当前公开税率不高');

  if (liquidity > 0 && liquidity < 10000) { score -= 12; risks.push('流动性很浅'); }
  else if (liquidity >= 50000) positives.push('流动性相对可用');
  if (geckoPool?.tx24h >= 80 || gecko?.volume24hUsd >= 20000) positives.push('GeckoTerminal 显示有持续成交');
  if (activeFlap && flap?.reserveBnb) positives.push(`Flap 内盘储备 ${flap.reserveBnb.toFixed(2)} BNB`);
  else if (flap) positives.push(hasExternalPool || flap.pool || flap.listed ? 'Flap 发射记录已读取，当前看外盘' : 'Flap 发射记录已读取');

  if (flags.taxControl) { score -= 10; risks.push('源码/选择器显示可调税或费用逻辑'); }
  if (flags.blacklist) { score -= 12; risks.push('源码包含黑名单/机器人控制相关逻辑'); }
  if (flags.maxTx) { score -= 8; risks.push('源码包含最大交易或最大钱包限制'); }
  if (flags.pause) { score -= 8; risks.push('源码包含暂停交易能力'); }
  if (flags.mint) { score -= 8; risks.push('源码包含 mint 相关逻辑'); }
  if (flags.onlyOwnerCount >= 8) { score -= 6; risks.push(`onlyOwner 较多(${flags.onlyOwnerCount})`); }

  const hasSelfTax = flow.suspects.some((item) => item.selfTax || String(item.label || '').includes('代币合约'));
  const eoaTax = flow.suspects.filter((item) => item.label === '个人钱包' || item.label === 'owner 钱包');
  if (eoaTax.length && !hasSelfTax) { score -= 10; risks.push('疑似税流进入个人钱包'); }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    risks: [...new Set(risks)].slice(0, 10),
    positives: [...new Set(positives)].slice(0, 8),
    flags,
    buyTax,
    sellTax,
    liquidity,
  };
}

function classifyMechanism({ meta, gp, pair, gecko, source, proxy, flow, flap, honeypot }) {
  const flags = sourceFlags(source?.source || '');
  const parts = [];
  if (proxy.isProxy || yes(gp?.is_proxy)) parts.push('代理合约');
  if (meta.symbol || meta.totalSupply > 0n) parts.push('BEP-20 代币');
  if (flap) parts.push(pair?.pairAddress || gecko?.topPools?.length || flap.pool || flap.listed ? 'Flap 发射 / 已迁移' : 'Flap 内盘');
  if ((Number(gp?.buy_tax || 0) > 0 || Number(gp?.sell_tax || 0) > 0 || flap?.buyTax > 0 || flap?.sellTax > 0 || flags.taxControl || flow.suspects.length)) parts.push('税币机制');
  if (pair?.pairAddress || gecko?.topPools?.length) parts.push('已有交易池');
  if (honeypot?.honeypotResult?.isHoneypot === true) parts.push('疑似蜜罐');
  if (flags.swapBack) parts.push('自动换币/回流');
  if (!parts.length) parts.push('普通合约');
  return parts.join(' / ');
}

function deterministicNarrative(analysis, lang) {
  const { meta, risk, mechanism, flow, source, owner, pair } = analysis;
  const symbol = meta.symbol || '这个合约';
  const topTax = flow.suspects[0];
  if (lang === 'en') {
    const riskLine = risk.score >= 75 ? 'looks watchable' : risk.score >= 50 ? 'needs caution' : 'is high-risk';
    const taxLine = topTax ? `Tax-like flow repeatedly points to ${topTax.label} ${shortAddress(topTax.address)}.` : 'No repeated tax wallet was obvious in recent transfer logs.';
    return `${symbol} ${riskLine}: ${mechanism}. ${taxLine} ${source.verified ? 'Source is available, so code-level checks were used.' : 'Source is not verified, so this is bytecode, event, and transaction-pattern inference.'}`;
  }
  const riskLine = risk.score >= 75 ? '能看，但别偷懒' : risk.score >= 50 ? '能研究，但要压风险' : '风险很重，不适合当作普通币看';
  const taxLine = topTax ? `最近交易里，疑似税流多次打到${topTax.label} ${shortAddress(topTax.address)}。` : '最近日志里没有抓到稳定重复的税收钱包。';
  const sourceLine = source.verified ? '源码能读，所以权限判断更硬一点。' : '源码没开，只能靠字节码、事件和交易路径推断。';
  return `${symbol} ${riskLine}：它的画像是 ${mechanism}。${taxLine}${sourceLine}${owner ? ` owner 还在 ${shortAddress(owner)}，这点要盯住。` : ''}${pair?.liquidity?.usd ? ` 池子大约 ${compactUsd(pair.liquidity.usd)}，深度决定你能不能跑得出来。` : ''}`;
}

async function aiNarrative(analysis, lang) {
  if (!MODEL_BASE_URL || !MODEL_API_KEY) return deterministicNarrative(analysis, lang);
  const facts = {
    address: analysis.address,
    symbol: analysis.meta.symbol,
    name: analysis.meta.name,
    mechanism: analysis.mechanism,
    score: analysis.risk.score,
    risks: analysis.risk.risks,
    positives: analysis.risk.positives,
    sourceVerified: analysis.source.verified,
    sourceProvider: analysis.source.sourceProvider,
    owner: analysis.owner,
    proxy: analysis.proxy,
    tax: { buy: analysis.risk.buyTax, sell: analysis.risk.sellTax },
    liquidityUsd: analysis.risk.liquidity,
    gecko: analysis.gecko ? { reserveUsd: analysis.gecko.reserveUsd, volume24hUsd: analysis.gecko.volume24hUsd, pools: analysis.gecko.topPools?.length || 0 } : null,
    honeypot: analysis.honeypot ? { isHoneypot: analysis.honeypot?.honeypotResult?.isHoneypot, risk: analysis.honeypot?.summary?.risk } : null,
    taxFlow: analysis.flow.suspects.map((item) => ({
      address: item.address,
      label: item.label,
      count: item.count,
      amount: item.totalText,
    })),
  };
  const system = lang === 'en'
    ? 'You are a pre-trade BSC contract scout. Write 2 short sentences: first the verdict and why, second the main uncertainty. No jokes, no slogans, no generic safety disclaimers, no "not financial advice".'
    : '你是交易前 BSC 合约侦察员。只写 2 句中文：第一句给结论和原因，第二句讲最大不确定性。不要玩梗，不要口号，不要“能看但别偷懒”，不要泛泛而谈，不要写“不是投资建议”。';
  try {
    const response = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${MODEL_API_KEY}` },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(facts) },
        ],
        temperature: 0.45,
        max_tokens: 420,
      }),
      signal: timeout(28000),
    });
    if (!response.ok) throw new Error(`model ${response.status}`);
    const payload = await response.json();
    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    return text || deterministicNarrative(analysis, lang);
  } catch {
    return deterministicNarrative(analysis, lang);
  }
}

async function analyzeContract(address, lang) {
  const code = await getCode(address);
  if (!code || code === '0x') {
    return {
      address,
      type: 'wallet',
      cards: [{
        id: cardId('wallet-scan', 'address'),
        type: 'world',
        label: lang === 'en' ? 'BSC scan' : 'BSC 扫描',
        title: lang === 'en' ? 'Wallet address' : '钱包地址',
        body: lang === 'en' ? 'This address has no contract bytecode. It is not a token contract.' : '这个地址没有合约字节码，不是代币合约。',
        details: [detail('Address', shortAddress(address)), detail(lang === 'en' ? 'Type' : '类型', lang === 'en' ? 'Wallet / EOA' : '个人钱包')],
        cta: { label: 'BscScan', href: `https://bscscan.com/address/${address}` },
      }],
    };
  }

  const [meta, gp, pair, flap, gecko, llamaPrice, sourceRaw, proxy, owner, selectors, activity] = await Promise.all([
    erc20Meta(address),
    goplus(address),
    dexscreener(address),
    flapPageData(address),
    geckoTerminalToken(address),
    defillamaPrice(address),
    sourceInfo(address),
    proxyInfo(address),
    getOwner(address),
    selectorNames(extractSelectors(code)),
    explorerActivity(address),
  ]);
  const source = sourceRaw?.verified || !yes(gp?.is_open_source)
    ? sourceRaw
    : { ...sourceRaw, verified: true, sourceProvider: 'GoPlus', source: sourceRaw?.source || '' };
  const primaryPool = normalizeAddress(pair?.pairAddress || gecko?.topPools?.[0] || flap?.pool || '');
  const [honeypot, geckoPool] = await Promise.all([
    honeypotScan(address, primaryPool),
    geckoTerminalPool(primaryPool),
  ]);
  const flow = await taxFlow(address, primaryPool, owner, meta.decimals).catch(() => ({ logs: [], suspects: [], sampleTxs: 0, range: 0 }));
  const receiverIntel = await inspectTaxReceivers(flow, { token: address, source }).catch(() => []);
  const risk = riskFromSignals({ gp, pair, gecko, geckoPool, honeypot, source, proxy, owner, flow, flap });
  const mechanism = classifyMechanism({ meta, gp, pair, gecko, source, proxy, flow, flap, honeypot });
  const kind = await assetKind(address, meta, gp, pair);
  const analysis = { address, code, kind, meta, gp, pair, flap, gecko, geckoPool, llamaPrice, honeypot, source, proxy, owner, selectors, activity, flow, receiverIntel, risk, mechanism };
  const narrative = await aiNarrative(analysis, lang);
  return { ...analysis, type: kind, cards: buildAuditCards(analysis, narrative, lang) };
}

function selectorSummary(selectors) {
  const named = [...selectors.entries()].slice(0, 14).map(([selector, name]) => `${selector} ${name}`);
  return named.length ? named.join(' / ') : '--';
}

function sourceSummary(source, flags, lang) {
  if (!source.verified) {
    return lang === 'en'
      ? 'Not verified. Analysis uses bytecode selectors, proxy slots, token events, GoPlus and DEX data.'
      : '未开源。这里走无源码路径：字节码 selector、proxy slot、Transfer 日志、GoPlus 和 DEX 数据。';
  }
  const hits = [];
  if (flags.taxControl) hits.push(lang === 'en' ? 'tax controls' : '可调税');
  if (flags.blacklist) hits.push(lang === 'en' ? 'blacklist' : '黑名单');
  if (flags.maxTx) hits.push(lang === 'en' ? 'tx/wallet limits' : '限购/限钱包');
  if (flags.tradingGate) hits.push(lang === 'en' ? 'trading gate' : '开盘开关');
  if (flags.swapBack) hits.push(lang === 'en' ? 'swapback' : '自动换币');
  if (flags.onlyOwnerCount) hits.push(`onlyOwner x${flags.onlyOwnerCount}`);
  return hits.length ? hits.join(' / ') : (lang === 'en' ? 'No common tax or blacklist pattern found in quick source scan.' : '快速源码扫描没看到常见高危税/黑名单模式。');
}

function buildAuditCardsOld(analysis, narrative, lang) {
  const { address, meta, gp, pair, source, proxy, owner, selectors, activity, flow, risk, mechanism } = analysis;
  const flags = sourceFlags(source.source || '');
  const isEn = lang === 'en';
  const tax = gp ? `${pct(Number(gp.buy_tax || 0) * 100)} / ${pct(Number(gp.sell_tax || 0) * 100)}` : '--';
  const title = `${meta.symbol || (isEn ? 'Contract' : '合约')} ${isEn ? 'chain dossier' : '链上档案'}`;

  const overview = {
    id: cardId('contract-dossier', address),
    type: 'world',
    label: isEn ? 'Contract scout' : '合约侦察',
    title,
    body: narrative,
    details: [
      detail('CA', shortAddress(address)),
      detail(isEn ? 'Mechanism' : '机制画像', mechanism),
      detail(isEn ? 'Risk score' : '风险评分', `${risk.score}/100`, risk.score >= 75 ? 'growth' : risk.score >= 50 ? 'warm' : 'alert'),
      detail(isEn ? 'Tax' : '买/卖税', tax),
      detail(isEn ? 'Liquidity' : '流动性', compactUsd(pair?.liquidity?.usd)),
      detail(isEn ? 'Source' : '源码', source.verified ? `${isEn ? 'verified' : '已验证'} ${source.sourceProvider || ''}` : (isEn ? 'not verified' : '未开源')),
      detail('Proxy', proxy.isProxy ? shortAddress(proxy.implementation) : 'no'),
      detail('Owner', owner ? shortAddress(owner) : (isEn ? 'not found' : '未读到')),
    ],
    cta: { label: pair?.url ? 'DexScreener' : 'BscScan', href: pair?.url || `https://bscscan.com/address/${address}` },
  };

  const taxFlowRows = flow.suspects.length
    ? flow.suspects.slice(0, 6).map((item) => detail(shortAddress(item.address), `${item.label} / ${item.count}x / ${item.totalText}`))
    : [detail(isEn ? 'Repeated receiver' : '重复收款方', isEn ? 'none found in sampled transfer logs' : '样本 Transfer 日志里没抓到稳定重复的钱包')];
  const flowCard = {
    id: cardId('tax-flow', address),
    type: 'world',
    label: isEn ? 'Tax flow' : '税流/资金流',
    title: isEn ? 'Where the money seems to go' : '钱往哪里走',
    body: isEn
      ? `Sampled recent Transfer logs around the main pool. This is transaction-pattern inference, not a formal audit.`
      : `采样最近 ${flow.range || SCAN_BLOCK_RANGE} 个区块的 Transfer 日志，围绕主池子推断税流。未开源时，这比只看税率更有用。`,
    details: [
      detail(isEn ? 'Sampled swap-like txs' : '样本交易', flow.sampleTxs || 0),
      detail(isEn ? 'Main pair' : '主池子', pair?.pairAddress ? shortAddress(pair.pairAddress) : '--'),
      ...taxFlowRows,
    ],
    cta: { label: 'BscScan', href: `https://bscscan.com/token/${address}` },
  };

  const sourceCard = {
    id: cardId('code-path', address),
    type: 'world',
    label: isEn ? 'Code path' : '源码/未开源推断',
    title: source.verified ? (isEn ? 'Verified source path' : '已开源路径') : (isEn ? 'No-source path' : '无源码路径'),
    body: sourceSummary(source, flags, lang),
    details: [
      detail(isEn ? 'Provider' : '来源', source.sourceProvider || 'none'),
      detail(isEn ? 'Compiler' : '编译器', source.compiler || '--'),
      detail(isEn ? 'Files' : '源码文件', source.files?.length || 0),
      detail(isEn ? 'Selectors' : '函数选择器', selectorSummary(selectors)),
      detail('Explorer tx', activity.enabled ? `${activity.normal.length} normal / ${activity.internal.length} internal` : 'API key not configured'),
      detail('Recent calls', activity.enabled && activity.selectors.length ? activity.selectors.map(([selector, count]) => `${selector} x${count}`).join(' / ') : '--'),
      detail('BNB flow', activity.enabled ? `in ${formatUnits(activity.bnbIn || 0n, 18, 4)} / out ${formatUnits(activity.bnbOut || 0n, 18, 4)}` : '--'),
      detail(isEn ? 'Key risks' : '关键风险', risk.risks.slice(0, 5).join(' / ') || (isEn ? 'none obvious' : '暂无明显高危')),
      detail(isEn ? 'Positive signals' : '正向信号', risk.positives.slice(0, 4).join(' / ') || '--'),
    ],
    cta: { label: 'BscScan Code', href: `https://bscscan.com/address/${address}#code` },
  };

  const sourceList = [
    'BNB RPC: bytecode / storage / logs',
    gp ? 'GoPlus: token security' : 'GoPlus: unavailable',
    pair ? 'DexScreener: pair / liquidity' : 'DexScreener: no pair',
    source.verified ? `${source.sourceProvider}: source` : 'Source: not verified',
    activity.enabled ? 'Etherscan v2: txlist + txlistinternal' : 'BscScan transactions require API key',
  ];
  const toolCard = {
    id: cardId('scan-tools', address),
    type: 'receipt',
    label: isEn ? 'Tool trace' : '工具轨迹',
    title: isEn ? 'What was checked' : '这次查了什么',
    body: isEn
      ? 'The card is assembled from tool results first, then narrated by the model.'
      : '先跑工具，再让模型叙事；不是模型凭空猜。',
    details: sourceList.map((item, index) => detail(`#${index + 1}`, item)),
  };

  return [overview, flowCard, sourceCard, toolCard];
}

function verdictFromScore(score, lang) {
  if (lang === 'en') {
    if (score >= 80) return { text: 'Watchable', tone: 'growth', line: 'No immediate kill switch surfaced, but this is still a pre-trade scan.' };
    if (score >= 55) return { text: 'Caution', tone: 'warm', line: 'There are enough open questions that position size matters.' };
    return { text: 'High risk', tone: 'alert', line: 'Too many red flags for a casual trade.' };
  }
  if (score >= 80) return { text: '可观察', tone: 'growth', line: '暂时没看到一眼致命点，但这不是正式审计。' };
  if (score >= 55) return { text: '谨慎', tone: 'warm', line: '能看，但疑点不少，仓位要小。' };
  return { text: '高危', tone: 'alert', line: '红旗太多，不适合当普通币碰。' };
}

function sourceLabel(source, lang) {
  if (source.verified) return lang === 'en' ? `Verified ${source.sourceProvider || ''}` : `已开源 ${source.sourceProvider || ''}`;
  return lang === 'en' ? 'Not verified' : '未开源';
}

function ownershipLabel(owner, lang) {
  if (!owner || owner === ZERO_ADDRESS) return lang === 'en' ? 'Owner not found' : '未读到 owner';
  return shortAddress(owner);
}

function selectorBrief(selectors, count = 5) {
  const named = [...selectors.entries()].slice(0, count).map(([selector, name]) => `${selector} ${name}`);
  return named.length ? named.join(' / ') : '--';
}

function toolTraceDetails({ gp, pair, gecko, honeypot, llamaPrice, source, activity }) {
  return [
    detail('RPC', 'bytecode / storage / Transfer logs'),
    detail('Security', gp ? 'GoPlus' : 'GoPlus unavailable'),
    detail('DEX', pair ? 'DexScreener pair/liquidity' : 'no pair found'),
    detail('GeckoTerminal', gecko ? 'token / pool mirror' : 'unavailable'),
    detail('Honeypot.is', honeypot ? 'simulation mirror' : 'unavailable'),
    detail('DeFiLlama', llamaPrice ? 'price mirror' : 'unavailable'),
    detail('Source', source.verified ? `${source.sourceProvider || 'verified source'}` : 'not verified'),
    detail('Explorer tx', activity.enabled ? 'txlist + txlistinternal' : '需要配置 BSCSCAN_API_KEY'),
  ];
}

function toneFromScore(score) {
  if (score >= 80) return 'growth';
  if (score >= 55) return 'warm';
  return 'alert';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreRow(label, item) {
  return detail(`${label} ${item.score}/100`, item.reason, toneFromScore(item.score));
}

function socialLabel(type, url) {
  const raw = String(type || '').toLowerCase();
  const href = String(url || '').toLowerCase();
  if (raw.includes('twitter') || raw === 'x' || href.includes('x.com') || href.includes('twitter.com')) return 'X';
  if (raw.includes('telegram') || href.includes('t.me') || href.includes('telegram')) return 'Telegram';
  if (raw.includes('discord') || href.includes('discord')) return 'Discord';
  if (raw.includes('website') || raw === 'web') return 'Website';
  return type || 'Link';
}

function pairSocials(pair, flap) {
  const info = pair?.info || {};
  const websites = Array.isArray(info.websites) ? info.websites : [];
  const socials = Array.isArray(info.socials) ? info.socials : [];
  const linksRaw = [
    ...websites.map((item) => ({ type: item?.label || 'website', url: item?.url || '' })),
    ...socials.map((item) => ({ type: item?.type || 'social', url: item?.url || '' })),
    ...((Array.isArray(flap?.links) ? flap.links : []).map((item) => ({ type: item.type, url: item.url }))),
  ].filter((item) => item.url);
  const seen = new Set();
  const links = linksRaw.filter((item) => {
    const key = String(item.url).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const websiteLinks = links.filter((item) => socialLabel(item.type, item.url) === 'Website');
  const socialLinks = links.filter((item) => socialLabel(item.type, item.url) !== 'Website');
  const labels = links.map((item) => item.type).slice(0, 4);
  return {
    websites: websiteLinks,
    socials: socialLinks,
    links,
    labels: links.map((item) => socialLabel(item.type, item.url)).slice(0, 4),
  };
}

function pctFraction(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  const pctValue = n * 100;
  return `${pctValue.toFixed(pctValue >= 10 ? 1 : 2)}%`;
}

function holderAddressType(holder) {
  const address = normalizeAddress(holder?.address || '');
  if (!address) return 'unknown';
  if (DEAD_ADDRESSES.has(address)) return 'dead';
  const tag = String(holder?.tag || '').toLowerCase();
  if (tag.includes('pancake') || tag.includes('pair') || tag.includes('lp')) return 'pair';
  if (Number(holder?.is_contract || 0) === 1) return 'contract';
  return 'wallet';
}

function chipHealth(gp, pair, lang, flap) {
  const isEn = lang === 'en';
  const holders = Array.isArray(gp?.holders) ? gp.holders : [];
  const holderCount = Number(gp?.holder_count || 0);
  const pairAddress = normalizeAddress(pair?.pairAddress || '');
  const realHolders = holders.filter((holder) => {
    const address = normalizeAddress(holder?.address || '');
    if (!address || DEAD_ADDRESSES.has(address)) return false;
    if (pairAddress && address === pairAddress) return false;
    const tag = String(holder?.tag || '').toLowerCase();
    if (tag.includes('pancake') || tag.includes('pair') || tag.includes('lp')) return false;
    return true;
  });
  const top = realHolders[0] || null;
  const topPct = Number(top?.percent || 0);
  const top10Pct = realHolders.slice(0, 10).reduce((sum, holder) => sum + Number(holder?.percent || 0), 0);
  const creatorPct = Number(gp?.creator_percent || 0);
  const contractTopCount = realHolders.slice(0, 10).filter((holder) => holderAddressType(holder) === 'contract').length;
  const lpHolders = Array.isArray(gp?.lp_holders) ? gp.lp_holders : [];
  const deadLp = lpHolders.reduce((sum, holder) => {
    const address = normalizeAddress(holder?.address || '');
    return sum + (DEAD_ADDRESSES.has(address) || Number(holder?.is_locked || 0) === 1 ? Number(holder?.percent || 0) : 0);
  }, 0);

  if (!holders.length && !pair?.pairAddress && flap?.bondingCurvePct) {
    return {
      score: 62,
      tone: 'warm',
      reason: isEn
        ? `${flap.bondingCurvePct}% sits in the Flap bonding curve; external holder API has not indexed buyers yet`
        : `${flap.bondingCurvePct}% 在 Flap bonding curve，外部 holder 接口还没索引普通买家`,
      holderCount: 0,
      topHolder: isEn ? `Bonding curve ${pct(flap.bondingCurvePct)}` : `Bonding curve ${pct(flap.bondingCurvePct)}`,
      topHolderType: 'contract',
      top10: '--',
      creator: flap.creator ? shortAddress(flap.creator) : '--',
      lpLock: isEn ? 'inner pool' : '内盘',
    };
  }

  let score = 100;
  const reasons = [];
  if (!holders.length) { score -= 22; reasons.push(isEn ? 'holder list unavailable' : '未拿到持仓列表'); }
  if (holderCount && holderCount < 50) { score -= 20; reasons.push(isEn ? 'few holders' : '持有人很少'); }
  else if (holderCount && holderCount < 200) { score -= 10; reasons.push(isEn ? 'holder base still small' : '持有人偏少'); }
  else if (holderCount) reasons.push(isEn ? `${holderCount} holders` : `${holderCount} 个持有人`);
  if (holderCount && holderCount < 2000) { score -= 6; reasons.push(isEn ? 'holder base not deep yet' : '持有人规模还不深'); }

  if (topPct > 0.15) { score -= 30; reasons.push(isEn ? 'top wallet >15%' : '最大非池钱包超过 15%'); }
  else if (topPct > 0.08) { score -= 18; reasons.push(isEn ? 'top wallet >8%' : '最大非池钱包超过 8%'); }
  else if (topPct > 0.04) { score -= 8; reasons.push(isEn ? 'top wallet >4%' : '最大非池钱包超过 4%'); }

  if (top10Pct > 0.45) { score -= 25; reasons.push(isEn ? 'top 10 too concentrated' : '前十非池地址过度集中'); }
  else if (top10Pct > 0.28) { score -= 12; reasons.push(isEn ? 'top 10 concentrated' : '前十非池地址偏集中'); }
  else if (top10Pct > 0.10) { score -= 6; reasons.push(isEn ? 'top 10 still matters' : '前十非池约一成以上'); }

  if (creatorPct > 0.05) { score -= 18; reasons.push(isEn ? 'creator keeps >5%' : '创建者持仓超过 5%'); }
  else if (creatorPct > 0.02) { score -= 8; reasons.push(isEn ? 'creator keeps >2%' : '创建者持仓超过 2%'); }

  if (contractTopCount >= 3) {
    score -= 6;
    reasons.push(isEn ? 'several top holders are contracts' : '前十里多个合约地址');
  }
  if (yes(gp?.honeypot_with_same_creator)) {
    score -= 18;
    reasons.push(isEn ? 'same creator has honeypot history' : '同创建者有蜜罐记录');
  }

  if (lpHolders.length) {
    if (deadLp >= 0.95) reasons.push(isEn ? 'LP mostly burned/locked' : 'LP 基本销毁/锁定');
    else if (deadLp >= 0.5) { score -= 8; reasons.push(isEn ? 'LP partly locked' : 'LP 部分锁定'); }
    else { score -= 22; reasons.push(isEn ? 'LP not clearly locked' : 'LP 未明显锁定'); }
  } else if (pair?.pairAddress) {
    score -= 12;
    reasons.push(isEn ? 'LP holder data missing' : '缺少 LP 持仓数据');
  }

  let finalScore = clampScore(score);
  if (holders.length) finalScore = Math.min(finalScore, 92);
  if (top10Pct > 0.10) finalScore = Math.min(finalScore, 88);
  if (topPct > 0.08) finalScore = Math.min(finalScore, 74);
  if (topPct > 0.15) finalScore = Math.min(finalScore, 58);
  return {
    score: finalScore,
    tone: toneFromScore(finalScore),
    reason: reasons.join('，') || (isEn ? 'holder distribution looks balanced' : '筹码分布暂时健康'),
    holderCount,
    topHolder: top ? `${shortAddress(top.address)} ${pctFraction(top.percent)}` : '--',
    topHolderType: top ? holderAddressType(top) : 'unknown',
    top10: pctFraction(top10Pct),
    creator: gp?.creator_address ? `${shortAddress(gp.creator_address)} ${pctFraction(creatorPct)}` : '--',
    lpLock: lpHolders.length ? pctFraction(deadLp) : '--',
  };
}
function scoreDimensions(analysis, lang) {
  const { gp, pair, flap, gecko, geckoPool, honeypot, source, proxy, owner, flow, risk, receiverIntel } = analysis;
  const flags = risk.flags || sourceFlags(source?.source || '');
  const maxTax = Math.max(risk.buyTax || 0, risk.sellTax || 0);
  const liquidity = Number(pair?.liquidity?.usd || geckoPool?.reserveUsd || gecko?.reserveUsd || 0);
  const internalReserve = Number(flap?.reserveBnb || 0);
  const hasExternalPool = Boolean(pair?.pairAddress || gecko?.topPools?.length || geckoPool?.address);
  const activeFlap = Boolean(flap && !hasExternalPool && !flap.pool && flap.listed !== true);
  const social = pairSocials(pair, flap);
  const chips = chipHealth(gp, pair, lang, flap);
  const isEn = lang === 'en';

  let tradeScore = 100;
  const tradeReasons = [];
  if (!hasExternalPool && !flap) { tradeScore -= 35; tradeReasons.push(isEn ? 'no live pair' : '没读到主池'); }
  else if (activeFlap) tradeReasons.push(isEn ? 'Flap inner market' : 'Flap 内盘');
  if (yes(gp?.is_honeypot)) { tradeScore -= 45; tradeReasons.push(isEn ? 'honeypot flag' : '疑似蜜罐'); }
  if (honeypot?.honeypotResult?.isHoneypot === true) { tradeScore -= 45; tradeReasons.push(isEn ? 'simulation failed' : '模拟交易失败'); }
  else if (honeypot) tradeReasons.push(isEn ? 'simulation passed' : '模拟交易通过');
  if (maxTax > 20) { tradeScore -= 25; tradeReasons.push(isEn ? 'very high tax' : '交易税很高'); }
  else if (maxTax > 10) { tradeScore -= 16; tradeReasons.push(isEn ? 'high tax' : '交易税偏高'); }
  else if (gp || flap) tradeReasons.push(isEn ? 'tax is readable' : '税率可读');
  if (liquidity && liquidity < 10000) { tradeScore -= 15; tradeReasons.push(isEn ? 'thin pool' : '池子很浅'); }
  if ((geckoPool?.tx24h || 0) >= 80 || (gecko?.volume24hUsd || 0) >= 20000) tradeReasons.push(isEn ? 'active tape' : '成交活跃');
  if (activeFlap && internalReserve < 1) { tradeScore -= 16; tradeReasons.push(isEn ? 'small inner reserve' : '内盘储备很小'); }

  let taxScore = gp || flap || honeypot ? 100 : 62;
  const taxReasons = [];
  if (!gp && !flap && !honeypot) taxReasons.push(isEn ? 'no tax oracle data' : '缺少税费接口数据');
  else if (activeFlap && (!gp?.buy_tax && !gp?.sell_tax)) taxReasons.push(isEn ? 'Flap inner tax read' : '读取 Flap 内盘税率');
  if (maxTax > 20) { taxScore -= 42; taxReasons.push(isEn ? 'tax >20%' : '税率超过 20%'); }
  else if (maxTax > 10) { taxScore -= 28; taxReasons.push(isEn ? 'tax >10%' : '税率超过 10%'); }
  else if (maxTax > 5) { taxScore -= 14; taxReasons.push(isEn ? 'visible tax' : '有明显税'); }
  else if (gp || flap || honeypot) taxReasons.push(isEn ? 'low tax' : '低税');
  if (flags.taxControl) { taxScore -= 12; taxReasons.push(isEn ? 'tax controls in code' : '发现调税痕迹'); }

  let liquidityScore = hasExternalPool ? 70 : (activeFlap ? 58 : 30);
  const liquidityReasons = [];
  if (liquidity >= 250000) { liquidityScore = 92; liquidityReasons.push(isEn ? 'deep pool' : '池子较深'); }
  else if (liquidity >= 50000) { liquidityScore = 82; liquidityReasons.push(isEn ? 'usable pool' : '池子可用'); }
  else if (liquidity >= 10000) { liquidityScore = 66; liquidityReasons.push(isEn ? 'medium pool' : '池子一般'); }
  else if (liquidity > 0) { liquidityScore = 42; liquidityReasons.push(isEn ? 'thin pool' : '池子偏浅'); }
  else if (activeFlap) {
    if (internalReserve >= 20) { liquidityScore = 76; liquidityReasons.push(isEn ? 'inner reserve usable' : '内盘储备可用'); }
    else if (internalReserve >= 5) { liquidityScore = 62; liquidityReasons.push(isEn ? 'inner reserve thin' : '内盘储备偏浅'); }
    else { liquidityScore = 44; liquidityReasons.push(isEn ? 'inner reserve very small' : '内盘储备很小'); }
  }
  else liquidityReasons.push(isEn ? 'no liquidity data' : '没读到流动性');
  if (geckoPool?.tx24h >= 80 && liquidityScore < 76) {
    liquidityScore += 8;
    liquidityReasons.push(isEn ? 'GeckoTerminal shows real flow' : 'GeckoTerminal 有实际成交');
  }

  let permissionScore = 100;
  const permissionReasons = [];
  if (!source?.verified) { permissionScore -= 22; permissionReasons.push(isEn ? 'source hidden' : '源码未开'); }
  else permissionReasons.push(isEn ? 'source verified' : '源码可读');
  if (owner && owner !== ZERO_ADDRESS) { permissionScore -= 16; permissionReasons.push(isEn ? `owner ${shortAddress(owner)}` : `owner 仍在 ${shortAddress(owner)}`); }
  if (proxy.isProxy) { permissionScore -= 14; permissionReasons.push(isEn ? 'upgrade proxy' : '代理可升级'); }
  if (flags.blacklist) { permissionScore -= 16; permissionReasons.push(isEn ? 'blacklist controls' : '黑名单逻辑'); }
  if (flags.mint) { permissionScore -= 12; permissionReasons.push(isEn ? 'mint path' : '增发痕迹'); }
  if (flags.pause) { permissionScore -= 10; permissionReasons.push(isEn ? 'pause path' : '暂停逻辑'); }

  const primaryReceiver = Array.isArray(receiverIntel) ? receiverIntel[0] : null;
  let flowScore = flow.sampleTxs >= 3 ? 76 : (activeFlap ? 66 : 55);
  const flowReasons = [];
  if (flow.sampleTxs < 3 && activeFlap) flowReasons.push(isEn ? 'inner-market tax visible; external swap samples absent' : '内盘税率可见，外盘样本不足');
  else if (flow.sampleTxs < 3) flowReasons.push(isEn ? 'few pool samples; tax rate only' : '池子样本少，只能先看税率');
  else if (primaryReceiver?.selfTax) {
    flowScore = primaryReceiver.sourceVerified ? 74 : 58;
    flowReasons.push(isEn ? 'tax first enters the token contract' : '税先进入代币合约');
    if (primaryReceiver.sourceVerified) flowReasons.push(isEn ? 'source readable' : '源码可读');
  }
  else if (primaryReceiver?.type === 'wallet') {
    flowScore = 38;
    flowReasons.push(isEn ? 'tax-like flow goes to wallet' : '疑似税流进入钱包');
  }
  else if (flow.suspects.length) {
    const personal = flow.suspects.some((item) => item.label === '个人钱包' || item.label === 'owner 钱包');
    if (personal) { flowScore = 44; flowReasons.push(isEn ? 'tax-like flow to wallet' : '疑似税流进个人/owner 钱包'); }
    else { flowScore = 68; flowReasons.push(isEn ? `receiver: ${flow.suspects[0].label}` : `重复收款方：${flow.suspects[0].label}`); }
  } else {
    flowScore = 82;
    flowReasons.push(isEn ? 'no repeated receiver' : '未发现重复收税钱包');
  }

  let socialScore = 40;
  const socialReasons = [];
  if (social.websites.length && social.socials.length >= 2) { socialScore = 88; socialReasons.push(isEn ? 'website + socials' : '官网和社媒齐'); }
  else if (social.websites.length && social.socials.length) { socialScore = 76; socialReasons.push(isEn ? 'website + social' : '官网和社媒都有'); }
  else if (social.websites.length || social.socials.length) { socialScore = 60; socialReasons.push(isEn ? 'one public link' : '只有单一公开链接'); }
  else socialReasons.push(isEn ? 'no public links from DEX data' : 'DEX 数据里没看到官网/社媒');

  const dimensions = {
    trade: { score: clampScore(tradeScore), reason: tradeReasons.join('，') || (isEn ? 'no hard block' : '没有硬阻塞') },
    tax: { score: clampScore(taxScore), reason: taxReasons.join('，') || (isEn ? 'tax unknown' : '税费未知') },
    liquidity: { score: clampScore(liquidityScore), reason: liquidityReasons.join('，') },
    permission: { score: clampScore(permissionScore), reason: permissionReasons.join('，') || (isEn ? 'no owner issue found' : '没看到明显权限问题') },
    flow: { score: clampScore(flowScore), reason: flowReasons.join('，') },
    social: { score: clampScore(socialScore), reason: socialReasons.join('，') },
    chips: { score: chips.score, reason: chips.reason },
  };
  let weighted = (
    dimensions.trade.score * 0.18
    + dimensions.tax.score * 0.14
    + dimensions.liquidity.score * 0.15
    + dimensions.permission.score * 0.16
    + dimensions.flow.score * 0.14
    + dimensions.social.score * 0.08
    + dimensions.chips.score * 0.15
  );
  if (honeypot?.honeypotResult?.isHoneypot === true || yes(gp?.is_honeypot)) weighted = Math.min(weighted, 40);
  if (dimensions.flow.score < 45) weighted = Math.min(weighted, 72);
  if (dimensions.chips.score < 50) weighted = Math.min(weighted, 70);
  if (dimensions.permission.score < 55) weighted = Math.min(weighted, 68);
  if (!activeFlap && dimensions.liquidity.score < 45) weighted = Math.min(weighted, 76);
  return { dimensions, social, chips, overall: clampScore(weighted) };
}

function decisionFromScores(score, dimensions, lang) {
  const isEn = lang === 'en';
  const floor = Math.min(dimensions.trade.score, dimensions.permission.score, dimensions.liquidity.score, dimensions.flow.score, dimensions.chips.score);
  if (score >= 82 && floor >= 60 && dimensions.social.score >= 40) {
    return { text: isEn ? 'Watchlist' : '可观察', action: isEn ? 'Worth watching. Still size by liquidity.' : '可以加入观察，但仓位要按池子深度来。', tone: 'growth' };
  }
  if (score >= 65 && Math.min(dimensions.trade.score, dimensions.permission.score, dimensions.liquidity.score) >= 45) {
    return { text: isEn ? 'Small test only' : '小仓试探', action: isEn ? 'Only a small test makes sense until weak spots clear.' : '只适合小仓试探，等薄弱项补齐再放大。', tone: 'warm' };
  }
  return { text: isEn ? 'Avoid for now' : '先别碰', action: isEn ? 'Too many weak signals for normal trading.' : '弱信号太多，不适合当普通标的交易。', tone: 'alert' };
}

function weakestDimension(dimensions, lang) {
  const names = lang === 'en'
    ? { trade: 'tradeability', tax: 'tax', liquidity: 'liquidity', permission: 'permissions', flow: 'money path', social: 'social proof', chips: 'holder health' }
    : { trade: '可交易性', tax: '税费', liquidity: '流动性', permission: '权限', flow: '资金流', social: '社媒', chips: '筹码健康度' };
  const entries = Object.entries(dimensions).sort((a, b) => a[1].score - b[1].score);
  const [key, item] = entries[0];
  return `${names[key]} ${item.score}/100：${item.reason}`;
}

function taxDestination(flow, lang) {
  const isEn = lang === 'en';
  if (flow.suspects.length) {
    return flow.suspects.slice(0, 2).map((item) => `${item.label} ${shortAddress(item.address)} · ${item.count}x`).join(' / ');
  }
  if (flow.sampleTxs < 3) return isEn ? 'Tax rate is visible, but recent pool samples are too thin to locate the receiver.' : '能看到税率，但最近池子样本太少，还不能定位收税地址。';
  return isEn ? 'No repeated tax receiver found.' : '没有发现稳定重复收税地址。';
}

function scanNarrative(analysis, lang) {
  const { meta, source, owner, pair, gecko, geckoPool, risk, flap } = analysis;
  const { dimensions, overall } = scoreDimensions(analysis, lang);
  const decision = decisionFromScores(overall, dimensions, lang);
  const symbol = meta.symbol || meta.name || (lang === 'en' ? 'This contract' : '这个合约');
  const taxText = risk.buyTax !== null || risk.sellTax !== null
    ? `${pct(risk.buyTax)} / ${pct(risk.sellTax)}`
    : '--';
  const hasExternalPool = Boolean(pair?.pairAddress || gecko?.topPools?.length || geckoPool?.address);
  const activeFlap = Boolean(flap && !hasExternalPool && !flap.pool && flap.listed !== true);
  const liquidity = activeFlap && flap?.reserveBnb
    ? `${flap.reserveBnb.toFixed(2)} BNB 内盘储备`
    : compactUsd(pair?.liquidity?.usd || geckoPool?.reserveUsd || gecko?.reserveUsd);
  const authority = owner
    ? (lang === 'en' ? `owner is still ${shortAddress(owner)}` : `owner 仍在 ${shortAddress(owner)}`)
    : (lang === 'en' ? 'owner was not found' : '未读到 owner');
  const sourceText = source.verified
    ? (lang === 'en' ? 'source is verified' : '源码已验证')
    : (lang === 'en' ? 'source is not verified' : '源码未开');

  if (lang === 'en') {
    if (activeFlap) {
      return `${symbol}: ${decision.text}, ${overall}/100. Flap inner market, tax ${taxText}, reserve ${liquidity}. Weakest point: ${weakestDimension(dimensions, lang)}; ${sourceText}.`;
    }
    return `${symbol}: ${decision.text}, ${overall}/100. Tax ${taxText}, liquidity ${liquidity}, ${authority}. Weakest point: ${weakestDimension(dimensions, lang)}; ${sourceText}.`;
  }
  if (activeFlap) {
    return `${symbol}：${decision.text}，综合 ${overall}/100。Flap 内盘，买/卖税 ${taxText}，储备 ${liquidity}。最弱项：${weakestDimension(dimensions, lang)}；${sourceText}。`;
  }
  return `${symbol}：${decision.text}，综合 ${overall}/100。买/卖税 ${taxText}，流动性 ${liquidity}，${authority}。最弱项：${weakestDimension(dimensions, lang)}；${sourceText}。`;
}

async function inspectTaxReceivers(flow, context = {}) {
  const suspects = Array.isArray(flow?.suspects) ? flow.suspects.slice(0, 3) : [];
  const out = [];
  for (const item of suspects) {
    const address = normalizeAddress(item.address);
    if (!address) continue;
    const isSelfTax = Boolean(item.selfTax) || address === normalizeAddress(context.token || '') || String(item.label || '').includes('代币合约');
    const code = await getCode(address).catch(() => '0x');
    const isContract = Boolean(code && code !== '0x');
    if (!isContract) {
      const selfTax = isSelfTax;
    const personal = item.label === '个人钱包' || item.label === 'owner 钱包';
      out.push({
        address,
        label: item.label,
        count: item.count,
        totalText: item.totalText,
        type: 'wallet',
        selfTax,
        sourceVerified: false,
        score: selfTax ? 58 : (personal ? 28 : 42),
        tone: selfTax ? 'warm' : 'alert',
        verdict: selfTax ? '税先进入代币合约' : (personal ? '税流进入个人/owner 钱包' : '税流进入外部钱包'),
        quality: selfTax ? '常见于 swapBack / 营销 / 加池逻辑；源码未开时无法确认后续分配。' : '不是合约，无法查看用途；如果这是收税地址，要按人为控制风险处理。',
      });
      continue;
    }

    const [source, proxy, owner, selectorMap] = await Promise.all([
      (isSelfTax && context.source ? Promise.resolve(context.source) : sourceInfo(address)).catch(() => ({ verified: false, source: '', files: [], sourceProvider: 'none' })),
      proxyInfo(address).catch(() => ({ isProxy: false, implementation: '' })),
      getOwner(address).catch(() => ''),
      selectorNames(extractSelectors(code)).catch(() => new Map()),
    ]);
    const flags = sourceFlags(source?.source || '');
    let score = 72;
    const notes = [];
    if (item.label === 'Flap / Four 相关地址') { score += 8; notes.push('平台相关地址'); }
    if (item.label === '代币合约自收税') { score -= 6; notes.push('税先进入代币合约'); }
    if (source.verified) notes.push(`源码已开${source.sourceProvider ? `(${source.sourceProvider})` : ''}`);
    else { score -= 18; notes.push('收税合约未开源'); }
    if (owner && owner !== ZERO_ADDRESS) { score -= 10; notes.push(`owner ${shortAddress(owner)}`); }
    if (proxy.isProxy) { score -= 10; notes.push('代理可升级'); }
    if (flags.blacklist) { score -= 12; notes.push('含黑名单痕迹'); }
    if (flags.mint) { score -= 8; notes.push('含 mint 痕迹'); }
    if (flags.pause) { score -= 8; notes.push('含暂停逻辑'); }
    if (flags.onlyOwnerCount >= 8) { score -= 6; notes.push(`onlyOwner ${flags.onlyOwnerCount} 处`); }
    const finalScore = clampScore(score);
    const selectorsBrief = selectorBrief(selectorMap, 5);
    out.push({
      address,
      label: item.label,
      count: item.count,
      totalText: item.totalText,
      type: 'contract',
      selfTax: isSelfTax,
      sourceVerified: Boolean(source.verified),
      score: finalScore,
      tone: toneFromScore(finalScore),
      verdict: source.verified ? '收税合约可读' : '收税合约未开源',
      quality: notes.join('，') || '未发现明显高危控制点',
      owner: owner || '',
      proxy: proxy.isProxy ? proxy.implementation : '',
      selectors: selectorsBrief,
      sourceProvider: source.sourceProvider || 'none',
    });
  }
  return out;
}

function receiverReport(receiverIntel, flow, lang) {
  const isEn = lang === 'en';
  const first = receiverIntel?.[0];
  if (!first) {
    return {
      title: isEn ? 'Tax receiver not located' : '未定位收税地址',
      score: flow.sampleTxs < 3 ? 55 : 74,
      tone: flow.sampleTxs < 3 ? 'warm' : 'growth',
      body: flow.sampleTxs < 3
        ? (isEn ? 'Few recent pool transfers. The rate is visible, but the receiver cannot be identified yet.' : '近期池子转账太少。能看税率，但还不能确认税进了谁的钱包。')
        : (isEn ? 'No repeated tax receiver found in sampled pool traffic.' : '样本里没有发现稳定重复的收税地址。'),
      items: [],
    };
  }
  return {
    title: first.type === 'wallet'
      ? (isEn ? 'Tax to wallet' : '税进钱包')
      : (first.selfTax ? (isEn ? 'Token self-tax path' : '代币合约自收税') : (isEn ? 'Tax receiver contract' : '收税合约')),
    score: first.score,
    tone: first.tone,
    body: isEn
      ? `${first.verdict}. ${first.quality}`
      : `${first.verdict}。${first.quality}`,
    items: [
      detail(isEn ? 'Address' : '地址', shortAddress(first.address), first.tone),
      detail(isEn ? 'Type' : '类型', first.type === 'contract' ? (isEn ? 'Contract' : '合约') : (isEn ? 'Wallet' : '钱包'), first.tone),
      detail(isEn ? 'Hits' : '出现次数', `${first.count || 0}x`),
      detail(isEn ? 'Amount' : '累计数量', first.totalText || '--'),
      ...(first.type === 'contract' ? [
        detail(isEn ? 'Source' : '源码', first.sourceVerified ? (isEn ? 'Verified' : '已开源') : (isEn ? 'Not verified' : '未开源'), first.sourceVerified ? 'growth' : 'warm'),
        detail('Owner', first.owner ? shortAddress(first.owner) : '--'),
      ] : []),
    ],
  };
}

function marketLens(analysis, dimensions, social, receiver, lang) {
  const { gp, pair, gecko, geckoPool, flow, risk, mechanism } = analysis;
  const flap = analysis.flap;
  const isEn = lang === 'en';
  const dexText = `${pair?.dexId || ''} ${pair?.url || ''}`.toLowerCase();
  const maxTax = Math.max(risk.buyTax || 0, risk.sellTax || 0);
  const hasTaxSignals = maxTax > 0 || flow.suspects.length > 0 || risk.flags?.taxControl || mechanism.includes('税币');
  const fourLike = /four|meme/.test(dexText);
  const hasExternalPool = Boolean(pair?.pairAddress || gecko?.topPools?.length || geckoPool?.address);
  const activeFlap = Boolean(flap && !hasExternalPool && !flap.pool && flap.listed !== true);
  const flapLike = Boolean(flap) || /flap/.test(dexText) || hasTaxSignals;

  if (hasExternalPool) {
    const txns = pair?.txns?.h24 || {};
    const buys = Number(txns.buys || geckoPool?.buys24h || 0);
    const sells = Number(txns.sells || geckoPool?.sells24h || 0);
    return {
      label: isEn ? 'DEX market lens' : '外盘交易镜头',
      title: isEn ? 'Graduated market' : '已迁移外盘',
      body: isEn
        ? 'This token is already trading on a DEX. Judge it by live liquidity, tax, volume, holder concentration and the tax receiver.'
        : '这个币已经迁移到 Pancake/外盘。先看实时池子、税率、成交、筹码集中度和收税路径。',
      items: [
        detail(isEn ? 'DEX liquidity' : '外盘流动性', compactUsd(pair?.liquidity?.usd || geckoPool?.reserveUsd || gecko?.reserveUsd), dimensions.liquidity.score >= 70 ? 'growth' : 'warm'),
        detail(isEn ? '24h volume' : '24h 成交', compactUsd(pair?.volume?.h24 || geckoPool?.volume24hUsd || gecko?.volume24hUsd), Number(pair?.volume?.h24 || geckoPool?.volume24hUsd || gecko?.volume24hUsd || 0) >= 20000 ? 'growth' : 'warm'),
        detail(isEn ? '24h txns' : '24h 笔数', `${buys} 买 / ${sells} 卖`, buys >= sells ? 'growth' : 'warm'),
        detail(isEn ? 'Tax' : '买/卖税', `${pct(risk.buyTax)} / ${pct(risk.sellTax)}`, dimensions.tax.score >= 80 ? 'growth' : 'warm'),
        detail(isEn ? 'Social' : '社媒', social.labels.length ? social.labels.join(' / ') : (isEn ? 'not found' : '未发现'), dimensions.social.score >= 70 ? 'growth' : 'warm'),
      ],
    };
  }

  if (activeFlap) {
    return {
      label: isEn ? 'Flap inner-market lens' : 'Flap 内盘镜头',
      title: isEn ? 'Inner market first' : '先看内盘结构',
      body: isEn
        ? 'Flap/Four-style launches may not appear on DexScreener before migration. Read inner tax, reserve, curve progress and recent order flow first.'
        : 'Flap/Four 这类内盘没迁移前，DexScreener 可能读不到池子。先看内盘税率、储备、曲线进度和最近买卖。',
      items: [
        detail(isEn ? 'Inner tax' : '内盘买/卖税', `${pct(flap.buyTax)} / ${pct(flap.sellTax)}`, dimensions.tax.score >= 80 ? 'growth' : dimensions.tax.score >= 55 ? 'warm' : 'alert'),
        detail(isEn ? 'Reserve' : '内盘储备', flap.reserveBnb ? `${flap.reserveBnb.toFixed(2)} BNB` : '--', dimensions.liquidity.score >= 70 ? 'growth' : 'warm'),
        detail(isEn ? 'Curve progress' : '曲线进度', flap.progress === null ? '--' : `${flap.progress.toFixed(1)}%`, flap.progress >= 75 ? 'growth' : 'warm'),
        detail(isEn ? 'Recent flow' : '最近买卖', `${flap.recentBuys || 0} 买 / ${flap.recentSells || 0} 卖`, flap.recentBuys >= flap.recentSells ? 'growth' : 'warm'),
        detail(isEn ? 'Holder view' : '筹码视图', flap.bondingCurvePct ? `Bonding curve ${pct(flap.bondingCurvePct)}` : (isEn ? 'not indexed' : '未索引'), 'warm'),
      ],
    };
  }

  if (flapLike) {
    return {
      label: isEn ? 'Flap tax lens' : 'Flap 税流镜头',
      title: isEn ? 'Mechanism first' : '先看税怎么走',
      body: isEn
        ? 'For tax tokens, the receiver matters more than the slogan. Check tax rate, receiver type, source visibility and whether the receiver is controlled by a wallet.'
        : '税币不要先看故事，先看税率、收税地址、收税合约是否开源，以及钱是不是进个人钱包。',
      items: [
        detail(isEn ? 'Tax' : '买/卖税', risk.buyTax !== null || risk.sellTax !== null ? `${pct(risk.buyTax)} / ${pct(risk.sellTax)}` : '--', dimensions.tax.score >= 80 ? 'growth' : dimensions.tax.score >= 55 ? 'warm' : 'alert'),
        detail(isEn ? 'Receiver' : '收税地址', receiver.title, receiver.tone),
        detail(isEn ? 'Mechanism' : '机制', mechanism),
        detail(isEn ? 'Flow score' : '税流评分', `${dimensions.flow.score}/100`, toneFromScore(dimensions.flow.score)),
      ],
    };
  }

  return {
    label: fourLike ? (isEn ? 'Four narrative lens' : 'Four 叙事镜头') : (isEn ? 'Narrative lens' : '叙事镜头'),
    title: isEn ? 'Story and attention first' : '先看故事和注意力',
    body: isEn
      ? 'For non-tax launches, the useful first pass is narrative, public links, liquidity and whether the contract leaves hidden authority.'
      : '非强税路径先看叙事、公开链接、池子深度和合约权限。没有社媒或池子很浅，就算故事好也不能重仓。',
    items: [
      detail(isEn ? 'Social' : '社媒', social.labels.length ? social.labels.join(' / ') : (isEn ? 'not found' : '未发现'), dimensions.social.score >= 70 ? 'growth' : 'warm'),
      detail(isEn ? 'Holder health' : '筹码健康', `${dimensions.chips.score}/100`, toneFromScore(dimensions.chips.score)),
      detail(isEn ? 'Liquidity' : '流动性', `${dimensions.liquidity.score}/100`, toneFromScore(dimensions.liquidity.score)),
      detail(isEn ? 'Authority' : '权限', `${dimensions.permission.score}/100`, toneFromScore(dimensions.permission.score)),
      detail(isEn ? 'Trade' : '可交易', `${dimensions.trade.score}/100`, toneFromScore(dimensions.trade.score)),
    ],
  };
}

function buildAuditCards(analysis, narrative, lang) {
  const { address, kind, meta, gp, pair, flap, gecko, geckoPool, llamaPrice, honeypot, source, proxy, owner, selectors, activity, flow, receiverIntel, risk, mechanism } = analysis;
  const isEn = lang === 'en';
  const isToken = kind === 'token';
  const isNft = kind === 'nft721' || kind === 'nft1155';
  const tax = risk.buyTax !== null || risk.sellTax !== null ? `${pct(risk.buyTax)} / ${pct(risk.sellTax)}` : '--';
  const verdict = verdictFromScore(risk.score, lang);
  const { dimensions, social, chips, overall } = scoreDimensions(analysis, lang);
  const decision = decisionFromScores(overall, dimensions, lang);
  const receiver = receiverReport(receiverIntel || [], flow, lang);
  const focus = marketLens(analysis, dimensions, social, receiver, lang);
  const hasExternalPool = Boolean(pair?.pairAddress || gecko?.topPools?.length || geckoPool?.address);
  const activeFlap = Boolean(flap && !hasExternalPool && !flap.pool && flap.listed !== true);
  const assetName = meta.symbol || meta.name || (isNft ? (kind === 'nft721' ? 'ERC-721' : 'ERC-1155') : (isEn ? 'Contract' : '合约'));
  const ctaHref = pair?.url || `https://bscscan.com/address/${address}`;

  if (!isToken) {
    return [{
      id: cardId(isNft ? 'nft-dossier' : 'contract-dossier', address),
      type: 'world',
      layout: 'contract-report',
      label: isNft ? (isEn ? 'NFT report' : 'NFT 报告') : (isEn ? 'Contract report' : '合约报告'),
      title: isEn ? `${assetName}: ${verdict.text}` : `${assetName}：${verdict.text}`,
      body: isNft
        ? (isEn ? 'NFT contract scan based on interface, owner, proxy and source visibility.' : 'NFT 合约扫描：看接口、owner、代理和源码可见性。')
        : (isEn ? 'Generic contract scan. It is not recognized as a live tradable token from current DEX/security data.' : '普通合约扫描：当前没有识别成可交易代币，重点看权限和调用痕迹。'),
      details: [
        detail(isEn ? 'Conclusion' : '结论', verdict.text, verdict.tone),
        detail(isEn ? 'Type' : '类型', isNft ? (kind === 'nft721' ? 'ERC-721' : 'ERC-1155') : (isEn ? 'Contract' : '普通合约'), 'cool'),
        detail(isEn ? 'Source' : '源码', sourceLabel(source, lang), source.verified ? 'growth' : 'warm'),
        detail('Owner', ownershipLabel(owner, lang)),
      ],
      advancedDetails: [
        detail('CA', address),
        detail('Proxy', proxy.isProxy ? shortAddress(proxy.implementation) : 'no'),
        detail(isEn ? 'Selectors' : '主要函数', selectorBrief(selectors, 12)),
        ...toolTraceDetails({ gp, pair, gecko, honeypot, llamaPrice, source, activity }),
      ],
      report: {
        kind: 'contract-report',
        asset: { name: assetName, address, type: isNft ? kind : 'contract', venue: sourceLabel(source, lang) },
        decision: { label: verdict.text, score: risk.score, tone: verdict.tone, summary: isNft ? 'NFT contract' : 'Generic contract', action: isEn ? 'Read source/owner before interacting.' : '交互前先看源码和 owner。' },
        metrics: [
          detail(isEn ? 'Type' : '类型', isNft ? kind : 'contract'),
          detail(isEn ? 'Source' : '源码', sourceLabel(source, lang), source.verified ? 'growth' : 'warm'),
          detail('Owner', ownershipLabel(owner, lang)),
          detail('Proxy', proxy.isProxy ? 'yes' : 'no', proxy.isProxy ? 'warm' : 'growth'),
        ],
        dimensions: [
          { label: isEn ? 'Permission' : '权限', score: risk.score, reason: risk.risks.slice(0, 2).join('，') || (isEn ? 'no obvious issue' : '暂无明显问题'), tone: verdict.tone },
        ],
        focus: { label: isEn ? 'Contract evidence' : '合约证据', title: isEn ? 'Read before use' : '先读再用', body: source.verified ? (isEn ? 'Source is available.' : '源码可读。') : (isEn ? 'Source is hidden.' : '源码未开。'), items: [detail(isEn ? 'Selectors' : '主要函数', selectorBrief(selectors, 5))] },
        receiver: null,
      },
      cta: { label: 'BscScan', href: ctaHref },
    }];
  }

  const report = {
    kind: 'contract-report',
    asset: {
      name: assetName,
      address,
      type: 'token',
      venue: activeFlap ? 'Flap' : (pair?.dexId || geckoPool?.dexId || (flap ? 'Flap / DEX' : 'DEX')),
    },
    decision: {
      label: decision.text,
      score: overall,
      tone: decision.tone,
      summary: scanNarrative(analysis, lang),
      action: decision.action,
    },
    metrics: [
      detail(isEn ? 'Tax' : '买/卖税', tax, dimensions.tax.score >= 80 ? 'growth' : dimensions.tax.score >= 55 ? 'warm' : 'alert'),
      detail(
        isEn ? (activeFlap ? 'Inner reserve' : 'Liquidity') : (activeFlap ? '内盘储备' : '流动性'),
        activeFlap && flap?.reserveBnb ? `${flap.reserveBnb.toFixed(2)} BNB` : compactUsd(pair?.liquidity?.usd || geckoPool?.reserveUsd || gecko?.reserveUsd),
        dimensions.liquidity.score >= 80 ? 'growth' : dimensions.liquidity.score >= 55 ? 'warm' : 'alert',
      ),
      ...(activeFlap ? [detail(isEn ? 'Curve' : '曲线进度', flap.progress === null ? '--' : `${flap.progress.toFixed(1)}%`, flap.progress >= 75 ? 'growth' : 'warm')] : []),
      ...(!activeFlap && (pair?.volume?.h24 || geckoPool?.volume24hUsd || gecko?.volume24hUsd) ? [detail(isEn ? '24h volume' : '24h 成交', compactUsd(pair?.volume?.h24 || geckoPool?.volume24hUsd || gecko?.volume24hUsd), Number(pair?.volume?.h24 || geckoPool?.volume24hUsd || gecko?.volume24hUsd || 0) >= 20000 ? 'growth' : 'warm')] : []),
      detail(isEn ? 'Source' : '源码', sourceLabel(source, lang), source.verified ? 'growth' : 'warm'),
      detail(isEn ? 'Social' : '社媒', social.labels.length ? social.labels.join(' / ') : (isEn ? 'not found' : '未发现'), dimensions.social.score >= 70 ? 'growth' : 'warm'),
      detail(isEn ? 'Holder health' : '筹码健康', `${dimensions.chips.score}/100`, toneFromScore(dimensions.chips.score)),
    ],
    dimensions: [
      { label: isEn ? 'Trade' : '可交易', ...dimensions.trade, tone: toneFromScore(dimensions.trade.score) },
      { label: isEn ? 'Tax' : '税费', ...dimensions.tax, tone: toneFromScore(dimensions.tax.score) },
      { label: isEn ? 'Liquidity' : '流动性', ...dimensions.liquidity, tone: toneFromScore(dimensions.liquidity.score) },
      { label: isEn ? 'Permission' : '权限', ...dimensions.permission, tone: toneFromScore(dimensions.permission.score) },
      { label: isEn ? 'Flow' : '资金流', ...dimensions.flow, tone: toneFromScore(dimensions.flow.score) },
      { label: isEn ? 'Social' : '社媒', ...dimensions.social, tone: toneFromScore(dimensions.social.score) },
      { label: isEn ? 'Holders' : '筹码', ...dimensions.chips, tone: toneFromScore(dimensions.chips.score) },
    ],
    focus,
    receiver,
  };

  return [{
    id: cardId('contract-report', address),
    type: 'world',
    layout: 'contract-report',
    label: isEn ? 'CA report' : 'CA 报告',
    title: isEn ? `${assetName}: ${decision.text}` : `${assetName}：${decision.text}`,
    body: decision.action,
    details: [
      detail(isEn ? 'Overall' : '综合评分', `${overall}/100`, decision.tone),
      detail(isEn ? 'Weakest' : '最弱项', weakestDimension(dimensions, lang), toneFromScore(Math.min(...Object.values(dimensions).map((item) => item.score)))),
      detail(isEn ? 'Tax receiver' : '收税地址', receiver.title, receiver.tone),
      detail(isEn ? 'Lens' : '分析镜头', focus.label, focus.label.includes('Flap') ? 'warm' : 'cool'),
    ],
    advancedDetails: [
      detail('CA', address),
      detail(isEn ? 'Mechanism' : '机制', mechanism),
      ...(flap ? [
        detail(isEn ? 'Launchpad' : '发射平台', activeFlap ? 'Flap inner market' : 'Flap / migrated'),
        detail(isEn ? 'Launch status' : '状态', activeFlap ? (isEn ? 'inner market' : '内盘') : (isEn ? 'migrated to DEX' : '已迁移外盘')),
        detail(isEn ? 'Flap page' : 'Flap 页面', flap.url),
      ] : []),
      detail(isEn ? 'GoPlus' : '安全接口', gp ? 'online' : 'unavailable'),
      detail(isEn ? 'Holder count' : '持有人数', chips.holderCount || '--'),
      detail(isEn ? 'Largest holder' : '最大非池地址', chips.topHolder),
      detail(isEn ? 'Top 10' : '前十非池地址', chips.top10),
      detail(isEn ? 'Creator' : '创建者持仓', chips.creator),
      detail(isEn ? 'LP burned/locked' : 'LP 锁定/销毁', chips.lpLock),
      detail(isEn ? 'Key risks' : '主要风险', risk.risks.slice(0, 5).join(' / ') || '--'),
      detail(isEn ? 'Positive signals' : '正向信号', risk.positives.slice(0, 4).join(' / ') || '--'),
      detail(isEn ? 'Selectors' : '关键函数', selectorBrief(selectors, 8)),
      detail(isEn ? 'Recent calls' : '近期调用', activity.enabled && activity.selectors.length ? activity.selectors.map(([selector, count]) => `${selector} x${count}`).join(' / ') : '--'),
      detail('Explorer tx', activity.enabled ? `${activity.normal.length} normal / ${activity.internal.length} internal` : '需要配置 BSCSCAN_API_KEY'),
      ...toolTraceDetails({ gp, pair, gecko, honeypot, llamaPrice, source, activity }),
    ],
    report,
    cta: { label: pair?.url ? 'DexScreener' : 'BscScan', href: ctaHref },
  }];
}
async function nfaStats(tokenId) {
  if (!ROUTER) return null;
  const id = BigInt(tokenId);
  const [lob, bal, task, pk] = await Promise.all([
    callSafe(ROUTER, `0xe7faef4a${hexArgUint(id)}`),
    callSafe(ROUTER, `0x586af883${hexArgUint(id)}`),
    TASK ? callSafe(TASK, `0xd32310c4${hexArgUint(id)}`) : '0x',
    PK ? callSafe(PK, `0x45932efa${hexArgUint(id)}`) : '0x',
  ]);
  if (!lob || lob === '0x') return null;
  const traits = [u8(lob, 2), u8(lob, 3), u8(lob, 4), u8(lob, 5), u8(lob, 6)];
  const level = u16(lob, 13);
  const xp = u32(lob, 14);
  let engine = '';
  const engineRaw = await callSafe(ROUTER, '0xe7b02f1e');
  if (engineRaw && engineRaw !== '0x') {
    engine = wordAddress(engineRaw, 0);
    if (engine === ZERO_ADDRESS) engine = '';
  }
  const monthly = [];
  for (let i = 0; i < 5; i += 1) {
    const raw = await callSafe(engine || ROUTER, `0x11818051${hexArgUint(id)}${hexArgUint(i)}`);
    monthly.push(raw && raw !== '0x' ? int8(raw) : 0);
  }
  return {
    traits,
    level,
    xp,
    balance: bal && bal !== '0x' ? word(bal, 0) : 0n,
    task: task && task !== '0x'
      ? { total: Number(word(task, 0)), earned: word(task, 1) }
      : null,
    pk: pk && pk !== '0x'
      ? { wins: Number(word(pk, 0)), losses: Number(word(pk, 1)), won: word(pk, 2), lost: word(pk, 3) }
      : null,
    monthly,
  };
}

function isNfaQuery(text) {
  const value = lowerText(text);
  return hasAny(value, ['属性', '本月', '增加', '成长', '赚了多少', '余额', '账本', '胜败', '任务', '状态', 'stats', 'status', 'balance', 'earned', 'month', 'trait', 'win', 'loss']);
}

async function buildNfaCards(tokenId, text, lang) {
  if (!isNfaQuery(text)) return null;
  const stats = await nfaStats(tokenId).catch(() => null);
  if (!stats) return null;
  const isEn = lang === 'en';
  const names = isEn ? ['Courage', 'Wisdom', 'Social', 'Create', 'Grit'] : ['勇气', '智慧', '社交', '创造', '韧性'];
  const monthly = stats.monthly.map((value, index) => `${names[index]} ${value >= 0 ? '+' : ''}${value}`).join(' / ');
  return [{
    id: cardId('nfa-status', tokenId),
    type: 'world',
    label: isEn ? 'Chain status' : 'NFA 状态',
    title: `NFA #${tokenId}`,
    body: isEn ? 'Live data read from BNB Chain.' : '这是刚从 BNB Chain 读到的数据。',
    details: [
      detail(isEn ? 'Level' : '等级', `Lv.${stats.level}`),
      detail(isEn ? 'Ledger' : '账本储备', `${formatUnits(stats.balance)} Claworld`),
      detail(isEn ? 'Traits' : '五围', stats.traits.map((value, index) => `${names[index]} ${value}`).join(' / ')),
      detail(isEn ? 'This month' : '本月成长', monthly),
      detail(isEn ? 'Tasks' : '任务', stats.task ? stats.task.total : '--'),
      detail(isEn ? 'Task earned' : '累计收益', stats.task ? `${formatUnits(stats.task.earned)} Claworld` : '--'),
      detail('PK', stats.pk ? `${stats.pk.wins}${isEn ? 'W' : '胜'} / ${stats.pk.losses}${isEn ? 'L' : '败'}` : '--'),
    ],
  }];
}

function intentFromText(text) {
  const value = lowerText(text);
  if (/^(\/mine|\/mining)\b/.test(value) || hasAny(value, ['挖矿', '任务', 'mine', 'mining'])) return 'mining';
  if (/^(\/arena|\/pk|\/br)\b/.test(value) || hasAny(value, ['竞技', 'pk', '大逃杀', 'battle', 'arena'])) return 'arena';
  if (/^(\/auto|\/agent)\b/.test(value) || hasAny(value, ['代理', '自治', 'auto', 'agent'])) return 'auto';
  if (/^(\/mint)\b/.test(value) || hasAny(value, ['铸造', 'mint'])) return 'mint';
  if (/^(\/market)\b/.test(value) || hasAny(value, ['市场', '购买', '买', '挂单', '撤单', 'market', 'buy', 'list', 'cancel listing'])) return 'market';
  if (/^(\/memory)\b/.test(value) || hasAny(value, ['记忆', '记住', 'memory', 'remember'])) return 'memory';
  if (hasAny(value, ['充值', '存款', '提现', '余额', '钱包', 'deposit', 'withdraw', 'balance', 'fund'])) return 'finance';
  return null;
}

function isPureQuestion(text) {
  const value = lowerText(text);
  const hasAction = hasAny(value, ['帮我', '我要', '我想', '去', '开始', '打开', '参加', '加入', '领取', '充值', '提现', '购买', '挂单', '撤单', 'please', 'can you', "let's", 'start', 'open', 'join', 'claim', 'deposit', 'withdraw', 'buy', 'list', 'cancel']);
  const asks = hasAny(value, ['多少', '怎么', '为什么', '规则', '上限', '能不能', '可不可以', '?', '？', 'what', 'why', 'how', 'limit', 'cap']);
  return asks && !hasAction;
}

function proposal(intent, lang, tokenId) {
  const zh = {
    mining: ['挖矿', '打开任务挖矿', '选任务，看收益，然后确认。', [['目标', '赚 Claworld'], ['条件', '冷却 / 储备']]],
    arena: ['竞技', '打开竞技场', 'PK 和大逃杀都在这里，先看对局再下注。', [['模式', 'PK / 大逃杀'], ['条件', '储备足够']]],
    auto: ['代理', '打开代理', '设策略、预算和提示词，后端按规则跑。', [['模式', '任务 / PK / 大逃杀'], ['安全', '预算 / 权限']]],
    mint: ['铸造', '打开铸造', '没有 NFA 时用这里入场，也可以去市场买。', [['路径', '铸造 / 市场'], ['结果', '获得 NFA']]],
    market: ['市场', '打开市场', '购买、上架或撤回 NFA。', [['目标', '买卖 NFA'], ['路径', '市场面板']]],
    memory: ['记忆', '写入记忆', '把这句话整理成长期记忆，确认后再保存。', [['目标', 'CML 记忆'], ['状态', '等待确认']]],
    finance: ['资金', '打开资金', '充值到 NFA 账本，或提现到钱包。', [['资产', 'Claworld'], ['路径', 'NFA 账本']]],
  };
  const en = {
    mining: ['Mining', 'Open Mining', 'Pick a task, preview reward, then confirm.', [['Goal', 'Earn Claworld'], ['Gate', 'Cooldown / reserve']]],
    arena: ['Arena', 'Open Arena', 'Check PK and Battle Royale, then confirm stake.', [['Modes', 'PK / Battle Royale'], ['Gate', 'Enough reserve']]],
    auto: ['Agent', 'Open Agent', 'Set policy, budget, and prompt. Backend acts inside limits.', [['Modes', 'Mining / PK / BR'], ['Safety', 'Budget / permissions']]],
    mint: ['Mint', 'Open Mint', 'Mint a new NFA or buy from market.', [['Path', 'Mint / Market'], ['Result', 'Get NFA']]],
    market: ['Market', 'Open Market', 'Buy, list, or cancel listed NFA.', [['Use', 'Trade NFA'], ['Entry', 'Market panel']]],
    memory: ['Memory', 'Save Memory', 'Turn this into long-term memory after confirmation.', [['Target', 'CML memory'], ['Status', 'Needs confirmation']]],
    finance: ['Funds', 'Open Funds', 'Deposit to NFA ledger or withdraw to wallet.', [['Asset', 'Claworld'], ['Path', 'NFA ledger']]],
  };
  const copy = (lang === 'en' ? en : zh)[intent];
  if (!copy) return null;
  return {
    id: cardId(`backend-${intent}`, tokenId),
    type: 'proposal',
    label: copy[0],
    title: copy[1],
    body: copy[2],
    details: copy[3].map(([label, value]) => ({ label, value })),
    actions: [{ label: copy[1], intent }],
  };
}

function systemPrompt(tokenId, body, lang) {
  const name = body?.context?.nfa?.displayName || body?.snapshot?.detail?.displayName || body?.displayName || `NFA #${tokenId}`;
  if (lang === 'en') {
    return `You are ${name}, an on-chain NFA in claworldnfa. Speak naturally, short, no support-copy tone. Use tools and be honest about uncertainty. Never claim a transaction happened before wallet confirmation.`;
  }
  return `你是 claworldnfa 里的链上 NFA，名字是 ${name}。说话要像有记忆、有脾气、会行动的链上伙伴，不要像客服。默认 1 到 3 句，不要说“作为 AI”“我这边”“稳了”。问行情或 CA 时可以用工具结果和联网能力，不确定就说清楚。链上写操作不要假装已经执行，要让用户看动作卡确认。`;
}

function historyMessages(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map((item) => ({
    role: item?.role === 'user' ? 'user' : 'assistant',
    content: [item?.title, item?.body].filter(Boolean).join('\n'),
  })).filter((item) => item.content);
}

async function callResponses(body, tokenId, lang) {
  if (!MODEL_BASE_URL || !MODEL_API_KEY) return '';
  const input = [
    { role: 'system', content: systemPrompt(tokenId, body, lang) },
    ...historyMessages(body.history),
    { role: 'user', content: String(body.content || body.slashCommand || '') },
  ];
  const tools = WEB_TOOLS ? [{ type: 'web_search' }] : [];
  const response = await fetch(`${MODEL_BASE_URL}/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${MODEL_API_KEY}` },
    body: JSON.stringify({ model: MODEL_NAME, input, tools, tool_choice: 'auto', max_output_tokens: 1600 }),
    signal: timeout(45000),
  });
  if (!response.ok) throw new Error(`model responses ${response.status}`);
  const payload = await response.json();
  if (typeof payload.output_text === 'string') return payload.output_text.trim();
  const chunks = [];
  for (const out of payload.output || []) {
    for (const content of out.content || []) if (content.text) chunks.push(content.text);
  }
  return chunks.join('\n\n').trim();
}

async function callChat(body, tokenId, lang) {
  if (!MODEL_BASE_URL || !MODEL_API_KEY) return '';
  const messages = [
    { role: 'system', content: systemPrompt(tokenId, body, lang) },
    ...historyMessages(body.history),
    { role: 'user', content: String(body.content || body.slashCommand || '') },
  ];
  const response = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${MODEL_API_KEY}` },
    body: JSON.stringify({ model: MODEL_NAME, messages, temperature: 0.75, max_tokens: 1000 }),
    signal: timeout(45000),
  });
  if (!response.ok) throw new Error(`model chat ${response.status}`);
  const payload = await response.json();
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

function cleanReply(text) {
  return String(text || '').replace(/^(\s*(作为AI|作为一个AI|as an ai|as a language model)[，,。\s]*)/i, '').trim();
}

async function handleChat(req, res, tokenId) {
  if (!authed(req)) return sendJson(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  const lang = pickLang(body);
  const text = String(body.content || body.slashCommand || '').trim();
  const address = normalizeAddress(text);

  if (address) {
    const result = await analyzeContract(address, lang);
    return sendJson(res, 200, { cards: result.cards });
  }

  let cards = await buildNfaCards(tokenId, text, lang);
  const intent = intentFromText(text);
  if (!cards && intent && !isPureQuestion(text)) {
    const proposed = proposal(intent, lang, tokenId);
    cards = proposed ? [proposed] : null;
  }
  if (cards?.length) return sendJson(res, 200, { cards });

  let reply = '';
  try {
    reply = await callResponses(body, tokenId, lang);
  } catch {
    try {
      reply = await callChat(body, tokenId, lang);
    } catch {
      // Fall through to deterministic fallback.
    }
  }
  if (reply) {
    return sendJson(res, 200, {
      cards: [{
        id: cardId('backend-reply', tokenId),
        type: 'message',
        role: 'nfa',
        label: lang === 'en' ? 'Reply' : '回复',
        title: '',
        body: cleanReply(reply),
        tone: 'warm',
      }],
    });
  }

  return sendJson(res, 200, {
    cards: [{
      id: cardId('backend-empty', tokenId),
      type: 'message',
      role: 'nfa',
      label: lang === 'en' ? 'Reply' : '回复',
      title: '',
      body: lang === 'en' ? 'I heard you. Say the target more directly and I can help.' : '我听到了。你直接说目标，我就能接上。',
      tone: 'warm',
    }],
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 204, {});
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
      return sendJson(res, 200, {
        ok: true,
        service: 'clawworld-api',
        model: MODEL_NAME,
        webTools: WEB_TOOLS,
        backend: 'contract-intel',
      });
    }
    const memoryMatch = url.pathname.match(/^\/(?:api\/)?memory\/([^/]+)\/(summary|timeline|write)\/?$/);
    if (memoryMatch) {
      if (!authed(req)) return sendJson(res, 401, { error: 'unauthorized' });
      const tokenId = parsePositiveInt(decodeURIComponent(memoryMatch[1]));
      if (!tokenId) return sendJson(res, 400, { error: 'invalid tokenId' });
      const action = memoryMatch[2];
      if (req.method === 'GET' && action === 'summary') {
        const summary = getBackendMemorySummary(tokenId);
        if (!summary) return sendJson(res, 404, { error: 'No CML memory for NFA #' + tokenId });
        return sendJson(res, 200, summary);
      }
      if (req.method === 'GET' && action === 'timeline') {
        const limit = clampInt(Number(url.searchParams.get('limit') || 6), 1, 50);
        return sendJson(res, 200, { snapshots: getBackendMemoryTimeline(tokenId, limit) });
      }
      if (req.method === 'POST' && action === 'write') {
        const body = await readBody(req);
        const content = normalizeMemoryText(body.content || body.text || body.memory || '', 800);
        const result = writeBackendMemory({
          tokenId,
          content,
          owner: body.owner || null,
          memoryRoot: body.memoryRoot || body.root || null,
        });
        return sendJson(res, 200, result);
      }
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    const match = url.pathname.match(/^\/chat\/([^/]+)\/send\/?$/);
    if (req.method === 'POST' && match) return await handleChat(req, res, decodeURIComponent(match[1]));
    return sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    return sendJson(res, status >= 400 && status < 600 ? status : 500, {
      error: error instanceof Error ? error.message : 'internal error',
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`clawworld-api listening on ${PORT}`);
});
