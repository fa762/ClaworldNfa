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
  return `Claim the settled Battle Royale reward for NFA #${tokenId.toString()} in match #${matchId.toString()} if it is available now.`;
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
      next.push(
        pick(
          '必须保持 owner 钱包连接，才能提交自治 claim request。',
          'Owner wallet must stay connected to submit the request.',
        ),
      );
    }
    if (emergencyPaused) {
      next.push(
        pick('自治风控当前处于 emergency paused。', 'Autonomy risk controls are emergency-paused.'),
      );
    }
    if (!policyEnabled) {
      next.push(
        pick('Battle Royale 的自治 policy 还没启用。', 'Battle Royale policy is not enabled yet.'),
      );
    }
    if (missingPermissions.length > 0) {
      next.push(
        pick(
          `还缺 ${missingPermissions.join(' / ')}，先把这些权限补齐再提交 claim request。`,
          `Missing ${missingPermissions.join(' / ')}. Complete those boundaries before submitting the claim request.`,
        ),
      );
    }
    if (hasConflict) {
      next.push(
        pick(
          'owner 和 autonomy participant 路径冲突，不能盲提 claim。',
          'Owner and autonomy participant paths conflict. Do not queue a blind claim.',
        ),
      );
    }
    if (preferredPath === 'owner' && claimable > 0n) {
      next.push(
        pick(
          '这笔奖励走 owner-wallet 路径，应该直接 owner claim。',
          'This reward is on the owner-wallet path, so use direct claim instead.',
        ),
      );
    }
    if (matchId === undefined || claimable <= 0n) {
      next.push(
        pick(
          '当前没有可走自治路径的 settled 奖励。',
          'No settled autonomy-side reward is ready to claim.',
        ),
      );
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
          title: pick('请到钱包里确认 request', 'Confirm the request in the wallet'),
          detail: pick(
            'action hub request 已准备好，现在只差 owner 钱包签名。',
            'The bounded request is ready. Confirm it in the owner wallet to continue.',
          ),
        }
      : receiptQuery.isLoading
        ? {
            tone: 'cw-panel--warm',
            chip: pick('确认中', 'Confirming'),
            chipTone: 'cw-chip--warm',
            title: pick('自治请求链上确认中', 'Autonomy request is confirming'),
            detail: pick(
              '交易已经发出，等回执回来后会解出 request id。',
              'The request transaction is on-chain. Wait for the receipt so the emitted request id can be decoded.',
            ),
          }
        : requestId !== null
          ? {
              tone: 'cw-panel--warm',
              chip: pick('已入队', 'Queued'),
              chipTone: 'cw-chip--growth',
              title: pick(`请求 #${requestId.toString()} 已入队`, `Request #${requestId.toString()} queued`),
              detail: pick(
                '这条 Battle Royale claim request 已进入 action hub。',
                'The action hub now holds this Battle Royale claim request on the bounded autonomy path.',
              ),
            }
          : hash
            ? {
                tone: 'cw-panel--warm',
                chip: pick('已提交', 'Submitted'),
                chipTone: 'cw-chip--cool',
                title: pick('请求交易已提交', 'Request transaction submitted'),
                detail: pick(
                  '交易已经可在链上查看，如果 request id 还没解出来，就保持这个页面打开。',
                  'The transaction is visible on-chain. If the request id is still blank, keep this page open until the receipt decode completes.',
                ),
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
          <span className="cw-label">{pick('Battle Royale claim request', 'Battle Royale claim request')}</span>
          <h3>
            {matchId !== undefined
              ? pick(`为第 #${matchId.toString()} 场排队自治 claim`, `Queue autonomy claim for match #${matchId.toString()}`)
              : pick('当前没有可走自治 claim request 的 settled 奖励', 'No settled reward is ready for an autonomy claim request')}
          </h3>
          <p className="cw-muted">
            {pick(
              '只有当奖励确实在 autonomy participant 路径上时，才把 claim request 交给 action hub。',
              'Submit a bounded claim request to the action hub only when the reward is claimable on the autonomy participant path.',
            )}
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
              ? pick('自治 participant', 'Autonomy participant')
              : preferredPath === 'owner'
                ? pick('owner 钱包', 'Owner wallet')
                : pick('未找到', 'Not found')}
          </strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('边界就绪', 'Operator boundaries')}</span>
          <strong>{pick(`${permissionCount}/4 就绪`, `${permissionCount}/4 ready`)}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('预计 gas', 'Estimated gas')}</span>
          <strong>{gasCostWei !== null ? formatBNB(gasCostWei, 6) : '--'} BNB</strong>
        </div>
      </div>

      <div className="cw-detail-list">
        <div className="cw-detail-row">
          <span>{pick('当前钱包', 'Connected wallet')}</span>
          <strong>{address ? truncateAddress(address) : pick('未连接', 'Not connected')}</strong>
        </div>
        <div className="cw-detail-row">
          <span>{pick('持有人', 'Owner')}</span>
          <strong>{ownerAddress ? truncateAddress(ownerAddress) : pick('未知', 'Unknown')}</strong>
        </div>
        <div className="cw-detail-row">
          <span>{pick('目标奖励', 'Requested reward')}</span>
          <strong>{formatCLW(claimable)}</strong>
        </div>
        <div className="cw-detail-row">
          <span>{pick('花费金额', 'Spend amount')}</span>
          <strong>0</strong>
        </div>
      </div>

      <div className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('Prompt 预览', 'Prompt preview')}</span>
            <h3>{pick('action-hub 请求文本', 'Action-hub request text')}</h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Swords size={14} />
            {pick('2 档决策', '2 choices')}
          </span>
        </div>
        <p className="cw-muted">
          {prompt || pick('找到 settled 可领奖局后，这里会出现 prompt。', 'Prompt will appear once a settled claimable match is found.')}
        </p>
      </div>

      {requestPulse ? (
        <div className={`cw-panel ${requestPulse.tone}`}>
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('请求脉冲', 'Request pulse')}</span>
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
              : pick('提交自治 claim request', 'Request autonomy claim')}
        </button>
      </div>

      {awaitingWallet ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Shield size={16} />
            <span>
              {pick(
                '现在去钱包里确认这笔自治 request。确认完成前，保持这个页面打开。',
                'Open the wallet and confirm this autonomy request. Keep this page open until the signature is complete.',
              )}
            </span>
          </div>
        </div>
      ) : receiptQuery.isLoading ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--cool">
            <Shield size={16} />
            <span>
              {pick(
                '交易已经发到链上，正在等 request id 回执。确认完成后，这里会自动解出请求编号。',
                'The transaction is live on-chain and waiting for the request-id receipt. This panel will decode the request number automatically after confirmation.',
              )}
            </span>
          </div>
        </div>
      ) : null}

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          {pick('查看请求交易', 'View request transaction')} <ArrowUpRight size={14} />
        </a>
      ) : null}

      {requestId !== null ? (
        <p className="cw-result-celebration">
          {pick(`请求 #${requestId.toString()} 已成功入队。`, `Request #${requestId.toString()} queued.`)}
        </p>
      ) : null}
    </section>
  );
}
