import { getRarityName, getRarityClass, getRarityStars } from '@/lib/rarity';

export function RarityBadge({ rarity }: { rarity: number; size?: string }) {
  const stars = getRarityStars(rarity);
  const name = getRarityName(rarity, true);
  const cls = getRarityClass(rarity);

  return (
    <span className={cls}>
      {stars ? `${stars}${name}` : name}
    </span>
  );
}
