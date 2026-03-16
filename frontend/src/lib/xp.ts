export const XP_PER_LEVEL = 100;

export function getXpForLevel(level: number): number {
  return XP_PER_LEVEL * (level + 1);
}

export function getXpProgress(level: number, xp: number): number {
  const required = getXpForLevel(level);
  return Math.min((xp / required) * 100, 100);
}
