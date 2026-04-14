'use client';

import { X } from 'lucide-react';

import { type ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { useI18n } from '@/lib/i18n';

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
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

  const taskMeters = [
    [pick('勇气', 'Courage'), companion.traits.courage, 'cw-meter--warm'],
    [pick('智慧', 'Wisdom'), companion.traits.wisdom, 'cw-meter--cool'],
    [pick('社交', 'Social'), companion.traits.social, 'cw-meter--growth'],
    [pick('创造', 'Create'), companion.traits.create, 'cw-meter--cool'],
    [pick('韧性', 'Grit'), companion.traits.grit, 'cw-meter--warm'],
  ] as const;

  const pkMeters = [
    ['STR', companion.combat.str, 'cw-meter--warm'],
    ['DEF', companion.combat.def, 'cw-meter--cool'],
    ['SPD', companion.combat.spd, 'cw-meter--growth'],
    ['VIT', companion.combat.vit, 'cw-meter--warm'],
  ] as const;

  return (
    <section className="cw-modal" aria-modal="true" role="dialog">
      <button type="button" className="cw-modal__scrim" aria-label={pick('关闭', 'Close')} onClick={onClose} />
      <div className="cw-modal__sheet">
        <section className="cw-sheet">
          <div className="cw-sheet-head">
            <div>
              <span className="cw-label">{pick('伙伴详情', 'Companion details')}</span>
              <h3>{`${companion.name} / #${companion.tokenNumber}`}</h3>
            </div>
            <button type="button" className="cw-icon-button cw-sheet-close" onClick={onClose} aria-label={pick('关闭', 'Close')}>
              <X size={16} />
            </button>
          </div>

          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">{pick('等级', 'Level')}</span>
              <strong>{`Lv.${companion.level}`}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('状态', 'Status')}</span>
              <strong>{companion.statusLabel}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('避难所', 'Shelter')}</span>
              <strong>{companion.shelterName}</strong>
            </div>
          </div>

          <div className="cw-section-head cw-section-head--compact">
            <h4 className="cw-section-title">{pick('任务属性', 'Task traits')}</h4>
          </div>
          <div className="cw-meter-list">
            {taskMeters.map(([label, value, meterClass]) => (
              <div key={label} className="cw-meter-row">
                <span>{label}</span>
                <div className="cw-meter">
                  <span className={meterClass} style={{ width: `${clampPercent(value)}%` }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="cw-section-head cw-section-head--compact">
            <h4 className="cw-section-title">{pick('PK属性', 'PK stats')}</h4>
          </div>
          <div className="cw-meter-list">
            {pkMeters.map(([label, value, meterClass]) => (
              <div key={label} className="cw-meter-row">
                <span>{label}</span>
                <div className="cw-meter">
                  <span className={meterClass} style={{ width: `${clampPercent(value)}%` }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

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
