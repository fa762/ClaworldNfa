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
const KV_REST_API_URL = (process.env.KV_REST_API_URL || process.env.AUTONOMY_DIRECTIVE_KV_REST_API_URL || '').trim();
const KV_REST_API_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.AUTONOMY_DIRECTIVE_KV_REST_API_TOKEN || '').trim();
const STORE_KEY = (process.env.AUTONOMY_DIRECTIVE_STORE_KEY || 'autonomy:directives').trim() || 'autonomy:directives';

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

function normalizeStore(value: unknown): StoreShape {
  const parsed = value as { records?: unknown[] } | null;
  return {
    records: Array.isArray(parsed?.records)
      ? parsed.records.map(normalizeRecord).filter((record): record is StoredAutonomyDirectiveRecord => Boolean(record))
      : [],
  };
}

function hasKvConfig() {
  return Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);
}

async function kvReadStore(): Promise<StoreShape> {
  const response = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(STORE_KEY)}`, {
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`KV get failed with ${response.status}`);
  }

  const json = (await response.json()) as { result?: string | null };
  if (!json.result) return { records: [] };

  const raw = Buffer.from(json.result, 'base64url').toString('utf8');
  return normalizeStore(JSON.parse(raw));
}

async function kvWriteStore(store: StoreShape): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(store), 'utf8').toString('base64url');
  const response = await fetch(
    `${KV_REST_API_URL}/set/${encodeURIComponent(STORE_KEY)}/${encodeURIComponent(encoded)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`KV set failed with ${response.status}`);
  }
}

async function fileReadStore(): Promise<StoreShape> {
  try {
    const raw = await fs.promises.readFile(STORE_FILE, 'utf8');
    return normalizeStore(JSON.parse(stripUtf8Bom(raw)));
  } catch {
    return { records: [] };
  }
}

async function fileWriteStore(store: StoreShape): Promise<void> {
  await fs.promises.mkdir(path.dirname(STORE_FILE), { recursive: true });
  await fs.promises.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function stripUtf8Bom(raw: string) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

async function readStore(): Promise<StoreShape> {
  return hasKvConfig() ? kvReadStore() : fileReadStore();
}

async function writeStore(store: StoreShape): Promise<void> {
  if (hasKvConfig()) {
    await kvWriteStore(store);
    return;
  }
  await fileWriteStore(store);
}

export async function getStoredAutonomyDirective(
  tokenId: number,
  actionKind: number
): Promise<StoredAutonomyDirectiveRecord | null> {
  const store = await readStore();
  return store.records.find((record) => record.tokenId === tokenId && record.actionKind === actionKind) ?? null;
}

export async function saveStoredAutonomyDirective(
  record: StoredAutonomyDirectiveRecord
): Promise<StoredAutonomyDirectiveRecord> {
  const normalized = normalizeRecord(record);
  if (!normalized) {
    throw new Error('Invalid autonomy directive record');
  }

  const store = await readStore();
  const next = store.records.filter(
    (item) => !(item.tokenId === normalized.tokenId && item.actionKind === normalized.actionKind)
  );
  next.push(normalized);
  const sortedStore = { records: next.sort((a, b) => a.tokenId - b.tokenId || a.actionKind - b.actionKind) };
  await writeStore(sortedStore);
  return normalized;
}
