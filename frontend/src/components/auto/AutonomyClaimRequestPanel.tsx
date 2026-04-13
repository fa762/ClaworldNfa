'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bot, Shield, Swords } from 'lucide-react';
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
import { formatBNB, formatCLW, truncateAddress } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ClaimPathKey = 'owner' | 'autonomy' | null | undefined;

const MODE_CLAIM_EXISTING = 3;

function buildClaimPrompt(tokenId: bigint, matchId: bigint) {
  return `为 NFA #${tokenId.toString()} 领取第 #${matchId.toString()} 场已结算的大逃杀奖励。`;
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
  const [gasCostWei, setGasCostWei] = useState<bigint | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
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

  const blockers = useMemo(() => {
    const next: string[] = [];
    if (!isOwner) {
      next.push(pick('先连接持有人钱包。', 'Connect the owner wallet first.'));
    }
    if (emergencyPaused) {
      next.push(pick('代理当前已暂停。', 'Agent is paused.'));
    }
    if (!policyEnabled) {
      next.push(pick('先启用策略。', 'Enable the policy first.'));
    }
    if (missingPermissions.length > 0) {
      next.push(pick(`先补权限：${missingPermissions.join(' / ')}`, `Missing: ${missingPermissions.join(' / ')}`));
    }
    if (hasConflict) {
      next.push(pick('领取路径冲突，先别提交。', 'Claim path conflicts.'));
    }
    if (preferredPath === 'owner' && claimable > 0n) {
      next.push(pick('这笔奖励该直接手动领取。', 'Use direct owner claim for this reward.'));
    }
    if (matchId === undefined || claimable <= 0n) {
      next.push(pick('当前没有可提交的奖励。', 'No reward is ready.'));
    }
    return next;
  }, [claimable, emergencyPaused, hasConflict, isOwner, matchId, missingPermissions, policyEnabled, preferredPath, pick]);

  const canSubmit =
    blockers.length === 0 &&
    payload !== undefined &&
    matchId !== undefined &&
    preferredPath === 'autonomy' &&
    claimable > 0n;

  const requestPulse = error
    ? {
        tone: 'cw-panel--cool',
        chip: pick('失败', 'Failed'),
        chipTone: 'cw-chip--alert',
        title: pick('自治请求失败', 'Autonomy request failed'),
        detail: error.message,
      }
    : awaitingWallet
      ? {
          tone: 'cw-panel--warm',
          chip: pick('等待签名', 'Waiting for signature'),
          chipTone: 'cw-chip--warm',
          title: pick('去钱包确认', 'Confirm in wallet'),
          detail: pick('这笔领取请求已经准备好。', 'The request is ready.'),
        }
      : receiptQuery.isLoading
        ? {
            tone: 'cw-panel--warm',
            chip: pick('确认中', 'Confirming'),
            chipTone: 'cw-chip--warm',
            title: pick('请求已发出', 'Request confirming'),
            detail: pick('正在等链上回执。', 'Waiting for the receipt.'),
          }
        : requestId !== null
          ? {
              tone: 'cw-panel--warm',
              chip: pick('已入队', 'Queued'),
              chipTone: 'cw-chip--growth',
              title: pick(`请求 #${requestId.toString()} 已入队`, `Request #${requestId.toString()} queued`),
              detail: pick('等待代理执行。', 'Waiting for the agent to execute it.'),
            }
          : hash
            ? {
              tone: 'cw-panel--warm',
              chip: pick('已提交', 'Submitted'),
              chipTone: 'cw-chip--cool',
              title: pick('请求已提交', 'Request submitted'),
              detail: pick('如果编号还没出来，等回执即可。', 'Wait for the receipt if the id is still blank.'),
            }
            : null;

  useEffect(() => {
    let cancelled = false;

    async function estimate() {
      if (!publicClient || !address || !canSubmit || payload === undefined) {
        setGasCostWei(null);
        setEstimateError(null);
        return;
      }

      try {
        const [estimated, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
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
          }),
          publicClient.getGasPrice(),
        ]);

        if (!cancelled) {
          setGasCostWei(estimated * gasPrice);
          setEstimateError(null);
        }
      } catch (estimateFailure) {
        if (!cancelled) {
          setGasCostWei(null);
          setEstimateError((estimateFailure as Error).message);
        }
      }
    }

    void estimate();

    return () => {
      cancelled = true;
    };
  }, [address, canSubmit, payload, prompt, publicClient, tokenId]);

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
      // wagmi error renders via error state
    } finally {
      setAwaitingWallet(false);
    }
  }

  return (
    <section className={`cw-panel ${canSubmit ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('领取请求', 'Claim request')}</span>
          <h3>
            {matchId !== undefined
              ? pick(`提交第 #${matchId.toString()} 场的领取`, `Claim match #${matchId.toString()}`)
              : pick('当前没有可提交的奖励', 'No claimable reward')}
          </h3>
          <p className="cw-muted">
            {preferredPath === 'owner'
              ? pick('这笔奖励该直接手动领取。', 'Use direct owner claim.')
              : preferredPath === 'autonomy'
                ? pick('这笔奖励可以交给代理。', 'This reward can go through the agent.')
                : pick('先等下一笔可领奖结果。', 'Wait for the next settled reward.')}
          </p>
        </div>
        <span className={`cw-chip ${canSubmit ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
          <Bot size={14} />
          {claimable > 0n ? formatCLW(claimable) : pick('空闲', 'Idle')}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">{pick('claim 路径', 'Claim path')}</span>
          <strong>
            {preferredPath === 'autonomy'
              ? pick('代理领取', 'Agent')
              : preferredPath === 'owner'
                ? pick('手动领取', 'Owner wallet')
                : pick('未找到', 'Not found')}
          </strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('权限', 'Ready')}</span>
          <strong>{pick(`${permissionCount}/4 就绪`, `${permissionCount}/4 ready`)}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('预计 gas', 'Estimated gas')}</span>
          <strong>{gasCostWei !== null ? formatBNB(gasCostWei, 6) : '--'} BNB</strong>
        </div>
      </div>

      {requestPulse ? (
        <div className={`cw-panel ${requestPulse.tone}`}>
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('状态', 'State')}</span>
              <h3>{requestPulse.title}</h3>
              <p className="cw-muted">{requestPulse.detail}</p>
            </div>
            <span className={`cw-chip ${requestPulse.chipTone}`}>{requestPulse.chip}</span>
          </div>
          {hash ? (
            <div className="cw-button-row">
              <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-button cw-button--secondary">
                <ArrowUpRight size={16} />
                {pick('查看请求交易', 'View request transaction')}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="cw-list">
          {blockers.map((blocker) => (
            <div key={blocker} className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{blocker}</span>
            </div>
          ))}
          {estimateError ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{pick(`gas 估算失败：${estimateError}`, `Gas estimate failed: ${estimateError}`)}</span>
            </div>
          ) : null}
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
              : pick('提交领取请求', 'Request autonomy claim')}
        </button>
      </div>

      {awaitingWallet ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Shield size={16} />
            <span>{pick('现在去钱包确认。', 'Confirm in your wallet now.')}</span>
          </div>
        </div>
      ) : receiptQuery.isLoading ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--cool">
            <Shield size={16} />
            <span>{pick('交易已发出，正在等编号。', 'Waiting for the request id.')}</span>
          </div>
        </div>
      ) : null}

      {requestId !== null ? (
        <p className="cw-result-celebration">
          {pick(`请求 #${requestId.toString()} 已成功入队。`, `Request #${requestId.toString()} queued.`)}
        </p>
      ) : null}
    </section>
  );
}
