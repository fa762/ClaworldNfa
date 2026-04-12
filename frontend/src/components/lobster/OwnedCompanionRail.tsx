'use client';

import { Boxes, Flame } from 'lucide-react';

import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useOwnedCompanionRoster } from '@/components/lobster/useOwnedCompanionRoster';
import { useI18n } from '@/lib/i18n';

type OwnedCompanionRailProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function OwnedCompanionRail({
  title = 'Owned companions',
  subtitle = 'Switch the active lobster without leaving the current flow.',
  compact = true,
}: OwnedCompanionRailProps) {
  const companion = useActiveCompanion();
  const roster = useOwnedCompanionRoster(companion.ownedTokens);
  const { pick } = useI18n();

  if (companion.ownedCount <= 1) return null;

  return (
    <section className={`cw-section ${compact ? 'cw-section--compact' : ''}`}>
      <div className={compact ? 'cw-roster-toolbar' : `cw-section-head ${compact ? 'cw-section-head--compact' : ''}`}>
        <div>
          {compact ? (
            <>
              <span className="cw-label">{pick('当前编组', 'Active roster')}</span>
              <h2 className="cw-section-title">{pick('切换龙虾', 'Switch lobster')}</h2>
            </>
          ) : (
            <>
              <h2 className="cw-section-title">{title}</h2>
              <p className="cw-muted">{subtitle}</p>
            </>
          )}
        </div>
        <span className="cw-chip cw-chip--cool">
          <Boxes size={14} />
          {pick(`${companion.ownedCount} 只`, `${companion.ownedCount} owned`)}
        </span>
      </div>

      <div className="cw-roster">
        {(roster.items.length > 0 ? roster.items : companion.ownedTokens.map((tokenId) => ({
          tokenId,
          tokenNumber: Number(tokenId),
          name: `NFA #${tokenId.toString()}`,
          shelterName: 'Loading...',
          level: 0,
          active: false,
          reserveText: '--',
          loading: true,
        })) ).map((item) => {
          const selected = item.tokenId === companion.tokenId;
          const loading = 'loading' in item && Boolean(item.loading);

          if (loading) {
            return (
              <div key={item.tokenId.toString()} className="cw-roster-card cw-roster-card--loading" aria-hidden="true">
                <div className="cw-roster-head">
                  <strong>#{item.tokenNumber}</strong>
                  <span className="cw-chip cw-chip--cool">{pick('读取中', 'Loading')}</span>
                </div>
                <div className="cw-roster-copy">
                  <h3>{item.name}</h3>
                  <p className="cw-muted">{item.shelterName}</p>
                </div>
                <div className="cw-roster-meta">
                  <span className="cw-label">{pick('储备', 'Reserve')}</span>
                  <strong>{item.reserveText}</strong>
                </div>
              </div>
            );
          }

          return (
            <button
              key={item.tokenId.toString()}
              type="button"
              className={`cw-roster-card ${selected ? 'cw-roster-card--active' : ''}`}
              onClick={() => companion.selectCompanion(item.tokenId)}
            >
              <div className="cw-roster-head">
                <strong>#{item.tokenNumber}</strong>
                <span className={`cw-chip ${item.active ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
                  <Flame size={12} />
                  {item.active ? pick('就绪', 'Ready') : pick('观察', 'Watch')}
                </span>
              </div>
              <div className="cw-roster-copy">
                <h3>{item.name}</h3>
                <p className="cw-muted">
                  {item.shelterName}
                  {item.level > 0 ? ` // Lv.${item.level}` : ''}
                </p>
              </div>
              <div className="cw-roster-meta">
                <span className="cw-label">{pick('储备', 'Reserve')}</span>
                <strong>{item.reserveText}</strong>
              </div>
            </button>
          );
        })}
      </div>

      {roster.isLoading && !compact ? <p className="cw-muted">{pick('正在刷新已拥有的龙虾列表。', 'Refreshing owned companion roster...')}</p> : null}
    </section>
  );
}
