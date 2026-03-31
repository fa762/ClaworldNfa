/**
 * 钱包桥接层 — React (wagmi) ↔ Phaser (EventBus)
 * 读链操作使用 viem publicClient，写操作通过 EventBus 委托 React 层
 */
import { eventBus } from '../EventBus';
import { createPublicClient, http, type Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { addresses, chainId, rpcUrl } from '@/contracts/addresses';

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

      const listing = result.result as {
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
    let rarity = 0;
    try {
      const state = await loadNFAState(listing.nfaId);
      rarity = state.rarity;
    } catch {
      rarity = 0;
    }
    return { ...listing, rarity };
  }));

  return enriched.sort((a, b) => b.listingId - a.listingId);
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

export async function loadRecentMatches(): Promise<PKMatch[]> {
  const matches: PKMatch[] = [];

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

  const start = Math.max(1, matchCount - 29);
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

      if (match.phase <= 3) {
        matches.push(match);
      }
    }
  }

  return matches;
}

export async function loadOpenMatches(): Promise<PKMatch[]> {
  const matches = await loadRecentMatches();
  return matches.filter((match) => match.phase === 0);
}

// ─── Bridge 初始化 ───

export function initBridge() {
  eventBus.on('game:ready', () => {
    console.log('[Bridge] Game ready, waiting for wallet...');
  });
}
