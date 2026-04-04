import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type StoredPKRevealSide = {
  nfaId: number;
  walletAddress: `0x${string}`;
  strategy: number;
  salt: `0x${string}`;
  savedAt: number;
};

export type StoredPKRevealRecord = {
  matchId: number;
  a?: StoredPKRevealSide;
  b?: StoredPKRevealSide;
  relayedTxHash?: `0x${string}`;
  relayRequestedAt?: number;
  updatedAt: number;
};

const STORE_FILE = path.join(process.cwd(), '.cache', 'pk-auto-reveal.json');
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

function kvKey(matchId: number) {
  return `pk:auto-reveal:${matchId}`;
}

function hasKvConfig() {
  return Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);
}

async function kvGet(matchId: number): Promise<StoredPKRevealRecord | null> {
  const response = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(kvKey(matchId))}`, {
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`KV get failed with ${response.status}`);
  }

  const json = await response.json() as { result?: string | null };
  if (!json.result) return null;

  const raw = Buffer.from(json.result, 'base64url').toString('utf8');
  return JSON.parse(raw) as StoredPKRevealRecord;
}

async function kvSet(record: StoredPKRevealRecord): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(record), 'utf8').toString('base64url');
  const response = await fetch(
    `${KV_REST_API_URL}/set/${encodeURIComponent(kvKey(record.matchId))}/${encodeURIComponent(encoded)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`KV set failed with ${response.status}`);
  }
}

async function fileGet(matchId: number): Promise<StoredPKRevealRecord | null> {
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    const store = JSON.parse(raw) as Record<string, StoredPKRevealRecord>;
    return store[String(matchId)] ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function fileSet(record: StoredPKRevealRecord): Promise<void> {
  const dir = path.dirname(STORE_FILE);
  await mkdir(dir, { recursive: true });

  let store: Record<string, StoredPKRevealRecord> = {};
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    store = JSON.parse(raw) as Record<string, StoredPKRevealRecord>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  store[String(record.matchId)] = record;
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export async function getStoredPKRevealRecord(matchId: number): Promise<StoredPKRevealRecord | null> {
  return hasKvConfig() ? kvGet(matchId) : fileGet(matchId);
}

export async function saveStoredPKRevealRecord(record: StoredPKRevealRecord): Promise<void> {
  if (hasKvConfig()) {
    await kvSet(record);
    return;
  }
  await fileSet(record);
}
