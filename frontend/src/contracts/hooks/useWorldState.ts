'use client';

import { useReadContract } from 'wagmi';
import { WorldStateABI } from '../abis/WorldState';
import { addresses } from '../addresses';
import { zeroAddress } from 'viem';

const worldStateContract = {
  address: addresses.worldState,
  abi: WorldStateABI,
} as const;

const isDeployed = !!addresses.worldState && addresses.worldState !== zeroAddress;

export function useRewardMultiplier() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'rewardMultiplier',
    query: { enabled: isDeployed },
  });
}

export function usePkStakeLimit() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'pkStakeLimit',
    query: { enabled: isDeployed },
  });
}

export function useMutationBonus() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'mutationBonus',
    query: { enabled: isDeployed },
  });
}

export function useDailyCostMultiplier() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'dailyCostMultiplier',
    query: { enabled: isDeployed },
  });
}

export function useActiveEvents() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'activeEvents',
    query: { enabled: isDeployed },
  });
}

export function useCLWPrice() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'getCLWPrice',
    query: { enabled: isDeployed },
  });
}
