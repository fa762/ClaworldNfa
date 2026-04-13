export type CompanionStageTone = 'warm' | 'cool' | 'growth' | 'alert';
export type CompanionStageVariant = 'home' | 'play' | 'arena' | 'auto' | 'settings' | 'companion';

type CompanionStageProps = {
  compact?: boolean;
  loading?: boolean;
  variant: CompanionStageVariant;
  eyebrow: string;
  title: string;
  statusLabel: string;
  statusTone: CompanionStageTone;
  readouts: Array<{ label: string; value: string; tone?: CompanionStageTone }>;
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
  statusLabel,
  statusTone,
  readouts,
}: CompanionStageProps) {
  return (
    <section
      className={`cw-stage cw-stage--${variant} cw-stage--status-${statusTone} ${compact ? 'cw-stage--compact' : ''}`}
    >
      <div className="cw-stage-copy">
        {loading ? (
          <div className="cw-loading-card cw-stage-loading">
            <div className="cw-skeleton-line cw-skeleton-line--short" />
            <div className="cw-stage-loading-head">
              <div className="cw-skeleton-line cw-skeleton-line--mid" />
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
          </>
        )}
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
    </section>
  );
}
