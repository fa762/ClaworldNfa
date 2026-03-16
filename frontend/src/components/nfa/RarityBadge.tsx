import { getRarityName, getRarityColor } from '@/lib/rarity';

export function RarityBadge({ rarity }: { rarity: number }) {
  const colors = getRarityColor(rarity);
  const name = getRarityName(rarity, true);

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
      {name}
    </span>
  );
}
