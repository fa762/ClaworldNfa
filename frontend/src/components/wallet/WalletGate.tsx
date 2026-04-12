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
            <span className="cw-label">{pick('连接中', 'Loading')}</span>
            <h3>{pick('正在读取钱包与龙虾状态', 'Reading wallet and companion state')}</h3>
            <p className="cw-muted">
              {pick(
                '保持这个页面打开，等链上持仓和维护状态加载完成。',
                'Keep this page open while ownership, reserve, and upkeep state resolve.',
              )}
            </p>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Shield size={14} />
            {pick('读取中', 'Loading')}
          </span>
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
            <h3>{title ?? pick('先连接钱包，再进入这条链路。', 'Connect a wallet before using this flow.')}</h3>
            <p className="cw-muted">
              {detail ??
                pick(
                  '这个页面需要真实的钱包持仓、NFA 所有权和链上余额，断开状态下不应该显示空数据。',
                  'This page depends on real ownership, reserve, and on-chain state. It should not fall back to dead zero panels.',
                )}
            </p>
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
            <span className="cw-label">{pick('未发现 NFA', 'No companion found')}</span>
            <h3>{pick('当前钱包还没有龙虾，先去铸造。', 'This wallet does not own a lobster yet.')}</h3>
            <p className="cw-muted">
              {pick(
                '新前端已经切成养成主入口，没有 NFA 时不应该继续展示竞技、自治或挖矿空面板。',
                'The rebuilt shell now starts from ownership. Without an NFA, the action surfaces should route you to mint instead of showing empty state.',
              )}
            </p>
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
