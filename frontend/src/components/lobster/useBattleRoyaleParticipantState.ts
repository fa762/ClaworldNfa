'use client';

import { useMemo } from 'react';
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  stringToHex,
  type Address,
} from 'viem';
import { useReadContract } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses } from '@/contracts/addresses';

const battleRoyaleContract = {
  address: addresses.battleRoyale,
  abi: BattleRoyaleABI,
} as const;

const PARTICIPANT_SALT = keccak256(stringToHex('clawworld.battle-royale.autonomy.participant'));

export type ParticipantPath = {
  key: 'owner' | 'autonomy';
  address?: Address;
  roomId: number;
  stake: bigint;
  claimable: bigint;
  claimed: boolean;
  effectiveNfa: bigint;
  entered: boolean;
  matchesToken: boolean;
};

export function deriveAutonomyParticipant(tokenId: bigint | undefined) {
  if (tokenId === undefined) return undefined;
  const hash = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'uint256' }],
      [PARTICIPANT_SALT, tokenId],
    ),
  );
  return getAddress(`0x${hash.slice(-40)}`);
}

function isRelevantPath(path: ParticipantPath, tokenId: bigint | undefined) {
  if (tokenId === undefined) return false;
  if (!path.matchesToken) return false;
  return path.entered || path.claimable > 0n || path.claimed;
}

export function preferPath(
  ownerPath: ParticipantPath,
  autonomyPath: ParticipantPath,
  tokenId: bigint | undefined,
) {
  if (isRelevantPath(autonomyPath, tokenId)) return autonomyPath;
  if (isRelevantPath(ownerPath, tokenId)) return ownerPath;
  return null;
}

export function useBattleRoyaleParticipantState(
  matchId: bigint | undefined,
  tokenId: bigint | undefined,
  ownerAddress?: Address,
) {
  const autonomyParticipant = useMemo(() => deriveAutonomyParticipant(tokenId), [tokenId]);
  const enabled = matchId !== undefined && tokenId !== undefined;

  const ownerPlayerInfoQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getPlayerInfo',
    args: enabled && ownerAddress ? [matchId!, ownerAddress] : undefined,
    query: { enabled: Boolean(enabled && ownerAddress) },
  });

  const ownerClaimableQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getClaimable',
    args: enabled && ownerAddress ? [matchId!, ownerAddress] : undefined,
    query: { enabled: Boolean(enabled && ownerAddress) },
  });

  const ownerEffectiveNfaQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getEffectivePlayerNfa',
    args: enabled && ownerAddress ? [matchId!, ownerAddress] : undefined,
    query: { enabled: Boolean(enabled && ownerAddress) },
  });

  const ownerClaimedQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'claimed',
    args: enabled && ownerAddress ? [matchId!, ownerAddress] : undefined,
    query: { enabled: Boolean(enabled && ownerAddress) },
  });

  const autonomyPlayerInfoQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getPlayerInfo',
    args: enabled && autonomyParticipant ? [matchId!, autonomyParticipant] : undefined,
    query: { enabled: Boolean(enabled && autonomyParticipant) },
  });

  const autonomyClaimableQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getClaimable',
    args: enabled && autonomyParticipant ? [matchId!, autonomyParticipant] : undefined,
    query: { enabled: Boolean(enabled && autonomyParticipant) },
  });

  const autonomyEffectiveNfaQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'getEffectivePlayerNfa',
    args: enabled && autonomyParticipant ? [matchId!, autonomyParticipant] : undefined,
    query: { enabled: Boolean(enabled && autonomyParticipant) },
  });

  const autonomyClaimedQuery = useReadContract({
    ...battleRoyaleContract,
    functionName: 'claimed',
    args: enabled && autonomyParticipant ? [matchId!, autonomyParticipant] : undefined,
    query: { enabled: Boolean(enabled && autonomyParticipant) },
  });

  return useMemo(() => {
    const ownerPlayerInfo = ownerPlayerInfoQuery.data as readonly [number, bigint] | undefined;
    const ownerEffectiveNfa = BigInt(ownerEffectiveNfaQuery.data?.toString() ?? '0');
    const autonomyPlayerInfo = autonomyPlayerInfoQuery.data as readonly [number, bigint] | undefined;
    const autonomyEffectiveNfa = BigInt(autonomyEffectiveNfaQuery.data?.toString() ?? '0');

    const ownerPath: ParticipantPath = {
      key: 'owner',
      address: ownerAddress,
      roomId: Number(ownerPlayerInfo?.[0] ?? 0),
      stake: BigInt(ownerPlayerInfo?.[1] ?? 0n),
      claimable: BigInt(ownerClaimableQuery.data?.toString() ?? '0'),
      claimed: Boolean(ownerClaimedQuery.data),
      effectiveNfa: ownerEffectiveNfa,
      entered: Number(ownerPlayerInfo?.[0] ?? 0) > 0 || BigInt(ownerPlayerInfo?.[1] ?? 0n) > 0n,
      matchesToken: tokenId !== undefined && ownerEffectiveNfa === tokenId,
    };

    const autonomyPath: ParticipantPath = {
      key: 'autonomy',
      address: autonomyParticipant,
      roomId: Number(autonomyPlayerInfo?.[0] ?? 0),
      stake: BigInt(autonomyPlayerInfo?.[1] ?? 0n),
      claimable: BigInt(autonomyClaimableQuery.data?.toString() ?? '0'),
      claimed: Boolean(autonomyClaimedQuery.data),
      effectiveNfa: autonomyEffectiveNfa,
      entered: Number(autonomyPlayerInfo?.[0] ?? 0) > 0 || BigInt(autonomyPlayerInfo?.[1] ?? 0n) > 0n,
      matchesToken: tokenId !== undefined && autonomyEffectiveNfa === tokenId,
    };

    const preferred = preferPath(ownerPath, autonomyPath, tokenId);
    const hasConflict =
      isRelevantPath(ownerPath, tokenId) &&
      isRelevantPath(autonomyPath, tokenId) &&
      ownerPath.address !== autonomyPath.address;

    return {
      ready: enabled,
      isLoading:
        ownerPlayerInfoQuery.isLoading ||
        ownerClaimableQuery.isLoading ||
        ownerEffectiveNfaQuery.isLoading ||
        ownerClaimedQuery.isLoading ||
        autonomyPlayerInfoQuery.isLoading ||
        autonomyClaimableQuery.isLoading ||
        autonomyEffectiveNfaQuery.isLoading ||
        autonomyClaimedQuery.isLoading,
      autonomyParticipant,
      ownerPath,
      autonomyPath,
      preferredPath: preferred,
      hasConflict,
      entered: Boolean(preferred?.entered),
      claimable: preferred?.claimable ?? 0n,
      claimPathLabel:
        preferred?.key === 'autonomy'
          ? 'NFA 记账账户'
          : preferred?.key === 'owner'
            ? '持有人钱包'
            : null,
    };
  }, [
    autonomyClaimableQuery.data,
    autonomyClaimableQuery.isLoading,
    autonomyEffectiveNfaQuery.data,
    autonomyEffectiveNfaQuery.isLoading,
    autonomyParticipant,
    autonomyPlayerInfoQuery.data,
    autonomyPlayerInfoQuery.isLoading,
    enabled,
    ownerAddress,
    ownerClaimableQuery.data,
    ownerClaimableQuery.isLoading,
    ownerClaimedQuery.data,
    ownerClaimedQuery.isLoading,
    ownerEffectiveNfaQuery.data,
    ownerEffectiveNfaQuery.isLoading,
    ownerPlayerInfoQuery.data,
    ownerPlayerInfoQuery.isLoading,
    tokenId,
    autonomyClaimedQuery.data,
    autonomyClaimedQuery.isLoading,
  ]);
}
