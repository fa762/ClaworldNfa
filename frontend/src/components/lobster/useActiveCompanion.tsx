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
import { type Address, zeroAddress } from 'viem';

import { useAgentMetadata, useAgentState, useTokensOfOwner } from '@/contracts/hooks/useClawNFA';
import {
  useClwBalance,
  useDailyCost,
  useIsActive,
  useLobsterState,
} from '@/contracts/hooks/useClawRouter';
import { usePkStats, useTaskStats } from '@/contracts/hooks/useNFAStats';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { addresses } from '@/contracts/addresses';
import { formatBNB, formatCLW } from '@/lib/format';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { useI18n } from '@/lib/i18n';
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
  isLoading: boolean;
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
  imageSrc: string;
  imageAlt: string;
  selectCompanion: (tokenId: bigint) => void;
  selectNext: () => void;
  selectPrevious: () => void;
};

const STORAGE_PREFIX = 'clawworld-active-companion:';

const DEMO_TOKEN_ID = 42n;

const defaultValue: ActiveCompanionValue = {
  live: false,
  isLoading: false,
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
  imageSrc: '/icon.png',
  imageAlt: 'Clawworld lobster companion',
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

function describeStance(
  traits: TraitShape,
  pkWinRate: number,
  taskTotal: number,
  active: boolean,
  pick: <T,>(zh: T, en: T) => T,
) {
  if (!active) {
    return pick(
      '壳已经连上了，但这只龙虾要先补维护，才能继续挖矿和参赛。',
      'The shell is live, but this lobster needs upkeep before the next mining or arena loop.',
    );
  }

  const dominant = [
    { key: 'courage', label: pick('勇气', 'Courage'), value: traits.courage },
    { key: 'wisdom', label: pick('智慧', 'Wisdom'), value: traits.wisdom },
    { key: 'social', label: pick('社交', 'Social'), value: traits.social },
    { key: 'create', label: pick('创造', 'Create'), value: traits.create },
    { key: 'grit', label: pick('韧性', 'Grit'), value: traits.grit },
  ].sort((left, right) => right.value - left.value)[0];

  if (pkWinRate >= 60) {
    return pick(
      `${dominant.label}主导，最近 PK 胜率 ${pkWinRate}% ，现在更适合压竞技节奏。`,
      `${dominant.label}-led posture with a ${pkWinRate}% PK win rate and room to press the arena.`,
    );
  }

  if (taskTotal >= 10) {
    return pick(
      `${dominant.label}主导，已经跑过 ${taskTotal} 次挖矿，这只龙虾的成长方向已经开始稳定下来。`,
      `${dominant.label}-led posture with ${taskTotal} completed mining runs already shaping this companion.`,
    );
  }

  return pick(
    `${dominant.label}主导，当前储备还能同时支撑成长、挖矿和竞技入口。`,
    `${dominant.label}-led posture with enough reserve to keep growth, mining, and arena state on one surface.`,
  );
}

function getStatus(
  active: boolean,
  upkeepDays: number | null,
  connected: boolean,
  hasToken: boolean,
  pick: <T,>(zh: T, en: T) => T,
) {
  if (!connected) return { label: pick('连接钱包', 'Connect wallet'), tone: 'cool' as const };
  if (!hasToken) return { label: pick('未发现 NFA', 'No NFA found'), tone: 'alert' as const };
  if (!active) return { label: pick('需要维护', 'Needs upkeep'), tone: 'alert' as const };
  if (upkeepDays !== null && upkeepDays <= 1) return { label: pick('储备告急', 'Reserve low'), tone: 'alert' as const };
  if (upkeepDays !== null && upkeepDays <= 3) return { label: pick('储备预警', 'Reserve watch'), tone: 'warm' as const };
  return { label: pick('稳定', 'Stable'), tone: 'growth' as const };
}

function getSource(
  connected: boolean,
  hasToken: boolean,
  pick: <T,>(zh: T, en: T) => T,
) {
  if (!connected) return { label: pick('演示模式', 'Demo mode'), tone: 'cool' as const };
  if (!hasToken) return { label: pick('钱包已连接', 'Wallet linked'), tone: 'cool' as const };
  return { label: pick('链上实时', 'Live on-chain'), tone: 'growth' as const };
}

function useProvideActiveCompanion(): ActiveCompanionValue {
  const { pick } = useI18n();
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
  const agentMetadataQuery = useAgentMetadata(activeTokenId);
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
    query: {
      enabled:
        connected &&
        Boolean(ownerAddress && addresses.clwToken && addresses.clwToken !== zeroAddress),
    },
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
    const isLoading =
      connected &&
      (ownedTokensQuery.isLoading ||
        walletNativeQuery.isLoading ||
        walletClwQuery.isLoading ||
        (hasToken &&
          (agentStateQuery.isLoading ||
            agentMetadataQuery.isLoading ||
            lobsterStateQuery.isLoading ||
            routerClwQuery.isLoading ||
            dailyCostQuery.isLoading ||
            activeQuery.isLoading ||
            taskStatsQuery.isLoading ||
            pkStatsQuery.isLoading)));

    if (!hasToken) {
      const source = getSource(connected, false, pick);
      const status = getStatus(false, null, connected, false, pick);
      return {
        ...defaultValue,
        isLoading,
        connected,
        ownerAddress,
        tokenId: 0n,
        tokenNumber: 0,
        ownedCount: ownedTokens.length,
        ownedTokens,
        selectedIndex: 0,
        name: connected ? pick('暂无伙伴', 'No Companion') : defaultValue.name,
        shelterName: connected ? pick('钱包已连接', 'Wallet linked') : defaultValue.shelterName,
        stance: connected
          ? pick(
              '这个钱包已经连上，但还没有持有 NFA，所以新壳还没有真正的龙虾可以挂载。',
              'This wallet is connected, but there is no owned NFA to anchor the companion shell yet.',
            )
          : defaultValue.stance,
        statusLabel: status.label,
        statusTone: status.tone,
        sourceLabel: source.label,
        sourceTone: source.tone,
        imageSrc: defaultValue.imageSrc,
        imageAlt: defaultValue.imageAlt,
        selectCompanion,
        selectNext,
        selectPrevious,
      };
    }

    const lobster = lobsterStateQuery.data as any;
    const agentState = agentStateQuery.data as any;
    const tokenNumber = Number(activeTokenId);
    const metadata = Array.isArray(agentMetadataQuery.data) ? agentMetadataQuery.data[0] : agentMetadataQuery.data;
    const rawVaultUri = String((metadata as any)?.vaultURI ?? (metadata as any)?.[4] ?? '');
    const imageSrc = resolveIpfsUrl(rawVaultUri);
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
    const status = getStatus(active, upkeepDays, connected, true, pick);
    const source = getSource(connected, true, pick);

    return {
      live: connected,
      isLoading,
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
      stance: describeStance(traits, pkWinRate, taskTotal, active, pick),
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
      walletClaworldText: walletClwQuery.isLoading
        ? pick('读取中', 'Loading')
        : walletClwQuery.error
          ? pick('读取失败', 'Read failed')
          : formatCLW(walletClaworld),
      walletNativeText: walletNativeQuery.isLoading
        ? pick('读取中', 'Loading')
        : walletNativeQuery.error
          ? pick('读取失败', 'Read failed')
          : formatBNB(walletNative),
      routerClaworldText: routerClwQuery.isLoading
        ? pick('读取中', 'Loading')
        : routerClwQuery.error
          ? pick('读取失败', 'Read failed')
          : formatCLW(routerClaworld),
      dailyCostText: dailyCostQuery.isLoading
        ? pick('读取中', 'Loading')
        : dailyCostQuery.error
          ? pick('读取失败', 'Read failed')
          : formatCLW(dailyCost),
      imageSrc,
      imageAlt: `${getLobsterName(tokenNumber)} #${tokenNumber}`,
      selectCompanion,
      selectNext,
      selectPrevious,
    };
  }, [
    activeQuery.data,
    activeTokenId,
    agentMetadataQuery.data,
    agentMetadataQuery.isLoading,
    agentStateQuery.data,
    agentStateQuery.isLoading,
    connected,
    dailyCostQuery.data,
    dailyCostQuery.isLoading,
    ownedTokensQuery.isLoading,
    ownedTokens,
    ownerAddress,
    pick,
    routerClwQuery.data,
    routerClwQuery.error,
    routerClwQuery.isLoading,
    selectedIndex,
    selectCompanion,
    selectNext,
    selectPrevious,
    lobsterStateQuery.data,
    lobsterStateQuery.isLoading,
    pkStatsQuery.data,
    pkStatsQuery.isLoading,
    taskStatsQuery.data,
    taskStatsQuery.isLoading,
    walletClwQuery.data,
    walletClwQuery.error,
    walletClwQuery.isLoading,
    walletNativeQuery.error,
    walletNativeQuery.isLoading,
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
