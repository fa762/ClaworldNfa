'use client';

import Link from 'next/link';
import { Compass, Shield } from 'lucide-react';

import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useI18n } from '@/lib/i18n';

export function WalletGate({
  children,
  title,
  detail,
}: {
  children: React.ReactNode;
  title?: string;
  detail?: string;
}) {
  const companion = useActiveCompanion();
  const { pick } = useI18n();

  if (companion.isLoading) {
    return (
      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('读取中', 'Loading')}</span>
            <h3>{pick('正在同步钱包和龙虾', 'Syncing wallet and companion')}</h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Shield size={14} />
            {pick('读取中', 'Loading')}
          </span>
        </div>
        <div className="cw-loading-card">
          <div className="cw-skeleton-line cw-skeleton-line--short" />
          <div className="cw-skeleton-line" />
          <div className="cw-skeleton-grid">
            <div className="cw-skeleton-block" />
            <div className="cw-skeleton-block" />
            <div className="cw-skeleton-block" />
          </div>
        </div>
      </section>
    );
  }

  if (!companion.connected) {
    return (
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('先连接钱包', 'Connect wallet')}</span>
            <h3>{title ?? pick('先连接钱包', 'Connect wallet first')}</h3>
            {detail ? <p className="cw-muted">{detail}</p> : null}
          </div>
          <span className="cw-chip cw-chip--warm">
            <Shield size={14} />
            {pick('未连接', 'Offline')}
          </span>
        </div>

        <div className="cw-button-row">
          <ConnectButton />
        </div>
      </section>
    );
  }

  if (!companion.hasToken) {
    return (
      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('没有 NFA', 'No companion')}</span>
            <h3>{pick('先去铸造一只龙虾', 'Mint a lobster first')}</h3>
          </div>
          <span className="cw-chip cw-chip--alert">
            <Compass size={14} />
            {pick('先铸造', 'Mint first')}
          </span>
        </div>

        <div className="cw-button-row">
          <Link href="/mint" className="cw-button cw-button--primary">
            <Compass size={16} />
            {pick('前往铸造', 'Go to mint')}
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
