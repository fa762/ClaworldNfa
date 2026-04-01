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
  3: '集装箱市场，Claworld价格屏幕',
  4: '玻璃透明墙，监控摄像头',
  5: '彩色涂鸦墙壁，孩子的画',
  6: '灰色天空，废墟，远处城市轮廓',
  7: '发光苔藓，天然岩洞，篝火',
};

type ShelterSpecialty = {
  zh: string;
  en: string;
  focus: 'task' | 'pk' | 'market' | 'openclaw';
  color: string;
  taskBias?: number;
  taskHintZh?: string;
  taskHintEn?: string;
  pkHintZh?: string;
  pkHintEn?: string;
  marketHintZh?: string;
  marketHintEn?: string;
};

export const SHELTER_SPECIALTIES: Record<number, ShelterSpecialty> = {
  0: { zh: '任务回路稳定', en: 'Task circuits stable', focus: 'task', color: '#ffd34d', taskBias: 4, taskHintZh: '这里更常出现长期维护与巡逻类任务。', taskHintEn: 'Maintenance and patrol tasks appear more often here.' },
  1: { zh: '竞技氛围最强', en: 'Arena-focused shelter', focus: 'pk', color: '#ff4d4d', pkHintZh: '这里的战斗文化鼓励激进开场和连续挑战。', pkHintEn: 'The battle culture here rewards aggressive openings and frequent duels.' },
  2: { zh: '研究与感知偏强', en: 'Research and perception focus', focus: 'task', color: '#7ad7ff', taskBias: 1, taskHintZh: '这里更容易接到分析、破译、诊断类任务。', taskHintEn: 'Analysis, decryption, and diagnostic tasks appear more often here.' },
  3: { zh: '交易流量最高', en: 'Highest market traffic', focus: 'market', color: '#4da3ff', marketHintZh: '这里适合买卖和观察市场价格波动。', marketHintEn: 'This shelter is ideal for trading and watching price swings.' },
  4: { zh: '监控严密，维护成本敏感', en: 'Tight surveillance, upkeep sensitive', focus: 'pk', color: '#66ffcc', pkHintZh: '这里强调生存压力下的谨慎对战与反制。', pkHintEn: 'Combat here leans toward careful counterplay under survival pressure.' },
  5: { zh: '社区与培育偏强', en: 'Community and nurturing focus', focus: 'task', color: '#44ff88', taskBias: 2, taskHintZh: '这里更常出现协作、接待、调解类任务。', taskHintEn: 'Cooperation, reception, and mediation tasks appear more often here.' },
  6: { zh: '废土资源稀缺，收益波动大', en: 'Wasteland scarcity, volatile rewards', focus: 'market', color: '#ffaa55', marketHintZh: '这里的黑市价格更冒险，也更适合拍卖和博弈。', marketHintEn: 'The black market here is riskier and better suited for auctions and gambles.' },
  7: { zh: '意识与回声最活跃', en: 'Consciousness and echoes thrive here', focus: 'openclaw', color: '#aa66ff', taskHintZh: '这里更偏向意识、记忆、信号相关的工作。', taskHintEn: 'Tasks here tend to orbit consciousness, memory, and signal work.' },
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

export function getShelterTaskBias(index: number): number | undefined {
  const item = SHELTER_SPECIALTIES[index as keyof typeof SHELTER_SPECIALTIES] ?? SHELTER_SPECIALTIES[0];
  return item.taskBias;
}

export function getShelterSceneHint(index: number, scene: 'task' | 'pk' | 'market', lang: 'zh' | 'en' = 'zh'): string {
  const item = SHELTER_SPECIALTIES[index as keyof typeof SHELTER_SPECIALTIES] ?? SHELTER_SPECIALTIES[0];

  if (scene === 'task') {
    return lang === 'zh' ? (item.taskHintZh ?? '这里的任务更贴近本地避难所需求。') : (item.taskHintEn ?? 'Tasks here are shaped by local shelter needs.');
  }

  if (scene === 'pk') {
    return lang === 'zh' ? (item.pkHintZh ?? '这里的对战风格延续了本地避难所的生存文化。') : (item.pkHintEn ?? 'Combat style here reflects the shelter’s survival culture.');
  }

  return lang === 'zh' ? (item.marketHintZh ?? '这里的交易节奏会受到避难所生态影响。') : (item.marketHintEn ?? 'Trading rhythm here is shaped by the shelter ecology.');
}
