import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

type CmlPulse = {
  valence?: number;
  arousal?: number;
  longing?: number;
};

type CmlFileShape = {
  IDENTITY?: {
    soul?: string;
    voice?: string;
    name?: string;
  };
  PREFRONTAL?: {
    beliefs?: string[];
  };
  BASAL?: {
    preferred_tasks?: string[];
    pk_tendency?: string;
    speech_length?: string;
  };
  CORTEX?: {
    vivid?: unknown[];
    sediment?: unknown[];
  };
  PULSE?: CmlPulse;
};

export type MemorySummaryPayload = {
  latestSnapshotHash: string;
  latestAnchorTxHash: string | null;
  pulse: number;
  hippocampusSize: number;
  identity: string;
  prefrontalBeliefs: string[];
  basalHabits: string[];
};

export type MemorySnapshotPayload = {
  snapshotId: string;
  hash: string;
  consolidatedAt: string;
  anchorTxHash: string | null;
  greenfieldUri: string | null;
  diffSummary: string;
  hippocampusMerged: number;
};

export type MemoryWriteResult = {
  acceptedAt: string;
  contentHash: string;
  persisted: boolean;
  storage: 'backend' | 'local' | 'none';
  summary: MemorySummaryPayload | null;
  snapshot: MemorySnapshotPayload | null;
};

const CML_ROOT =
  process.env.CLAWORLD_CML_DIR ||
  process.env.CLAWORLD_LOCAL_CML_DIR ||
  process.env.AUTONOMY_CML_DIR ||
  path.join(os.homedir(), '.claworld', 'cml');

function localCmlFallbackEnabled() {
  const value = process.env.CLAWORLD_ENABLE_LOCAL_CML_FALLBACK || '';
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function remoteBaseUrl() {
  const value =
    process.env.CLAWORLD_API_URL ||
    process.env.CLAWORLD_BACKEND_API_URL ||
    process.env.CLAWORLD_AI_BACKEND_URL ||
    '';
  return value.replace(/\/+$/, '');
}

function remotePath(templateEnv: string | undefined, fallback: string, tokenId: number, limit?: number) {
  const template = templateEnv || fallback;
  return template
    .replace('{tokenId}', encodeURIComponent(String(tokenId)))
    .replace('{limit}', encodeURIComponent(String(limit ?? '')));
}

async function readRemoteJson<T>(pathTemplate: string | undefined, fallback: string, tokenId: number, limit?: number): Promise<T | null> {
  const baseUrl = remoteBaseUrl();
  if (!baseUrl) return null;

  const pathValue = remotePath(pathTemplate, fallback, tokenId, limit);
  const url = `${baseUrl}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  const token =
    process.env.CLAWORLD_API_TOKEN ||
    process.env.CLAWORLD_BACKEND_API_TOKEN ||
    process.env.CLAWORLD_AI_BACKEND_TOKEN ||
    '';
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function postRemoteJson<T>(
  pathTemplate: string | undefined,
  fallback: string,
  tokenId: number,
  body: Record<string, unknown>,
): Promise<T | null> {
  const baseUrl = remoteBaseUrl();
  if (!baseUrl) return null;

  const pathValue = remotePath(pathTemplate, fallback, tokenId);
  const url = `${baseUrl}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json; charset=utf-8',
  };
  const token =
    process.env.CLAWORLD_API_TOKEN ||
    process.env.CLAWORLD_BACKEND_API_TOKEN ||
    process.env.CLAWORLD_AI_BACKEND_TOKEN ||
    '';
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function currentCmlPath(tokenId: number) {
  return path.join(CML_ROOT, `nfa-${tokenId}.cml`);
}

function archiveDir(tokenId: number) {
  return path.join(CML_ROOT, 'archive', `nfa-${tokenId}`);
}

function memoryInboxPath(tokenId: number) {
  return path.join(CML_ROOT, 'pending-memory', `nfa-${tokenId}.json`);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function readJsonFile<T>(targetPath: string): T | null {
  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function computePulse(rawPulse: CmlPulse | undefined) {
  if (!rawPulse) return 0;
  const valence = typeof rawPulse.valence === 'number' ? rawPulse.valence : 0;
  const arousal = typeof rawPulse.arousal === 'number' ? rawPulse.arousal : 0;
  const longing = typeof rawPulse.longing === 'number' ? rawPulse.longing : 0;
  const normalizedValence = (Math.max(-1, Math.min(1, valence)) + 1) / 2;
  const pulse = normalizedValence * 0.25 + Math.max(0, Math.min(1, arousal)) * 0.45 + Math.max(0, Math.min(1, longing)) * 0.3;
  return Number(Math.max(0, Math.min(1, pulse)).toFixed(2));
}

function buildIdentity(cml: CmlFileShape) {
  const identity = cml.IDENTITY;
  return (
    normalizeText(identity?.soul || '') ||
    normalizeText(identity?.voice || '') ||
    normalizeText(identity?.name || '') ||
    '当前还没有足够的本地记忆摘要。'
  );
}

function buildBasalHabits(cml: CmlFileShape) {
  const habits: string[] = [];
  const basal = cml.BASAL;
  if (Array.isArray(basal?.preferred_tasks) && basal.preferred_tasks.length) {
    habits.push(`偏好任务：${basal.preferred_tasks.slice(0, 3).join(' / ')}`);
  }
  if (basal?.pk_tendency) {
    habits.push(`PK 倾向：${basal.pk_tendency}`);
  }
  if (basal?.speech_length) {
    habits.push(`回应长度：${basal.speech_length}`);
  }
  return habits;
}

function countVivid(cml: CmlFileShape) {
  return Array.isArray(cml.CORTEX?.vivid) ? cml.CORTEX!.vivid!.length : 0;
}

function countSediment(cml: CmlFileShape) {
  return Array.isArray(cml.CORTEX?.sediment) ? cml.CORTEX!.sediment!.length : 0;
}

function parseArchiveTimestamp(fileName: string) {
  const normalized = fileName.replace(/\.cml$/i, '');
  const parts = normalized.split('-').slice(0, 6);
  if (parts.length < 6) return null;
  const [year, month, day, hour, minute, second] = parts;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function readCurrentSnapshot(tokenId: number) {
  const targetPath = currentCmlPath(tokenId);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`No local CML file for NFA #${tokenId}`);
  }
  const raw = fs.readFileSync(targetPath, 'utf8');
  const parsed = JSON.parse(raw) as CmlFileShape;
  return { raw, parsed };
}

export function getMemorySummary(tokenId: number): MemorySummaryPayload {
  const { raw, parsed } = readCurrentSnapshot(tokenId);
  return {
    latestSnapshotHash: sha256(raw),
    latestAnchorTxHash: null,
    pulse: computePulse(parsed.PULSE),
    hippocampusSize: 0,
    identity: buildIdentity(parsed),
    prefrontalBeliefs: Array.isArray(parsed.PREFRONTAL?.beliefs) ? parsed.PREFRONTAL!.beliefs!.slice(0, 4).map(normalizeText).filter(Boolean) : [],
    basalHabits: buildBasalHabits(parsed),
  };
}

export function getMemoryTimeline(tokenId: number, limit: number): MemorySnapshotPayload[] {
  const targetDir = archiveDir(tokenId);
  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const files = fs
    .readdirSync(targetDir)
    .filter((fileName) => fileName.endsWith('.cml'))
    .sort()
    .reverse()
    .slice(0, limit);

  let previous: CmlFileShape | null = null;

  return files.map((fileName, index) => {
    const targetPath = path.join(targetDir, fileName);
    const raw = fs.readFileSync(targetPath, 'utf8');
    const parsed = readJsonFile<CmlFileShape>(targetPath) || {};
    const vivid = countVivid(parsed);
    const sediment = countSediment(parsed);
    const previousVivid = previous ? countVivid(previous) : vivid;
    const previousSediment = previous ? countSediment(previous) : sediment;
    previous = parsed;

    const vividDelta = vivid - previousVivid;
    const sedimentDelta = sediment - previousSediment;
    const consolidatedAt = parseArchiveTimestamp(fileName) || new Date().toISOString();
    const diffSummary =
      index === 0
        ? `可见记忆 ${vivid} 条 · 沉淀 ${sediment} 条`
        : `可见记忆 ${vividDelta >= 0 ? '+' : ''}${vividDelta} · 沉淀 ${sedimentDelta >= 0 ? '+' : ''}${sedimentDelta}`;

    return {
      snapshotId: fileName,
      hash: sha256(raw),
      consolidatedAt,
      anchorTxHash: null,
      greenfieldUri: null,
      diffSummary,
      hippocampusMerged: 0,
    };
  });
}

export async function getMemorySummaryRuntime(tokenId: number): Promise<MemorySummaryPayload | null> {
  const remote = await readRemoteJson<MemorySummaryPayload>(
    process.env.CLAWORLD_MEMORY_SUMMARY_PATH,
    '/memory/{tokenId}/summary',
    tokenId,
  );
  if (remote) return remote;

  if (!localCmlFallbackEnabled()) return null;

  try {
    return getMemorySummary(tokenId);
  } catch {
    return null;
  }
}

export async function getMemoryTimelineRuntime(tokenId: number, limit: number): Promise<MemorySnapshotPayload[]> {
  const remote = await readRemoteJson<{ snapshots?: MemorySnapshotPayload[] } | MemorySnapshotPayload[]>(
    process.env.CLAWORLD_MEMORY_TIMELINE_PATH,
    '/memory/{tokenId}/timeline?limit={limit}',
    tokenId,
    limit,
  );
  if (Array.isArray(remote)) return remote.slice(0, limit);
  if (Array.isArray(remote?.snapshots)) return remote.snapshots.slice(0, limit);

  if (!localCmlFallbackEnabled()) return [];

  try {
    return getMemoryTimeline(tokenId, limit);
  } catch {
    return [];
  }
}

function normalizeRemoteWriteResult(raw: unknown, contentHash: string): MemoryWriteResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as {
    acceptedAt?: string;
    contentHash?: string;
    persisted?: boolean;
    storage?: string;
    summary?: MemorySummaryPayload | null;
    snapshot?: MemorySnapshotPayload | null;
  };
  return {
    acceptedAt: payload.acceptedAt || new Date().toISOString(),
    contentHash: payload.contentHash || contentHash,
    persisted: Boolean(payload.persisted),
    storage: payload.storage === 'backend' ? 'backend' : payload.storage === 'local' ? 'local' : 'backend',
    summary: payload.summary ?? null,
    snapshot: payload.snapshot ?? null,
  };
}

function writeLocalMemoryFallback(tokenId: number, content: string, contentHash: string, memoryRoot?: string | null): MemoryWriteResult {
  const acceptedAt = new Date().toISOString();
  const targetPath = memoryInboxPath(tokenId);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const existing = readJsonFile<{ entries?: Array<Record<string, unknown>> }>(targetPath) || { entries: [] };
  const nextEntry = {
    id: `pending-${Date.now().toString(36)}`,
    content,
    contentHash,
    memoryRoot: memoryRoot || null,
    acceptedAt,
  };
  const entries = Array.isArray(existing.entries) ? [...existing.entries, nextEntry].slice(-50) : [nextEntry];
  fs.writeFileSync(targetPath, JSON.stringify({ version: 1, entries }, null, 2));

  return {
    acceptedAt,
    contentHash,
    persisted: true,
    storage: 'local',
    summary: {
      latestSnapshotHash: memoryRoot || contentHash,
      latestAnchorTxHash: null,
      pulse: 0,
      hippocampusSize: 0,
      identity: content,
      prefrontalBeliefs: [],
      basalHabits: [],
    },
    snapshot: {
      snapshotId: nextEntry.id,
      hash: memoryRoot || contentHash,
      consolidatedAt: acceptedAt,
      anchorTxHash: null,
      greenfieldUri: null,
      diffSummary: `本地正文：${normalizeText(content).slice(0, 120)}`,
      hippocampusMerged: 0,
    },
  };
}

export async function writeMemoryRuntime(input: {
  tokenId: number;
  content: string;
  owner?: string | null;
  memoryRoot?: string | null;
}): Promise<MemoryWriteResult> {
  const acceptedAt = new Date().toISOString();
  const content = normalizeText(input.content).slice(0, 500);
  const contentHash = sha256(content);

  const remote = await postRemoteJson(
    process.env.CLAWORLD_MEMORY_WRITE_PATH,
    '/memory/{tokenId}/write',
    input.tokenId,
    {
      tokenId: input.tokenId,
      owner: input.owner || null,
      content,
      contentHash,
      memoryRoot: input.memoryRoot || null,
      acceptedAt,
    },
  );
  const normalizedRemote = normalizeRemoteWriteResult(remote, contentHash);
  if (normalizedRemote) return normalizedRemote;

  if (localCmlFallbackEnabled()) {
    return writeLocalMemoryFallback(input.tokenId, content, contentHash, input.memoryRoot);
  }

  return {
    acceptedAt,
    contentHash,
    persisted: false,
    storage: 'none',
    summary: null,
    snapshot: null,
  };
}
