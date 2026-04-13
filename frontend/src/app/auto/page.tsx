'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, Coins, Shield, XCircle } from 'lucide-react';

import { AutonomyClaimRequestPanel } from '@/components/auto/AutonomyClaimRequestPanel';
import { AutonomyDirectivePanel } from '@/components/auto/AutonomyDirectivePanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import { WalletGate } from '@/components/wallet/WalletGate';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_PROTOCOL_ID,
  useAutonomyActionSetup,
  useAutonomyProofs,
} from '@/contracts/hooks/useAutonomy';
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

function receiptStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 4) return pick('已执行', 'Executed');
  if (status === 5) return pick('失败', 'Failed');
  if (status === 3) return pick('已终结', 'Finalized');
  if (status === 2) return pick('已同步', 'Synced');
  if (status === 1) return pick('已履约', 'Fulfilled');
  return pick('等待中', 'Pending');
}

function receiptStatusTone(status: number) {
  if (status === 5) return 'cw-chip--alert';
  if (status === 4 || status === 3) return 'cw-chip--growth';
  if (status === 2 || status === 1) return 'cw-chip--cool';
  return 'cw-chip--warm';
}

function receiptListTone(status: number) {
  if (status === 5) return 'cw-list-item--alert';
  if (status === 4 || status === 3) return 'cw-list-item--growth';
  return 'cw-list-item--cool';
}

function receiptSummary(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 5) {
    return pick(
      '上一条自治请求已经落到终态失败，需要 operator 级别排查后再重放。',
      'The last autonomy request reached a terminal failure state and needs an operator-level read before replay.',
    );
  }
  if (status === 4) {
    return pick(
      '上一条自治请求已经链上执行，后续只需要看 receipt 和 proof。',
      'The last autonomy request executed on-chain and now sits in the receipt/proof path.',
    );
  }
  if (status === 3) {
    return pick(
      '上一条自治请求已经 finalize，结算闭环完成。',
      'The last autonomy request is finalized. Settlement is closed and only audit surfaces remain.',
    );
  }
  if (status === 2) {
    return pick(
      '上一条自治请求已经 synced，正在等执行。',
      'The last autonomy request is synced and waiting for execution.',
    );
  }
  if (status === 1) {
    return pick(
      '上一条自治请求已经 fulfilled，正在往 synced 执行推进。',
      'The last autonomy request is fulfilled and moving toward synced execution.',
    );
  }
  return pick(
    '上一条自治请求还在等待态，尚未进入 fulfilled 执行阶段。',
    'The last autonomy request is still pending and has not crossed into fulfilled execution yet.',
  );
}

export default function AutoPage() {
  const { pick } = useI18n();
  const [refreshingAuto, setRefreshingAuto] = useState(false);
  const companion = useActiveCompanion();
  const tokenId = companion.hasToken ? companion.tokenId : undefined;
  const battleRoyale = useBattleRoyaleOverview();
  const battleRoyaleParticipant = useBattleRoyaleParticipantState(
    battleRoyale.matchId,
    tokenId,
    companion.ownerAddress,
  );
  const claimWindow = useBattleRoyaleClaimWindow(tokenId, companion.ownerAddress);

  const setup = useAutonomyActionSetup({
    tokenId: tokenId ?? 0n,
    actionKind: AUTONOMY_ACTION_KIND.battleRoyale,
    protocolId: AUTONOMY_PROTOCOL_ID.battleRoyale,
    adapter: addresses.battleRoyaleAdapter,
  });
  const proofs = useAutonomyProofs(tokenId, AUTONOMY_PROTOCOL_ID.battleRoyale);

  const permissionReadiness = [
    {
      key: 'protocol',
      label: pick('协议批准', 'Protocol approval'),
      detail: pick('Battle Royale protocol 已在 registry 中批准。', 'Battle Royale protocol is approved in the registry.'),
      ready: setup.protocolApproved,
    },
    {
      key: 'adapter',
      label: pick('Adapter 批准', 'Adapter approval'),
      detail: pick('当前 Battle Royale adapter 已绑定到这个 actionKind。', 'The current Battle Royale adapter is approved for this action kind.'),
      ready: setup.adapterApproved,
    },
    {
      key: 'operator',
      label: pick('Operator 批准', 'Operator approval'),
      detail: pick('自治 operator 已被 owner 授权。', 'The autonomy operator is approved by the owner.'),
      ready: setup.operatorApproved,
    },
    {
      key: 'lease',
      label: pick('Delegation lease', 'Delegation lease'),
      detail: pick('执行租约仍然有效，自治执行不会被 registry 拒绝。', 'The execution lease is still active, so registry checks will not reject the operator.'),
      ready: setup.leaseActive,
    },
  ] as const;

  const permissionCount = permissionReadiness.filter((item) => item.ready).length;
  const missingPermissions = permissionReadiness
    .filter((item) => !item.ready)
    .map((item) => item.label);

  const autoCards = [
    {
      title: pick('Directive 面板', 'Directive surface'),
      value: setup.policy?.enabled
        ? pick(
            `风险模式 ${setup.policy.riskMode} / 日限额 ${setup.policy.dailyLimit}`,
            `Risk mode ${setup.policy.riskMode} / daily ${setup.policy.dailyLimit}`,
          )
        : pick('policy 还没启用', 'Policy not enabled yet'),
      icon: Bot,
      tone: setup.policy?.enabled ? 'cw-card--safe' : 'cw-card--warning',
    },
    {
      title: pick('运行时余额', 'Runtime balance'),
      value: `${companion.routerClaworldText} ${pick('储备', 'reserve')} / ${companion.dailyCostText} ${pick('维护', 'upkeep')}`,
      icon: Coins,
      tone:
        companion.upkeepDays !== null && companion.upkeepDays > 2
          ? 'cw-card--watch'
          : 'cw-card--warning',
    },
    {
      title: pick('权限边界', 'Permissions'),
      value:
        permissionCount === 4
          ? pick('4/4 全部就绪', '4/4 fully ready')
          : pick(`缺 ${4 - permissionCount} 项`, `${4 - permissionCount} missing`),
      icon: Shield,
      tone: permissionCount === 4 ? 'cw-card--safe' : 'cw-card--warning',
    },
  ] as const;

  const receiptItems = proofs.receipts.slice(0, 2) as Array<{
    requestId?: bigint;
    status?: number;
    actualSpend?: bigint;
    clwCredit?: bigint;
    lastError?: string;
    reasoningCid?: string;
  }>;
  const latestReceipt = receiptItems[0] ?? null;
  const latestReceiptStatus = Number(latestReceipt?.status ?? 0);
  const autoErrors = [
    setup.error instanceof Error ? setup.error.message : null,
    proofs.error instanceof Error ? proofs.error.message : null,
    battleRoyale.hasError ? battleRoyale.errorText ?? pick('Battle Royale 读取失败。', 'Battle Royale read failed.') : null,
    claimWindow.error,
  ].filter((value): value is string => Boolean(value));
  const autoLoading =
    setup.isLoading ||
    proofs.isLoading ||
    battleRoyale.isLoading ||
    battleRoyaleParticipant.isLoading ||
    claimWindow.isLoading;
  const autoRefreshing =
    refreshingAuto ||
    setup.isRefreshing ||
    proofs.isRefreshing ||
    battleRoyale.isRefreshing ||
    claimWindow.isLoading;

  async function handleRefreshAuto() {
    setRefreshingAuto(true);
    try {
      await Promise.all([
        setup.refresh(),
        proofs.refresh(),
        battleRoyale.refresh(),
        claimWindow.refresh(),
      ]);
    } finally {
      setRefreshingAuto(false);
    }
  }

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{pick('自治代理', 'Autonomy')}</p>
            <h2 className="cw-section-title">
              {pick(
                `${companion.name} 现在能看到真实自治边界。`,
                `${companion.name} now shows live autonomy boundaries.`,
              )}
            </h2>
            <p className="cw-muted">
              {pick(
                '这个页面现在会读取 Battle Royale 自治路径的真实 policy、权限和 proof 状态。',
                'This page now reads real policy, permission, and proof state for the Battle Royale autonomy path.',
              )}
            </p>
          </div>
          <div className="cw-score">
            <strong>
              {setup.risk?.emergencyPaused
                ? pick('暂停', 'Paused')
                : setup.policy?.enabled
                  ? pick('已上线', 'Live')
                  : pick('待配置', 'Setup')}
            </strong>
            <span>{pick('模式', 'mode')}</span>
          </div>
        </div>
      </section>

      <WalletGate
        title={pick('先连接 owner 钱包，再编辑自治设置。', 'Connect the owner wallet before editing autonomy.')}
        detail={pick(
          'directive 签名、claim request 和权限读取都依赖当前钱包和已拥有的 NFA。',
          'Directive signing, claim requests, and permission reads all depend on the current wallet and owned NFA.',
        )}
      >
        <OwnedCompanionRail
          title={pick('自治编组', 'Managed roster')}
          subtitle={pick(
            '先切换当前龙虾，再查看它的 policy、ledger 和自治 claim 路径。',
            'Switch the active lobster before checking policy, ledger, and autonomy claim path.',
          )}
        />

        {autoLoading ? (
          <>
            <section className="cw-card-stack">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`auto-card-loading-${index}`} className="cw-skeleton-block cw-skeleton-block--card" />
              ))}
            </section>

            <section className="cw-panel cw-panel--cool">
              <div className="cw-loading-card">
                <div className="cw-skeleton-line cw-skeleton-line--short" />
                <div className="cw-skeleton-line" />
                <div className="cw-skeleton-line cw-skeleton-line--mid" />
                <div className="cw-skeleton-grid">
                  <div className="cw-skeleton-block" />
                  <div className="cw-skeleton-block" />
                  <div className="cw-skeleton-block" />
                </div>
              </div>
            </section>

            <section className="cw-panel cw-panel--warm">
              <div className="cw-loading-card">
                <div className="cw-skeleton-line cw-skeleton-line--short" />
                <div className="cw-skeleton-line" />
                <div className="cw-skeleton-grid">
                  <div className="cw-skeleton-block" />
                  <div className="cw-skeleton-block" />
                  <div className="cw-skeleton-block" />
                </div>
                <div className="cw-skeleton-line" />
              </div>
            </section>
          </>
        ) : (
          <>
        {autoErrors.length > 0 ? (
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <p className="cw-label">{pick('读数恢复', 'Read recovery')}</p>
                <h3>{pick('有一组自治读数没成功回来。', 'One or more autonomy reads did not return cleanly.')}</h3>
                <p className="cw-muted">
                  {pick(
                    '先在页内重试，不要让用户掉进看起来像“空状态”的假象里。',
                    'Retry in-page first instead of letting the UI collapse into a fake empty state.',
                  )}
                </p>
              </div>
              <button
                type="button"
                className="cw-button cw-button--secondary"
                disabled={autoRefreshing}
                onClick={() => void handleRefreshAuto()}
              >
                <Shield size={16} />
                {autoRefreshing ? pick('重读中', 'Refreshing') : pick('重新读取', 'Retry reads')}
              </button>
            </div>
            <div className="cw-list">
              {autoErrors.map((message, index) => (
                <div key={`auto-error-${index}`} className="cw-list-item cw-list-item--cool">
                  <XCircle size={16} />
                  <span>{message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="cw-card-stack">
          {autoCards.map(({ title, value, icon: Icon, tone }) => (
            <article key={title} className={`cw-card ${tone}`}>
              <div className="cw-card-icon">
                <Icon size={18} />
              </div>
              <div className="cw-card-copy">
                <p className="cw-label">{title}</p>
                <h3>{value}</h3>
              </div>
            </article>
          ))}
        </section>

        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <p className="cw-label">{pick('权限缺口', 'Permission gates')}</p>
              <h3>
                {permissionCount === 4
                  ? pick('当前 Battle Royale 自治权限已经齐了。', 'All Battle Royale autonomy gates are ready.')
                  : pick('先把缺的权限补齐，再发自治 request。', 'Complete the missing gates before sending an autonomy request.')}
              </h3>
              <p className="cw-muted">
                {pick(
                  '不要只看 25% / 50% 这类聚合条，下面直接列出哪一项卡住了。',
                  'Do not rely on a single readiness bar. The exact blocked gate is listed below.',
                )}
              </p>
            </div>
            <span className={`cw-chip ${permissionCount === 4 ? 'cw-chip--growth' : 'cw-chip--alert'}`}>
              <Shield size={14} />
              {permissionCount}/4
            </span>
          </div>
          <div className="cw-list">
            {permissionReadiness.map((item) => (
              <div
                key={item.key}
                className={`cw-list-item ${item.ready ? 'cw-list-item--growth' : 'cw-list-item--alert'}`}
              >
                {item.ready ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>
                  <strong>{item.label}</strong>
                  {' / '}
                  {item.ready
                    ? pick('已就绪', 'Ready')
                    : pick('未就绪', 'Missing')}
                  {' / '}
                  {item.detail}
                </span>
              </div>
            ))}
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
            missingPermissions={missingPermissions}
            emergencyPaused={Boolean(setup.risk?.emergencyPaused)}
          />
        ) : null}

        {tokenId !== undefined ? (
          <AutonomyDirectivePanel
            tokenId={tokenId}
            actionKind={AUTONOMY_ACTION_KIND.battleRoyale}
            ownerAddress={companion.ownerAddress}
            title={pick('Directive 面板', 'Directive surface')}
          />
        ) : null}

        <section className={`cw-panel ${latestReceipt && latestReceiptStatus === 5 ? 'cw-panel--cool' : 'cw-panel--warm'}`}>
          <div className="cw-section-head">
            <div>
              <p className="cw-label">{pick('自治脉冲', 'Autonomy pulse')}</p>
              <h3>
                {latestReceipt
                  ? pick(
                      `请求 #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(latestReceiptStatus, pick)}`,
                      `Request #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(latestReceiptStatus, pick)}`,
                    )
                  : pick('还没有最近一条 Battle Royale 自治回执', 'No recent Battle Royale autonomy receipt yet')}
              </h3>
              <p className="cw-muted">
                {latestReceipt
                  ? receiptSummary(latestReceiptStatus, pick)
                  : pick(
                      '等请求开始落地后，这里会直接给出最新状态、花费、credit 和失败原因。',
                      'As requests start to land, this panel will surface the latest state, spend, credit, and failure reason without sending the user into raw logs first.',
                    )}
              </p>
            </div>
            <span className={`cw-chip ${latestReceipt ? receiptStatusTone(latestReceiptStatus) : 'cw-chip--cool'}`}>
              <Bot size={14} />
              {latestReceipt ? receiptStatusText(latestReceiptStatus, pick) : pick('空闲', 'Idle')}
            </span>
          </div>
          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">{pick('最新请求', 'Latest request')}</span>
              <strong>{latestReceipt ? `#${latestReceipt.requestId?.toString() ?? '-'}` : '--'}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('花费', 'Spend')}</span>
              <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.actualSpend ?? 0n)) : '--'}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('Credit', 'Credit')}</span>
              <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.clwCredit ?? 0n)) : '--'}</strong>
            </div>
          </div>
          <div className="cw-list">
            <div className={`cw-list-item ${latestReceipt ? receiptListTone(latestReceiptStatus) : 'cw-list-item--cool'}`}>
              <Shield size={16} />
              <span>
                {latestReceipt
                  ? latestReceipt.lastError
                    ? pick(`最近错误：${latestReceipt.lastError}`, `Latest receipt error: ${latestReceipt.lastError}`)
                    : latestReceipt.reasoningCid
                      ? pick(`reasoning proof：${latestReceipt.reasoningCid}`, `Reasoning proof attached: ${latestReceipt.reasoningCid}`)
                      : pick(
                          '这条回执没有可见失败串，继续看 proof 和交易路径即可。',
                          'This receipt has no exposed failure string. Use the proof and tx path if a deeper audit is needed.',
                        )
                  : pick('当前龙虾还没有最近一条可读回执。', 'No recent receipt is available for the current lobster.')}
              </span>
            </div>
            <div className={`cw-list-item ${
              claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy'
                ? 'cw-list-item--warm'
                : 'cw-list-item--cool'
            }`}>
              <Shield size={16} />
              <span>
                {claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy'
                  ? pick(
                      `有一笔可走自治路径的 settled Battle Royale 奖励：第 #${claimWindow.matchId?.toString() ?? '-'} 场 / ${formatCLW(claimWindow.claimable)}。`,
                      `A settled Battle Royale autonomy claim is ready: ${formatCLW(claimWindow.claimable)} from match #${claimWindow.matchId?.toString() ?? '-'}.`,
                    )
                  : claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'owner'
                    ? pick(
                        '下一笔 settled reward 在 owner 路径上，不应该走自治 claim request。',
                        'The next settled reward sits on the owner path, so the autonomy operator should not request this claim.',
                      )
                    : claimWindow.hasConflict
                      ? pick(
                          'owner 和 autonomy participant 路径冲突，先不要开放 claim。',
                          'Owner and autonomy participant claim paths disagree. Keep the claim blocked until the participant identity is resolved.',
                        )
                      : pick(
                          '当前没有自治侧的 settled claim 在等待处理。',
                          'No autonomy-side settled claim is waiting behind the current receipt stream.',
                        )}
              </span>
            </div>
          </div>
        </section>

        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <p className="cw-label">{pick('账本', 'Ledger')}</p>
              <h3>{pick('已执行和失败的自治回执，现在都从 action hub 账本读。', 'Executed and failed autonomy receipts now come from the action hub view.')}</h3>
            </div>
            <span className={`cw-chip ${setup.policy?.enabled ? 'cw-chip--growth' : 'cw-chip--alert'}`}>
              <Shield size={14} />
              {setup.policy?.enabled ? pick('policy 已启用', 'Policy live') : pick('待配置', 'Needs setup')}
            </span>
          </div>
          <div className="cw-meter-list">
            <div className="cw-meter-row">
              <div>
                <span className="cw-label">{pick('回执成功率', 'Receipt success')}</span>
                <div className="cw-meter">
                  <span
                    className="cw-meter--growth"
                    style={{
                      width: `${
                        proofs.ledger && proofs.ledger.executedCount + proofs.ledger.failedCount > 0
                          ? Math.round(
                              (proofs.ledger.executedCount /
                                (proofs.ledger.executedCount + proofs.ledger.failedCount)) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <strong>
                {proofs.ledger
                  ? pick(
                      `${proofs.ledger.executedCount} 已执行 / ${proofs.ledger.failedCount} 失败`,
                      `${proofs.ledger.executedCount} executed / ${proofs.ledger.failedCount} failed`,
                    )
                  : pick('还没有 ledger 记录', 'No ledger yet')}
              </strong>
            </div>
            <div className="cw-meter-row">
              <div>
                <span className="cw-label">{pick('权限就绪度', 'Permission readiness')}</span>
                <div className="cw-meter">
                  <span className="cw-meter--cool" style={{ width: `${permissionCount * 25}%` }} />
                </div>
              </div>
              <strong>{pick(`${permissionCount}/4 项就绪`, `${permissionCount}/4 boundaries ready`)}</strong>
            </div>
          </div>
        </section>

        <section className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Bot size={16} />
            <span>
              {proofs.ledger
                ? pick(
                    `总花费 ${formatCLW(proofs.ledger.totalActualSpend)} / 总 credit ${formatCLW(proofs.ledger.totalClwCredit)} / ${proofs.ledger.totalXpCredit} XP`,
                    `Total spend ${formatCLW(proofs.ledger.totalActualSpend)} / total credit ${formatCLW(proofs.ledger.totalClwCredit)} / ${proofs.ledger.totalXpCredit} XP`,
                  )
                : pick(
                    '等 live 自治回执出现后，action hub ledger 会显示在这里。',
                    'The action hub ledger will appear here once live autonomy receipts exist.',
                  )}
            </span>
          </div>
          {receiptItems.length > 0 ? (
            receiptItems.map((receipt, index) => (
              <div
                key={receipt.requestId?.toString() ?? `receipt-${index}`}
                className={`cw-list-item ${receiptListTone(Number(receipt.status ?? 0))}`}
              >
                <Shield size={16} />
                <span>
                  {pick('请求', 'Request')} #{receipt.requestId?.toString() ?? '-'} / {receiptStatusText(Number(receipt.status ?? 0), pick)} / {pick('花费', 'spend')}{' '}
                  {formatCLW(BigInt(receipt.actualSpend ?? 0n))} / credit {formatCLW(BigInt(receipt.clwCredit ?? 0n))}
                  {receipt.lastError ? ` / ${receipt.lastError}` : receipt.reasoningCid ? ` / CID ${receipt.reasoningCid}` : ''}
                </span>
              </div>
            ))
          ) : (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{pick('当前龙虾还没有可见的 Battle Royale 自治回执。', 'No Battle Royale autonomy receipts are visible for the current lobster yet.')}</span>
            </div>
          )}
          <div className={`cw-list-item ${battleRoyaleParticipant.claimable > 0n ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
            <Shield size={16} />
            <span>
              {claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy'
                ? pick(
                    `Battle Royale 自治领取已就绪：第 #${claimWindow.matchId?.toString() ?? '-'} 场 / ${formatCLW(claimWindow.claimable)}。`,
                    `Battle Royale autonomy claim ready: ${formatCLW(claimWindow.claimable)} from settled match #${claimWindow.matchId?.toString() ?? '-'}.`,
                  )
                : claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'owner'
                  ? pick(
                      `这笔 settled reward ${formatCLW(claimWindow.claimable)} 走 owner-wallet 路径。`,
                      `Settled reward ${formatCLW(claimWindow.claimable)} sits on the owner-wallet path for match #${claimWindow.matchId?.toString() ?? '-'}.`,
                    )
                  : claimWindow.hasConflict
                    ? pick(
                        'Battle Royale 的 claim 数据在 owner / autonomy participant 之间冲突，需要人工排查。',
                        'Settled Battle Royale claim data conflicts between owner and autonomy participant paths and needs manual review.',
                      )
                    : battleRoyaleParticipant.entered && battleRoyaleParticipant.preferredPath?.key === 'autonomy'
                      ? pick(
                          `当前 Battle Royale 参赛走自治 participant 路径，match #${battleRoyale.matchId?.toString() ?? '-'}.`,
                          `Current Battle Royale participation is tracked on the autonomy participant path for match #${battleRoyale.matchId?.toString() ?? '-'}.`,
                        )
                      : pick(
                          '当前没有自治侧 Battle Royale claim 在等待处理。',
                        'No active autonomy-side Battle Royale claim is visible for this lobster.',
                      )}
            </span>
          </div>
        </section>
          </>
        )}
      </WalletGate>
    </>
  );
}
