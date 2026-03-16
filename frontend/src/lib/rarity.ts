export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export const RARITY_NAMES_CN = ['普通', '稀有', '史诗', '传说', '神话'] as const;

export type RarityLevel = 0 | 1 | 2 | 3 | 4;

export const RARITY_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: 'bg-gray-700', text: 'text-gray-300', border: 'border-gray-500' },
  1: { bg: 'bg-blue-900', text: 'text-blue-300', border: 'border-blue-500' },
  2: { bg: 'bg-purple-900', text: 'text-purple-300', border: 'border-purple-500' },
  3: { bg: 'bg-yellow-900', text: 'text-yellow-300', border: 'border-[#B8860B]' },
  4: { bg: 'bg-white/10', text: 'text-[#F0F8FF]', border: 'border-white' },
};

export function getRarityName(rarity: number, chinese = false): string {
  const names = chinese ? RARITY_NAMES_CN : RARITY_NAMES;
  return names[rarity] ?? 'Unknown';
}

export function getRarityColor(rarity: number) {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS[0];
}
