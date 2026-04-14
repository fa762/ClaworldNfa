'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bot, Shield } from 'lucide-react';
import { decodeEventLog, encodeAbiParameters, type Address } from 'viem';
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { ClawOracleActionHubABI } from '@/contracts/abis/ClawOracleActionHub';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_ASSET_ID,
} from '@/contracts/hooks/useAutonomy';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ClaimPathKey = 'owner' | 'autonomy' | null | undefined;

const MODE_CLAIM_EXISTING = 3;

function buildClaimPrompt(tokenId: bigint, matchId: bigint) {
  return `Use NFA #${tokenId.toString()} to claim settled Battle Royale reward for match #${matchId.toString()}.`;
}

function shortError(message: string | null | undefined, pick: <T,>(zh: T, en: T) => T) {
  if (!message) return null;
  if (message.includes('User rejected') || message.includes('rejected')) {
    return pick('你取消了这次签名。', 'You cancelled the signature.');
  }
  return message.slice(0, 90);
}

export function AutonomyClaimRequestPanel({
  tokenId,
  ownerAddress,
  matchId,
  claimable,
  preferredPath,
  hasConflict,
  policyEnabled,
  permissionCount,
  missingPermissions,
  emergencyPaused,
}: {
  tokenId: bigint;
  ownerAddress?: Address;
  matchId?: bigint;
  claimable: bigint;
  preferredPath: ClaimPathKey;
  hasConflict: boolean;
  policyEnabled: boolean;
  permissionCount: number;
  missingPermissions: string[];
  emergencyPaused: boolean;
}) {
  const { pick } = useI18n();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { data: hash, error, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });
  const [requestId, setRequestId] = useState<bigint | null>(null);
  const [awaitingWallet, setAwaitingWallet] = useState(false);

  const isOwner =
    Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();

  const payload = useMemo(() => {
    if (matchId === undefined) return undefined;
    const innerData = encodeAbiParameters([{ type: 'uint256' }], [matchId]);
    return encodeAbiParameters([{ type: 'uint8' }, { type: 'bytes' }], [MODE_CLAIM_EXISTING, innerData]);
  }, [matchId]);

  const prompt = useMemo(
    () => (matchId === undefined ? '' : buildClaimPrompt(tokenId, matchId)),
    [matchId, tokenId],
  );

  const blocker = useMemo(() => {
    if (!isOwner) return pick('先连接持有人钱包。', 'Connect the owner wallet first.');
    if (emergencyPaused) return pick('代理现在是暂停状态。', 'The agent is paused.');
    if (!policyEnabled) return pick('先把代理开起来。', 'Enable the agent first.');
    if (missingPermissions.length > 0) {
      return pick(`先补齐权限：${missingPermissions.join(' / ')}`, `Missing: ${missingPermissions.join(' / ')}`);
    }
    if (hasConflict) return pick('这笔奖励路径冲突，先别自动领。', 'This reward path conflicts.');
    if (preferredPath === 'owner' && claimable > 0n) {
      return pick('这笔奖励适合你手动领。', 'This reward should be claimed manually.');
    }
    if (matchId === undefined || claimable <= 0n) return pick('现在还没有可领奖励。', 'No reward is ready.');
    return null;
  }, [claimable, emergencyPaused, hasConflict, isOwner, matchId, missingPermissions, pick, policyEnabled, preferredPath]);

  const canSubmit =
    !blocker &&
    payload !== undefined &&
    matchId !== undefined &&
    preferredPath === 'autonomy' &&
    claimable > 0n;

  useEffect(() => {
    if (!receiptQuery.data) return;

    for (const log of receiptQuery.data.logs) {
      if (log.address.toLowerCase() !== addresses.oracleActionHub.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ClawOracleActionHubABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'AutonomousActionRequested') {
          const nextRequestId = decoded.args.requestId;
          if (typeof nextRequestId === 'bigint') {
            setRequestId(nextRequestId);
          }
        }
      } catch {
        continue;
      }
    }
  }, [receiptQuery.data]);

  useEffect(() => {
    if (!publicClient || !address || !canSubmit || payload === undefined) return;
    void publicClient.simulateContract({
      address: addresses.oracleActionHub,
      abi: ClawOracleActionHubABI,
      functionName: 'requestAutonomousAction',
      args: [
        tokenId,
        AUTONOMY_ACTION_KIND.battleRoyale,
        AUTONOMY_ASSET_ID.claworld,
        0n,
        payload,
        prompt,
        2,
      ],
      account: address,
    }).catch(() => {
      // keep UX light; submit path will surface any real error
    });
  }, [address, canSubmit, payload, prompt, publicClient, tokenId]);

  async function handleSubmit() {
    if (!canSubmit || payload === undefined) return;

    setRequestId(null);
    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.oracleActionHub,
        abi: ClawOracleActionHubABI,
        functionName: 'requestAutonomousAction',
        args: [
          tokenId,
          AUTONOMY_ACTION_KIND.battleRoyale,
          AUTONOMY_ASSET_ID.claworld,
          0n,
          payload,
          prompt,
          2,
        ],
      });
    } catch {
      // wagmi error shows via `error`
    } finally {
      setAwaitingWallet(false);
    }
  }

  const currentState = error
    ? shortError(error.message, pick)
    : awaitingWallet
      ? pick('去钱包确认这次领奖请求。', 'Confirm the claim request in your wallet.')
      : receiptQuery.isLoading
        ? pick('链上确认中。', 'Waiting for the receipt.')
        : requestId !== null
          ? pick(`请求 #${requestId.toString()} 已排队。`, `Request #${requestId.toString()} queued.`)
          : null;

  return (
    <section className={`cw-panel ${canSubmit ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('自动领奖', 'Auto claim')}</span>
          <h3>
            {matchId !== undefined
              ? pick(`第 #${matchId.toString()} 场`, `Match #${matchId.toString()}`)
              : pick('当前没有可领奖励', 'No reward ready')}
          </h3>
          <p className="cw-muted">
            {preferredPath === 'autonomy'
              ? pick('奖励会回到这只龙虾的记账账户。', 'The reward returns to this lobster ledger.')
              : preferredPath === 'owner'
                ? pick('这笔奖励现在走手动领奖。', 'This reward uses manual claim.')
                : pick('等对局结算后，这里会出现入口。', 'This area unlocks after settlement.')}
          </p>
        </div>
        <span className={`cw-chip ${canSubmit ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
          <Bot size={14} />
          {claimable > 0n ? formatCLW(claimable) : pick('空闲', 'Idle')}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">{pick('领取路径', 'Path')}</span>
          <strong>
            {preferredPath === 'autonomy'
              ? pick('代理领取', 'Agent')
              : preferredPath === 'owner'
                ? pick('手动领取', 'Owner')
                : pick('未找到', 'Not found')}
          </strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('准备度', 'Ready')}</span>
          <strong>{permissionCount}/4</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('可领金额', 'Claimable')}</span>
          <strong>{claimable > 0n ? formatCLW(claimable) : '--'}</strong>
        </div>
      </div>

      {blocker ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--cool">
            <Shield size={16} />
            <span>{blocker}</span>
          </div>
        </div>
      ) : null}

      {currentState ? (
        <div className="cw-list">
          <div className={`cw-list-item ${error ? 'cw-list-item--alert' : 'cw-list-item--warm'}`}>
            <Shield size={16} />
            <span>{currentState}</span>
          </div>
        </div>
      ) : null}

      <div className="cw-button-row">
        <button
          type="button"
          className="cw-button cw-button--primary"
          disabled={!canSubmit || awaitingWallet || receiptQuery.isLoading}
          onClick={handleSubmit}
        >
          <Bot size={16} />
          {awaitingWallet
            ? pick('等待签名', 'Waiting for signature')
            : receiptQuery.isLoading
              ? pick('链上确认中', 'Confirming')
              : pick('提交自动领奖', 'Request auto claim')}
        </button>

        {hash ? (
          <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-button cw-button--secondary">
            <ArrowUpRight size={16} />
            {pick('查看交易', 'View transaction')}
          </a>
        ) : null}
      </div>
    </section>
  );
}
