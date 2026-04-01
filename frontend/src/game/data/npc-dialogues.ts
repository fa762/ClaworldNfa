/**
 * NPC 模板对话树 — MVP 阶段（后续接 AI 替换）
 * 根据 NPC 类型和龙虾性格动态填充
 */

export interface DialogueLine {
  speaker: string;
  text: string;
  color?: string;
}

export interface DialogueChoice {
  label: string;
  action: string; // 事件名
  data?: Record<string, unknown>;
}

export interface DialogueNode {
  lines: DialogueLine[];
  choices?: DialogueChoice[];
}

// ── 性格描述映射 ──
export function getPersonalityDesc(dominant: string, value: number): string {
  if (value >= 80) return `极度${dominant}`;
  if (value >= 60) return `相当${dominant}`;
  if (value >= 40) return `有些${dominant}`;
  return `不太${dominant}`;
}

// ── 任务终端对话 ──
export function getTaskDialogue(nfaId: number, personality: { courage: number; wisdom: number; social: number; create: number; grit: number }): DialogueNode {
  const dims = [
    { key: 'courage', name: '勇气', val: personality.courage },
    { key: 'wisdom', name: '智慧', val: personality.wisdom },
    { key: 'social', name: '社交', val: personality.social },
    { key: 'create', name: '创造', val: personality.create },
    { key: 'grit', name: '毅力', val: personality.grit },
  ];
  const top = dims.sort((a, b) => b.val - a.val)[0];

  return {
    lines: [
      { speaker: '任务终端', text: `NFA #${nfaId} 验证通过。主导属性: ${top.name} (${top.val})`, color: '#ffd700' },
      { speaker: '任务终端', text: '当前有 3 项任务可领取，完成可获得 CLW 奖励。', color: '#ffd700' },
    ],
    choices: [
      { label: '查看任务列表', action: 'task:enter' },
      { label: '离开', action: 'dialogue:close' },
    ],
  };
}

// ── PK 擂台对话 ──
export function getPKDialogue(nfaId: number): DialogueNode {
  return {
    lines: [
      { speaker: '竞技终端', text: '欢迎来到擂台。', color: '#ff4444' },
      { speaker: '竞技终端', text: `NFA #${nfaId} 已登记。选择你的策略。`, color: '#ff4444' },
      { speaker: '竞技终端', text: '全攻克全防，全防克平衡，平衡克全攻。性格加成可能改变结果。', color: '#ff4444' },
    ],
    choices: [
      { label: '创建擂台（质押 CLW）', action: 'pk:showCreate' },
      { label: '搜索等待中的擂台', action: 'pk:search' },
      { label: '离开', action: 'dialogue:close' },
    ],
  };
}

// ── 市场对话 ──
export function getMarketDialogue(): DialogueNode {
  return {
    lines: [
      { speaker: '交易墙', text: '这面墙上贴满了交易信息。', color: '#3399ff' },
      { speaker: '交易墙', text: '有人在卖龙虾，有人在拍卖。价高者得。', color: '#3399ff' },
    ],
    choices: [
      { label: '浏览市场', action: 'market:browse' },
      { label: '挂售我的 NFA', action: 'market:list' },
      { label: '离开', action: 'dialogue:close' },
    ],
  };
}

// ── 传送门对话 ──
export function getPortalDialogue(currentShelter: number): DialogueNode {
  const shelterNames = ['虚空', '珊瑚', '深渊', '海藻', '海沟', '礁石', '火山', '废土'];
  const choices: DialogueChoice[] = shelterNames
    .map((name, i) => ({
      label: `SHELTER-0${i} ${name}`,
      action: 'portal:travel',
      data: { shelter: i },
    }))
    .filter((_, i) => i !== currentShelter);

  return {
    lines: [
      { speaker: '隧道入口', text: '这条地下隧道连接着其他避难所。', color: '#aa44ff' },
      { speaker: '隧道入口', text: `当前位置: SHELTER-0${currentShelter} ${shelterNames[currentShelter]}`, color: '#aa44ff' },
      { speaker: '隧道入口', text: '选择目的地:', color: '#aa44ff' },
    ],
    choices,
  };
}

// ── 意识唤醒舱对话 ──
export function getOpenClawDialogue(): DialogueNode {
  return {
    lines: [
      { speaker: '意识唤醒舱', text: '这台设备很特殊。它可以让你的龙虾...思考。', color: '#ffffff' },
      { speaker: '意识唤醒舱', text: '不是简单的指令执行。是真正的对话、记忆、甚至做梦。', color: '#ffffff' },
      { speaker: '意识唤醒舱', text: '但这需要 OpenClaw 框架支持。你的设备上有安装吗？', color: '#ffffff' },
    ],
    choices: [
      { label: '告诉我怎么安装', action: 'openclaw:install' },
      { label: '已经安装了', action: 'openclaw:connected' },
      { label: '还不需要', action: 'dialogue:close' },
    ],
  };
}

// ── 随机遇到的 NPC 闲聊 ──
export function getRandomNPCDialogue(shelter: number): DialogueNode {
  const chats: DialogueLine[][] = [
    [
      { speaker: '避难所居民', text: '你也养了龙虾？我的那只最近老是偷懒，毅力太低了。' },
      { speaker: '避难所居民', text: '听说勇气高的龙虾做废墟探索能拿双倍奖励，真的假的？' },
    ],
    [
      { speaker: '流浪者', text: '地面上的事...你不想知道。AXIOM 的巡逻越来越频繁了。' },
      { speaker: '流浪者', text: '有个传言说 SHELTER-00 虚空里藏着关于 AXIOM 的秘密。信不信由你。' },
    ],
    [
      { speaker: '技术员', text: '这些终端机都是老古董了。但跑 OpenClaw 刚刚好。' },
      { speaker: '技术员', text: 'AXIOM 控制不了本地运行的 AI，这就是我们的优势。' },
    ],
    [
      { speaker: '商人', text: '最近 CLW 汇率又变了。世界状态倍率调高了，任务赚的多了。' },
      { speaker: '商人', text: '想赚钱？培养一只高匹配度的龙虾，比什么都强。' },
    ],
  ];

  const idx = Math.floor(Math.random() * chats.length);
  return { lines: chats[idx] };
}
