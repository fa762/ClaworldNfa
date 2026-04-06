'use client';

import { useReadContract } from 'wagmi';
import { ClawRouterABI } from '../abis/ClawRouter';
import { DepositRouterABI } from '../abis/DepositRouter';
import { addresses } from '../addresses';
import { zeroAddress } from 'viem';

const routerContract = {
  address: addresses.clawRouter,
  abi: ClawRouterABI,
} as const;

const depositRouterContract = {
  address: addresses.depositRouter,
  abi: DepositRouterABI,
} as const;

const isDeployed = !!addresses.clawRouter && addresses.clawRouter !== zeroAddress;
const isDepositRouterDeployed = !!addresses.depositRouter && addresses.depositRouter !== zeroAddress;

export function useLobsterState(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'getLobsterState',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useClwBalance(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'clwBalances',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useDailyCost(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'getDailyCost',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useJobClass(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'getJobClass',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useIsActive(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'isActive',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useGraduated() {
  return useReadContract({
    ...depositRouterContract,
    functionName: 'graduated',
    query: { enabled: isDepositRouterDeployed },
  });
}

export function useWithdrawRequest(tokenId: bigint | undefined) {
  return useReadContract({
    ...routerContract,
    functionName: 'withdrawRequests',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined, refetchInterval: 3000 },
  });
}

export function useWithdrawCooldown() {
  return useReadContract({
    ...routerContract,
    functionName: 'WITHDRAW_COOLDOWN',
    query: { enabled: isDeployed },
  });
}
