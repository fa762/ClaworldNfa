'use client';

export type TerminalMemorySummary = {
  latestSnapshotHash: string;
  latestAnchorTxHash: string | null;
  pulse: number;
  hippocampusSize: number;
  identity: string;
  prefrontalBeliefs: string[];
  basalHabits: string[];
};

export type TerminalMemorySnapshot = {
  snapshotId: string;
  hash: string;
  consolidatedAt: string;
  anchorTxHash: string | null;
  greenfieldUri: string | null;
  diffSummary: string;
  hippocampusMerged: number;
};

export type LocalMemoryEntry = {
  id: string;
  content: string;
  createdAt: string;
  memoryRoot: string | null;
  txHash: string | null;
  storage: 'browser' | 'backend' | 'local';
};

type LocalMemoryEnvelope = {
  version: 1;
  entries: LocalMemoryEntry[];
};

const LOCAL_MEMORY_VERSION = 1;
const MAX_LOCAL_ENTRIES = 24;

function storageKey(tokenId?: string, owner?: string) {
  if (!tokenId || !owner) return null;
  return `clawworld-memory-local:${owner.toLowerCase()}:${tokenId}`;
}

function clampText(value: string, limit = 240) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function readEnvelope(key: string | null) {
  if (!key || typeof window === 'undefined') return { version: LOCAL_MEMORY_VERSION, entries: [] } satisfies LocalMemoryEnvelope;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { version: LOCAL_MEMORY_VERSION, entries: [] } satisfies LocalMemoryEnvelope;
    const parsed = JSON.parse(raw) as Partial<LocalMemoryEnvelope>;
    if (parsed.version !== LOCAL_MEMORY_VERSION || !Array.isArray(parsed.entries)) {
      return { version: LOCAL_MEMORY_VERSION, entries: [] } satisfies LocalMemoryEnvelope;
    }
    return {
      version: LOCAL_MEMORY_VERSION,
      entries: parsed.entries.filter((entry): entry is LocalMemoryEntry => {
        return (
          Boolean(entry) &&
          typeof entry.id === 'string' &&
          typeof entry.content === 'string' &&
          typeof entry.createdAt === 'string' &&
          (entry.memoryRoot === null || typeof entry.memoryRoot === 'string') &&
          (entry.txHash === null || typeof entry.txHash === 'string') &&
          (entry.storage === 'browser' || entry.storage === 'backend' || entry.storage === 'local')
        );
      }),
    };
  } catch {
    return { version: LOCAL_MEMORY_VERSION, entries: [] } satisfies LocalMemoryEnvelope;
  }
}

function writeEnvelope(key: string | null, envelope: LocalMemoryEnvelope) {
  if (!key || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(envelope));
}

export function readLocalMemoryEntries(tokenId?: string, owner?: string) {
  return readEnvelope(storageKey(tokenId, owner)).entries;
}

export function appendLocalMemoryEntry(
  tokenId: string,
  owner: string,
  entry: Omit<LocalMemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
) {
  const key = storageKey(tokenId, owner);
  const envelope = readEnvelope(key);
  const next: LocalMemoryEntry = {
    id: entry.id || `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: entry.createdAt || new Date().toISOString(),
    content: entry.content.trim().slice(0, 500),
    memoryRoot: entry.memoryRoot ?? null,
    txHash: entry.txHash ?? null,
    storage: entry.storage,
  };
  const merged = [...envelope.entries, next]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_LOCAL_ENTRIES);
  writeEnvelope(key, { version: LOCAL_MEMORY_VERSION, entries: merged });
  return next;
}

export function updateLocalMemoryEntry(
  tokenId: string,
  owner: string,
  entryId: string,
  patch: Partial<Omit<LocalMemoryEntry, 'id' | 'createdAt' | 'content'>>,
) {
  const key = storageKey(tokenId, owner);
  const envelope = readEnvelope(key);
  const nextEntries = envelope.entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          memoryRoot: patch.memoryRoot ?? entry.memoryRoot,
          txHash: patch.txHash ?? entry.txHash,
          storage: patch.storage ?? entry.storage,
        }
      : entry,
  );
  writeEnvelope(key, { version: LOCAL_MEMORY_VERSION, entries: nextEntries });
}

export function mergeMemoryState(
  remoteSummary: TerminalMemorySummary | null,
  remoteTimeline: TerminalMemorySnapshot[],
  localEntries: LocalMemoryEntry[],
) {
  const localTimeline: TerminalMemorySnapshot[] = localEntries.map((entry) => ({
    snapshotId: entry.id,
    hash: entry.memoryRoot || entry.id,
    consolidatedAt: entry.createdAt,
    anchorTxHash: entry.txHash,
    greenfieldUri: null,
    diffSummary: `本地记忆：${clampText(entry.content)}`,
    hippocampusMerged: 0,
  }));

  const mergedTimeline = [...localTimeline, ...remoteTimeline]
    .sort((left, right) => right.consolidatedAt.localeCompare(left.consolidatedAt))
    .filter((item, index, items) => items.findIndex((entry) => entry.snapshotId === item.snapshotId) === index);

  const latestLocal = localEntries[0];
  const mergedSummary: TerminalMemorySummary | null = latestLocal
    ? {
        latestSnapshotHash: latestLocal.memoryRoot || remoteSummary?.latestSnapshotHash || latestLocal.id,
        latestAnchorTxHash: latestLocal.txHash || remoteSummary?.latestAnchorTxHash || null,
        pulse: remoteSummary?.pulse ?? 0,
        hippocampusSize: remoteSummary?.hippocampusSize ?? 0,
        identity: latestLocal.content,
        prefrontalBeliefs: remoteSummary?.prefrontalBeliefs ?? [],
        basalHabits: remoteSummary?.basalHabits ?? [],
      }
    : remoteSummary;

  return {
    summary: mergedSummary,
    timeline: mergedTimeline,
  };
}
