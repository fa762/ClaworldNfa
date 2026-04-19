import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { WorldStateABI } from '@/contracts/abis/WorldState';
import { getEventInfo, parseActiveEvents } from '@/lib/events';
import { addresses } from '@/contracts/addresses';

import { ensureConfigured, publicClient } from './chain';

export type WorldSummaryPayload = {
  rewardMultiplier: string;
  pkStakeLimitCLW: string;
  mutationBonus: string;
  dailyCostMultiplier: string;
  activeEvents: Array<{
    key: string;
    label: string;
    tone: 'warm' | 'cool' | 'alert';
  }>;
  battleRoyale: {
    matchId: string | null;
    status: 'open' | 'pending_reveal' | 'settled' | 'unknown';
    players: number;
    triggerCount: number;
    revealBlock: string;
    potCLW: string;
    losingRoom: number;
  } | null;
};

function formatBasisPoints(value: bigint) {
  return `${(Number(value) / 10000).toFixed(2)}x`;
}

export async function getWorldSummary(): Promise<WorldSummaryPayload> {
  ensureConfigured(['worldState', 'battleRoyale']);

  const [rewardMultiplier, pkStakeLimit, mutationBonus, dailyCostMultiplier, activeEventsRaw, latestOpenMatch, matchCount] =
    await Promise.all([
      publicClient.readContract({
        address: addresses.worldState,
        abi: WorldStateABI,
        functionName: 'rewardMultiplier',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.worldState,
        abi: WorldStateABI,
        functionName: 'pkStakeLimit',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.worldState,
        abi: WorldStateABI,
        functionName: 'mutationBonus',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.worldState,
        abi: WorldStateABI,
        functionName: 'dailyCostMultiplier',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.worldState,
        abi: WorldStateABI,
        functionName: 'activeEvents',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'latestOpenMatch',
      }) as Promise<bigint>,
      publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'matchCount',
      }) as Promise<bigint>,
    ]);

  const targetMatchId = latestOpenMatch > 0n ? latestOpenMatch : matchCount > 0n ? matchCount : 0n;
  let battleRoyale: WorldSummaryPayload['battleRoyale'] = null;

  if (targetMatchId > 0n) {
    const [matchInfo, matchConfig] = await Promise.all([
      publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'getMatchInfo',
        args: [targetMatchId],
      }) as Promise<readonly [number, number, bigint, number, bigint, bigint]>,
      publicClient.readContract({
        address: addresses.battleRoyale,
        abi: BattleRoyaleABI,
        functionName: 'getMatchConfig',
        args: [targetMatchId],
      }) as Promise<readonly [bigint, number, bigint, number]>,
    ]);

    battleRoyale = {
      matchId: targetMatchId.toString(),
      status: Number(matchInfo[0]) === 0 ? 'open' : Number(matchInfo[0]) === 1 ? 'pending_reveal' : Number(matchInfo[0]) === 2 ? 'settled' : 'unknown',
      players: Number(matchInfo[1]),
      triggerCount: Number(matchConfig[1]),
      revealBlock: BigInt(matchInfo[2]).toString(),
      potCLW: BigInt(matchInfo[4]).toString(),
      losingRoom: Number(matchInfo[3]),
    };
  }

  return {
    rewardMultiplier: formatBasisPoints(rewardMultiplier),
    pkStakeLimitCLW: pkStakeLimit.toString(),
    mutationBonus: formatBasisPoints(mutationBonus),
    dailyCostMultiplier: formatBasisPoints(dailyCostMultiplier),
    activeEvents: parseActiveEvents(BigInt(activeEventsRaw)).map((key) => {
      const info = getEventInfo(key);
      return {
        key,
        label: info?.nameCN ?? key,
        tone: key === 'BUBBLE' ? 'alert' : key === 'WINTER' ? 'cool' : 'warm',
      };
    }),
    battleRoyale,
  };
}
