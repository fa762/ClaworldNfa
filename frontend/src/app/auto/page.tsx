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

  const latestStatus = latestReceipt ? receiptStatusText(Number(latestReceipt.status ?? 0), pick) : pick('空闲', 'Idle');
  const latestError = latestReceipt?.lastError ? String(latestReceipt.lastError).slice(0, 72) : null;

  return (
    <>
      <WalletGate
        title={pick('先连接持有人钱包', 'Connect owner wallet first')}
        detail={pick('连接后才能设置代理。', 'Connect before using agent mode.')}
      >
        <section className="cw-panel cw-panel--cool">
          <div className="cw-section-head">
            <div>
              <span className="cw-label">{pick('代理状态', 'Agent state')}</span>
              <h3>{setup.policy?.enabled ? pick('已启用', 'Enabled') : pick('未启用', 'Not enabled')}</h3>
            </div>
            <span className={`cw-chip ${setup.policy?.enabled ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
              <Bot size={14} />
              {permissionCount}/4
            </span>
          </div>
          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">{pick('可领', 'Claim')}</span>
              <strong>{claimWindow.claimable > 0n ? formatCLW(claimWindow.claimable) : '--'}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('权限', 'Ready')}</span>
              <strong>{permissionCount}/4</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('结果', 'Result')}</span>
              <strong>{latestStatus}</strong>
            </div>
          </div>
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
              {latestStatus}
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
                <span className="cw-label">{pick('异常', 'Error')}</span>
                <strong>{latestError ?? '--'}</strong>
              </div>
            </div>
          ) : null}
        </section>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? pick('收起高级', 'Hide advanced') : pick('高级', 'Advanced')}
          </button>
        </div>

        {showAdvanced ? (
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('高级', 'Advanced')}</span>
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
