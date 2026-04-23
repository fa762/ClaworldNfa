/**
 * 钱包桥接层 — React (wagmi) ↔ Phaser (EventBus)
 * 读链操作使用 viem publicClient，写操作通过 EventBus 委托 React 层
 */
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { addresses, chainId, deployBlock, rpcUrl } from '@/contracts/addresses';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BATCH_SIZE = 40;

const LOBSTER_STATE_ABI = [{
  name: 'getLobsterState',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [
    { name: 'rarity', type: 'uint8' },
    { name: 'shelter', type: 'uint8' },
    { name: 'courage', type: 'uint256' },
    { name: 'wisdom', type: 'uint256' },
    { name: 'social', type: 'uint256' },
    { name: 'create_', type: 'uint256' },
    { name: 'grit', type: 'uint256' },
    { name: 'str_', type: 'uint256' },
    { name: 'def_', type: 'uint256' },
    { name: 'spd', type: 'uint256' },
    { name: 'vit', type: 'uint256' },
    { name: 'mutation1', type: 'uint256' },
    { name: 'mutation2', type: 'uint256' },
    { name: 'level', type: 'uint256' },
    { name: 'xp', type: 'uint256' },
    { name: 'lastUpkeepTime', type: 'uint256' },
  ],
}] as const;

const CLW_BALANCE_ABI = [{
  name: 'clwBalances',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '', type: 'uint256' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const IS_ACTIVE_ABI = [{
  name: 'isActive',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'nfaId', type: 'uint256' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

const DAILY_COST_ABI = [{
  name: 'getDailyCost',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'nfaId', type: 'uint256' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const TASK_LAST_TIME_ABI = [{
  name: 'lastTaskTime',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '', type: 'uint256' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

const MARKET_GET_LISTING_ABI = [{
  name: 'getListing',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'listingId', type: 'uint256' }],
  outputs: [{
    type: 'tuple',
    components: [
      { name: 'nfaId', type: 'uint256' },
      { name: 'seller', type: 'address' },
      { name: 'listingType', type: 'uint8' },
      { name: 'price', type: 'uint256' },
      { name: 'highestBid', type: 'uint256' },
      { name: 'highestBidder', type: 'address' },
      { name: 'endTime', type: 'uint64' },
      { name: 'swapTargetId', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  }],
}] as const;

const PK_MATCHES_ABI = [{
  name: 'matches',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '', type: 'uint256' }],
  outputs: [
    { name: 'nfaA', type: 'uint256' },
    { name: 'nfaB', type: 'uint256' },
    { name: 'commitA', type: 'bytes32' },
    { name: 'commitB', type: 'bytes32' },
    { name: 'strategyA', type: 'uint8' },
    { name: 'strategyB', type: 'uint8' },
    { name: 'stake', type: 'uint256' },
    { name: 'phase', type: 'uint8' },
    { name: 'phaseTimestamp', type: 'uint64' },
    { name: 'revealedA', type: 'bool' },
    { name: 'revealedB', type: 'bool' },
    { name: 'saltA', type: 'bytes32' },
    { name: 'saltB', type: 'bytes32' },
  ],
}] as const;

export const CONTRACTS = {
  clawNFA: addresses.clawNFA,
  clawRouter: addresses.clawRouter,
  taskSkill: addresses.taskSkill,
  pkSkill: addresses.pkSkill,
  marketSkill: addresses.marketSkill,
};

export const publicClient = createPublicClient({
  chain: chainId === 56 ? bsc : bscTestnet,
  transport: http(rpcUrl),
});

export interface NFAState {
  rarity: number;
  shelter: number;
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
  str: number;
  def: number;
  spd: number;
  vit: number;
  mutation1: number;
  mutation2: number;
  level: number;
  xp: number;
  clwBalance: number;
  active: boolean;
  dailyCost: number;
}

export interface TaskCooldownState {
  lastTaskTime: number;
  cooldownEndsAt: number;
  remainingSeconds: number;
}

export interface NFASummary {
  tokenId: number;
  rarity: number;
  shelter: number;
  level: number;
  clwBalance: number;
  active: boolean;
  dailyCost: number;
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
}

// ─── NFA 读取 ───

export async function loadPlayerNFAs(ownerAddress: Address): Promise<number[]> {
  const balance = await publicClient.readContract({
    address: CONTRACTS.clawNFA,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [ownerAddress],
  });

  const count = Number(balance);
  if (count === 0) return [];

  const nfaIds: number[] = [];
  for (let i = 0; i < count; i++) {
    const tokenId = await publicClient.readContract({
      address: CONTRACTS.clawNFA,
      abi: [{ name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'tokenOfOwnerByIndex',
      args: [ownerAddress, BigInt(i)],
    });
    nfaIds.push(Number(tokenId));
  }

  return nfaIds;
}

export async function loadNFAState(nfaId: number) {
  const results = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACTS.clawRouter,
        abi: LOBSTER_STATE_ABI,
        functionName: 'getLobsterState',
        args: [BigInt(nfaId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: CLW_BALANCE_ABI,
        functionName: 'clwBalances',
        args: [BigInt(nfaId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: IS_ACTIVE_ABI,
        functionName: 'isActive',
        args: [BigInt(nfaId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: DAILY_COST_ABI,
        functionName: 'getDailyCost',
        args: [BigInt(nfaId)],
      },
    ],
  });

  const result = results[0].result as unknown as readonly unknown[];
  const clwBalance = results[1].result as bigint;
  const isActive = results[2].result as boolean;
  const dailyCost = results[3].result as bigint;

  const state: NFAState = {
    rarity: Number(result[0]),
    shelter: Number(result[1]),
    courage: Number(result[2]),
    wisdom: Number(result[3]),
    social: Number(result[4]),
    create: Number(result[5]),
    grit: Number(result[6]),
    str: Number(result[7]),
    def: Number(result[8]),
    spd: Number(result[9]),
    vit: Number(result[10]),
    mutation1: Number(result[11]),
    mutation2: Number(result[12]),
    level: Number(result[13]),
    xp: Number(result[14]),
    clwBalance: Number(clwBalance) / 1e18,
    active: Boolean(isActive),
    dailyCost: Number(dailyCost) / 1e18,
  };

  return state;
}

export async function loadTaskCooldownState(nfaId: number): Promise<TaskCooldownState> {
  const lastTaskTime = Number(await publicClient.readContract({
    address: CONTRACTS.taskSkill,
    abi: TASK_LAST_TIME_ABI,
    functionName: 'lastTaskTime',
    args: [BigInt(nfaId)],
  }));

  const cooldownEndsAt = lastTaskTime + (4 * 60 * 60);
  const now = Math.floor(Date.now() / 1000);

  return {
    lastTaskTime,
    cooldownEndsAt,
    remainingSeconds: Math.max(0, cooldownEndsAt - now),
  };
}

export async function loadNfaSummaries(tokenIds: number[]): Promise<Record<number, NFASummary>> {
  if (tokenIds.length === 0) {
    return {};
  }

  const summaries: Record<number, NFASummary> = {};

  for (let start = 0; start < tokenIds.length; start += BATCH_SIZE) {
    const batchIds = tokenIds.slice(start, start + BATCH_SIZE);
    const calls = batchIds.flatMap((tokenId) => [
      {
        address: CONTRACTS.clawRouter,
        abi: LOBSTER_STATE_ABI,
        functionName: 'getLobsterState',
        args: [BigInt(tokenId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: CLW_BALANCE_ABI,
        functionName: 'clwBalances',
        args: [BigInt(tokenId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: IS_ACTIVE_ABI,
        functionName: 'isActive',
        args: [BigInt(tokenId)],
      },
      {
        address: CONTRACTS.clawRouter,
        abi: DAILY_COST_ABI,
        functionName: 'getDailyCost',
        args: [BigInt(tokenId)],
      },
    ]);

    const results = await publicClient.multicall({ contracts: calls });

    for (let index = 0; index < batchIds.length; index++) {
      const tokenId = batchIds[index];
      const offset = index * 4;
      const lobsterState = results[offset];
      const clwBalance = results[offset + 1];
      const isActive = results[offset + 2];
      const dailyCost = results[offset + 3];

      if (lobsterState.status !== 'success' || clwBalance.status !== 'success' || isActive.status !== 'success' || dailyCost.status !== 'success') {
        continue;
      }

      const state = lobsterState.result as unknown as readonly unknown[];
      summaries[tokenId] = {
        tokenId,
        rarity: Number(state[0]),
        shelter: Number(state[1]),
        courage: Number(state[2]),
        wisdom: Number(state[3]),
        social: Number(state[4]),
        create: Number(state[5]),
        grit: Number(state[6]),
        level: Number(state[13]),
        clwBalance: Number(clwBalance.result as bigint) / 1e18,
        active: Boolean(isActive.result as boolean),
        dailyCost: Number(dailyCost.result as bigint) / 1e18,
      };
    }
  }

  return summaries;
}

// ─── Market 读取 ───

export interface MarketListing {
  listingId: number;
  nfaId: number;
  seller: string;
  listingType: number; // 0=fixed, 1=auction, 2=swap
  price: bigint;
  highestBid: bigint;
  highestBidder: string;
  endTime: number;
  swapTargetId: number;
  status: number; // 0=active, 1=sold, 2=cancelled
  rarity: number;
}

type RawMarketListing = {
  nfaId: bigint;
  seller: string;
  listingType: number;
  price: bigint;
  highestBid: bigint;
  highestBidder: string;
  endTime: bigint;
  swapTargetId: bigint;
  status: number;
};

function isEmptyListing(listing: {
  nfaId: bigint;
  seller: string;
  price: bigint;
  highestBid: bigint;
  highestBidder: string;
  endTime: bigint;
  swapTargetId: bigint;
  status: number;
}) {
  return (
    listing.nfaId === 0n &&
    listing.seller.toLowerCase() === ZERO_ADDRESS &&
    listing.price === 0n &&
    listing.highestBid === 0n &&
    listing.highestBidder.toLowerCase() === ZERO_ADDRESS &&
    listing.endTime === 0n &&
    listing.swapTargetId === 0n &&
    listing.status === 0
  );
}

async function enrichMarketListing(
  listingId: number,
  listing: RawMarketListing,
): Promise<MarketListing> {
  let rarity = 0;
  try {
    const state = await loadNFAState(Number(listing.nfaId));
    rarity = state.rarity;
  } catch {
    rarity = 0;
  }

  return {
    listingId,
    nfaId: Number(listing.nfaId),
    seller: listing.seller,
    listingType: listing.listingType,
    price: listing.price,
    highestBid: listing.highestBid,
    highestBidder: listing.highestBidder,
    endTime: Number(listing.endTime),
    swapTargetId: Number(listing.swapTargetId),
    status: listing.status,
    rarity,
  };
}

export async function loadMarketListings(): Promise<MarketListing[]> {
  const activeListings: Omit<MarketListing, 'rarity'>[] = [];

  let reachedEnd = false;

  for (let start = 1; start <= 200 && !reachedEnd; start += BATCH_SIZE) {
    const end = Math.min(200, start + BATCH_SIZE - 1);
    const ids = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: CONTRACTS.marketSkill,
        abi: MARKET_GET_LISTING_ABI,
        functionName: 'getListing',
        args: [BigInt(id)],
      })),
    });

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const listingId = ids[index];

      if (result.status !== 'success') {
        reachedEnd = true;
        break;
      }

      const listing = result.result as RawMarketListing;

      if (isEmptyListing(listing)) {
        reachedEnd = true;
        break;
      }

      if (listing.status === 0) {
        activeListings.push({
          listingId,
          nfaId: Number(listing.nfaId),
          seller: listing.seller,
          listingType: listing.listingType,
          price: listing.price,
          highestBid: listing.highestBid,
          highestBidder: listing.highestBidder,
          endTime: Number(listing.endTime),
          swapTargetId: Number(listing.swapTargetId),
          status: listing.status,
        });
      }
    }
  }

  const enriched = await Promise.all(activeListings.map(async (listing) => {
    const enrichedListing = await enrichMarketListing(listing.listingId, {
      nfaId: BigInt(listing.nfaId),
      seller: listing.seller,
      listingType: listing.listingType,
      price: listing.price,
      highestBid: listing.highestBid,
      highestBidder: listing.highestBidder,
      endTime: BigInt(listing.endTime),
      swapTargetId: BigInt(listing.swapTargetId),
      status: listing.status,
    });
    return enrichedListing;
  }));

  return enriched.sort((a, b) => b.listingId - a.listingId);
}

export async function loadMarketListing(listingId: number): Promise<MarketListing | null> {
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return null;
  }

  try {
    const listing = await publicClient.readContract({
      address: CONTRACTS.marketSkill,
      abi: MARKET_GET_LISTING_ABI,
      functionName: 'getListing',
      args: [BigInt(listingId)],
    }) as RawMarketListing;

    if (isEmptyListing(listing)) {
      return null;
    }

    return await enrichMarketListing(listingId, listing);
  } catch {
    return null;
  }
}

// ─── PK 读取 ───

export interface PKMatch {
  matchId: number;
  nfaA: number;
  nfaB: number;
  strategyA: number;
  strategyB: number;
  stake: bigint;
  phase: number; // 0=open,1=joined,2=committed,3=revealed,4=settled,5=cancelled
  phaseTimestamp: number;
  revealedA: boolean;
  revealedB: boolean;
}

export interface PKMatchSettlement {
  type: 'settled';
  matchId: number;
  winnerNfaId: number;
  loserNfaId: number;
  reward: bigint;
  burned: bigint;
  blockNumber: number;
  transactionHash: `0x${string}`;
}

export interface PKMatchCancellation {
  type: 'cancelled';
  matchId: number;
  blockNumber: number;
  transactionHash: `0x${string}`;
}

export type PKMatchResolution = PKMatchSettlement | PKMatchCancellation;

type LoadMatchesOptions = {
  includeClosed?: boolean;
  maxCount?: number;
};

const PK_MATCH_SETTLED_EVENT = parseAbiItem(
  'event MatchSettled(uint256 indexed matchId, uint256 indexed winner, uint256 indexed loser, uint256 reward, uint256 burned)',
);

const PK_MATCH_CANCELLED_EVENT = parseAbiItem(
  'event MatchCancelled(uint256 indexed matchId)',
);
const LOG_CHUNK_SIZE = 1500n;
const MIN_LOG_CHUNK_SIZE = 200n;

type SettledMatchLog = {
  args: {
    winner?: bigint;
    loser?: bigint;
    reward?: bigint;
    burned?: bigint;
  };
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
};

type CancelledMatchLog = {
  blockNumber: bigint | null;
  transactionHash: `0x${string}` | null;
};

async function findLatestPkLogInChunks(params: {
  event: typeof PK_MATCH_SETTLED_EVENT | typeof PK_MATCH_CANCELLED_EVENT;
  matchId: bigint;
}) {
  const latestBlock = await publicClient.getBlockNumber();
  let toBlock = latestBlock;
  let chunkSize = LOG_CHUNK_SIZE;

  while (toBlock >= deployBlock) {
    const fromBlock = toBlock > chunkSize ? toBlock - chunkSize : deployBlock;
    let chunk;

    try {
      chunk = await publicClient.getLogs({
        address: CONTRACTS.pkSkill,
        event: params.event,
        args: { matchId: params.matchId },
        fromBlock,
        toBlock,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('limit exceeded') && chunkSize > MIN_LOG_CHUNK_SIZE) {
        chunkSize = chunkSize > MIN_LOG_CHUNK_SIZE * 2n ? chunkSize / 2n : MIN_LOG_CHUNK_SIZE;
        continue;
      }
      throw error;
    }

    if (chunk.length > 0) {
      return chunk.at(-1) ?? null;
    }
    if (fromBlock === deployBlock) break;
    toBlock = fromBlock - 1n;
  }

  return null;
}

async function findPkLogNearPhase(params: {
  event: typeof PK_MATCH_SETTLED_EVENT | typeof PK_MATCH_CANCELLED_EVENT;
  matchId: bigint;
  phaseTimestamp?: number;
}) {
  if (!params.phaseTimestamp || params.phaseTimestamp <= 0) {
    return null;
  }

  const latestBlock = await publicClient.getBlock();
  const latestTimestamp = Number(latestBlock.timestamp);
  const phaseAgeSeconds = Math.max(0, latestTimestamp - params.phaseTimestamp);
  const approxBlocksAgo = Math.ceil(phaseAgeSeconds / 3);
  let chunkSize = BigInt(Math.max(2500, Math.min(25000, approxBlocksAgo + 4000)));
  let toBlock = latestBlock.number;
  const minFromBlock = latestBlock.number > BigInt(approxBlocksAgo + 12000)
    ? latestBlock.number - BigInt(approxBlocksAgo + 12000)
    : deployBlock;

  while (toBlock >= minFromBlock) {
    const fromBlock = toBlock > chunkSize ? toBlock - chunkSize : minFromBlock;
    let chunk;

    try {
      chunk = await publicClient.getLogs({
        address: CONTRACTS.pkSkill,
        event: params.event,
        args: { matchId: params.matchId },
        fromBlock,
        toBlock,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('limit exceeded') && chunkSize > MIN_LOG_CHUNK_SIZE) {
        chunkSize = chunkSize > MIN_LOG_CHUNK_SIZE * 2n ? chunkSize / 2n : MIN_LOG_CHUNK_SIZE;
        continue;
      }
      return null;
    }

    if (chunk.length > 0) {
      return chunk.at(-1) ?? null;
    }

    if (fromBlock === minFromBlock) break;
    toBlock = fromBlock - 1n;
  }

  return null;
}

export async function loadMatch(matchId: number): Promise<PKMatch | null> {
  try {
    const result = await publicClient.readContract({
      address: CONTRACTS.pkSkill,
      abi: PK_MATCHES_ABI,
      functionName: 'matches',
      args: [BigInt(matchId)],
    }) as unknown as [
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

    if (result[0] === 0n) {
      return null;
    }

    return {
      matchId,
      nfaA: Number(result[0]),
      nfaB: Number(result[1]),
      strategyA: result[4],
      strategyB: result[5],
      stake: result[6],
      phase: result[7],
      phaseTimestamp: Number(result[8]),
      revealedA: result[9],
      revealedB: result[10],
    };
  } catch {
    return null;
  }
}

export async function loadRecentMatches(options: LoadMatchesOptions = {}): Promise<PKMatch[]> {
  const matches: PKMatch[] = [];
  const includeClosed = options.includeClosed ?? true;

  let matchCount = 0;
  try {
    const count = await publicClient.readContract({
      address: CONTRACTS.pkSkill,
      abi: [{ name: 'getMatchCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'getMatchCount',
    });
    matchCount = Number(count);
  } catch {
    return matches;
  }

  const maxCount = options.maxCount && options.maxCount > 0
    ? Math.min(matchCount, options.maxCount)
    : matchCount;
  const start = Math.max(1, matchCount - maxCount + 1);
  const ids = Array.from({ length: matchCount - start + 1 }, (_, index) => matchCount - index);

  for (let batchStart = 0; batchStart < ids.length; batchStart += BATCH_SIZE) {
    const batchIds = ids.slice(batchStart, batchStart + BATCH_SIZE);
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: batchIds.map((id) => ({
        address: CONTRACTS.pkSkill,
        abi: PK_MATCHES_ABI,
        functionName: 'matches',
        args: [BigInt(id)],
      })),
    });

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status !== 'success') continue;

      const raw = result.result as [
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

      if (raw[0] === 0n) continue;

      const match: PKMatch = {
        matchId: batchIds[index],
        nfaA: Number(raw[0]),
        nfaB: Number(raw[1]),
        strategyA: raw[4],
        strategyB: raw[5],
        stake: raw[6],
        phase: raw[7],
        phaseTimestamp: Number(raw[8]),
        revealedA: raw[9],
        revealedB: raw[10],
      };

      if (includeClosed || match.phase <= 3) {
        matches.push(match);
      }
    }
  }

  return matches;
}

export async function loadOpenMatches(): Promise<PKMatch[]> {
  const matches = await loadRecentMatches({ includeClosed: false });
  return matches.filter((match) => match.phase === 0);
}

export async function loadMatchResolution(matchId: number, phaseTimestamp?: number): Promise<PKMatchResolution | null> {
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return null;
  }

  try {
    const [nearSettledLog, nearCancelledLog] = await Promise.all([
      findPkLogNearPhase({
        event: PK_MATCH_SETTLED_EVENT,
        matchId: BigInt(matchId),
        phaseTimestamp,
      }),
      findPkLogNearPhase({
        event: PK_MATCH_CANCELLED_EVENT,
        matchId: BigInt(matchId),
        phaseTimestamp,
      }),
    ]);

    const [settledLogs, cancelledLogs] = nearSettledLog || nearCancelledLog
      ? [nearSettledLog, nearCancelledLog]
      : await Promise.all([
          findLatestPkLogInChunks({
            event: PK_MATCH_SETTLED_EVENT,
            matchId: BigInt(matchId),
          }),
          findLatestPkLogInChunks({
            event: PK_MATCH_CANCELLED_EVENT,
            matchId: BigInt(matchId),
          }),
        ]);

    const settledLog = settledLogs as SettledMatchLog | null;
    if (settledLog) {
      const winner = settledLog.args.winner;
      const loser = settledLog.args.loser;
      const reward = settledLog.args.reward;
      const burned = settledLog.args.burned;
      const transactionHash = settledLog.transactionHash;
      if (winner === undefined || loser === undefined || reward === undefined || burned === undefined || !transactionHash || settledLog.blockNumber === null) {
        return null;
      }
      return {
        type: 'settled',
        matchId,
        winnerNfaId: Number(winner),
        loserNfaId: Number(loser),
        reward,
        burned,
        blockNumber: Number(settledLog.blockNumber),
        transactionHash,
      };
    }

    const cancelledLog = cancelledLogs as CancelledMatchLog | null;
    if (cancelledLog && cancelledLog.blockNumber !== null && cancelledLog.transactionHash) {
      return {
        type: 'cancelled',
        matchId,
        blockNumber: Number(cancelledLog.blockNumber),
        transactionHash: cancelledLog.transactionHash,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ─── Bridge 初始化 ───

export function initBridge() {
}
