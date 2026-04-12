'use client';

import { Bell, KeyRound, Wallet } from 'lucide-react';

import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useI18n } from '@/lib/i18n';

export default function SettingsPage() {
  const { pick, t } = useI18n();

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{t('shell.settings')}</p>
            <h2 className="cw-section-title">{pick('把钱包、提醒和未来扩展放在安静的一层。', 'Keep wallet, alerts, and future controls in a calm layer.')}</h2>
            <p className="cw-muted">{pick('这里不抢主循环，只负责连接和开关。', 'This screen stays quiet. It should not compete with the main loop.')}</p>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{t('shell.settings')} / {t('footer.wallet')}</span>
            <h3>{pick('钱包连接', 'Wallet connection')}</h3>
            <p className="cw-muted">
              {pick('当前链路：BSC Mainnet。', 'Current network: BSC Mainnet.')}
            </p>
          </div>
          <Wallet size={20} style={{ color: 'var(--color-bunker-primary)', flexShrink: 0 }} />
        </div>
        <div className="cw-button-row">
          <ConnectButton />
        </div>
      </section>

      <section className="cw-card-stack">
        <article className="cw-card cw-card--watch">
          <div className="cw-card-icon">
            <KeyRound size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">BYOK</p>
            <h3>{pick('用户自带模型 Key 与 relay 路径，后续并入这里。', 'User-provided model keys and relay selection will land here next.')}</h3>
            <p className="cw-muted">{pick('当前仍按计划后置，不和主交易链路混在一起。', 'This stays behind the core action loops until the main UX is fully stable.')}</p>
          </div>
          <span className="cw-chip cw-chip--cool">{pick('即将加入', 'Coming soon')}</span>
        </article>

        <article className="cw-card cw-card--safe">
          <div className="cw-card-icon">
            <Bell size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">{pick('提醒', 'Notifications')}</p>
            <h3>{pick('PWA 安装、离线与提醒控制会继续从这里展开。', 'PWA install, offline, and alert controls will continue from here.')}</h3>
            <p className="cw-muted">{pick('当前先保留为说明卡，避免看起来像已完成的可点设置。', 'For now this stays as a labeled placeholder instead of pretending to be a finished control surface.')}</p>
          </div>
          <span className="cw-chip cw-chip--cool">{pick('即将加入', 'Coming soon')}</span>
        </article>
      </section>
    </>
  );
}
