export type SkillLang = 'zh' | 'en';

export function detectLanguage(text: string, fallback: SkillLang = 'zh'): SkillLang {
  const normalized = text.trim();
  if (!normalized) return fallback;

  const zhCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = (normalized.match(/[A-Za-z]/g) || []).length;

  const lower = normalized.toLowerCase();
  if (/speak english|use english|english please|in english/.test(lower)) return 'en';
  if (/中文|说中文|切回中文/.test(normalized)) return 'zh';

  if (zhCount === 0 && enCount === 0) return fallback;
  if (zhCount > enCount / 2) return 'zh';
  if (enCount > zhCount * 2) return 'en';
  return fallback;
}

export const RARITY_NAMES = {
  zh: ['普通', '稀有', '史诗', '传说', '神话'],
  en: ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'],
} as const;

export const SHELTER_NAMES = {
  zh: ['珊瑚礁', '深渊', '海藻林', '海沟', '礁石', '火山', '废土', '虚空'],
  en: ['Coral Reef', 'Abyss', 'Kelp Forest', 'Trench', 'Reef', 'Volcano', 'Wasteland', 'Void'],
} as const;

export const JOB_NAMES = {
  zh: ['探索者', '外交官', '创造者', '守护者', '学者', '先驱'],
  en: ['Explorer', 'Diplomat', 'Creator', 'Guardian', 'Scholar', 'Pioneer'],
} as const;

export const STRATEGY_NAMES = {
  zh: ['全攻', '均衡', '全防'],
  en: ['All Attack', 'Balanced', 'All Defense'],
} as const;

export const TASK_TYPE_NAMES = {
  zh: ['勇气', '智慧', '社交', '创造', '毅力'],
  en: ['Courage', 'Wisdom', 'Social', 'Create', 'Grit'],
} as const;

export const LISTING_TYPE_NAMES = {
  zh: ['固定价', '拍卖', '互换'],
  en: ['Fixed Price', 'Auction', 'Swap'],
} as const;

export const PK_PHASE_NAMES = {
  zh: ['等待对手', '已加入', '提交策略', '已揭示', '已结算', '已取消'],
  en: ['Waiting', 'Joined', 'Committed', 'Revealed', 'Settled', 'Cancelled'],
} as const;

export function t(lang: SkillLang, zh: string, en: string): string {
  return lang === 'zh' ? zh : en;
}

export function getRarityName(lang: SkillLang, index: number): string {
  return RARITY_NAMES[lang][index as 0 | 1 | 2 | 3 | 4] ?? t(lang, '未知', 'Unknown');
}

export function getShelterName(lang: SkillLang, index: number): string {
  return SHELTER_NAMES[lang][index as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? t(lang, '未知', 'Unknown');
}

export function getJobName(lang: SkillLang, index: number): string {
  return JOB_NAMES[lang][index as 0 | 1 | 2 | 3 | 4 | 5] ?? t(lang, '未知', 'Unknown');
}

export function getStrategyName(lang: SkillLang, index: number): string {
  return STRATEGY_NAMES[lang][index as 0 | 1 | 2] ?? t(lang, '未知', 'Unknown');
}

export function getTaskTypeName(lang: SkillLang, index: number): string {
  return TASK_TYPE_NAMES[lang][index as 0 | 1 | 2 | 3 | 4] ?? t(lang, '未知', 'Unknown');
}

export function getListingTypeName(lang: SkillLang, index: number): string {
  return LISTING_TYPE_NAMES[lang][index as 0 | 1 | 2] ?? t(lang, '未知', 'Unknown');
}

export function getPkPhaseName(lang: SkillLang, index: number): string {
  return PK_PHASE_NAMES[lang][index as 0 | 1 | 2 | 3 | 4 | 5] ?? t(lang, '未知', 'Unknown');
}
