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

export function getShelterName(index: number): string {
  return SHELTER_NAMES[index] ?? `SHELTER-${index}`;
}

export function getShelterDescription(index: number): string {
  return SHELTER_DESCRIPTIONS[index] ?? '';
}
