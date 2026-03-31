/**
 * 钱包桥接层 — React (wagmi) ↔ Phaser (EventBus)
 * 读链操作使用 viem publicClient，写操作通过 EventBus 委托 React 层
 */
import { eventBus } from '../EventBus';
import { createPublicClient, http, type Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { addresses, chainId, rpcUrl } from '@/contracts/addresses';

// 从环境配置读取合约地址
export const CONTRACTS = {
  clawNFA:     addresses.clawNFA,
  clawRouter:  addresses.clawRouter,
  taskSkill:   addresses.taskSkill,
  pkSkill:     addresses.pkSkill,
  marketSkill: addresses.marketSkill,
};

// 公共读取客户端（根据 chainId 自动选网络）
export const publicClient = createPublicClient({
  chain: chainId === 56 ? bsc : bscTestnet,
  transport: http(rpcUrl),
});

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
  const result = await publicClient.readContract({
    address: CONTRACTS.clawRouter,
    abi: [{
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
    }],
    functionName: 'getLobsterState',
    args: [BigInt(nfaId)],
  }) as unknown as unknown[];

  const clwBalance = await publicClient.readContract({
    address: CONTRACTS.clawRouter,
    abi: [{ name: 'clwBalances', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }],
    functionName: 'clwBalances',
    args: [BigInt(nfaId)],
  });

  return {
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
  };
}

// ─── Market 读取 ───

export interface MarketListing {
  listingId: number;
  nfaId: number;
  seller: string;
  listingType: number; // 0=fixed, 1=auction, 2=swap
  price: bigint;
  active: boolean;
}

export async function loadMarketListings(): Promise<MarketListing[]> {
  const listings: MarketListing[] = [];

  // 读取 getListing(id) 逐个扫描最近的 listing
  // MarketSkill 没有 getActiveListings 批量接口，需要遍历
  for (let id = 1; id <= 50; id++) {
    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.marketSkill,
        abi: [{
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
              { name: 'endTime', type: 'uint256' },
              { name: 'wantedNfaId', type: 'uint256' },
              { name: 'active', type: 'bool' },
            ],
          }],
        }],
        functionName: 'getListing',
        args: [BigInt(id)],
      }) as unknown as { nfaId: bigint; seller: string; listingType: number; price: bigint; active: boolean };

      if (result.active) {
        listings.push({
          listingId: id,
          nfaId: Number(result.nfaId),
          seller: result.seller,
          listingType: result.listingType,
          price: result.price,
          active: true,
        });
      }
    } catch {
      // listing doesn't exist, stop scanning
      break;
    }
  }

  return listings;
}

// ─── PK 读取 ───

export interface PKMatch {
  matchId: number;
  nfaA: number;
  nfaB: number;
  stake: bigint;
  status: number; // 0=Open, 1=Joined, 2=BothCommitted, 3=Settled, 4=Cancelled
}

export async function loadOpenMatches(): Promise<PKMatch[]> {
  const matches: PKMatch[] = [];

  // 获取总场次
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

  // 从最新的开始往回扫描，找 Open 状态的 (最多扫 30 场)
  const start = Math.max(1, matchCount - 30);
  for (let id = matchCount; id >= start; id--) {
    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.pkSkill,
        abi: [{
          name: 'getMatch',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'matchId', type: 'uint256' }],
          outputs: [{
            type: 'tuple',
            components: [
              { name: 'nfaA', type: 'uint256' },
              { name: 'nfaB', type: 'uint256' },
              { name: 'commitA', type: 'bytes32' },
              { name: 'commitB', type: 'bytes32' },
              { name: 'strategyA', type: 'uint8' },
              { name: 'strategyB', type: 'uint8' },
              { name: 'saltA', type: 'bytes32' },
              { name: 'saltB', type: 'bytes32' },
              { name: 'stake', type: 'uint256' },
              { name: 'status', type: 'uint8' },
              { name: 'winner', type: 'uint256' },
              { name: 'createdAt', type: 'uint256' },
            ],
          }],
        }],
        functionName: 'getMatch',
        args: [BigInt(id)],
      }) as unknown as { nfaA: bigint; nfaB: bigint; stake: bigint; status: number };

      // status 0 = Open (waiting for opponent)
      if (result.status === 0) {
        matches.push({
          matchId: id,
          nfaA: Number(result.nfaA),
          nfaB: 0,
          stake: result.stake,
          status: 0,
        });
      }
    } catch {
      continue;
    }
  }

  return matches;
}

// ─── Bridge 初始化 ───

export function initBridge() {
  eventBus.on('game:ready', () => {
    console.log('[Bridge] Game ready, waiting for wallet...');
  });
}
