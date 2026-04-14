'use client';

import { Wallet, X } from 'lucide-react';

import { type ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { truncateAddress } from '@/lib/format';
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

          <div className="cw-detail-list">
            <div className="cw-detail-row">
              <span>{pick('主钱包', 'Owner')}</span>
              <strong>{companion.ownerAddress ? truncateAddress(companion.ownerAddress) : '--'}</strong>
            </div>
            <div className="cw-detail-row">
              <span>{pick('储备', 'Reserve')}</span>
              <strong>{companion.routerClaworldText}</strong>
            </div>
            <div className="cw-detail-row">
              <span>{pick('日维护', 'Daily upkeep')}</span>
              <strong>{companion.dailyCostText}</strong>
            </div>
            <div className="cw-detail-row">
              <span>{pick('钱包 Claworld', 'Wallet Claworld')}</span>
              <strong>{companion.walletClaworldText}</strong>
            </div>
            <div className="cw-detail-row">
              <span>{pick('续航', 'Runway')}</span>
              <strong>{companion.upkeepDays === null ? pick('未知', 'n/a') : pick(`${companion.upkeepDays}天`, `${companion.upkeepDays}d`)}</strong>
            </div>
          </div>

          <div className="cw-rule-strip">
            <div className="cw-rule-copy">
              <span className="cw-label">{pick('任务属性', 'Task traits')}</span>
              <strong>{pick('影响挖矿推荐、成长方向、代理判断。', 'Shapes mining preference, growth, and auto decisions.')}</strong>
            </div>
          </div>

          <div className="cw-meter-list">
            {[
              [pick('勇气', 'Courage'), companion.traits.courage, 'cw-meter--warm'],
              [pick('智慧', 'Wisdom'), companion.traits.wisdom, 'cw-meter--cool'],
              [pick('社交', 'Social'), companion.traits.social, 'cw-meter--growth'],
              [pick('创造', 'Create'), companion.traits.create, 'cw-meter--cool'],
              [pick('韧性', 'Grit'), companion.traits.grit, 'cw-meter--warm'],
            ].map(([label, value, meterClass]) => (
              <div key={String(label)} className="cw-meter-row">
                <span>{label}</span>
                <div className="cw-meter">
                  <span className={String(meterClass)} style={{ width: `${clampPercent(Number(value))}%` }} />
                </div>
                <strong>{Number(value)}</strong>
              </div>
            ))}
          </div>

          <div className="cw-rule-strip">
            <div className="cw-rule-copy">
              <span className="cw-label">{pick('PK属性', 'PK stats')}</span>
              <strong>{pick('决定出手、抗性、速度和残局能力。', 'Controls striking, defense, speed, and late-fight stamina.')}</strong>
            </div>
          </div>

          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">STR</span>
              <strong>{companion.combat.str}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">DEF</span>
              <strong>{companion.combat.def}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">SPD</span>
              <strong>{companion.combat.spd}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">VIT</span>
              <strong>{companion.combat.vit}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('任务', 'Mining')}</span>
              <strong>{companion.taskTotal}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">{pick('胜败', 'W/L')}</span>
              <strong>{`${companion.pkWins}胜 / ${companion.pkLosses}败`}</strong>
            </div>
          </div>

          <div className="cw-button-row">
            <button type="button" className="cw-button cw-button--ghost" onClick={onClose}>
              <Wallet size={16} />
              {pick('收起', 'Close')}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
