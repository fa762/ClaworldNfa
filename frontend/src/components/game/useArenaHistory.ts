'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address } from 'viem';
import { usePublicClient } from 'wagmi';

import { deriveAutonomyParticipant } from '@/components/lobster/useBattleRoyaleParticipantState';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { addresses, chainId as appChainId } from '@/contracts/addresses';
import {
  loadPKResolutionCache,
  savePKResolutionCache,
  type CachedPKResolution,
} from '@/game/chain/contracts';
import { loadMatchResolution, loadRecentMatches } from '@/game/chain/wallet';

export type PkHistoryEntry = {
  matchId: number;
  role: '发起' | '应战';
  opponent: number;
  phase: number;
  stake: bigint;
  result: string;
  reward: bigint;
  myStrategy: string;
  opponentStrategy: string;
  winnerNfaId: number;
  loserNfaId: number;
  burned: bigint;
  txHash?: `0x${string}`;
};

export type BrHistoryEntry = {
  matchId: number;
  path: 'owner' | 'autonomy';
  pathLabel: '持有人钱包' | 'NFA 记账账户';
  status: number;
  roomId: number;
  stake: bigint;
  claimable: bigint;
  claimed: boolean;
  pot: bigint;
  totalPlayers: number;
  losingRoom: number;
  result: string;
};

function pkPhaseText(phase: number) {
  if (phase === 0) return '等待应战';
  if (phase === 1) return '已匹配';
  if (phase === 2) return '等待亮招';
  if (phase === 3) return '可结算';
  if (phase === 4) return '已结算';
  if (phase === 5) return '已清局';
  return '未知';
}

function brResultText(
  status: number,
  roomId: number,
  losingRoom: number,
  claimable: bigint,
  claimed: boolean,
) {
  if (status === 0) return '进行中';
  if (status === 1) return '等待揭示';
  if (roomId === 0) return '未入场';
  if (roomId === losingRoom) return '已出局';
  if (claimable > 0n) return '可领奖';
  if (claimed) return '已领取';
  return '已结算';
}

function toTxHash(value: string | undefined): `0x${string}` | undefined {
  if (!value || !value.startsWith('0x')) return undefined;
  return value as `0x${string}`;
}

function strategyLabel(strategy: number, revealed: boolean) {
  if (!revealed) return '未亮招';
  if (strategy === 0) return '强攻';
  if (strategy === 1) return '均衡';
  if (strategy === 2) return '防守';
  return '未知';
}

function getStrategyMuls(strategy: number) {
  if (strategy === 0) return { atkMul: 15000, defMul: 5000 };
  if (strategy === 1) return { atkMul: 10000, defMul: 10000 };
  return { atkMul: 5000, defMul: 15000 };
}

function toLobsterStats(lobster: readonly unknown[]) {
  return {
    courage: Number(lobster[2] ?? 0),
    wisdom: Number(lobster[3] ?? 0),
    grit: Number(lobster[6] ?? 0),
    str: Number(lobster[7] ?? 0),
    def: Number(lobster[8] ?? 0),
    spd: Number(lobster[9] ?? 0),
    vit: Number(lobster[10] ?? 0),
  };
}

function deriveCombatUnit(lobster: readonly unknown[], strategy: number) {
  const base = toLobsterStats(lobster);
  const { atkMul: baseAtkMul, defMul: baseDefMul } = getStrategyMuls(strategy);
  let atkMul = baseAtkMul;
  let defMul = baseDefMul;

  if (strategy === 0 && base.courage >= 70) atkMul += 500;
  if (strategy === 2 && base.grit >= 70) defMul += 500;
  if (strategy === 1 && base.wisdom >= 70) {
    atkMul += 300;
    defMul += 300;
  }

  return {
    str: base.str,
    def: base.def,
    spd: base.spd,
    vit: base.vit,
    atkMul,
    defMul,
  };
}

function derivePkSettlement(
  match: Awaited<ReturnType<typeof loadRecentMatches>>[number],
  lobsterA: readonly unknown[],
  lobsterB: readonly unknown[],
) {
  const a = deriveCombatUnit(lobsterA, match.strategyA);
  const b = deriveCombatUnit(lobsterB, match.strategyB);

  const effStrA = Math.floor((a.str * a.atkMul) / 10000);
  const effDefA = Math.floor((a.def * a.defMul) / 10000);
  const effStrB = Math.floor((b.str * b.atkMul) / 10000);
  const effDefB = Math.floor((b.def * b.defMul) / 10000);

  let rawDmgA = effStrA > effDefB ? effStrA - effDefB : 1;
  let rawDmgB = effStrB > effDefA ? effStrB - effDefA : 1;

  if (a.spd > b.spd) rawDmgA = Math.floor((rawDmgA * 11000) / 10000);
  else if (b.spd > a.spd) rawDmgB = Math.floor((rawDmgB * 11000) / 10000);

  const hpA = a.vit * 10;
  const hpB = b.vit * 10;
  const damageA = Math.floor((rawDmgA * 10000) / Math.max(hpB, 1));
  const damageB = Math.floor((rawDmgB * 10000) / Math.max(hpA, 1));

  const winnerNfaId = damageA >= damageB ? match.nfaA : match.nfaB;
  const loserNfaId = winnerNfaId === match.nfaA ? match.nfaB : match.nfaA;
  const totalStake = match.stake * 2n;
  const burned = (totalStake * 1000n) / 10000n;
  const reward = totalStake - burned;

  return {
    winnerNfaId,
    loserNfaId,
    reward,
    burned,
  };
}

async function resolvePkHistory(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  tokenNumber: number,
) {
  const recent = await loadRecentMatches({ includeClosed: true, maxCount: 12 });
  const ownMatches = recent.filter(
    (match) => match.nfaA === tokenNumber || match.nfaB === tokenNumber,
  );

  const entries = await Promise.all(
    ownMatches.slice(0, 6).map(async (match) => {
      let resolution: CachedPKResolution | null = loadPKResolutionCache(match.matchId);
      if (!resolution && match.phase >= 4) {
        const settled = await loadMatchResolution(match.matchId, match.phaseTimestamp);
        if (settled?.type === 'settled') {
          resolution = {
            type: 'settled',
            matchId: settled.matchId,
            winnerNfaId: settled.winnerNfaId,
            loserNfaId: settled.loserNfaId,
            reward: settled.reward.toString(),
            burned: settled.burned.toString(),
            txHash: settled.transactionHash,
            ts: Date.now(),
          };
          savePKResolutionCache(resolution);
        } else if (settled?.type === 'cancelled') {
          resolution = {
            type: 'cancelled',
            matchId: settled.matchId,
            txHash: settled.transactionHash,
            ts: Date.now(),
          };
          savePKResolutionCache(resolution);
        }
      }

      let derivedReward = 0n;
      let derivedBurned = 0n;
      let derivedWinner = 0;
      let derivedLoser = 0;
      if (match.phase === 4 && (!resolution || resolution.type !== 'settled')) {
        try {
          const [lobsterA, lobsterB] = (await publicClient.multicall({
            allowFailure: false,
            contracts: [
              {
                address: addresses.clawRouter,
                abi: ClawRouterABI,
                functionName: 'lobsters',
                args: [BigInt(match.nfaA)],
              },
              {
                address: addresses.clawRouter,
                abi: ClawRouterABI,
                functionName: 'lobsters',
                args: [BigInt(match.nfaB)],
              },
            ],
          })) as [readonly unknown[], readonly unknown[]];

          const derived = derivePkSettlement(match, lobsterA, lobsterB);
          derivedReward = derived.reward;
          derivedBurned = derived.burned;
          derivedWinner = derived.winnerNfaId;
          derivedLoser = derived.loserNfaId;
        } catch {
          derivedReward = 0n;
          derivedBurned = 0n;
        }
      }

      const isCreator = match.nfaA === tokenNumber;
      const myStrategy = strategyLabel(
        isCreator ? match.strategyA : match.strategyB,
        match.phase >= 4 || (isCreator ? match.revealedA : match.revealedB),
      );
      const opponentStrategy = strategyLabel(
        isCreator ? match.strategyB : match.strategyA,
        match.phase >= 4 || (isCreator ? match.revealedB : match.revealedA),
      );

      const reward =
        resolution?.type === 'settled'
          ? BigInt(resolution.reward)
          : derivedReward;
      const burned =
        resolution?.type === 'settled'
          ? BigInt(resolution.burned)
          : derivedBurned;
      const winnerNfaId =
        resolution?.type === 'settled'
          ? resolution.winnerNfaId
          : derivedWinner;
      const loserNfaId =
        resolution?.type === 'settled'
          ? resolution.loserNfaId
          : derivedLoser;
      const result =
        resolution?.type === 'cancelled'
          ? '已清局'
          : winnerNfaId > 0
            ? winnerNfaId === tokenNumber
              ? '胜'
              : '败'
            : pkPhaseText(match.phase);

      return {
        matchId: match.matchId,
        role: isCreator ? '发起' : '应战',
        opponent: isCreator ? match.nfaB : match.nfaA,
        phase: match.phase,
        stake: match.stake,
        result,
        reward,
        myStrategy,
        opponentStrategy,
        winnerNfaId,
        loserNfaId,
        burned,
        txHash:
          resolution?.type === 'settled'
            ? toTxHash(resolution.txHash)
            : resolution?.type === 'cancelled'
              ? toTxHash(resolution.txHash)
              : undefined,
      } satisfies PkHistoryEntry;
    }),
  );

  return entries;
}

export function useArenaHistory(tokenId: bigint | undefined, ownerAddress?: Address) {
  const publicClient = usePublicClient({ chainId: appChainId });
  const [pkHistory, setPkHistory] = useState<PkHistoryEntry[]>([]);
  const [brHistory, setBrHistory] = useState<BrHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tokenId || !publicClient) {
      setPkHistory([]);
      setBrHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tokenNumber = Number(tokenId);
      const participant = deriveAutonomyParticipant(tokenId);
      const pkEntries = await resolvePkHistory(publicClient, tokenNumber);

      const matchCountValue = (await publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'matchCount',
      })) as bigint;

      const brEntries: BrHistoryEntry[] = [];
      const start = Math.max(1, Number(matchCountValue) - 11);

      for (let matchId = Number(matchCountValue); matchId >= start; matchId -= 1) {
        const matchInfo = (await publicClient.readContract({
          address: addresses.battleRoyale,
          abi: BattleRoyaleABI,
          functionName: 'getMatchInfo',
          args: [BigInt(matchId)],
        })) as readonly [number, number, bigint, number, bigint, bigint];

        const ownerPlayerInfo = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getPlayerInfo',
              args: [BigInt(matchId), ownerAddress],
            })) as readonly [number, bigint])
          : ([0, 0n] as const);

        const ownerClaimable = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getClaimable',
              args: [BigInt(matchId), ownerAddress],
            })) as bigint)
          : 0n;

        const ownerEffectiveNfa = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getEffectivePlayerNfa',
              args: [BigInt(matchId), ownerAddress],
            })) as bigint)
          : 0n;

        const ownerClaimed = ownerAddress
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'claimed',
              args: [BigInt(matchId), ownerAddress],
            })) as boolean)
          : false;

        const autoPlayerInfo = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getPlayerInfo',
              args: [BigInt(matchId), participant],
            })) as readonly [number, bigint])
          : ([0, 0n] as const);

        const autoClaimable = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getClaimable',
              args: [BigInt(matchId), participant],
            })) as bigint)
          : 0n;

        const autoEffectiveNfa = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'getEffectivePlayerNfa',
              args: [BigInt(matchId), participant],
            })) as bigint)
          : 0n;

        const autoClaimed = participant
          ? ((await publicClient.readContract({
              address: addresses.battleRoyale,
              abi: BattleRoyaleABI,
              functionName: 'claimed',
              args: [BigInt(matchId), participant],
            })) as boolean)
          : false;

        const ownerPlayed =
          ownerEffectiveNfa === tokenId &&
          (Number(ownerPlayerInfo[0]) > 0 || ownerPlayerInfo[1] > 0n || ownerClaimable > 0n || ownerClaimed);
        const autoPlayed =
          autoEffectiveNfa === tokenId &&
          (Number(autoPlayerInfo[0]) > 0 || autoPlayerInfo[1] > 0n || autoClaimable > 0n || autoClaimed);

        if (!ownerPlayed && !autoPlayed) continue;

        const usingAuto = autoPlayed;
        const playerInfo = usingAuto ? autoPlayerInfo : ownerPlayerInfo;
        const claimable = usingAuto ? autoClaimable : ownerClaimable;
        const claimed = usingAuto ? autoClaimed : ownerClaimed;
        const roomId = Number(playerInfo[0] ?? 0);
        const losingRoom = Number(matchInfo[3] ?? 0);

        brEntries.push({
          matchId,
          path: usingAuto ? 'autonomy' : 'owner',
          pathLabel: usingAuto ? 'NFA 记账账户' : '持有人钱包',
          status: Number(matchInfo[0] ?? 0),
          totalPlayers: Number(matchInfo[1] ?? 0),
          losingRoom,
          pot: BigInt(matchInfo[4] ?? 0n),
          roomId,
          stake: BigInt(playerInfo[1] ?? 0n),
          claimable,
          claimed,
          result: brResultText(Number(matchInfo[0] ?? 0), roomId, losingRoom, claimable, claimed),
        });

        if (brEntries.length >= 6) break;
      }

      setPkHistory(pkEntries);
      setBrHistory(brEntries);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '竞技历史读取失败。');
    } finally {
      setIsLoading(false);
    }
  }, [ownerAddress, publicClient, tokenId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    pkHistory,
    brHistory,
    isLoading,
    error,
    refresh,
  };
}
