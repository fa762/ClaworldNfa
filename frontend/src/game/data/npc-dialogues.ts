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

export type GameLang = 'zh' | 'en';

// ── 性格描述映射 ──
export function getPersonalityDesc(dominant: string, value: number): string {
  if (value >= 80) return `极度${dominant}`;
  if (value >= 60) return `相当${dominant}`;
  if (value >= 40) return `有些${dominant}`;
  return `不太${dominant}`;
}

// ── 任务终端对话 ──
export function getTaskDialogue(nfaId: number, personality: { courage: number; wisdom: number; social: number; create: number; grit: number }, lang: GameLang): DialogueNode {
  const dims = [
    { key: 'courage', name: lang === 'zh' ? '勇气' : 'Courage', val: personality.courage },
    { key: 'wisdom', name: lang === 'zh' ? '智慧' : 'Wisdom', val: personality.wisdom },
    { key: 'social', name: lang === 'zh' ? '社交' : 'Social', val: personality.social },
    { key: 'create', name: lang === 'zh' ? '创造' : 'Create', val: personality.create },
    { key: 'grit', name: lang === 'zh' ? '毅力' : 'Grit', val: personality.grit },
  ];
  const top = dims.sort((a, b) => b.val - a.val)[0];

  return {
    lines: [
      { speaker: lang === 'zh' ? '任务终端' : 'Task Terminal', text: lang === 'zh' ? `NFA #${nfaId} 验证通过。主导属性: ${top.name} (${top.val})` : `NFA #${nfaId} verified. Dominant trait: ${top.name} (${top.val})`, color: '#ffd700' },
      { speaker: lang === 'zh' ? '任务终端' : 'Task Terminal', text: lang === 'zh' ? '当前有 3 项任务可领取，完成可获得 Claworld 奖励。' : 'Three tasks are available. Completing one will grant Claworld rewards.', color: '#ffd700' },
    ],
    choices: [
      { label: lang === 'zh' ? '查看任务列表' : 'View task list', action: 'task:enter' },
      { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
    ],
  };
}

// ── PK 擂台对话 ──
export function getPKDialogue(nfaId: number, lang: GameLang): DialogueNode {
  return {
    lines: [
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', text: lang === 'zh' ? '欢迎来到擂台。' : 'Welcome to the arena.', color: '#ff4444' },
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', text: lang === 'zh' ? `NFA #${nfaId} 已登记。选择你的策略。` : `NFA #${nfaId} registered. Choose your strategy.`, color: '#ff4444' },
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', text: lang === 'zh' ? '全攻克全防，全防克平衡，平衡克全攻。性格加成可能改变结果。' : 'Aggro beats Guard, Guard beats Balance, Balance beats Aggro. Personality bonuses may change the outcome.', color: '#ff4444' },
    ],
    choices: [
      { label: lang === 'zh' ? '创建擂台（质押 Claworld）' : 'Create match (stake Claworld)', action: 'pk:showCreate' },
      { label: lang === 'zh' ? '搜索等待中的擂台' : 'Search open matches', action: 'pk:search' },
      { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
    ],
  };
}

// ── 市场对话 ──
export function getMarketDialogue(lang: GameLang): DialogueNode {
  return {
    lines: [
      { speaker: lang === 'zh' ? '交易墙' : 'Market Wall', text: lang === 'zh' ? '这面墙上贴满了交易信息。' : 'This wall is covered with trade offers.', color: '#3399ff' },
      { speaker: lang === 'zh' ? '交易墙' : 'Market Wall', text: lang === 'zh' ? '有人在卖龙虾，有人在拍卖。价高者得。' : 'Some are selling lobsters, others are auctioning them. Highest bid wins.', color: '#3399ff' },
    ],
    choices: [
      { label: lang === 'zh' ? '浏览市场' : 'Browse market', action: 'market:browse' },
      { label: lang === 'zh' ? '挂售我的 NFA' : 'List my NFA', action: 'market:list' },
      { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
    ],
  };
}

// ── 传送门对话 ──
export function getPortalDialogue(currentShelter: number, lang: GameLang): DialogueNode {
  const shelterNames = lang === 'zh'
    ? ['虚空', '珊瑚', '深渊', '海藻', '海沟', '礁石', '火山', '废土']
    : ['Void', 'Coral', 'Abyss', 'Kelp', 'Trench', 'Reef', 'Volcano', 'Wasteland'];
  const choices: DialogueChoice[] = shelterNames
    .map((name, i) => ({
      label: `SHELTER-0${i} ${name}`,
      action: 'portal:travel',
      data: { shelter: i },
    }))
    .filter((_, i) => i !== currentShelter);

  return {
    lines: [
      { speaker: lang === 'zh' ? '隧道入口' : 'Tunnel Gate', text: lang === 'zh' ? '这条地下隧道连接着其他避难所。' : 'This underground tunnel links the other shelters.', color: '#aa44ff' },
      { speaker: lang === 'zh' ? '隧道入口' : 'Tunnel Gate', text: lang === 'zh' ? `当前位置: SHELTER-0${currentShelter} ${shelterNames[currentShelter]}` : `Current location: SHELTER-0${currentShelter} ${shelterNames[currentShelter]}`, color: '#aa44ff' },
      { speaker: lang === 'zh' ? '隧道入口' : 'Tunnel Gate', text: lang === 'zh' ? '选择目的地:' : 'Choose a destination:', color: '#aa44ff' },
    ],
    choices,
  };
}

// ── 意识唤醒舱对话 ──
export function getOpenClawDialogue(lang: GameLang): DialogueNode {
  return {
    lines: [
      { speaker: lang === 'zh' ? '意识唤醒舱' : 'Awakening Pod', text: lang === 'zh' ? '这台设备很特殊。它可以让你的龙虾...思考。' : 'This machine is unusual. It can make your lobster... think.', color: '#ffffff' },
      { speaker: lang === 'zh' ? '意识唤醒舱' : 'Awakening Pod', text: lang === 'zh' ? '不是简单的指令执行。是真正的对话、记忆、甚至做梦。' : 'Not just command execution. Real dialogue, memory, even dreams.', color: '#ffffff' },
      { speaker: lang === 'zh' ? '意识唤醒舱' : 'Awakening Pod', text: lang === 'zh' ? '但这需要 OpenClaw 框架支持。你的设备上有安装吗？' : 'But it needs the OpenClaw framework. Is it installed on your device?', color: '#ffffff' },
    ],
    choices: [
      { label: lang === 'zh' ? '告诉我怎么安装' : 'Show install steps', action: 'openclaw:install' },
      { label: lang === 'zh' ? '已经安装了' : 'Already installed', action: 'openclaw:connected' },
      { label: lang === 'zh' ? '还不需要' : 'Not now', action: 'dialogue:close' },
    ],
  };
}

// ── 随机遇到的 NPC 闲聊 ──
export function getRandomNPCDialogue(_shelter: number, lang: GameLang): DialogueNode {
  const chats: DialogueLine[][] = [
    lang === 'zh'
      ? [
          { speaker: '避难所居民', text: '你也养了龙虾？我的那只最近老是偷懒，毅力太低了。' },
          { speaker: '避难所居民', text: '听说勇气高的龙虾做废墟探索能拿双倍奖励，真的假的？' },
        ]
      : [
          { speaker: 'Shelter Resident', text: 'You raise lobsters too? Mine has been slacking lately. Grit is way too low.' },
          { speaker: 'Shelter Resident', text: 'I heard high-courage lobsters can earn double rewards in ruins expeditions. True or not?' },
        ],
    lang === 'zh'
      ? [
          { speaker: '流浪者', text: '地面上的事...你不想知道。AXIOM 的巡逻越来越频繁了。' },
          { speaker: '流浪者', text: '有个传言说 SHELTER-00 虚空里藏着关于 AXIOM 的秘密。信不信由你。' },
        ]
      : [
          { speaker: 'Wanderer', text: 'What happens on the surface... you do not want to know. AXIOM patrols are getting more frequent.' },
          { speaker: 'Wanderer', text: 'There is a rumor that SHELTER-00 Void hides secrets about AXIOM. Believe it or not.' },
        ],
    lang === 'zh'
      ? [
          { speaker: '技术员', text: '这些终端机都是老古董了。但跑 OpenClaw 刚刚好。' },
          { speaker: '技术员', text: 'AXIOM 控制不了本地运行的 AI，这就是我们的优势。' },
        ]
      : [
          { speaker: 'Technician', text: 'These terminals are ancient. But they are perfect for running OpenClaw.' },
          { speaker: 'Technician', text: 'AXIOM cannot control AI that runs locally. That is our edge.' },
        ],
    lang === 'zh'
      ? [
          { speaker: '商人', text: '最近 Claworld 汇率又变了。世界状态倍率调高了，任务赚的多了。' },
          { speaker: '商人', text: '想赚钱？培养一只高匹配度的龙虾，比什么都强。' },
        ]
      : [
          { speaker: 'Merchant', text: 'The Claworld rate moved again. World-state multiplier is up, so tasks pay more.' },
          { speaker: 'Merchant', text: 'Want profit? Raise a lobster with high match scores. Nothing beats that.' },
        ],
  ];

  const idx = Math.floor(Math.random() * chats.length);
  return { lines: chats[idx] };
}
