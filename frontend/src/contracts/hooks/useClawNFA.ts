'use client';

import { useReadContract } from 'wagmi';
import { ClawNFAABI } from '../abis/ClawNFA';
import { addresses } from '../addresses';
import { type Address, zeroAddress } from 'viem';

const nfaContract = {
  address: addresses.clawNFA,
  abi: ClawNFAABI,
} as const;

const isDeployed = !!addresses.clawNFA && addresses.clawNFA !== zeroAddress;

export function useTotalSupply() {
  return useReadContract({
    ...nfaContract,
    functionName: 'getTotalSupply',
    query: { enabled: isDeployed },
  });
}

export function useAgentState(tokenId: bigint | undefined) {
  return useReadContract({
    ...nfaContract,
    functionName: 'getAgentState',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useAgentMetadata(tokenId: bigint | undefined) {
  return useReadContract({
    ...nfaContract,
    functionName: 'getAgentMetadata',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}

export function useTokensOfOwner(owner: Address | undefined) {
  return useReadContract({
    ...nfaContract,
    functionName: 'tokensOfOwner',
    args: owner ? [owner] : undefined,
    query: { enabled: isDeployed && !!owner },
  });
}

export function useNFAOwner(tokenId: bigint | undefined) {
  return useReadContract({
    ...nfaContract,
    functionName: 'ownerOf',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: isDeployed && tokenId !== undefined },
  });
}
