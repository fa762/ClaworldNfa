import { useReadContract } from 'wagmi';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { addresses } from '@/contracts/addresses';

const isDeployed = !!addresses.clawNFA;

export function useTaskStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: process.env.NEXT_PUBLIC_TASKSKILL_ADDRESS as `0x${string}` || '0x4F8f75D6b0775b065F588F2C11C1Ec79Bb1ECE0E',
    abi: TaskSkillABI,
    functionName: 'getTaskStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function usePkStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: process.env.NEXT_PUBLIC_PKSKILL_ADDRESS as `0x${string}` || '0x0e76D541e49FDcB5ac754b1Cc38b98c60f95839A',
    abi: PKSkillABI,
    functionName: 'getPkStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}
