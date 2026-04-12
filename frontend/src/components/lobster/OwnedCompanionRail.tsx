'use client';

import { Boxes, Flame } from 'lucide-react';

import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useOwnedCompanionRoster } from '@/components/lobster/useOwnedCompanionRoster';

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

  if (companion.ownedCount <= 1) return null;

  return (
    <section className={`cw-section ${compact ? 'cw-section--compact' : ''}`}>
      <div className={`cw-section-head ${compact ? 'cw-section-head--compact' : ''}`}>
        <div>
          <h2 className="cw-section-title">{title}</h2>
          {!compact ? <p className="cw-muted">{subtitle}</p> : null}
        </div>
        <span className="cw-chip cw-chip--cool">
          <Boxes size={14} />
          {companion.ownedCount} owned
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
                  <span className="cw-chip cw-chip--cool">Loading</span>
                </div>
                <div className="cw-roster-copy">
                  <h3>{item.name}</h3>
                  <p className="cw-muted">{item.shelterName}</p>
                </div>
                <div className="cw-roster-meta">
                  <span className="cw-label">Reserve</span>
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
                  {item.active ? 'Ready' : 'Watch'}
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
                <span className="cw-label">Reserve</span>
                <strong>{item.reserveText}</strong>
              </div>
            </button>
          );
        })}
      </div>

      {roster.isLoading && !compact ? <p className="cw-muted">Refreshing owned companion roster...</p> : null}
    </section>
  );
}
