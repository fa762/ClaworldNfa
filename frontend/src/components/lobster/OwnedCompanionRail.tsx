'use client';

import { Boxes, Flame } from 'lucide-react';

import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useOwnedCompanionRoster } from '@/components/lobster/useOwnedCompanionRoster';

type OwnedCompanionRailProps = {
  title?: string;
  subtitle?: string;
};

export function OwnedCompanionRail({
  title = 'Owned companions',
  subtitle = 'Switch the active lobster without leaving the current flow.',
}: OwnedCompanionRailProps) {
  const companion = useActiveCompanion();
  const roster = useOwnedCompanionRoster(companion.ownedTokens);

  if (companion.ownedCount <= 1) return null;

  return (
    <section className="cw-section">
      <div className="cw-section-head">
        <div>
          <h2 className="cw-section-title">{title}</h2>
          <p className="cw-muted">{subtitle}</p>
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
        })) ).map((item) => {
          const selected = item.tokenId === companion.tokenId;
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

      {roster.isLoading ? <p className="cw-muted">Refreshing owned companion roster...</p> : null}
    </section>
  );
}
