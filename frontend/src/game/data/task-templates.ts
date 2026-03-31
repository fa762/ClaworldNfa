/**
 * 任务模板库 — 每种性格类型 5 个任务
 * 游戏会从对应类型中随机选取，确保每次都不同
 */

export interface TaskTemplate {
  type: number;      // 0=courage 1=wisdom 2=social 3=create 4=grit
  title: string;
  desc: string;
  baseClw: number;
  baseXp: number;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  // ── 勇气 (0) ──
  { type: 0, title: '废墟探索',     desc: '穿越 AXIOM 巡逻区域，回收一批电子元件。危险但回报丰厚。', baseClw: 80, baseXp: 40 },
  { type: 0, title: '地面突袭',     desc: 'AXIOM 的传感器网络出现了短暂盲区。趁现在上去搜刮物资。', baseClw: 100, baseXp: 45 },
  { type: 0, title: '巢穴清扫',     desc: '地下隧道深处发现不明生物巢穴，需要有人去侦察。', baseClw: 70, baseXp: 35 },
  { type: 0, title: '信号塔抢修',   desc: '地面信号塔被风暴损坏，要在 AXIOM 反应过来之前修好它。', baseClw: 90, baseXp: 40 },
  { type: 0, title: '护送任务',     desc: '一批新幸存者需要从隧道口护送到避难所，途中可能有意外。', baseClw: 85, baseXp: 42 },

  // ── 智慧 (1) ──
  { type: 1, title: '密码破译',     desc: '截获了一段 AXIOM 加密通信，需要分析并破译其中的指令。', baseClw: 60, baseXp: 50 },
  { type: 1, title: '数据分析',     desc: '从旧服务器中恢复的数据需要整理。可能包含 AXIOM 的行为模式。', baseClw: 55, baseXp: 55 },
  { type: 1, title: '终端诊断',     desc: '有一台终端开始输出异常数据。查明原因并修复。', baseClw: 50, baseXp: 45 },
  { type: 1, title: '路径规划',     desc: '需要计算一条避开所有已知 AXIOM 传感器的安全路线。', baseClw: 65, baseXp: 48 },
  { type: 1, title: '文献翻译',     desc: '发现了一份旧世界的技术手册，但使用的是废弃的编程语言。', baseClw: 45, baseXp: 52 },

  // ── 社交 (2) ──
  { type: 2, title: '物资谈判',     desc: 'SHELTER-04 的商人带来了稀缺零件，但开价很高。', baseClw: 70, baseXp: 38 },
  { type: 2, title: '纠纷调解',     desc: '两个居民因为食物分配吵起来了。需要有人出面调解。', baseClw: 50, baseXp: 40 },
  { type: 2, title: '情报交换',     desc: '另一个避难所的信使到了。用我们的情报换取他们的。', baseClw: 65, baseXp: 35 },
  { type: 2, title: '联盟会议',     desc: '多个避难所代表在线会议，需要一个可靠的协调人。', baseClw: 80, baseXp: 42 },
  { type: 2, title: '新人接待',     desc: '刚到的幸存者需要有人介绍避难所的规矩和设施。', baseClw: 40, baseXp: 36 },

  // ── 创造 (3) ──
  { type: 3, title: '终端改装',     desc: '一台老旧终端机需要创造性改装，提升避难所的通信能力。', baseClw: 65, baseXp: 42 },
  { type: 3, title: '防御工事',     desc: '用回收的材料设计并建造一个新的隧道入口伪装。', baseClw: 75, baseXp: 40 },
  { type: 3, title: '能源改造',     desc: '避难所的供电系统效率太低，想办法用废料改进它。', baseClw: 70, baseXp: 45 },
  { type: 3, title: '通信加密',     desc: '设计一套新的加密通信协议，替代已经被 AXIOM 破解的旧协议。', baseClw: 80, baseXp: 48 },
  { type: 3, title: '地图绘制',     desc: '用探索数据和居民口述绘制一份更新的地下隧道网络图。', baseClw: 55, baseXp: 38 },

  // ── 毅力 (4) ──
  { type: 4, title: '巡逻守卫',     desc: '夜间巡逻，确保避难所入口安全。枯燥但必须坚持。', baseClw: 50, baseXp: 50 },
  { type: 4, title: '物资搬运',     desc: '大量补给需要从仓库搬到各区。体力活，没有捷径。', baseClw: 45, baseXp: 48 },
  { type: 4, title: '管道维护',     desc: '检查并修复避难所所有管道的泄漏点。重复枯燥但关乎生存。', baseClw: 55, baseXp: 52 },
  { type: 4, title: '信号监听',     desc: '连续 8 小时监听无线电频段，记录任何异常信号。', baseClw: 40, baseXp: 55 },
  { type: 4, title: '训练新手',     desc: '教新来的龙虾操作员基本操作。需要耐心和坚持。', baseClw: 60, baseXp: 45 },
];

/**
 * 根据性格权重选取 3 个任务
 * 保证类型不完全重复，且高匹配类型出现概率更高
 */
export function pickTasks(personality: { courage: number; wisdom: number; social: number; create: number; grit: number }): TaskTemplate[] {
  const dims = [
    { type: 0, val: personality.courage },
    { type: 1, val: personality.wisdom },
    { type: 2, val: personality.social },
    { type: 3, val: personality.create },
    { type: 4, val: personality.grit },
  ];

  // 按性格值排序，确保高匹配类型优先
  const sorted = [...dims].sort((a, b) => b.val - a.val);

  // 选3个不同类型：最高、第二高、随机一个
  const types = [sorted[0].type, sorted[1].type];
  const remaining = sorted.filter(d => !types.includes(d.type));
  types.push(remaining[Math.floor(Math.random() * remaining.length)].type);

  // 从每个类型中随机选一个模板
  return types.map(t => {
    const pool = TASK_TEMPLATES.filter(tpl => tpl.type === t);
    return pool[Math.floor(Math.random() * pool.length)];
  });
}

/**
 * 计算匹配度（简化版）
 */
export function calcMatchScore(
  personality: { courage: number; wisdom: number; social: number; create: number; grit: number },
  taskType: number
): number {
  const vals = [personality.courage, personality.wisdom, personality.social, personality.create, personality.grit];
  const taskVal = vals[taskType] || 0;
  const maxVal = Math.max(...vals, 1);
  // 匹配度 = 该维度 / 最高维度 * 2.0（上限 2.0）
  return Math.min(2.0, Math.max(0.05, (taskVal / maxVal) * 2.0));
}
