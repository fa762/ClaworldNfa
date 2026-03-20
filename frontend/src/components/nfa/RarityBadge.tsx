'use client';

import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';
import { useI18n } from '@/lib/i18n';

export function RarityBadge({ rarity }: { rarity: number; size?: string }) {
  const { lang } = useI18n();
  const stars = getRarityStars(rarity);
  const name = getRarityName(rarity, lang === 'zh');
  const cls = getRarityClass(rarity);

  return (
    <span className={cls}>
      {stars ? `${stars}${name}` : name}
    </span>
  );
}
