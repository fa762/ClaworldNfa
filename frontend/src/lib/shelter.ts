export const SHELTER_NAMES = [
  'SHELTER-01',
  'SHELTER-02',
  'SHELTER-03',
  'SHELTER-04',
  'SHELTER-05',
  'SHELTER-06',
  '废土',
  'SHELTER-00',
] as const;

export const SHELTER_DESCRIPTIONS: Record<number, string> = {
  0: '地下走廊，17度蓝光，水培植物',
  1: '军事钢铁走廊',
  2: '刻满经文的石壁，暖黄烛光',
  3: '集装箱市场，CLW价格屏幕',
  4: '玻璃透明墙，监控摄像头',
  5: '彩色涂鸦墙壁，孩子的画',
  6: '灰色天空，废墟，远处城市轮廓',
  7: '发光苔藓，天然岩洞，篝火',
};

export const SHELTER_SPECIALTIES = {
  0: { zh: '任务回路稳定', en: 'Task circuits stable', focus: 'task', color: '#ffd34d' },
  1: { zh: '竞技氛围最强', en: 'Arena-focused shelter', focus: 'pk', color: '#ff4d4d' },
  2: { zh: '研究与感知偏强', en: 'Research and perception focus', focus: 'task', color: '#7ad7ff' },
  3: { zh: '交易流量最高', en: 'Highest market traffic', focus: 'market', color: '#4da3ff' },
  4: { zh: '监控严密，维护成本敏感', en: 'Tight surveillance, upkeep sensitive', focus: 'pk', color: '#66ffcc' },
  5: { zh: '社区与培育偏强', en: 'Community and nurturing focus', focus: 'task', color: '#44ff88' },
  6: { zh: '废土资源稀缺，收益波动大', en: 'Wasteland scarcity, volatile rewards', focus: 'market', color: '#ffaa55' },
  7: { zh: '意识与回声最活跃', en: 'Consciousness and echoes thrive here', focus: 'openclaw', color: '#aa66ff' },
} as const;

export function getShelterName(index: number): string {
  return SHELTER_NAMES[index] ?? `SHELTER-${index}`;
}

export function getShelterDescription(index: number): string {
  return SHELTER_DESCRIPTIONS[index] ?? '';
}

export function getShelterSpecialty(index: number, lang: 'zh' | 'en' = 'zh') {
  const item = SHELTER_SPECIALTIES[index as keyof typeof SHELTER_SPECIALTIES] ?? SHELTER_SPECIALTIES[0];
  return {
    text: lang === 'zh' ? item.zh : item.en,
    focus: item.focus,
    color: item.color,
  };
}
