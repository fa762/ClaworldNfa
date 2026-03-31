/**
 * 钱包桥接层 — React (wagmi) ↔ Phaser (EventBus)
 * 在 React 组件中调用，将钱包状态和合约调用桥接到 Phaser 场景
 */
import { eventBus } from '../EventBus';
import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';

// 合约地址（主网）
export const CONTRACTS = {
  clawNFA:     '0xAa2094798B5892191124eae9D77E337544FFAE48' as Address,
  clawRouter:  '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5' as Address,
  taskSkill:   '0xaed370784536e31BE4A5D0Dbb1bF275c98179D10' as Address,
  pkSkill:     '0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF' as Address,
  marketSkill: '0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54' as Address,
};

// 公共读取客户端
export const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed1.bnbchain.org'),
});

/**
 * 读取玩家拥有的 NFA 列表
 */
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

/**
 * 读取 NFA 基本状态
 */
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

/**
 * 初始化桥接：监听 Phaser 事件，调用合约
 */
export function initBridge() {
  // Phaser 请求数据时的处理在 React 组件中绑定
  eventBus.on('game:ready', () => {
    console.log('[Bridge] Game ready, waiting for wallet...');
  });
}
