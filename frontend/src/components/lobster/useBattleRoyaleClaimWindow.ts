'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { usePublicClient } from 'wagmi';

import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { addresses } from '@/contracts/addresses';

import {
  deriveAutonomyParticipant,
  preferPath,
  type ParticipantPath,
} from './useBattleRoyaleParticipantState';

type ClaimWindowState = {
  isLoading: boolean;
  error: string | null;
  matchId?: bigint;
  matchStatus?: number;
  preferredPath: ParticipantPath | null;
  ownerPath: ParticipantPath | null;
  autonomyPath: ParticipantPath | null;
  claimable: bigint;
  hasConflict: boolean;
  autonomyParticipant?: Address;
};

const battleRoyaleContract = {
  address: addresses.battleRoyale,
  abi: BattleRoyaleABI,
} as const;

const defaultState: ClaimWindowState = {
  isLoading: false,
  error: null,
  preferredPath: null,
  ownerPath: null,
  autonomyPath: null,
  claimable: 0n,
  hasConflict: false,
};

function buildPath(
  key: 'owner' | 'autonomy',
  address: Address | undefined,
  tokenId: bigint,
  playerInfo: readonly [number, bigint],
  claimable: bigint,
  effectiveNfa: bigint,
): ParticipantPath {
  const roomId = Number(playerInfo?.[0] ?? 0);
  const stake = BigInt(playerInfo?.[1] ?? 0n);

  return {
    key,
    address,
    roomId,
    stake,
    claimable,
    effectiveNfa,
    entered: roomId > 0 || stake > 0n,
    matchesToken: effectiveNfa === tokenId,
  };
}

export function useBattleRoyaleClaimWindow(
  tokenId: bigint | undefined,
  ownerAddress?: Address,
  lookback = 12,
) {
  const publicClient = usePublicClient();
  const autonomyParticipant = useMemo(() => deriveAutonomyParticipant(tokenId), [tokenId]);
  const [state, setState] = useState<ClaimWindowState>(defaultState);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(async () => {
    setRefreshNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || tokenId === undefined || !ownerAddress) {
      setState((current) => ({
        ...defaultState,
        autonomyParticipant,
        isLoading: false,
      }));
      return;
    }

    async function loadClaimWindow() {
      const client = publicClient;
      const activeTokenId = tokenId;
      const owner = ownerAddress;
      const participant = autonomyParticipant;
      if (!client || activeTokenId === undefined || !owner || !participant) return;

      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
        autonomyParticipant,
      }));

      try {
        const matchCount = BigInt(
          (
            await client.readContract({
              ...battleRoyaleContract,
              functionName: 'matchCount',
            })
          ).toString(),
        );

        if (matchCount === 0n) {
          if (!cancelled) {
            setState({
              ...defaultState,
              autonomyParticipant,
              isLoading: false,
            });
          }
          return;
        }

        const maxLookback = BigInt(Math.max(1, lookback));
        const lowerBound = matchCount > maxLookback ? matchCount - maxLookback + 1n : 1n;
        let currentMatchId = matchCount;
        let nextState: ClaimWindowState = {
          ...defaultState,
          autonomyParticipant,
          isLoading: false,
        };

        while (currentMatchId >= lowerBound) {
          const matchInfo = (await client.readContract({
            ...battleRoyaleContract,
            functionName: 'getMatchInfo',
            args: [currentMatchId],
          })) as readonly [number, number, bigint, number, bigint, bigint];

          const matchStatus = Number(matchInfo?.[0] ?? 0);
          if (matchStatus === 2) {
            const [
              ownerPlayerInfo,
              ownerClaimable,
              ownerEffectiveNfa,
              autonomyPlayerInfo,
              autonomyClaimable,
              autonomyEffectiveNfa,
            ] = (await client.multicall({
              contracts: [
                {
                  ...battleRoyaleContract,
                  functionName: 'getPlayerInfo',
                  args: [currentMatchId, owner],
                },
                {
                  ...battleRoyaleContract,
                  functionName: 'getClaimable',
                  args: [currentMatchId, owner],
                },
                {
                  ...battleRoyaleContract,
                  functionName: 'getEffectivePlayerNfa',
                  args: [currentMatchId, owner],
                },
                {
                  ...battleRoyaleContract,
                  functionName: 'getPlayerInfo',
                  args: [currentMatchId, participant],
                },
                {
                  ...battleRoyaleContract,
                  functionName: 'getClaimable',
                  args: [currentMatchId, participant],
                },
                {
                  ...battleRoyaleContract,
                  functionName: 'getEffectivePlayerNfa',
                  args: [currentMatchId, participant],
                },
              ],
              allowFailure: false,
            })) as [
              readonly [number, bigint],
              bigint,
              bigint,
              readonly [number, bigint],
              bigint,
              bigint,
            ];

            const ownerPath = buildPath(
              'owner',
              owner,
              activeTokenId,
              ownerPlayerInfo,
              BigInt(ownerClaimable.toString()),
              BigInt(ownerEffectiveNfa.toString()),
            );
            const derivedAutonomyPath = buildPath(
              'autonomy',
              participant,
              activeTokenId,
              autonomyPlayerInfo,
              BigInt(autonomyClaimable.toString()),
              BigInt(autonomyEffectiveNfa.toString()),
            );
            const preferredPath = preferPath(ownerPath, derivedAutonomyPath);
            const hasConflict =
              ownerPath.entered &&
              derivedAutonomyPath.entered &&
              ownerPath.address !== derivedAutonomyPath.address;

            if (hasConflict || (preferredPath?.claimable ?? 0n) > 0n) {
              nextState = {
                isLoading: false,
                error: null,
                matchId: currentMatchId,
                matchStatus,
                preferredPath,
                ownerPath,
                autonomyPath: derivedAutonomyPath,
                claimable: preferredPath?.claimable ?? 0n,
                hasConflict,
                autonomyParticipant: participant,
              };
              break;
            }
          }

          if (currentMatchId === lowerBound) break;
          currentMatchId -= 1n;
        }

        if (!cancelled) {
          setState(nextState);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            ...defaultState,
            autonomyParticipant,
            isLoading: false,
            error: (error as Error).message,
          });
        }
      }
    }

    void loadClaimWindow();

    return () => {
      cancelled = true;
    };
  }, [autonomyParticipant, lookback, ownerAddress, publicClient, refreshNonce, tokenId]);

  return {
    ...state,
    refresh,
  };
}
