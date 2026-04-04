import { NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  getAddress,
  http,
  keccak256,
  parseAbi,
  type Address,
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { addresses, chainId, rpcUrl } from '@/contracts/addresses';
import {
  getStoredPKRevealRecord,
  saveStoredPKRevealRecord,
  type StoredPKRevealRecord,
  type StoredPKRevealSide,
} from '@/lib/server/pkAutoRevealStore';

export const runtime = 'nodejs';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const RELAYER_KEY = process.env.PK_RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

const pkAbi = parseAbi([
  'function matches(uint256) view returns (uint256 nfaA, uint256 nfaB, bytes32 commitA, bytes32 commitB, uint8 strategyA, uint8 strategyB, uint256 stake, uint8 phase, uint64 phaseTimestamp, bool revealedA, bool revealedB, bytes32 saltA, bytes32 saltB)',
  'function participantAOf(uint256) view returns (address)',
  'function participantBOf(uint256) view returns (address)',
  'function revealBothAndSettle(uint256 matchId, uint8 strategyA, bytes32 saltA, uint8 strategyB, bytes32 saltB)',
  'function settle(uint256 matchId)',
]);

const nfaAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const chain = chainId === 56 ? bsc : bscTestnet;
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });

function normalizePrivateKey(key: string): `0x${string}` {
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

type MatchState = {
  nfaA: number;
  nfaB: number;
  commitA: `0x${string}`;
  commitB: `0x${string}`;
  strategyA: number;
  strategyB: number;
  stake: bigint;
  phase: number;
  phaseTimestamp: number;
  revealedA: boolean;
  revealedB: boolean;
  saltA: `0x${string}`;
  saltB: `0x${string}`;
};

function normalizeMatchState(raw: readonly [
  bigint,
  bigint,
  `0x${string}`,
  `0x${string}`,
  number,
  number,
  bigint,
  number,
  bigint,
  boolean,
  boolean,
  `0x${string}`,
  `0x${string}`,
]): MatchState {
  return {
    nfaA: Number(raw[0]),
    nfaB: Number(raw[1]),
    commitA: raw[2],
    commitB: raw[3],
    strategyA: raw[4],
    strategyB: raw[5],
    stake: raw[6],
    phase: raw[7],
    phaseTimestamp: Number(raw[8]),
    revealedA: raw[9],
    revealedB: raw[10],
    saltA: raw[11],
    saltB: raw[12],
  };
}

async function readParticipantAddress(matchId: number, side: 'A' | 'B', nfaId: number): Promise<Address> {
  try {
    const address = await publicClient.readContract({
      address: addresses.pkSkill,
      abi: pkAbi,
      functionName: side === 'A' ? 'participantAOf' : 'participantBOf',
      args: [BigInt(matchId)],
    });
    if (address && address !== ZERO_ADDRESS) {
      return getAddress(address);
    }
  } catch {
    // Contract may not be upgraded yet; fall back to current owner below.
  }

  if (nfaId <= 0) return ZERO_ADDRESS;

  const owner = await publicClient.readContract({
    address: addresses.clawNFA,
    abi: nfaAbi,
    functionName: 'ownerOf',
    args: [BigInt(nfaId)],
  });
  return getAddress(owner);
}

function buildExpectedCommit(strategy: number, salt: `0x${string}`, walletAddress: Address) {
  return keccak256(encodePacked(['uint8', 'bytes32', 'address'], [strategy, salt, walletAddress]));
}

function parseStoredPayload(body: unknown): StoredPKRevealSide & { matchId: number } {
  const payload = body as {
    matchId?: number;
    nfaId?: number;
    walletAddress?: string;
    strategy?: number;
    salt?: string;
  };

  if (!Number.isInteger(payload.matchId) || (payload.matchId ?? 0) <= 0) {
    throw new Error('Invalid matchId');
  }
  if (!Number.isInteger(payload.nfaId) || (payload.nfaId ?? 0) <= 0) {
    throw new Error('Invalid nfaId');
  }
  if (!Number.isInteger(payload.strategy) || (payload.strategy ?? -1) < 0 || (payload.strategy ?? 9) > 2) {
    throw new Error('Invalid strategy');
  }
  if (typeof payload.walletAddress !== 'string' || !payload.walletAddress.startsWith('0x')) {
    throw new Error('Invalid walletAddress');
  }
  if (typeof payload.salt !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(payload.salt)) {
    throw new Error('Invalid salt');
  }

  const matchId = payload.matchId as number;
  const nfaId = payload.nfaId as number;
  const strategy = payload.strategy as number;
  const walletAddress = payload.walletAddress as string;
  const salt = payload.salt as string;

  return {
    matchId,
    nfaId,
    walletAddress: getAddress(walletAddress),
    strategy,
    salt: salt as `0x${string}`,
    savedAt: Date.now(),
  };
}

async function relayIfReady(record: StoredPKRevealRecord, match: MatchState) {
  if (!record.a || !record.b) {
    return { state: match.phase <= 1 ? 'saved' : 'waiting' } as const;
  }

  if (match.phase >= 4) {
    return { state: 'already-finalized' } as const;
  }

  if (record.relayedTxHash) {
    return { state: 'already-synced', txHash: record.relayedTxHash } as const;
  }

  if (!RELAYER_KEY) {
    return {
      state: 'waiting',
      message: 'PK relayer is not configured yet.',
    } as const;
  }

  const account = privateKeyToAccount(normalizePrivateKey(RELAYER_KEY));
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  let txHash: `0x${string}`;
  if (match.phase === 3) {
    txHash = await walletClient.writeContract({
      address: addresses.pkSkill,
      abi: pkAbi,
      functionName: 'settle',
      args: [BigInt(record.matchId)],
    });
  } else if (match.phase === 2) {
    txHash = await walletClient.writeContract({
      address: addresses.pkSkill,
      abi: pkAbi,
      functionName: 'revealBothAndSettle',
      args: [
        BigInt(record.matchId),
        record.a.strategy,
        record.a.salt,
        record.b.strategy,
        record.b.salt,
      ],
    });
  } else {
    return { state: 'waiting' } as const;
  }

  record.relayedTxHash = txHash;
  record.relayRequestedAt = Date.now();
  record.updatedAt = Date.now();
  await saveStoredPKRevealRecord(record);

  return { state: 'relayed', txHash } as const;
}

export async function POST(request: Request) {
  try {
    const payload = parseStoredPayload(await request.json());

    const rawMatch = await publicClient.readContract({
      address: addresses.pkSkill,
      abi: pkAbi,
      functionName: 'matches',
      args: [BigInt(payload.matchId)],
    }) as readonly [
      bigint,
      bigint,
      `0x${string}`,
      `0x${string}`,
      number,
      number,
      bigint,
      number,
      bigint,
      boolean,
      boolean,
      `0x${string}`,
      `0x${string}`,
    ];
    const match = normalizeMatchState(rawMatch);

    if (match.nfaA === 0) {
      return NextResponse.json({ error: `Match #${payload.matchId} not found` }, { status: 404 });
    }

    const participantA = await readParticipantAddress(payload.matchId, 'A', match.nfaA);
    const participantB = await readParticipantAddress(payload.matchId, 'B', match.nfaB);

    const expectedCommit = buildExpectedCommit(payload.strategy, payload.salt, payload.walletAddress);

    let side: 'a' | 'b' | null = null;
    if (payload.nfaId === match.nfaA && expectedCommit === match.commitA && participantA === payload.walletAddress) {
      side = 'a';
    } else if (payload.nfaId === match.nfaB && expectedCommit === match.commitB && participantB === payload.walletAddress) {
      side = 'b';
    }

    if (!side) {
      return NextResponse.json({
        error: 'Submitted strategy does not match the on-chain commit for this match.',
      }, { status: 400 });
    }

    const existing = await getStoredPKRevealRecord(payload.matchId);
    const record: StoredPKRevealRecord = existing ?? {
      matchId: payload.matchId,
      updatedAt: Date.now(),
    };

    record[side] = {
      nfaId: payload.nfaId,
      walletAddress: payload.walletAddress,
      strategy: payload.strategy,
      salt: payload.salt,
      savedAt: Date.now(),
    };
    record.updatedAt = Date.now();
    await saveStoredPKRevealRecord(record);

    const relay = await relayIfReady(record, match);
    return NextResponse.json(relay);
  } catch (error) {
    console.error('PK auto reveal sync failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'PK auto reveal sync failed',
    }, { status: 500 });
  }
}
