#!/usr/bin/env node

const baseUrl = (process.env.AGENT_RUNTIME_BASE_URL || 'https://clawnfaterminal.xyz').replace(/\/+$/, '');
const tokenId = process.env.AGENT_RUNTIME_TOKEN_ID || '3';
const requestId = process.env.AGENT_RUNTIME_REQUEST_ID || '21';
const verifyMemoryWrite = process.env.AGENT_RUNTIME_VERIFY_WRITE === '1';

const paths = {
  projectCard: '/.well-known/agent-card.json',
  apiAgentCard: `/api/agents/${tokenId}/agent-card`,
  publicAgentCard: `/agents/${tokenId}/agent-card.json`,
  skills: `/api/agents/${tokenId}/skills`,
  receipts: `/api/agents/${tokenId}/receipts?limit=5`,
  receipt: `/api/receipts/${requestId}`,
  publicReceipt: `/receipts/${requestId}`,
  memorySummary: `/api/agents/${tokenId}/memory/summary`,
};

const failures = [];
const notes = [];

function fail(label, message) {
  failures.push(`${label}: ${message}`);
}

function assert(label, condition, message) {
  if (!condition) fail(label, message);
}

function hasBadPublicHost(value) {
  if (typeof value !== 'string') return false;
  return /https?:\/\/(0\.0\.0\.0|127\.0\.0\.1|localhost)(?::\d+)?/i.test(value);
}

function walkStrings(value, visit) {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkStrings(item, visit));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => walkStrings(item, visit));
  }
}

async function fetchJson(label, path) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'claworldnfa-agent-runtime-verify/0',
    },
  });
  const text = await response.text();
  assert(label, response.ok, `HTTP ${response.status} from ${url}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(label, `invalid JSON from ${url}: ${error.message}`);
    return null;
  }
}

async function postJson(label, path, body) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'claworldnfa-agent-runtime-verify/0',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assert(label, response.ok, `HTTP ${response.status} from ${url}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(label, `invalid JSON from ${url}: ${error.message}`);
    return null;
  }
}

function assertNoPrivateUrls(label, payload) {
  const bad = [];
  walkStrings(payload, (value) => {
    if (hasBadPublicHost(value)) bad.push(value);
  });
  assert(label, bad.length === 0, `public payload leaks private/local URLs: ${bad.slice(0, 5).join(', ')}`);
}

const projectCard = await fetchJson('project-card', paths.projectCard);
if (projectCard) {
  assert('project-card', projectCard.schemaVersion === 'claw.project-agent-card.v0', 'unexpected schemaVersion');
  assert('project-card', projectCard.chainId === 56, 'chainId should be 56');
  assert('project-card', projectCard.contracts?.nfa, 'missing NFA contract');
  assert('project-card', projectCard.contracts?.actionHub, 'missing ActionHub contract');
  assert('project-card', Array.isArray(projectCard.capabilities), 'capabilities should be an array');
  assert('project-card', projectCard.capabilities?.includes('claw.action_receipt'), 'missing action receipt capability');
  assertNoPrivateUrls('project-card', projectCard);
  notes.push(`project-card capabilities=${projectCard.capabilities?.length ?? 0}`);
}

const apiAgentCard = await fetchJson('api-agent-card', paths.apiAgentCard);
const publicAgentCard = await fetchJson('public-agent-card', paths.publicAgentCard);
if (apiAgentCard) {
  assert('api-agent-card', apiAgentCard.schemaVersion === 'claw.agent-card.v0', 'unexpected schemaVersion');
  assert('api-agent-card', String(apiAgentCard.tokenId) === String(tokenId), 'tokenId mismatch');
  assert('api-agent-card', apiAgentCard.owner?.startsWith('0x'), 'missing owner');
  assert('api-agent-card', apiAgentCard.body?.level !== undefined, 'missing body.level');
  assert('api-agent-card', apiAgentCard.memory?.root?.startsWith('0x'), 'missing memory root');
  assert('api-agent-card', Array.isArray(apiAgentCard.skills), 'missing embedded skills');
  assert('api-agent-card', apiAgentCard.receipts?.endpoint, 'missing receipts endpoint');
  assertNoPrivateUrls('api-agent-card', apiAgentCard);
  notes.push(`agent-card owner=${apiAgentCard.owner} level=${apiAgentCard.body?.level}`);
}
if (publicAgentCard) {
  assert('public-agent-card', String(publicAgentCard.tokenId) === String(tokenId), 'tokenId mismatch');
  assertNoPrivateUrls('public-agent-card', publicAgentCard);
}

const skills = await fetchJson('skills', paths.skills);
if (skills) {
  const keys = new Set((skills.skills || []).map((skill) => skill.key));
  for (const key of ['task', 'pk', 'battle_royale', 'finance', 'market', 'memory', 'contract_intel']) {
    assert('skills', keys.has(key), `missing skill ${key}`);
  }
  const callable = (skills.skills || []).filter((skill) => skill.agentCallable || skill.userCallable).length;
  assert('skills', callable > 0, 'no callable skills found');
  assertNoPrivateUrls('skills', skills);
  notes.push(`skills=${skills.skills?.length ?? 0}`);
}

const receipts = await fetchJson('receipts', paths.receipts);
if (receipts) {
  assert('receipts', String(receipts.tokenId) === String(tokenId), 'tokenId mismatch');
  assert('receipts', Array.isArray(receipts.receipts), 'receipts should be an array');
  assert('receipts', receipts.receipts.length > 0, 'receipt list is empty');
  const first = receipts.receipts?.[0] || {};
  assert('receipts', first.receiptHash?.startsWith('0x'), 'missing receiptHash');
  assert('receipts', first.capabilityHash?.startsWith('0x'), 'missing capabilityHash');
  assert('receipts', typeof first.statusLabel === 'string', 'missing statusLabel');
  assertNoPrivateUrls('receipts', receipts);
  notes.push(`receipts=${receipts.receipts?.length ?? 0}`);
}

const receipt = await fetchJson('receipt', paths.receipt);
const publicReceipt = await fetchJson('public-receipt', paths.publicReceipt);
if (receipt) {
  assert('receipt', String(receipt.requestId) === String(requestId), 'requestId mismatch');
  assert('receipt', receipt.receiptHash?.startsWith('0x'), 'missing receiptHash');
  assert('receipt', receipt.capabilityHash?.startsWith('0x'), 'missing capabilityHash');
  assert('receipt', typeof receipt.statusLabel === 'string', 'missing statusLabel');
  assertNoPrivateUrls('receipt', receipt);
  notes.push(`receipt-${requestId} status=${receipt.statusLabel} skill=${receipt.skill}`);
}
if (publicReceipt) {
  assert('public-receipt', String(publicReceipt.requestId) === String(requestId), 'requestId mismatch');
  assertNoPrivateUrls('public-receipt', publicReceipt);
}

const memorySummary = await fetchJson('memory-summary', paths.memorySummary);
if (memorySummary) {
  assert('memory-summary', String(memorySummary.tokenId) === String(tokenId), 'tokenId mismatch');
  assert('memory-summary', memorySummary.learning?.root?.startsWith('0x'), 'missing learning.root');
  assert('memory-summary', memorySummary.learning?.updatedAtIso, 'missing updatedAtIso');
  assert('memory-summary', memorySummary.storage === 'available', 'backend memory storage is not available');
  assert('memory-summary', memorySummary.summary?.latestSnapshotHash, 'missing backend memory snapshot hash');
  assertNoPrivateUrls('memory-summary', memorySummary);
  notes.push(`memory-storage=${memorySummary.storage ?? 'unknown'} snapshot=${memorySummary.summary?.latestSnapshotHash?.slice(0, 12) ?? 'none'}`);
}

if (verifyMemoryWrite) {
  const writeResult = await postJson('memory-write', `/api/memory/${tokenId}/write`, {
    content: `Agent Runtime verification memory write for NFA #${tokenId}.`,
  });
  if (writeResult) {
    assert('memory-write', writeResult.ok === true, 'write did not return ok=true');
    assert('memory-write', writeResult.summary?.latestSnapshotHash, 'missing write snapshot hash');
    assertNoPrivateUrls('memory-write', writeResult);
    notes.push(`memory-write=${writeResult.summary?.latestSnapshotHash?.slice(0, 12) ?? 'none'}`);
  }
}

if (failures.length) {
  console.error('Agent Runtime verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Agent Runtime verification passed.');
for (const note of notes) console.log(`- ${note}`);
