'use client';

import { useReadContract } from 'wagmi';
import { WorldStateABI } from '../abis/WorldState';
import { addresses } from '../addresses';

const worldStateContract = {
  address: addresses.worldState,
  abi: WorldStateABI,
} as const;

export function useRewardMultiplier() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'rewardMultiplier',
  });
}

export function usePkStakeLimit() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'pkStakeLimit',
  });
}

export function useMutationBonus() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'mutationBonus',
  });
}

export function useDailyCostMultiplier() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'dailyCostMultiplier',
  });
}

export function useActiveEvents() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'activeEvents',
  });
}

export function useCLWPrice() {
  return useReadContract({
    ...worldStateContract,
    functionName: 'getCLWPrice',
  });
}
