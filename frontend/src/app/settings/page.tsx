'use client';

import { Bell, KeyRound, Wallet } from 'lucide-react';

import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useI18n } from '@/lib/i18n';

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">{t('shell.settings')}</p>
            <h2 className="cw-section-title">{t('mood.quietControls')}</h2>
            <p className="cw-muted">{t('shell.alertsConfigurable')}</p>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{t('shell.settings')} / {t('footer.wallet')}</span>
            <h3>{t('wallet.connect')}</h3>
            <p className="cw-muted">
              {t('mood.walletLinked')} — BSC Mainnet
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
            <h3>Provider selection and transient relay path — Phase E</h3>
            <p className="cw-muted">{t('shell.directiveSynced')}</p>
          </div>
        </article>

        <article className="cw-card cw-card--safe">
          <div className="cw-card-icon">
            <Bell size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">Notifications</p>
            <h3>PWA install and offline controls expand from the shell banner.</h3>
            <p className="cw-muted">{t('shell.alertsConfigurable')}</p>
          </div>
        </article>
      </section>
    </>
  );
}
