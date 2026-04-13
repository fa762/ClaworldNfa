export type CompanionStageTone = 'warm' | 'cool' | 'growth' | 'alert';
export type CompanionStageVariant = 'home' | 'play' | 'arena' | 'auto' | 'settings' | 'companion';

type CompanionStageProps = {
  compact?: boolean;
  loading?: boolean;
  variant: CompanionStageVariant;
  eyebrow: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: CompanionStageTone;
  signals: Array<{ label: string; tone?: CompanionStageTone }>;
  moodLabel: string;
  moodTone: CompanionStageTone;
  readouts: Array<{ label: string; value: string; tone?: CompanionStageTone }>;
  imageSrc?: string;
  imageAlt?: string;
};

function toneClass(tone?: CompanionStageTone) {
  if (tone === 'cool') return 'cw-chip--cool';
  if (tone === 'growth') return 'cw-chip--growth';
  if (tone === 'alert') return 'cw-chip--alert';
  if (tone === 'warm') return 'cw-chip--warm';
  return 'cw-chip--cool';
}

export function CompanionStage({
  compact = false,
  loading = false,
  variant,
  eyebrow,
  title,
  subtitle,
  statusLabel,
  statusTone,
  signals,
  moodLabel,
  moodTone,
  readouts,
  imageSrc = '/icon.png',
  imageAlt = 'Clawworld lobster companion',
}: CompanionStageProps) {
  const normalizedImage = imageSrc || '/icon.png';

  return (
    <section
      className={`cw-stage cw-stage--${variant} cw-stage--mood-${moodTone} cw-stage--status-${statusTone} ${compact ? 'cw-stage--compact' : ''}`}
    >
      <div className="cw-stage-copy">
        {loading ? (
          <div className="cw-loading-card cw-stage-loading">
            <div className="cw-skeleton-line cw-skeleton-line--short" />
            <div className="cw-stage-loading-head">
              <div className="cw-skeleton-line cw-skeleton-line--mid" />
              <div className="cw-stage-loading-chip" />
            </div>
            <div className="cw-skeleton-line" />
            <div className="cw-skeleton-line cw-skeleton-line--mid" />
            <div className="cw-stage-loading-signals">
              <div className="cw-stage-loading-chip" />
              <div className="cw-stage-loading-chip" />
              <div className="cw-stage-loading-chip" />
            </div>
          </div>
        ) : (
          <>
            <p className="cw-overline">{eyebrow}</p>
            <div className="cw-stage-head">
              <h2 className="cw-stage-title">{title}</h2>
              <span className={`cw-chip ${toneClass(statusTone)}`}>{statusLabel}</span>
            </div>
            <p className="cw-stage-subtitle">{subtitle}</p>
            <div className="cw-stage-meta">
              {signals.map((signal) => (
                <span key={signal.label} className={`cw-chip ${toneClass(signal.tone)}`.trim()}>
                  {signal.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="cw-stage-visual">
        <div className={`cw-stage-art ${compact ? 'cw-stage-art--compact' : ''}`}>
          <div className="cw-stage-shell" />
          <div className="cw-stage-ring" />
          <div className="cw-stage-glow" />
          <div className="cw-stage-signal cw-stage-signal--top" />
          <div className="cw-stage-signal cw-stage-signal--bottom" />
          <img
            src={normalizedImage}
            alt={imageAlt}
            className="cw-stage-image"
          />
          <div className={`cw-stage-badge ${toneClass(moodTone)}`}>{loading ? '...' : moodLabel}</div>
        </div>

        <div className="cw-stage-readouts">
          {loading
            ? readouts.map((readout, index) => (
                <div key={`${readout.label}-${index}`} className="cw-stage-readout cw-stage-readout--loading">
                  <div className="cw-skeleton-line cw-skeleton-line--short" />
                  <div className="cw-skeleton-line cw-skeleton-line--mid" />
                </div>
              ))
            : readouts.map((readout) => (
                <div key={readout.label} className={`cw-stage-readout ${toneClass(readout.tone)}`}>
                  <span>{readout.label}</span>
                  <strong>{readout.value}</strong>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
