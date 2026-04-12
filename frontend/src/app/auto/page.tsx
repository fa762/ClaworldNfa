'use client';

import { Bot, Coins, Shield } from 'lucide-react';

import { AutonomyClaimRequestPanel } from '@/components/auto/AutonomyClaimRequestPanel';
import { AutonomyDirectivePanel } from '@/components/auto/AutonomyDirectivePanel';
import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { useBattleRoyaleOverview } from '@/components/lobster/useBattleRoyaleOverview';
import { useBattleRoyaleParticipantState } from '@/components/lobster/useBattleRoyaleParticipantState';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_PROTOCOL_ID,
  useAutonomyActionSetup,
  useAutonomyProofs,
} from '@/contracts/hooks/useAutonomy';
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';

function receiptStatusText(status: number) {
  if (status === 4) return 'Executed';
  if (status === 5) return 'Failed';
  if (status === 3) return 'Finalized';
  if (status === 2) return 'Synced';
  if (status === 1) return 'Fulfilled';
  return 'Pending';
}

function receiptStatusTone(status: number) {
  if (status === 5) return 'cw-chip--alert';
  if (status === 4 || status === 3) return 'cw-chip--growth';
  if (status === 2 || status === 1) return 'cw-chip--cool';
  return 'cw-chip--warm';
}

function receiptListTone(status: number) {
  if (status === 5) return 'cw-list-item--cool';
  if (status === 4 || status === 3) return 'cw-list-item--warm';
  return 'cw-list-item--cool';
}

function receiptSummary(status: number) {
  if (status === 5) return 'The last autonomy request reached a terminal failure state and needs an operator-level read before replay.';
  if (status === 4) return 'The last autonomy request executed onchain and now sits in the receipt/proof path.';
  if (status === 3) return 'The last autonomy request is finalized. Settlement is closed and only audit surfaces remain.';
  if (status === 2) return 'The last autonomy request is synced and waiting for execution.';
  if (status === 1) return 'The last autonomy request is fulfilled and moving toward synced execution.';
  return 'The last autonomy request is still pending and has not crossed into fulfilled execution yet.';
}

export default function AutoPage() {
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

  const permissionCount = [
    setup.protocolApproved,
    setup.adapterApproved,
    setup.operatorApproved,
    setup.leaseActive,
  ].filter(Boolean).length;

  const autoCards = [
    {
      title: 'Directive surface',
      value: setup.policy?.enabled
        ? `Risk mode ${setup.policy.riskMode} / daily ${setup.policy.dailyLimit}`
        : 'Policy not enabled yet',
      icon: Bot,
      tone: setup.policy?.enabled ? 'cw-card--safe' : 'cw-card--warning',
    },
    {
      title: 'Runtime balance',
      value: `${companion.routerClaworldText} reserve / ${companion.dailyCostText} upkeep`,
      icon: Coins,
      tone: companion.upkeepDays !== null && companion.upkeepDays > 2 ? 'cw-card--watch' : 'cw-card--warning',
    },
    {
      title: 'Permissions',
      value: `${permissionCount}/4 boundaries ready`,
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

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Autonomy</p>
            <h2 className="cw-section-title">{companion.name} now shows live autonomy boundaries.</h2>
            <p className="cw-muted">
              This page now reads real policy, permission, and proof state for the Battle Royale autonomy path.
            </p>
          </div>
          <div className="cw-score">
            <strong>{setup.risk?.emergencyPaused ? 'Paused' : setup.policy?.enabled ? 'Live' : 'Setup'}</strong>
            <span>mode</span>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title="Managed roster"
        subtitle="Switch the active lobster before checking policy, ledger, and autonomy claim path."
      />

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
          emergencyPaused={Boolean(setup.risk?.emergencyPaused)}
        />
      ) : null}

      {tokenId !== undefined ? (
        <AutonomyDirectivePanel
          tokenId={tokenId}
          actionKind={AUTONOMY_ACTION_KIND.battleRoyale}
          ownerAddress={companion.ownerAddress}
          title="Directive surface"
        />
      ) : null}

      <section className={`cw-panel ${latestReceipt && latestReceiptStatus === 5 ? 'cw-panel--cool' : 'cw-panel--warm'}`}>
        <div className="cw-section-head">
          <div>
            <p className="cw-label">Autonomy pulse</p>
            <h3>
              {latestReceipt
                ? `Request #${latestReceipt.requestId?.toString() ?? '-'} ${receiptStatusText(latestReceiptStatus)}`
                : 'No recent Battle Royale autonomy receipt yet'}
            </h3>
            <p className="cw-muted">
              {latestReceipt
                ? receiptSummary(latestReceiptStatus)
                : 'As requests start to land, this panel will surface the latest state, spend, credit, and failure reason without sending the user into raw logs first.'}
            </p>
          </div>
          <span className={`cw-chip ${latestReceipt ? receiptStatusTone(latestReceiptStatus) : 'cw-chip--cool'}`}>
            <Bot size={14} />
            {latestReceipt ? receiptStatusText(latestReceiptStatus) : 'Idle'}
          </span>
        </div>
        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">Latest request</span>
            <strong>{latestReceipt ? `#${latestReceipt.requestId?.toString() ?? '-'}` : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">Spend</span>
            <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.actualSpend ?? 0n)) : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">Credit</span>
            <strong>{latestReceipt ? formatCLW(BigInt(latestReceipt.clwCredit ?? 0n)) : '--'}</strong>
          </div>
        </div>
        <div className="cw-list">
          <div className={`cw-list-item ${latestReceipt ? receiptListTone(latestReceiptStatus) : 'cw-list-item--cool'}`}>
            <Shield size={16} />
            <span>
              {latestReceipt
                ? latestReceipt.lastError
                  ? `Latest receipt error: ${latestReceipt.lastError}`
                  : latestReceipt.reasoningCid
                    ? `Reasoning proof attached: ${latestReceipt.reasoningCid}`
                    : 'This receipt has no exposed failure string. Use the proof and tx path if a deeper audit is needed.'
                : 'No recent receipt is available for the current lobster.'}
            </span>
          </div>
          <div className={`cw-list-item ${
            claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy' ? 'cw-list-item--warm' : 'cw-list-item--cool'
          }`}>
            <Shield size={16} />
            <span>
              {claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy'
                ? `A settled Battle Royale autonomy claim is ready: ${formatCLW(claimWindow.claimable)} from match #${claimWindow.matchId?.toString() ?? '-'}.`
                : claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'owner'
                  ? `The next settled reward sits on the owner path, so the autonomy operator should not request this claim.`
                  : claimWindow.hasConflict
                    ? 'Owner and autonomy participant claim paths disagree. Keep the claim blocked until the participant identity is resolved.'
                    : 'No autonomy-side settled claim is waiting behind the current receipt stream.'}
            </span>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <p className="cw-label">Ledger</p>
            <h3>Executed and failed autonomy receipts now come from the action hub view.</h3>
          </div>
          <span className={`cw-chip ${setup.policy?.enabled ? 'cw-chip--growth' : 'cw-chip--alert'}`}>
            <Shield size={14} />
            {setup.policy?.enabled ? 'Policy live' : 'Needs setup'}
          </span>
        </div>
        <div className="cw-meter-list">
          <div className="cw-meter-row">
            <div>
              <span className="cw-label">Receipt success</span>
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
                ? `${proofs.ledger.executedCount} executed / ${proofs.ledger.failedCount} failed`
                : 'No ledger yet'}
            </strong>
          </div>
          <div className="cw-meter-row">
            <div>
              <span className="cw-label">Permission readiness</span>
              <div className="cw-meter">
                <span className="cw-meter--cool" style={{ width: `${permissionCount * 25}%` }} />
              </div>
            </div>
            <strong>{permissionCount}/4 boundaries ready</strong>
          </div>
        </div>
      </section>

      <section className="cw-list">
        <div className="cw-list-item cw-list-item--warm">
          <Bot size={16} />
          <span>
            {proofs.ledger
              ? `Total spend ${formatCLW(proofs.ledger.totalActualSpend)} / total credit ${formatCLW(proofs.ledger.totalClwCredit)} / ${proofs.ledger.totalXpCredit} XP`
              : 'The action hub ledger will appear here once live autonomy receipts exist.'}
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
                Request #{receipt.requestId?.toString() ?? '-'} / {receiptStatusText(Number(receipt.status ?? 0))} / spend{' '}
                {formatCLW(BigInt(receipt.actualSpend ?? 0n))} / credit {formatCLW(BigInt(receipt.clwCredit ?? 0n))}
                {receipt.lastError ? ` / ${receipt.lastError}` : receipt.reasoningCid ? ` / CID ${receipt.reasoningCid}` : ''}
              </span>
            </div>
          ))
        ) : (
          <div className="cw-list-item cw-list-item--cool">
            <Shield size={16} />
            <span>No Battle Royale autonomy receipts are visible for the current lobster yet.</span>
          </div>
        )}
        <div className={`cw-list-item ${battleRoyaleParticipant.claimable > 0n ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
          <Shield size={16} />
          <span>
            {claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'autonomy'
              ? `Battle Royale autonomy claim ready: ${formatCLW(claimWindow.claimable)} from settled match #${claimWindow.matchId?.toString() ?? '-'}.`
              : claimWindow.claimable > 0n && claimWindow.preferredPath?.key === 'owner'
                ? `Settled reward ${formatCLW(claimWindow.claimable)} sits on the owner-wallet path for match #${claimWindow.matchId?.toString() ?? '-'}.`
                : claimWindow.hasConflict
                  ? `Settled Battle Royale claim data conflicts between owner and autonomy participant paths and needs manual review.`
              : battleRoyaleParticipant.entered && battleRoyaleParticipant.preferredPath?.key === 'autonomy'
                ? `Current Battle Royale participation is tracked on the autonomy participant path for match #${battleRoyale.matchId?.toString() ?? '-'}.`
                : 'No active autonomy-side Battle Royale claim is visible for this lobster.'}
          </span>
        </div>
      </section>
    </>
  );
}
