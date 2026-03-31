/**
 * 合约写操作封装 — React 层通过 wagmi writeContract 调用
 * 每个函数返回合约调用参数，由 React 组件负责签名发送
 */
import { type Address, encodePacked, keccak256, parseEther } from 'viem';
import { addresses } from '@/contracts/addresses';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { MarketSkillABI } from '@/contracts/abis/MarketSkill';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';

// ─── Task ───

export function taskSubmitArgs(nfaId: number, taskType: number, xp: number, clw: number, matchScore: number) {
  return {
    address: addresses.taskSkill as Address,
    abi: TaskSkillABI,
    functionName: 'ownerCompleteTypedTask' as const,
    args: [BigInt(nfaId), taskType, xp, parseEther(String(clw)), matchScore] as const,
    gas: 500_000n,
  };
}

// ─── PK ───

/** 生成链上 PK commit：keccak256(abi.encodePacked(strategy, salt, owner)) */
export function generateCommit(strategy: number, owner: Address): { commitHash: `0x${string}`; salt: `0x${string}` } {
  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  const salt = ('0x' + Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
  const commitHash = keccak256(encodePacked(['uint8', 'bytes32', 'address'], [strategy, salt, owner]));
  return { commitHash, salt };
}

/** 保存 PK salt 到 localStorage（reveal 时需要） */
export function savePKSalt(matchId: number, strategy: number, salt: string) {
  const key = `claw-pk-${matchId}`;
  localStorage.setItem(key, JSON.stringify({ strategy, salt, ts: Date.now() }));
}

/** 读取 PK salt */
export function loadPKSalt(matchId: number): { strategy: number; salt: string } | null {
  const key = `claw-pk-${matchId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function pkCreateArgs(nfaId: number, stake: bigint, commitHash: `0x${string}`) {
  return {
    address: addresses.pkSkill as Address,
    abi: PKSkillABI,
    functionName: 'createMatchWithCommit' as const,
    args: [BigInt(nfaId), stake, commitHash] as const,
    gas: 300_000n,
  };
}

export function pkJoinArgs(matchId: number, nfaId: number, commitHash: `0x${string}`) {
  return {
    address: addresses.pkSkill as Address,
    abi: PKSkillABI,
    functionName: 'joinMatchWithCommit' as const,
    args: [BigInt(matchId), BigInt(nfaId), commitHash] as const,
    gas: 300_000n,
  };
}

export function pkRevealArgs(matchId: number, strategy: number, salt: `0x${string}`) {
  return {
    address: addresses.pkSkill as Address,
    abi: PKSkillABI,
    functionName: 'revealStrategy' as const,
    args: [BigInt(matchId), strategy, salt] as const,
    gas: 300_000n,
  };
}

export function pkSettleArgs(matchId: number) {
  return {
    address: addresses.pkSkill as Address,
    abi: PKSkillABI,
    functionName: 'settle' as const,
    args: [BigInt(matchId)] as const,
    gas: 500_000n,
  };
}

export function pkCancelArgs(matchId: number, phase: number) {
  const functionName = phase === 0
    ? 'cancelMatch'
    : phase === 1
      ? 'cancelJoinedMatch'
      : 'cancelCommittedMatch';

  return {
    address: addresses.pkSkill as Address,
    abi: PKSkillABI,
    functionName: functionName as 'cancelMatch' | 'cancelJoinedMatch' | 'cancelCommittedMatch',
    args: [BigInt(matchId)] as const,
    gas: 300_000n,
  };
}

export function processUpkeepArgs(nfaId: number) {
  return {
    address: addresses.clawRouter as Address,
    abi: ClawRouterABI,
    functionName: 'processUpkeep' as const,
    args: [BigInt(nfaId)] as const,
    gas: 250_000n,
  };
}

// ─── Market ───

export function marketBuyArgs(listingId: number, price: bigint) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'buyFixedPrice' as const,
    args: [BigInt(listingId)] as const,
    value: price,
    gas: 300_000n,
  };
}

export function marketListArgs(nfaId: number, price: bigint) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'listFixedPrice' as const,
    args: [BigInt(nfaId), price] as const,
    gas: 300_000n,
  };
}

export function marketAuctionArgs(nfaId: number, startPrice: bigint) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'listAuction' as const,
    args: [BigInt(nfaId), startPrice] as const,
    gas: 300_000n,
  };
}

export function marketSwapArgs(nfaId: number, targetNfaId: number) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'listSwap' as const,
    args: [BigInt(nfaId), BigInt(targetNfaId)] as const,
    gas: 300_000n,
  };
}

export function marketBidArgs(listingId: number, amount: bigint) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'bid' as const,
    args: [BigInt(listingId)] as const,
    value: amount,
    gas: 300_000n,
  };
}

export function marketSettleAuctionArgs(listingId: number) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'settleAuction' as const,
    args: [BigInt(listingId)] as const,
    gas: 400_000n,
  };
}

export function marketCancelArgs(listingId: number) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'cancelListing' as const,
    args: [BigInt(listingId)] as const,
    gas: 300_000n,
  };
}

export function marketAcceptSwapArgs(listingId: number) {
  return {
    address: addresses.marketSkill as Address,
    abi: MarketSkillABI,
    functionName: 'acceptSwap' as const,
    args: [BigInt(listingId)] as const,
    gas: 350_000n,
  };
}

/** NFA approve 给 MarketSkill（挂售前需要） */
export function nfaApproveArgs(nfaId: number) {
  return {
    address: addresses.clawNFA as Address,
    abi: ClawNFAABI,
    functionName: 'approve' as const,
    args: [addresses.marketSkill as Address, BigInt(nfaId)] as const,
    gas: 100_000n,
  };
}
