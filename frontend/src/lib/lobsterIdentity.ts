import type { NFASummary, NFAState } from '@/game/chain/wallet';

type Traits = Pick<NFASummary, 'courage' | 'wisdom' | 'social' | 'create' | 'grit'>;

export interface LobsterIdentity {
  title: string;
  subtitle: string;
  dominantLabel: string;
  dominantValue: number;
}

type GameLang = 'zh' | 'en';

const DOMINANT_LABELS_ZH = {
  courage: '勇气',
  wisdom: '智慧',
  social: '社交',
  create: '创造',
  grit: '毅力',
} as const;

const DOMINANT_LABELS_EN = {
  courage: 'Courage',
  wisdom: 'Wisdom',
  social: 'Social',
  create: 'Create',
  grit: 'Grit',
} as const;

export function buildLobsterIdentity(data: Traits & { shelter: number; rarity: number; level: number }, lang: GameLang): LobsterIdentity {
  const entries = [
    { key: 'courage', value: data.courage },
    { key: 'wisdom', value: data.wisdom },
    { key: 'social', value: data.social },
    { key: 'create', value: data.create },
    { key: 'grit', value: data.grit },
  ].sort((a, b) => b.value - a.value);

  const dominant = entries[0];
  const labels = lang === 'zh' ? DOMINANT_LABELS_ZH : DOMINANT_LABELS_EN;
  const dominantLabel = labels[dominant.key as keyof typeof labels];

  const title = lang === 'zh'
    ? getTitleZh(dominant.key, data.rarity, data.shelter)
    : getTitleEn(dominant.key, data.rarity, data.shelter);

  const subtitle = lang === 'zh'
    ? `Lv.${data.level} · ${dominantLabel} ${dominant.value}`
    : `Lv.${data.level} · ${dominantLabel} ${dominant.value}`;

  return {
    title,
    subtitle,
    dominantLabel,
    dominantValue: dominant.value,
  };
}

export function buildIdentityFromState(state: NFAState, lang: GameLang) {
  return buildLobsterIdentity(state, lang);
}

function getTitleZh(key: string, rarity: number, shelter: number) {
  const base = {
    courage: ['裂潮冲锋者', '赤壳斗士', '前线猛钳'],
    wisdom: ['回路策士', '静海测算者', '深算者'],
    social: ['交易说客', '港湾联络官', '群居协调者'],
    create: ['火花工匠', '废土造物者', '异构设计师'],
    grit: ['灰烬生还者', '长夜苦修者', '地下铁骨'],
  } as const;

  const bucket = rarity >= 3 ? 0 : shelter % 3;
  return base[key as keyof typeof base]?.[bucket] ?? '地下龙虾';
}

function getTitleEn(key: string, rarity: number, shelter: number) {
  const base = {
    courage: ['Tidebreaker Vanguard', 'Redshell Duelist', 'Frontline Claw'],
    wisdom: ['Circuit Tactician', 'Stillwater Analyst', 'Deep Strategist'],
    social: ['Market Whisperer', 'Harbor Liaison', 'Colony Diplomat'],
    create: ['Spark Forger', 'Wasteland Maker', 'Modular Architect'],
    grit: ['Ash Survivor', 'Longnight Keeper', 'Underground Ironclaw'],
  } as const;

  const bucket = rarity >= 3 ? 0 : shelter % 3;
  return base[key as keyof typeof base]?.[bucket] ?? 'Underground Lobster';
}
