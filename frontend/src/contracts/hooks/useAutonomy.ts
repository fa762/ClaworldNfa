'use client';

import { useCallback, useMemo } from 'react';
import { type Address, parseEther, zeroAddress } from 'viem';
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { addresses } from '../addresses';
import { ClawAutonomyRegistryABI } from '../abis/ClawAutonomyRegistry';
import { ClawAutonomyDelegationRegistryABI } from '../abis/ClawAutonomyDelegationRegistry';
import { ClawOracleActionHubViewABI } from '../abis/ClawOracleActionHubView';

const registryContract = {
  address: addresses.autonomyRegistry,
  abi: ClawAutonomyRegistryABI,
} as const;

const delegationContract = {
  address: addresses.autonomyDelegationRegistry,
  abi: ClawAutonomyDelegationRegistryABI,
} as const;

const actionHubContract = {
  address: addresses.oracleActionHub,
  abi: ClawOracleActionHubViewABI,
} as const;

export const AUTONOMY_ACTION_KIND = {
  task: 0,
  pk: 1,
  market: 2,
  battleRoyale: 3,
  worldEvent: 4,
} as const;

export const AUTONOMY_ROLE_MASK = {
  request: 1,
  execute: 2,
  maintain: 4,
  full: 7,
} as const;

export const AUTONOMY_ASSET_ID = {
  claworld: '0x7d30665e51781b58ceb817be668a245d1f553a75ac5dd7c1de4d206cb0876de8',
} as const;

export const AUTONOMY_PROTOCOL_ID = {
  task: '0x27c4f99113533472859c5bb20de06076029b600390706ebf7016ee2575a69c0a',
  pk: '0x8c48a1a6b0668360238d9e0abd8940194fa1d6458713a56e869643e9ea637b34',
  battleRoyale: '0xd24032ab7b57cf65aa850464772106aedcd29cf1628f7ab9e962ba506049607c',
} as const;

const autonomyMinWalletHoldingRaw =
  process.env.NEXT_PUBLIC_AUTONOMY_MIN_WALLET_HOLDING || '2000000';

export const AUTONOMY_MIN_WALLET_HOLDING_RAW = autonomyMinWalletHoldingRaw;
export const AUTONOMY_MIN_WALLET_HOLDING = parseEther(autonomyMinWalletHoldingRaw);
export const AUTONOMY_OPERATOR = addresses.autonomyOperator;

const autonomyReady =
  !!addresses.autonomyRegistry &&
  addresses.autonomyRegistry !== zeroAddress &&
  !!addresses.autonomyDelegationRegistry &&
  addresses.autonomyDelegationRegistry !== zeroAddress &&
  !!addresses.oracleActionHub &&
  addresses.oracleActionHub !== zeroAddress &&
  !!AUTONOMY_OPERATOR &&
  AUTONOMY_OPERATOR !== zeroAddress;

export type AutonomySetupInput = {
  tokenId: bigint;
  actionKind: number;
  protocolId: `0x${string}`;
  adapter: Address;
  operator?: Address;
};

export function useAutonomyActionSetup({
  tokenId,
  actionKind,
  protocolId,
  adapter,
  operator = AUTONOMY_OPERATOR,
}: AutonomySetupInput) {
  const enabled = autonomyReady && !!tokenId && !!adapter && adapter !== zeroAddress;

  const policy = useReadContract({
    ...registryContract,
    functionName: 'getPolicy',
    args: enabled ? [tokenId, actionKind] : undefined,
    query: { enabled },
  });

  const riskState = useReadContract({
    ...registryContract,
    functionName: 'getRiskState',
    args: enabled ? [tokenId, actionKind] : undefined,
    query: { enabled },
  });

  const protocolApproved = useReadContract({
    ...registryContract,
    functionName: 'isProtocolApproved',
    args: enabled ? [tokenId, protocolId] : undefined,
    query: { enabled },
  });

  const adapterApproved = useReadContract({
    ...registryContract,
    functionName: 'isAdapterApproved',
    args: enabled ? [tokenId, actionKind, adapter] : undefined,
    query: { enabled },
  });

  const operatorApproved = useReadContract({
    ...registryContract,
    functionName: 'isOperatorApproved',
    args: enabled ? [tokenId, actionKind, operator] : undefined,
    query: { enabled },
  });

  const operatorRoleMask = useReadContract({
    ...registryContract,
    functionName: 'getOperatorRoleMask',
    args: enabled ? [tokenId, actionKind, operator] : undefined,
    query: { enabled },
  });

  const delegationLease = useReadContract({
    ...delegationContract,
    functionName: 'getDelegationLease',
    args: enabled ? [tokenId, actionKind, operator] : undefined,
    query: { enabled },
  });

  const activeLease = useReadContract({
    ...delegationContract,
    functionName: 'hasActiveLease',
    args: enabled ? [tokenId, actionKind, operator, AUTONOMY_ROLE_MASK.full] : undefined,
    query: { enabled },
  });

  const refresh = useCallback(async () => {
    await Promise.all([
      policy.refetch(),
      riskState.refetch(),
      protocolApproved.refetch(),
      adapterApproved.refetch(),
      operatorApproved.refetch(),
      operatorRoleMask.refetch(),
      delegationLease.refetch(),
      activeLease.refetch(),
    ]);
  }, [
    activeLease,
    adapterApproved,
    delegationLease,
    operatorApproved,
    operatorRoleMask,
    policy,
    protocolApproved,
    riskState,
  ]);

  const parsed = useMemo(() => {
    const policyValue = policy.data as
      | readonly [boolean, number, number, number, bigint, bigint]
      | undefined;
    const riskValue = riskState.data as
      | readonly [boolean, number, number, number, number, bigint, bigint]
      | undefined;
    const leaseValue = delegationLease.data as
      | readonly [boolean, number, bigint, bigint]
      | undefined;

    return {
      policy: policyValue
        ? {
            enabled: policyValue[0],
            riskMode: Number(policyValue[1]),
            dailyLimit: Number(policyValue[2]),
            actionsUsed: Number(policyValue[3]),
            windowStart: Number(policyValue[4]),
            maxClwPerAction: BigInt(policyValue[5]),
          }
        : null,
      risk: riskValue
        ? {
            emergencyPaused: riskValue[0],
            maxFailureStreak: Number(riskValue[1]),
            failureStreak: Number(riskValue[2]),
            totalActions: Number(riskValue[3]),
            totalFailures: Number(riskValue[4]),
            lastActionAt: Number(riskValue[5]),
            minClwReserve: BigInt(riskValue[6]),
          }
        : null,
      protocolApproved: Boolean(protocolApproved.data),
      adapterApproved: Boolean(adapterApproved.data),
      operatorApproved: Boolean(operatorApproved.data),
      operatorRoleMask: Number(operatorRoleMask.data ?? 0),
      lease: leaseValue
        ? {
            enabled: leaseValue[0],
            roleMask: Number(leaseValue[1]),
            issuedAt: Number(leaseValue[2]),
            expiresAt: Number(leaseValue[3]),
          }
        : null,
      leaseActive: Boolean(activeLease.data),
    };
  }, [
    activeLease.data,
    adapterApproved.data,
    delegationLease.data,
    operatorApproved.data,
    operatorRoleMask.data,
    policy.data,
    protocolApproved.data,
    riskState.data,
  ]);

  return {
    ready: enabled,
    isLoading:
      policy.isLoading ||
      riskState.isLoading ||
      protocolApproved.isLoading ||
      adapterApproved.isLoading ||
      operatorApproved.isLoading ||
      operatorRoleMask.isLoading ||
      delegationLease.isLoading ||
      activeLease.isLoading,
    isRefreshing:
      policy.isRefetching ||
      riskState.isRefetching ||
      protocolApproved.isRefetching ||
      adapterApproved.isRefetching ||
      operatorApproved.isRefetching ||
      operatorRoleMask.isRefetching ||
      delegationLease.isRefetching ||
      activeLease.isRefetching,
    error:
      policy.error ??
      riskState.error ??
      protocolApproved.error ??
      adapterApproved.error ??
      operatorApproved.error ??
      operatorRoleMask.error ??
      delegationLease.error ??
      activeLease.error,
    refresh,
    ...parsed,
  };
}

export function useAutonomyProofs(tokenId: bigint | undefined, protocolId: `0x${string}`) {
  const enabled = autonomyReady && tokenId !== undefined;

  const receipts = useReadContract({
    ...actionHubContract,
    functionName: 'getActionReceiptsByProtocol',
    args: enabled ? [tokenId!, protocolId, 0n, 3n] : undefined,
    query: { enabled },
  });

  const ledger = useReadContract({
    ...actionHubContract,
    functionName: 'getNfaLedger',
    args: enabled ? [tokenId!] : undefined,
    query: { enabled },
  });

  const parsedReceipts = useMemo(() => {
    const result = receipts.data as [readonly any[], bigint] | undefined;
    return result?.[0] ?? [];
  }, [receipts.data]);

  const parsedLedger = useMemo(() => {
    const value = ledger.data as
      | readonly [number, number, number, number, bigint, bigint, number, bigint, `0x${string}`]
      | undefined;
    if (!value) return null;
    return {
      executedCount: Number(value[0]),
      failedCount: Number(value[1]),
      cancelledCount: Number(value[2]),
      expiredCount: Number(value[3]),
      totalActualSpend: BigInt(value[4]),
      totalClwCredit: BigInt(value[5]),
      totalXpCredit: Number(value[6]),
      lastUpdatedAt: Number(value[7]),
      lastExecutionRef: value[8],
    };
  }, [ledger.data]);

  const refresh = useCallback(async () => {
    await Promise.all([receipts.refetch(), ledger.refetch()]);
  }, [ledger, receipts]);

  return {
    ready: enabled,
    isLoading: receipts.isLoading || ledger.isLoading,
    isRefreshing: receipts.isRefetching || ledger.isRefetching,
    error: receipts.error ?? ledger.error,
    refresh,
    receipts: parsedReceipts,
    ledger: parsedLedger,
  };
}

export function useAutonomyActions() {
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  return {
    ready: autonomyReady,
    hash: write.data,
    error: write.error ?? receipt.error,
    isPending: write.isPending,
    isConfirming: receipt.isLoading,
    isSuccess: receipt.isSuccess,
    setApprovedProtocol: (tokenId: bigint, protocolId: `0x${string}`, approved: boolean) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setApprovedProtocol',
        args: [tokenId, protocolId, approved],
      }),
    setApprovedAdapter: (tokenId: bigint, actionKind: number, adapter: Address, approved: boolean) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setApprovedAdapter',
        args: [tokenId, actionKind, adapter, approved],
      }),
    setApprovedOperator: (tokenId: bigint, actionKind: number, operator: Address, approved: boolean) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setApprovedOperator',
        args: [tokenId, actionKind, operator, approved],
      }),
    setOperatorRoleMask: (tokenId: bigint, actionKind: number, operator: Address, roleMask: number) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setOperatorRoleMask',
        args: [tokenId, actionKind, operator, roleMask],
      }),
    setRiskControls: (tokenId: bigint, actionKind: number, maxFailureStreak: number, minClwReserve: string) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setRiskControls',
        args: [tokenId, actionKind, maxFailureStreak, parseEther(minClwReserve || '0')],
      }),
    setPolicy: (
      tokenId: bigint,
      actionKind: number,
      enabled: boolean,
      riskMode: number,
      dailyLimit: number,
      maxClwPerAction: string
    ) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setPolicy',
        args: [
          tokenId,
          actionKind,
          enabled,
          riskMode,
          dailyLimit,
          parseEther(maxClwPerAction || '0'),
        ],
      }),
    setEmergencyPause: (tokenId: bigint, actionKind: number, paused: boolean) =>
      write.writeContract({
        ...registryContract,
        functionName: 'setEmergencyPause',
        args: [tokenId, actionKind, paused],
      }),
    setDelegationLease: (
      tokenId: bigint,
      actionKind: number,
      operator: Address,
      roleMask: number,
      expiresAt: bigint
    ) =>
      write.writeContract({
        ...delegationContract,
        functionName: 'setDelegationLease',
        args: [tokenId, actionKind, operator, roleMask, expiresAt],
      }),
    revokeDelegationLease: (tokenId: bigint, actionKind: number, operator: Address) =>
      write.writeContract({
        ...delegationContract,
        functionName: 'revokeDelegationLease',
        args: [tokenId, actionKind, operator],
      }),
  };
}
