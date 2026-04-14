'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Coins, PauseCircle, PlayCircle, Settings2, Shield } from 'lucide-react';
import { parseEther } from 'viem';

import { AutonomyClaimRequestPanel } from '@/components/auto/AutonomyClaimRequestPanel';
import { AutonomyDirectivePanel } from '@/components/auto/AutonomyDirectivePanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { WalletGate } from '@/components/wallet/WalletGate';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_MIN_WALLET_HOLDING,
  AUTONOMY_MIN_WALLET_HOLDING_RAW,
  AUTONOMY_OPERATOR,
  AUTONOMY_PROTOCOL_ID,
  AUTONOMY_ROLE_MASK,
  useAutonomyActionSetup,
  useAutonomyActions,
  useAutonomyProofs,
} from '@/contracts/hooks/useAutonomy';
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type NextStep =
  | 'contracts'
  | 'owner'
  | 'wallet'
  | 'runtime'
  | 'protocol'
  | 'adapter'
  | 'operator'
  | 'roles'
  | 'lease'
  | 'risk'
  | 'policy'
  | 'resume'
  | 'active';

function parseAmount(value: string) {
  try {
    return parseEther(value && Number(value) >= 0 ? value : '0');
  } catch {
    return 0n;
  }
}

function receiptStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 4) return pick('已执行', 'Executed');
  if (status === 5) return pick('失败', 'Failed');
  if (status === 3) return pick('已完成', 'Finalized');
  if (status === 2) return pick('等待执行', 'Synced');
  if (status === 1) return pick('已排队', 'Queued');
  return pick('空闲', 'Idle');
}

function nextStepTitle(step: NextStep, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'contracts':
      return pick('主网代理地址还没配好', 'Autonomy contracts are not configured');
    case 'owner':
      return pick('先连接持有人钱包', 'Connect the owner wallet first');
    case 'wallet':
      return pick('钱包门槛还没到', 'Wallet threshold not met');
    case 'runtime':
      return pick('先补足这只龙虾的储备', 'Top up this lobster first');
    case 'protocol':
      return pick('授权协议', 'Approve protocol');
    case 'adapter':
      return pick('授权适配器', 'Approve adapter');
    case 'operator':
      return pick('授权代理执行者', 'Approve operator');
    case 'roles':
      return pick('授予代理角色', 'Grant operator roles');
    case 'lease':
      return pick('签发代理租约', 'Create operator lease');
    case 'risk':
      return pick('写入保底和熔断', 'Save reserve and breaker');
    case 'policy':
      return pick('启用代理', 'Enable agent');
    case 'resume':
      return pick('恢复代理', 'Resume agent');
    default:
      return pick('代理已开启', 'Agent is live');
  }
}

function nextStepDetail(step: NextStep, thresholdLabel: string, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'wallet':
      return pick(`当前持有人钱包至少要有 ${thresholdLabel}。`, `The owner wallet must hold at least ${thresholdLabel}.`);
    case 'runtime':
      return pick('这只龙虾的记账储备要先够用，代理才会真的去跑。', 'The lobster ledger needs enough reserve before the agent can act.');
    case 'active':
      return pick('后面就看最近结果和推理摘要。', 'From here you mainly watch recent results and reasoning.');
    case 'policy':
      return pick('这一步会把你的预算和风格写到链上。', 'This writes your budget and posture to chain.');
    case 'risk':
      return pick('这一步会写保底余额和失败熔断。', 'This writes the reserve floor and failure breaker.');
    default:
      return pick('按顺序点下去就行。', 'Just keep going in order.');
  }
}

function primaryButtonText(step: NextStep, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'protocol':
      return pick('授权协议', 'Approve protocol');
    case 'adapter':
      return pick('授权适配器', 'Approve adapter');
    case 'operator':
      return pick('授权执行者', 'Approve operator');
    case 'roles':
      return pick('授予角色', 'Grant roles');
    case 'lease':
      return pick('签发租约', 'Create lease');
    case 'risk':
      return pick('保存保底', 'Save reserve');
    case 'policy':
      return pick('启用代理', 'Enable agent');
    case 'resume':
      return pick('恢复代理', 'Resume agent');
    case 'active':
      return pick('代理运行中', 'Agent is live');
    case 'wallet':
      return pick('钱包门槛不足', 'Wallet threshold not met');
    case 'runtime':
      return pick('储备还不够', 'Reserve is too low');
    case 'owner':
      return pick('请切换钱包', 'Switch wallet');
    default:
      return pick('继续', 'Continue');
  }
}

function shortError(message: string | null | undefined, pick: <T,>(zh: T, en: T) => T) {
  if (!message) return null;
  if (message.includes('User rejected')) return pick('你取消了这次签名。', 'You cancelled the signature.');
  if (message.includes('rejected')) return pick('你取消了这次签名。', 'You cancelled the signature.');
  if (message.includes('execution reverted')) return pick('链上拒绝了这次动作，请先看条件是否满足。', 'The chain rejected this action.');
  return message.slice(0, 90);
}

export default function AutoPage() {
  const { pick } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastHandledHash, setLastHandledHash] = useState<string | null>(null);

  const companion = useActiveCompanion();
  const tokenId = companion.hasToken ? companion.tokenId : undefined;
  const thresholdLabel = `${AUTONOMY_MIN_WALLET_HOLDING_RAW} Claworld`;
  const holderWalletEligible = companion.walletClaworld >= AUTONOMY_MIN_WALLET_HOLDING;

  const claimWindow = useBattleRoyaleClaimWindow(tokenId, companion.ownerAddress);
  const setup = useAutonomyActionSetup({
    tokenId: tokenId ?? 0n,
    actionKind: AUTONOMY_ACTION_KIND.battleRoyale,
    protocolId: AUTONOMY_PROTOCOL_ID.battleRoyale,
    adapter: addresses.battleRoyaleAdapter,
  });
  const proofs = useAutonomyProofs(tokenId, AUTONOMY_PROTOCOL_ID.battleRoyale);
  const actions = useAutonomyActions();

  const [riskMode, setRiskMode] = useState(1);
  const [dailyLimit, setDailyLimit] = useState('2');
  const [maxSpend, setMaxSpend] = useState('100');
  const [minReserve, setMinReserve] = useState('200');
  const [maxFailures, setMaxFailures] = useState('3');

  useEffect(() => {
    if (!setup.policy || !setup.risk) return;
    setRiskMode(setup.policy.riskMode);
    setDailyLimit(String(setup.policy.dailyLimit || 2));
    setMaxSpend(String(Number(setup.policy.maxClwPerAction) / 1e18 || 0));
    setMinReserve(String(Number(setup.risk.minClwReserve) / 1e18 || 0));
    setMaxFailures(String(setup.risk.maxFailureStreak || 3));
  }, [setup.policy, setup.risk]);

  useEffect(() => {
    if (!actions.hash || !actions.isSuccess || lastHandledHash === actions.hash) return;
    setLastHandledHash(actions.hash);
    void Promise.all([setup.refresh(), proofs.refresh(), claimWindow.refresh()]);
  }, [actions.hash, actions.isSuccess, claimWindow, lastHandledHash, proofs, setup]);

  const desiredDailyLimit = Number(dailyLimit || '0');
  const desiredMaxSpendWei = parseAmount(maxSpend);
  const desiredReserveWei = parseAmount(minReserve);
  const desiredMaxFailures = Number(maxFailures || '0');
  const runtimeRequired = desiredReserveWei + desiredMaxSpendWei;
  const runtimeReady = companion.routerClaworld >= runtimeRequired;

  const riskNeedsUpdate =
    !setup.risk ||
    setup.risk.maxFailureStreak !== desiredMaxFailures ||
    setup.risk.minClwReserve !== desiredReserveWei;

  const policyNeedsUpdate =
    !setup.policy ||
    !setup.policy.enabled ||
    setup.policy.riskMode !== riskMode ||
    setup.policy.dailyLimit !== desiredDailyLimit ||
    setup.policy.maxClwPerAction !== desiredMaxSpendWei;

  const nextStep = useMemo<NextStep>(() => {
    if (!setup.ready) return 'contracts';
    if (!companion.ownerAddress || !companion.connected) return 'owner';
    if (!holderWalletEligible) return 'wallet';
    if (!runtimeReady) return 'runtime';
    if (!setup.protocolApproved) return 'protocol';
    if (!setup.adapterApproved) return 'adapter';
    if (!setup.operatorApproved) return 'operator';
    if (setup.operatorRoleMask !== AUTONOMY_ROLE_MASK.full) return 'roles';
    if (!setup.leaseActive) return 'lease';
    if (riskNeedsUpdate) return 'risk';
    if (policyNeedsUpdate) return 'policy';
    if (setup.risk?.emergencyPaused) return 'resume';
    return 'active';
  }, [
    companion.connected,
    companion.ownerAddress,
    holderWalletEligible,
    policyNeedsUpdate,
    riskNeedsUpdate,
    runtimeReady,
    setup.adapterApproved,
    setup.leaseActive,
    setup.operatorApproved,
    setup.operatorRoleMask,
    setup.protocolApproved,
    setup.ready,
    setup.risk,
  ]);

  const permissionReadiness = [
    { key: 'protocol', label: pick('协议', 'Protocol'), ready: setup.protocolApproved },
    { key: 'adapter', label: pick('适配器', 'Adapter'), ready: setup.adapterApproved },
    { key: 'operator', label: pick('执行者', 'Operator'), ready: setup.operatorApproved },
    { key: 'lease', label: pick('租约', 'Lease'), ready: setup.leaseActive },
  ] as const;

  const permissionCount = permissionReadiness.filter((item) => item.ready).length;
  const latestReceipt = proofs.receipts[0] as
    | {
        requestId?: bigint;
        status?: number;
        actualSpend?: bigint;
        clwCredit?: bigint;
        reasoningCid?: string;
        executionRef?: string;
        lastError?: string;
      }
    | undefined;

  const latestStatus = latestReceipt ? receiptStatusText(Number(latestReceipt.status ?? 0), pick) : pick('还没有结果', 'No result yet');
  const latestError = shortError(latestReceipt?.lastError ? String(latestReceipt.lastError) : null, pick);
  const actionError = shortError(actions.error?.message ? String(actions.error.message) : null, pick);
  const awaitingMessage = actions.isPending
    ? pick('去钱包确认这一步。', 'Confirm this step in your wallet.')
    : actions.isConfirming
      ? pick('链上确认中。', 'Waiting for the transaction receipt.')
      : null;

  function handlePrimaryAction() {
    if (!tokenId || actions.isPending || actions.isConfirming || !companion.ownerAddress) return;

    const leaseExpiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    if (nextStep === 'protocol') {
      actions.setApprovedProtocol(tokenId, AUTONOMY_PROTOCOL_ID.battleRoyale, true);
      return;
    }
    if (nextStep === 'adapter') {
      actions.setApprovedAdapter(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, addresses.battleRoyaleAdapter, true);
      return;
    }
    if (nextStep === 'operator') {
      actions.setApprovedOperator(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, AUTONOMY_OPERATOR, true);
      return;
    }
    if (nextStep === 'roles') {
      actions.setOperatorRoleMask(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full);
      return;
    }
    if (nextStep === 'lease') {
      actions.setDelegationLease(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full, leaseExpiry);
      return;
    }
    if (nextStep === 'risk') {
      actions.setRiskControls(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, desiredMaxFailures, minReserve || '0');
      return;
    }
    if (nextStep === 'policy') {
      actions.setPolicy(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, true, riskMode, desiredDailyLimit, maxSpend || '0');
      return;
    }
    if (nextStep === 'resume') {
      actions.setEmergencyPause(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, false);
    }
  }

  function handlePauseToggle() {
    if (!tokenId || !setup.policy?.enabled || actions.isPending || actions.isConfirming) return;
    actions.setEmergencyPause(tokenId, AUTONOMY_ACTION_KIND.battleRoyale, !Boolean(setup.risk?.emergencyPaused));
  }

  const canAct =
    nextStep !== 'contracts' &&
    nextStep !== 'owner' &&
    nextStep !== 'wallet' &&
    nextStep !== 'runtime' &&
    nextStep !== 'active';

  const primaryButtonDisabled = !canAct || actions.isPending || actions.isConfirming;

  return (
    <WalletGate
      title={pick('先连接持有人钱包', 'Connect owner wallet first')}
      detail={pick('连接后才可以开代理、改参数和看结果。', 'Connect before enabling the agent and editing settings.')}
    >
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('AI 代理', 'AI agent')}</span>
            <h3>{pick('大逃杀代理', 'Battle Royale agent')}</h3>
            <p className="cw-muted">{pick('当前这页只管：自动入场、补揭示、自动领奖。', 'This page handles auto entry, reveal maintenance, and reward claim.')}</p>
          </div>
          <span className={`cw-chip ${setup.policy?.enabled && !setup.risk?.emergencyPaused ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <Bot size={14} />
            {setup.policy?.enabled && !setup.risk?.emergencyPaused ? pick('已开启', 'Enabled') : pick('未开启', 'Disabled')}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('钱包门槛', 'Wallet threshold')}</span>
            <strong>{thresholdLabel}</strong>
            <p className="cw-muted">{pick(`当前 ${companion.walletClaworldText}`, `Now ${companion.walletClaworldText}`)}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('龙虾储备', 'Lobster reserve')}</span>
            <strong>{companion.routerClaworldText}</strong>
            <p className="cw-muted">{pick(`至少要 ${formatCLW(runtimeRequired)}`, `Needs at least ${formatCLW(runtimeRequired)}`)}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('最近结果', 'Latest result')}</span>
            <strong>{latestStatus}</strong>
            <p className="cw-muted">
              {latestReceipt ? `#${latestReceipt.requestId?.toString() ?? '-'}` : pick('还没有动作', 'No action yet')}
            </p>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('开通步骤', 'Setup')}</span>
            <h3>{nextStepTitle(nextStep, pick)}</h3>
            <p className="cw-muted">{nextStepDetail(nextStep, thresholdLabel, pick)}</p>
          </div>
          <span className={`cw-chip ${nextStep === 'active' ? 'cw-chip--growth' : 'cw-chip--warm'}`}>
            <Shield size={14} />
            {permissionCount}/4
          </span>
        </div>

        <div className="cw-field-grid">
          <label className="cw-field">
            <span className="cw-label">{pick('风格', 'Style')}</span>
            <select value={riskMode} onChange={(event) => setRiskMode(Number(event.target.value))} className="cw-input">
              <option value={0}>{pick('保守', 'Conservative')}</option>
              <option value={1}>{pick('平衡', 'Balanced')}</option>
              <option value={2}>{pick('激进', 'Aggressive')}</option>
            </select>
          </label>

          <label className="cw-field">
            <span className="cw-label">{pick('每日最多几次', 'Daily limit')}</span>
            <input value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} type="number" min="0" className="cw-input" />
          </label>

          <label className="cw-field">
            <span className="cw-label">{pick('单次最多花多少', 'Max spend')}</span>
            <input value={maxSpend} onChange={(event) => setMaxSpend(event.target.value)} type="number" min="0" step="0.01" className="cw-input" />
          </label>

          <label className="cw-field">
            <span className="cw-label">{pick('最低保底储备', 'Minimum reserve')}</span>
            <input value={minReserve} onChange={(event) => setMinReserve(event.target.value)} type="number" min="0" step="0.01" className="cw-input" />
          </label>
        </div>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--primary" disabled={primaryButtonDisabled} onClick={handlePrimaryAction}>
            <PlayCircle size={16} />
            {actions.isPending
              ? pick('等待签名', 'Waiting for signature')
              : actions.isConfirming
                ? pick('链上确认中', 'Confirming')
                : primaryButtonText(nextStep, pick)}
          </button>

          {setup.policy?.enabled ? (
            <button type="button" className="cw-button cw-button--ghost" disabled={actions.isPending || actions.isConfirming} onClick={handlePauseToggle}>
              {setup.risk?.emergencyPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
              {setup.risk?.emergencyPaused ? pick('恢复代理', 'Resume agent') : pick('暂停代理', 'Pause agent')}
            </button>
          ) : null}

          <button type="button" className="cw-button cw-button--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            <Settings2 size={16} />
            {showAdvanced ? pick('收起高级', 'Hide advanced') : pick('高级', 'Advanced')}
          </button>
        </div>

        {awaitingMessage ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>{awaitingMessage}</span>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{actionError}</span>
            </div>
          </div>
        ) : null}
      </section>

      {tokenId !== undefined ? (
        <AutonomyDirectivePanel
          tokenId={tokenId}
          actionKind={AUTONOMY_ACTION_KIND.battleRoyale}
          ownerAddress={companion.ownerAddress}
          title={pick('一句提示', 'Prompt')}
        />
      ) : null}

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('最近结果', 'Latest result')}</span>
            <h3>{latestReceipt ? pick(`请求 #${latestReceipt.requestId?.toString() ?? '-'}`, `Request #${latestReceipt.requestId?.toString() ?? '-'}`) : pick('还没有自动动作', 'No recent action')}</h3>
            <p className="cw-muted">
              {latestReceipt?.reasoningCid
                ? pick('这次已经生成推理证明，展开高级就能看。', 'This action has a reasoning proof. Open Advanced to inspect it.')
                : pick('这里会显示最近一笔自动动作和结果。', 'This area shows the latest autonomous action and result.')}
            </p>
          </div>
          <span className={`cw-chip ${latestReceipt && Number(latestReceipt.status ?? 0) === 4 ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <CheckCircle2 size={14} />
            {latestStatus}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('花费', 'Spend')}</span>
            <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.actualSpend ?? 0n)) : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('回款', 'Credit')}</span>
            <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.clwCredit ?? 0n)) : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('错误', 'Error')}</span>
            <strong>{latestError ?? '--'}</strong>
          </div>
        </div>
      </section>

      {showAdvanced ? (
        <>
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('高级', 'Advanced')}</span>
                <h3>{pick('权限和细节', 'Permissions and details')}</h3>
              </div>
            </div>
            <div className="cw-list">
              {permissionReadiness.map((item) => (
                <div key={item.key} className={`cw-list-item ${item.ready ? 'cw-list-item--growth' : 'cw-list-item--alert'}`}>
                  {item.ready ? <CheckCircle2 size={16} /> : <Shield size={16} />}
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="cw-list-item cw-list-item--cool">
                <Coins size={16} />
                <span>{pick(`失败熔断 ${maxFailures} 次`, `Failure breaker ${maxFailures}`)}</span>
              </div>
              {latestReceipt?.reasoningCid ? (
                <div className="cw-list-item cw-list-item--cool">
                  <Bot size={16} />
                  <span>{pick(`推理证明 ${latestReceipt.reasoningCid}`, `Reasoning proof ${latestReceipt.reasoningCid}`)}</span>
                </div>
              ) : null}
              {latestReceipt?.executionRef ? (
                <div className="cw-list-item cw-list-item--cool">
                  <Bot size={16} />
                  <span>{pick(`执行回执 ${latestReceipt.executionRef}`, `Execution ref ${latestReceipt.executionRef}`)}</span>
                </div>
              ) : null}
            </div>
          </section>

          {tokenId !== undefined ? (
            <AutonomyClaimRequestPanel
              tokenId={tokenId}
              ownerAddress={companion.ownerAddress}
              matchId={claimWindow.matchId}
              claimable={claimWindow.claimable}
              preferredPath={claimWindow.preferredPath?.key}
              hasConflict={claimWindow.hasConflict}
              policyEnabled={Boolean(setup.policy?.enabled)}
              permissionCount={permissionCount}
              missingPermissions={permissionReadiness.filter((item) => !item.ready).map((item) => item.label)}
              emergencyPaused={Boolean(setup.risk?.emergencyPaused)}
            />
          ) : null}
        </>
      ) : null}
    </WalletGate>
  );
}
