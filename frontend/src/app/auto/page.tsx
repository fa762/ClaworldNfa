'use client';

import { useState } from 'react';
import { Bot, CheckCircle2, Shield, XCircle } from 'lucide-react';

import { AutonomyClaimRequestPanel } from '@/components/auto/AutonomyClaimRequestPanel';
import { AutonomyDirectivePanel } from '@/components/auto/AutonomyDirectivePanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
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
  if (status === 3) return pick('已完成', 'Finalized');
  if (status === 2) return pick('等待执行', 'Synced');
  if (status === 1) return pick('已排队', 'Fulfilled');
  return pick('等待中', 'Pending');
}

export default function AutoPage() {
  const { pick } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const companion = useActiveCompanion();
  const tokenId = companion.hasToken ? companion.tokenId : undefined;
  const claimWindow = useBattleRoyaleClaimWindow(tokenId, companion.ownerAddress);
  const setup = useAutonomyActionSetup({
    tokenId: tokenId ?? 0n,
    actionKind: AUTONOMY_ACTION_KIND.battleRoyale,
    protocolId: AUTONOMY_PROTOCOL_ID.battleRoyale,
    adapter: addresses.battleRoyaleAdapter,
  });
  const proofs = useAutonomyProofs(tokenId, AUTONOMY_PROTOCOL_ID.battleRoyale);

  const permissionReadiness = [
    { key: 'protocol', label: pick('协议批准', 'Protocol'), ready: setup.protocolApproved },
    { key: 'adapter', label: pick('Adapter 批准', 'Adapter'), ready: setup.adapterApproved },
    { key: 'operator', label: pick('Operator 批准', 'Operator'), ready: setup.operatorApproved },
    { key: 'lease', label: pick('Lease 有效', 'Lease'), ready: setup.leaseActive },
  ] as const;

  const permissionCount = permissionReadiness.filter((item) => item.ready).length;
  const missingPermissions = permissionReadiness.filter((item) => !item.ready).map((item) => item.label);
  const latestReceipt = proofs.receipts[0] as
    | {
        requestId?: bigint;
        status?: number;
        actualSpend?: bigint;
        clwCredit?: bigint;
        lastError?: string;
      }
    | undefined;

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{pick('代理', 'Auto')}</p>
            <h2 className="cw-section-title">{pick('选策略，再提交', 'Pick a policy, then submit')}</h2>
          </div>
          <div className="cw-score">
            <strong>{permissionCount}/4</strong>
            <span>{pick('权限', 'Gates')}</span>
          </div>
        </div>
      </section>

      <WalletGate
        title={pick('先连接持有人钱包', 'Connect owner wallet first')}
        detail={pick('代理设置和自治请求都要走持有人签名。', 'Policy edits and autonomy requests need the owner wallet.')}
      >
        <section className="cw-card-stack">
          <article className={`cw-card ${setup.policy?.enabled ? 'cw-card--safe' : 'cw-card--warning'}`}>
            <div className="cw-card-icon">
              <Bot size={18} />
            </div>
            <div className="cw-card-copy">
              <p className="cw-label">{pick('当前策略', 'Policy')}</p>
              <h3>{setup.policy?.enabled ? pick('已启用', 'Enabled') : pick('未启用', 'Not enabled')}</h3>
            </div>
            <div className="cw-score">
              <strong>{permissionCount}/4</strong>
              <span>{pick('权限', 'gates')}</span>
            </div>
          </article>

          <article className={`cw-card ${claimWindow.claimable > 0n ? 'cw-card--ready' : 'cw-card--safe'}`}>
            <div className="cw-card-icon">
              <Shield size={18} />
            </div>
            <div className="cw-card-copy">
              <p className="cw-label">{pick('自治领取', 'Autonomy claim')}</p>
              <h3>
                {claimWindow.claimable > 0n
                  ? pick(`可处理 ${formatCLW(claimWindow.claimable)}`, `Ready ${formatCLW(claimWindow.claimable)}`)
                  : pick('当前没有待处理奖励', 'No pending claim')}
              </h3>
            </div>
          </article>
        </section>

        {tokenId !== undefined ? (
          <AutonomyDirectivePanel
            tokenId={tokenId}
            actionKind={AUTONOMY_ACTION_KIND.battleRoyale}
            ownerAddress={companion.ownerAddress}
            title={pick('策略与提示词', 'Strategy and prompt')}
          />
        ) : null}

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

        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('结果', 'Result')}</span>
              <h3>
                {latestReceipt
                  ? pick(
                      `请求 #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
                      `Request #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(Number(latestReceipt.status ?? 0), pick)}`,
                    )
                  : pick('还没有最近结果', 'No recent result')}
              </h3>
            </div>
            <span className={`cw-chip ${latestReceipt && Number(latestReceipt.status ?? 0) === 5 ? 'cw-chip--alert' : 'cw-chip--cool'}`}>
              <Bot size={14} />
              {latestReceipt ? receiptStatusText(Number(latestReceipt.status ?? 0), pick) : pick('空闲', 'Idle')}
            </span>
          </div>
          {latestReceipt ? (
            <div className="cw-state-grid">
              <div className="cw-state-card">
                <span className="cw-label">{pick('花费', 'Spend')}</span>
                <strong>{formatCLW(BigInt(latestReceipt.actualSpend ?? 0n))}</strong>
              </div>
              <div className="cw-state-card">
                <span className="cw-label">Credit</span>
                <strong>{formatCLW(BigInt(latestReceipt.clwCredit ?? 0n))}</strong>
              </div>
              <div className="cw-state-card">
                <span className="cw-label">{pick('错误', 'Error')}</span>
                <strong>{latestReceipt.lastError ?? '--'}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? pick('收起高级', 'Hide advanced') : pick('展开高级', 'Show advanced')}
          </button>
        </div>

        {showAdvanced ? (
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">Advanced</span>
                <h3>{pick('权限明细', 'Permission detail')}</h3>
              </div>
            </div>
            <div className="cw-list">
              {permissionReadiness.map((item) => (
                <div key={item.key} className={`cw-list-item ${item.ready ? 'cw-list-item--growth' : 'cw-list-item--alert'}`}>
                  {item.ready ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </WalletGate>
    </>
  );
}