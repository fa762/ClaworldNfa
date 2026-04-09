import fs from 'fs';
import path from 'path';

export type StoredAutonomyDirectiveStyle = 'tight' | 'balanced' | 'expressive';

export type StoredAutonomyDirectiveRecord = {
  tokenId: number;
  actionKind: number;
  style: StoredAutonomyDirectiveStyle;
  text: string;
  updatedAt: number;
  updatedBy?: string;
};

type StoreShape = {
  records: StoredAutonomyDirectiveRecord[];
};

const STORE_FILE = path.join(process.cwd(), '.cache', 'autonomy-directives.json');

function normalizeRecord(value: unknown): StoredAutonomyDirectiveRecord | null {
  const record = value as Partial<StoredAutonomyDirectiveRecord> | null;
  if (!record) return null;
  if (!Number.isInteger(record.tokenId) || (record.tokenId ?? 0) <= 0) return null;
  if (!Number.isInteger(record.actionKind) || (record.actionKind ?? -1) < 0) return null;
  if (record.style !== 'tight' && record.style !== 'balanced' && record.style !== 'expressive') return null;
  if (typeof record.text !== 'string') return null;
  if (!Number.isFinite(record.updatedAt)) return null;

  return {
    tokenId: record.tokenId!,
    actionKind: record.actionKind!,
    style: record.style,
    text: record.text.slice(0, 220),
    updatedAt: record.updatedAt!,
    updatedBy: typeof record.updatedBy === 'string' ? record.updatedBy : undefined,
  };
}

function readStore(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { records?: unknown[] };
    return {
      records: Array.isArray(parsed.records)
        ? parsed.records.map(normalizeRecord).filter((value): value is StoredAutonomyDirectiveRecord => Boolean(value))
        : [],
    };
  } catch {
    return { records: [] };
  }
}

function writeStore(store: StoreShape) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function getStoredAutonomyDirective(tokenId: number, actionKind: number): StoredAutonomyDirectiveRecord | null {
  const store = readStore();
  return store.records.find((record) => record.tokenId === tokenId && record.actionKind === actionKind) ?? null;
}

export function saveStoredAutonomyDirective(record: StoredAutonomyDirectiveRecord): StoredAutonomyDirectiveRecord {
  const normalized = normalizeRecord(record);
  if (!normalized) {
    throw new Error('Invalid autonomy directive record');
  }

  const store = readStore();
  const next = store.records.filter(
    (item) => !(item.tokenId === normalized.tokenId && item.actionKind === normalized.actionKind)
  );
  next.push(normalized);
  writeStore({ records: next.sort((a, b) => a.tokenId - b.tokenId || a.actionKind - b.actionKind) });
  return normalized;
}
