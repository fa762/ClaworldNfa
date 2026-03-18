export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
export const RARITY_NAMES_CN = ['普通', '稀有', '史诗', '传说', '神话'] as const;

export type RarityLevel = 0 | 1 | 2 | 3 | 4;

// Terminal color classes
export const RARITY_CLASSES: Record<number, string> = {
  0: 'rarity-common',
  1: 'rarity-rare',
  2: 'rarity-epic',
  3: 'rarity-legendary',
  4: 'rarity-mythic',
};

// Star indicators per rarity
export const RARITY_STARS: Record<number, string> = {
  0: '',
  1: '★',
  2: '★★',
  3: '★★★',
  4: '★★★★★',
};

// Legacy color objects for compatibility
export const RARITY_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: '', text: 'rarity-common', border: '' },
  1: { bg: '', text: 'rarity-rare', border: '' },
  2: { bg: '', text: 'rarity-epic', border: '' },
  3: { bg: '', text: 'rarity-legendary', border: '' },
  4: { bg: '', text: 'rarity-mythic', border: '' },
};

export function getRarityName(rarity: number, chinese = false): string {
  const names = chinese ? RARITY_NAMES_CN : RARITY_NAMES;
  return names[rarity] ?? 'Unknown';
}

export function getRarityColor(rarity: number) {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS[0];
}

export function getRarityClass(rarity: number): string {
  return RARITY_CLASSES[rarity] ?? RARITY_CLASSES[0];
}

export function getRarityStars(rarity: number): string {
  return RARITY_STARS[rarity] ?? '';
}
