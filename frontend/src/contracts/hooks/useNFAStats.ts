import { useReadContract } from 'wagmi';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { addresses } from '@/contracts/addresses';

const isDeployed = !!addresses.clawNFA;

export function useTaskStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: addresses.taskSkill,
    abi: TaskSkillABI,
    functionName: 'getTaskStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function usePkStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: addresses.pkSkill,
    abi: PKSkillABI,
    functionName: 'getPkStats',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}
