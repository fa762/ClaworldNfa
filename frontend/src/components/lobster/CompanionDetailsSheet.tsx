'use client';

import { X } from 'lucide-react';

import { type ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { useI18n } from '@/lib/i18n';

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function buildRadarPolygon(values: number[], cx: number, cy: number, radius: number) {
  return values
    .map((value, index) => {
      const point = polarPoint(cx, cy, radius * (clampPercent(value) / 100), (360 / values.length) * index);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

function buildRadarRing(step: number, count: number, cx: number, cy: number, radius: number) {
  return Array.from({ length: count }, (_, index) => {
    const currentRadius = radius * ((index + 1) * step);
    return Array.from({ length: 5 }, (_unused, pointIndex) => {
      const point = polarPoint(cx, cy, currentRadius, (360 / 5) * pointIndex);
      return `${point.x},${point.y}`;
    }).join(' ');
  });
}

export function CompanionDetailsSheet({
  companion,
  open,
  onClose,
}: {
  companion: ActiveCompanionValue;
  open: boolean;
  onClose: () => void;
}) {
  const { pick } = useI18n();

  if (!open) return null;

  const taskTraits = [
    { label: pick('勇气', 'Courage'), value: companion.traits.courage, color: '#ffb347' },
    { label: pick('智慧', 'Wisdom'), value: companion.traits.wisdom, color: '#7ecfb0' },
    { label: pick('社交', 'Social'), value: companion.traits.social, color: '#5c9ead' },
    { label: pick('创造', 'Create'), value: companion.traits.create, color: '#d4a76a' },
    { label: pick('韧性', 'Grit'), value: companion.traits.grit, color: '#c44536' },
  ] as const;

  const pkStats = [
    { label: 'STR', value: companion.combat.str, tone: 'cw-bar-fill--warm' },
    { label: 'DEF', value: companion.combat.def, tone: 'cw-bar-fill--cool' },
    { label: 'SPD', value: companion.combat.spd, tone: 'cw-bar-fill--growth' },
    { label: 'VIT', value: companion.combat.vit, tone: 'cw-bar-fill--alert' },
  ] as const;

  const radarPoints = buildRadarPolygon(
    taskTraits.map((trait) => trait.value),
    84,
    84,
    62,
  );
  const radarRings = buildRadarRing(0.25, 4, 84, 84, 62);

  return (
    <section className="cw-modal" aria-modal="true" role="dialog">
      <button type="button" className="cw-modal__scrim" aria-label={pick('关闭', 'Close')} onClick={onClose} />
      <div className="cw-modal__sheet">
        <section className="cw-sheet cw-companion-sheet">
          <div className="cw-sheet-head">
            <div>
              <span className="cw-label">{pick('伙伴详情', 'Companion details')}</span>
              <h3>{`${companion.name} / #${companion.tokenNumber}`}</h3>
            </div>
            <button type="button" className="cw-icon-button cw-sheet-close" onClick={onClose} aria-label={pick('关闭', 'Close')}>
              <X size={16} />
            </button>
          </div>

          <div className="cw-detail-hero-grid">
            <div className="cw-detail-pill">
              <span className="cw-label">{pick('等级', 'Level')}</span>
              <strong>{`Lv.${companion.level}`}</strong>
            </div>
            <div className="cw-detail-pill">
              <span className="cw-label">{pick('状态', 'Status')}</span>
              <strong>{companion.statusLabel}</strong>
            </div>
            <div className="cw-detail-pill">
              <span className="cw-label">{pick('避难所', 'Shelter')}</span>
              <strong>{companion.shelterName}</strong>
            </div>
          </div>

          <section className="cw-companion-block">
            <div className="cw-section-head cw-section-head--compact">
              <h4 className="cw-section-title">{pick('任务属性', 'Task traits')}</h4>
            </div>
            <div className="cw-radar-layout">
              <div className="cw-radar">
                <svg viewBox="0 0 168 168" className="cw-radar-svg" aria-hidden="true">
                  {radarRings.map((ring, index) => (
                    <polygon key={index} points={ring} className="cw-radar-ring" />
                  ))}
                  {taskTraits.map((trait, index) => {
                    const point = polarPoint(84, 84, 62, (360 / taskTraits.length) * index);
                    return (
                      <g key={trait.label}>
                        <line x1="84" y1="84" x2={point.x} y2={point.y} className="cw-radar-axis" />
                        <text x={point.x} y={point.y - (point.y < 84 ? 6 : -14)} textAnchor="middle" className="cw-radar-label">
                          {trait.label}
                        </text>
                      </g>
                    );
                  })}
                  <polygon points={radarPoints} className="cw-radar-fill" />
                  <polygon points={radarPoints} className="cw-radar-stroke" />
                  {taskTraits.map((trait, index) => {
                    const point = polarPoint(84, 84, 62 * (clampPercent(trait.value) / 100), (360 / taskTraits.length) * index);
                    return <circle key={`${trait.label}-node`} cx={point.x} cy={point.y} r="3.5" fill={trait.color} className="cw-radar-node" />;
                  })}
                </svg>
              </div>
              <div className="cw-radar-legend">
                {taskTraits.map((trait) => (
                  <div key={trait.label} className="cw-radar-legend-item">
                    <span className="cw-radar-swatch" style={{ backgroundColor: trait.color }} />
                    <span>{trait.label}</span>
                    <strong>{trait.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="cw-companion-block">
            <div className="cw-section-head cw-section-head--compact">
              <h4 className="cw-section-title">{pick('PK 基因属性', 'PK stats')}</h4>
            </div>
            <div className="cw-bar-stack">
              {pkStats.map((stat) => (
                <div key={stat.label} className="cw-bar-card">
                  <div className="cw-bar-top">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                  <div className="cw-bar-track">
                    <span className={`cw-bar-fill ${stat.tone}`} style={{ width: `${clampPercent(stat.value)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="cw-button-row">
            <button type="button" className="cw-button cw-button--ghost" onClick={onClose}>
              {pick('收起', 'Close')}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
