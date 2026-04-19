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

const CML_ROOT =
  process.env.OPENCLAW_CML_DIR ||
  process.env.AUTONOMY_CML_DIR ||
  path.join(os.homedir(), '.openclaw', 'claw-world');

function currentCmlPath(tokenId: number) {
  return path.join(CML_ROOT, `nfa-${tokenId}.cml`);
}

function archiveDir(tokenId: number) {
  return path.join(CML_ROOT, 'archive', `nfa-${tokenId}`);
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
