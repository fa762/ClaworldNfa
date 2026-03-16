import { getRarityName, getRarityColor } from '@/lib/rarity';
import { Star, Crown, Sparkles } from 'lucide-react';

const rarityIcons: Record<number, React.ElementType | null> = {
  0: null,
  1: null,
  2: Star,
  3: Crown,
  4: Sparkles,
};

export function RarityBadge({ rarity, size = 'sm' }: { rarity: number; size?: 'sm' | 'md' }) {
  const colors = getRarityColor(rarity);
  const name = getRarityName(rarity, true);
  const Icon = rarityIcons[rarity];
  const isSm = size === 'sm';

  return (
    <span className={`inline-flex items-center gap-1 ${isSm ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'} rounded-full border font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
      {Icon && <Icon size={isSm ? 10 : 12} />}
      {name}
    </span>
  );
}
