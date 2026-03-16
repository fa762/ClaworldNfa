'use client';

import { useReadContract } from 'wagmi';
import { ClawRouterABI } from '../abis/ClawRouter';
import { addresses } from '../addresses';
import { zeroAddress } from 'viem';

const routerContract = {
  address: addresses.clawRouter,
  abi: ClawRouterABI,
} as const;

const isDeployed = !!addresses.clawRouter && addresses.clawRouter !== zeroAddress;

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
    ...routerContract,
    functionName: 'graduated',
    query: { enabled: isDeployed },
  });
}
