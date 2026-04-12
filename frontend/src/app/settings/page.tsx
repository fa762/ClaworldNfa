import { Bell, KeyRound, Wallet } from 'lucide-react';

const settingsGroups = [
  {
    title: 'Wallet',
    detail: 'Connection state, network, and advanced transaction boundaries.',
    icon: Wallet,
    tone: 'cw-card--safe',
  },
  {
    title: 'BYOK',
    detail: 'Provider selection and transient relay path belong here when Phase E begins.',
    icon: KeyRound,
    tone: 'cw-card--watch',
  },
  {
    title: 'Notifications',
    detail: 'PWA install and offline-state controls now start from the live shell banner and will keep expanding here.',
    icon: Bell,
    tone: 'cw-card--safe',
  },
];

export default function SettingsPage() {
  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Settings</p>
            <h2 className="cw-section-title">Quiet controls, low cognitive load.</h2>
            <p className="cw-muted">Wallet, AI, installability, and alerts should stay tucked away behind a calm surface.</p>
          </div>
          <div className="cw-score">
            <strong>3</strong>
            <span>groups</span>
          </div>
        </div>
      </section>

      <section className="cw-card-stack">
        {settingsGroups.map(({ title, detail, icon: Icon, tone }) => (
          <article key={title} className={`cw-card ${tone}`}>
            <div className="cw-card-icon">
              <Icon size={18} />
            </div>
            <div className="cw-card-copy">
              <p className="cw-label">{title}</p>
              <h3>{detail}</h3>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
