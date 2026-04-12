'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { type Address } from 'viem';

import { ERC20ABI } from '@/contracts/abis/ERC20';
import { useAgentState, useTokensOfOwner } from '@/contracts/hooks/useClawNFA';
import {
  useClwBalance,
  useDailyCost,
  useIsActive,
  useLobsterState,
} from '@/contracts/hooks/useClawRouter';
import { usePkStats, useTaskStats } from '@/contracts/hooks/useNFAStats';
import { addresses } from '@/contracts/addresses';
import { formatBNB, formatCLW } from '@/lib/format';
import { getLobsterName } from '@/lib/mockData';
import { getShelterName } from '@/lib/shelter';

type Tone = 'warm' | 'cool' | 'growth' | 'alert';

type TraitShape = {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
};

export type ActiveCompanionValue = {
  live: boolean;
  connected: boolean;
  hasToken: boolean;
  ownerAddress?: Address;
  tokenId: bigint;
  tokenNumber: number;
  ownedCount: number;
  ownedTokens: bigint[];
  selectedIndex: number;
  name: string;
  shelterName: string;
  level: number;
  active: boolean;
  stance: string;
  statusLabel: string;
  statusTone: Tone;
  sourceLabel: string;
  sourceTone: Tone;
  walletClaworld: bigint;
  walletNative: bigint;
  routerClaworld: bigint;
  dailyCost: bigint;
  upkeepDays: number | null;
  traits: TraitShape;
  taskTotal: number;
  pkWins: number;
  pkLosses: number;
  pkWinRate: number;
  walletClaworldText: string;
  walletNativeText: string;
  routerClaworldText: string;
  dailyCostText: string;
  selectCompanion: (tokenId: bigint) => void;
  selectNext: () => void;
  selectPrevious: () => void;
};

const STORAGE_PREFIX = 'clawworld-active-companion:';

const DEMO_TOKEN_ID = 42n;

const defaultValue: ActiveCompanionValue = {
  live: false,
  connected: false,
  hasToken: false,
  ownerAddress: undefined,
  tokenId: DEMO_TOKEN_ID,
  tokenNumber: Number(DEMO_TOKEN_ID),
  ownedCount: 0,
  ownedTokens: [],
  selectedIndex: 0,
  name: 'Spark',
  shelterName: 'SHELTER-01',
  level: 4,
  active: true,
  stance: 'A quiet companion view stays available until a wallet and owned NFA are present.',
  statusLabel: 'Demo view',
  statusTone: 'cool',
  sourceLabel: 'Demo mode',
  sourceTone: 'cool',
  walletClaworld: 0n,
  walletNative: 0n,
  routerClaworld: 0n,
  dailyCost: 0n,
  upkeepDays: null,
  traits: {
    courage: 72,
    wisdom: 45,
    social: 58,
    create: 41,
    grit: 67,
  },
  taskTotal: 0,
  pkWins: 0,
  pkLosses: 0,
  pkWinRate: 0,
  walletClaworldText: formatCLW(0n),
  walletNativeText: formatBNB(0n),
  routerClaworldText: formatCLW(0n),
  dailyCostText: formatCLW(0n),
  selectCompanion: () => {},
  selectNext: () => {},
  selectPrevious: () => {},
};

const ActiveCompanionContext = createContext<ActiveCompanionValue>(defaultValue);

function parseTokenId(value: string | null): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function normalizeBigintList(values: readonly bigint[] | undefined) {
  return [...(values ?? [])].map((value) => BigInt(value)).sort((a, b) => Number(a - b));
}

function describeStance(traits: TraitShape, pkWinRate: number, taskTotal: number, active: boolean) {
  if (!active) return 'The shell is live, but this lobster needs upkeep before the next action loop.';

  const dominant = [
    { key: 'courage', label: 'Courage', value: traits.courage },
    { key: 'wisdom', label: 'Wisdom', value: traits.wisdom },
    { key: 'social', label: 'Social', value: traits.social },
    { key: 'create', label: 'Create', value: traits.create },
    { key: 'grit', label: 'Grit', value: traits.grit },
  ].sort((left, right) => right.value - left.value)[0];

  if (pkWinRate >= 60) {
    return `${dominant.label}-led posture with a ${pkWinRate}% PK win rate and room to press the arena.`;
  }

  if (taskTotal >= 10) {
    return `${dominant.label}-led posture with ${taskTotal} completed tasks already shaping this companion.`;
  }

  return `${dominant.label}-led posture with enough reserve to keep growth and action on one surface.`;
}

function getStatus(active: boolean, upkeepDays: number | null, connected: boolean, hasToken: boolean) {
  if (!connected) return { label: 'Connect wallet', tone: 'cool' as const };
  if (!hasToken) return { label: 'No NFA found', tone: 'alert' as const };
  if (!active) return { label: 'Needs upkeep', tone: 'alert' as const };
  if (upkeepDays !== null && upkeepDays <= 1) return { label: 'Reserve low', tone: 'alert' as const };
  if (upkeepDays !== null && upkeepDays <= 3) return { label: 'Reserve watch', tone: 'warm' as const };
  return { label: 'Stable', tone: 'growth' as const };
}

function getSource(connected: boolean, hasToken: boolean) {
  if (!connected) return { label: 'Demo mode', tone: 'cool' as const };
  if (!hasToken) return { label: 'Wallet linked', tone: 'cool' as const };
  return { label: 'Live on-chain', tone: 'growth' as const };
}

function useProvideActiveCompanion(): ActiveCompanionValue {
  const { address, isConnected } = useAccount();
  const ownerAddress = address as Address | undefined;
  const connected = Boolean(isConnected && ownerAddress);
  const storageKey = ownerAddress ? `${STORAGE_PREFIX}${ownerAddress.toLowerCase()}` : null;

  const ownedTokensQuery = useTokensOfOwner(ownerAddress);
  const ownedTokens = useMemo(
    () => normalizeBigintList((ownedTokensQuery.data as readonly bigint[] | undefined) ?? []),
    [ownedTokensQuery.data],
  );

  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) {
      setSelectedTokenId(null);
      return;
    }

    setSelectedTokenId(parseTokenId(window.localStorage.getItem(storageKey)));
  }, [storageKey]);

  useEffect(() => {
    if (ownedTokens.length === 0) {
      setSelectedTokenId(null);
      return;
    }

    setSelectedTokenId((current) => {
      if (current !== null && ownedTokens.some((tokenId) => tokenId === current)) return current;
      if (typeof window !== 'undefined' && storageKey) {
        const saved = parseTokenId(window.localStorage.getItem(storageKey));
        if (saved !== null && ownedTokens.some((tokenId) => tokenId === saved)) return saved;
      }
      return ownedTokens[0];
    });
  }, [ownedTokens, storageKey]);

  const activeTokenId = selectedTokenId ?? ownedTokens[0];

  const agentStateQuery = useAgentState(activeTokenId);
  const lobsterStateQuery = useLobsterState(activeTokenId);
  const routerClwQuery = useClwBalance(activeTokenId);
  const dailyCostQuery = useDailyCost(activeTokenId);
  const activeQuery = useIsActive(activeTokenId);
  const taskStatsQuery = useTaskStats(activeTokenId);
  const pkStatsQuery = usePkStats(activeTokenId);

  const walletNativeQuery = useBalance({
    address: ownerAddress,
    query: { enabled: connected },
  });

  const walletClwQuery = useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: ownerAddress ? [ownerAddress] : undefined,
    query: { enabled: connected && Boolean(ownerAddress && addresses.clwToken) },
  });

  const selectCompanion = useCallback(
    (tokenId: bigint) => {
      if (!ownedTokens.some((owned) => owned === tokenId)) return;
      setSelectedTokenId(tokenId);
      if (typeof window !== 'undefined' && storageKey) {
        window.localStorage.setItem(storageKey, tokenId.toString());
      }
    },
    [ownedTokens, storageKey],
  );

  const selectedIndex = useMemo(() => {
    if (activeTokenId === undefined) return 0;
    const index = ownedTokens.findIndex((tokenId) => tokenId === activeTokenId);
    return index >= 0 ? index : 0;
  }, [activeTokenId, ownedTokens]);

  const selectNext = useCallback(() => {
    if (ownedTokens.length <= 1) return;
    const nextIndex = (selectedIndex + 1) % ownedTokens.length;
    selectCompanion(ownedTokens[nextIndex]);
  }, [ownedTokens, selectCompanion, selectedIndex]);

  const selectPrevious = useCallback(() => {
    if (ownedTokens.length <= 1) return;
    const nextIndex = (selectedIndex - 1 + ownedTokens.length) % ownedTokens.length;
    selectCompanion(ownedTokens[nextIndex]);
  }, [ownedTokens, selectCompanion, selectedIndex]);

  return useMemo(() => {
    const hasToken = activeTokenId !== undefined;
    if (!hasToken) {
      const source = getSource(connected, false);
      const status = getStatus(false, null, connected, false);
      return {
        ...defaultValue,
        connected,
        ownerAddress,
        tokenId: 0n,
        tokenNumber: 0,
        ownedCount: ownedTokens.length,
        ownedTokens,
        selectedIndex: 0,
        name: connected ? 'No Companion' : defaultValue.name,
        shelterName: connected ? 'Wallet linked' : defaultValue.shelterName,
        stance: connected
          ? 'This wallet is connected, but there is no owned NFA to anchor the companion shell yet.'
          : defaultValue.stance,
        statusLabel: status.label,
        statusTone: status.tone,
        sourceLabel: source.label,
        sourceTone: source.tone,
        selectCompanion,
        selectNext,
        selectPrevious,
      };
    }

    const lobster = lobsterStateQuery.data as any;
    const agentState = agentStateQuery.data as any;
    const tokenNumber = Number(activeTokenId);
    const traits: TraitShape = {
      courage: Number(lobster?.courage ?? lobster?.[2] ?? 0),
      wisdom: Number(lobster?.wisdom ?? lobster?.[3] ?? 0),
      social: Number(lobster?.social ?? lobster?.[4] ?? 0),
      create: Number(lobster?.create ?? lobster?.[5] ?? 0),
      grit: Number(lobster?.grit ?? lobster?.[6] ?? 0),
    };
    const shelter = Number(lobster?.shelter ?? lobster?.[1] ?? 0);
    const level = Number(lobster?.level ?? lobster?.[13] ?? 0);
    const routerClaworld = BigInt(routerClwQuery.data?.toString() ?? '0');
    const dailyCost = BigInt(dailyCostQuery.data?.toString() ?? '0');
    const walletClaworld = BigInt(walletClwQuery.data?.toString() ?? '0');
    const walletNative = walletNativeQuery.data?.value ?? 0n;
    const active = Boolean(activeQuery.data ?? agentState?.active ?? agentState?.[1] ?? false);
    const upkeepDays = dailyCost > 0n ? Number(routerClaworld / dailyCost) : null;
    const taskStats = taskStatsQuery.data as any;
    const pkStats = pkStatsQuery.data as any;
    const taskTotal = Number(taskStats?.total ?? taskStats?.[0] ?? 0);
    const pkWins = Number(pkStats?.wins ?? pkStats?.[0] ?? 0);
    const pkLosses = Number(pkStats?.losses ?? pkStats?.[1] ?? 0);
    const pkTotal = pkWins + pkLosses;
    const pkWinRate = pkTotal > 0 ? Math.round((pkWins / pkTotal) * 100) : 0;
    const status = getStatus(active, upkeepDays, connected, true);
    const source = getSource(connected, true);

    return {
      live: connected,
      connected,
      hasToken: true,
      ownerAddress,
      tokenId: activeTokenId,
      tokenNumber,
      ownedCount: ownedTokens.length,
      ownedTokens,
      selectedIndex,
      name: getLobsterName(tokenNumber),
      shelterName: getShelterName(shelter),
      level,
      active,
      stance: describeStance(traits, pkWinRate, taskTotal, active),
      statusLabel: status.label,
      statusTone: status.tone,
      sourceLabel: source.label,
      sourceTone: source.tone,
      walletClaworld,
      walletNative,
      routerClaworld,
      dailyCost,
      upkeepDays,
      traits,
      taskTotal,
      pkWins,
      pkLosses,
      pkWinRate,
      walletClaworldText: formatCLW(walletClaworld),
      walletNativeText: formatBNB(walletNative),
      routerClaworldText: formatCLW(routerClaworld),
      dailyCostText: formatCLW(dailyCost),
      selectCompanion,
      selectNext,
      selectPrevious,
    };
  }, [
    activeQuery.data,
    activeTokenId,
    agentStateQuery.data,
    connected,
    dailyCostQuery.data,
    ownedTokens,
    ownerAddress,
    routerClwQuery.data,
    selectedIndex,
    selectCompanion,
    selectNext,
    selectPrevious,
    lobsterStateQuery.data,
    pkStatsQuery.data,
    taskStatsQuery.data,
    walletClwQuery.data,
    walletNativeQuery.data?.value,
  ]);
}

export function ActiveCompanionProvider({ children }: { children: ReactNode }) {
  const value = useProvideActiveCompanion();

  return <ActiveCompanionContext.Provider value={value}>{children}</ActiveCompanionContext.Provider>;
}

export function useActiveCompanion() {
  return useContext(ActiveCompanionContext);
}
