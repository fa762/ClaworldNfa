/**
 * NPC 模板对话树 — MVP 阶段（后续接 AI 替换）
 * 根据 NPC 类型和龙虾性格动态填充
 */

export interface DialogueLine {
  speaker: string;
  text: string;
  color?: string;
  portraitKey?: string;
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
export type SableNode =
  | 'intro'
  | 'relay'
  | 'bsc'
  | 'tutorial'
  | 'fixed'
  | 'auction'
  | 'swap'
  | 'risk'
  | 'past'
  | 'whyStay'
  | 'jobs'
  | 'custody'
  | 'operators'
  | 'secret';

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
      {
        speaker: lang === 'zh' ? 'Sable' : 'Sable',
        portraitKey: 'sable-portrait-default',
        text: lang === 'zh'
          ? '欢迎来到撮合墙。我负责这里的挂单、清算和失控价格。'
          : 'Welcome to the Match Wall. I manage listings, settlement, and runaway prices here.',
        color: '#ffd34d',
      },
      {
        speaker: lang === 'zh' ? 'Sable' : 'Sable',
        portraitKey: 'sable-portrait-calm',
        text: lang === 'zh'
          ? '这不是普通市场，而是旧时代币安中继塔残留下来的结算网络。'
          : 'This is not a normal market. It is the surviving settlement mesh of an old Binance relay tower.',
        color: '#ffd34d',
      },
      {
        speaker: lang === 'zh' ? 'Sable' : 'Sable',
        portraitKey: 'sable-portrait-warning',
        text: lang === 'zh'
          ? 'BSC 中继链路还在运转。价格屏、挂牌和清算回执，都是从这里同步出去的。'
          : 'The BSC relay path is still alive. Price boards, listings, and settlement receipts are synchronized from here.',
        color: '#ffd34d',
      },
    ],
    choices: [
      { label: lang === 'zh' ? '进入撮合墙' : 'Open match wall', action: 'market:browse' },
      { label: lang === 'zh' ? '挂售我的 NFA' : 'List my NFA', action: 'market:list' },
      { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
    ],
  };
}

export function getSableDialogue(node: SableNode, lang: GameLang): DialogueNode {
  const speaker = 'Sable';
  const close = lang === 'zh' ? '离开' : 'Leave';
  const back = lang === 'zh' ? '回到上一步' : 'Back';

  if (node === 'relay') {
    return {
      lines: [
        {
          speaker,
          portraitKey: 'sable-portrait-calm',
          color: '#ffd34d',
          text: lang === 'zh'
            ? '你眼前这堵墙，以前不叫撮合墙。它只是中继塔的一个侧终端，负责收价格、发回执、同步清算。'
            : 'This wall was not called a Match Wall before. It was just a side terminal on a relay tower, built to ingest prices, issue receipts, and sync settlements.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-calm',
          color: '#ffd34d',
          text: lang === 'zh'
            ? '旧时代的人把速度当信仰。黄黑塔架竖起来之后，整条价值链都挂在它们上面。价格跑得比人快，清算跑得比恐慌快。后来老交易员提起那些塔的时候，总会顺手提到 Binance，提到 CZ，提到一姐。'
            : 'The old age worshipped speed. Once the yellow-black towers were raised, whole value chains hung from them. Prices moved faster than people. Settlement moved faster than panic.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-warning',
          color: '#ffb84d',
          text: lang === 'zh'
            ? '后来塔没全倒。最危险的东西，从来不会一次死干净。它们留下了线、留下了规则、也留下了习惯。现在避难所还靠这些残骸活着。'
            : 'Then the towers never fully died. The most dangerous systems never go cleanly. They leave rails, rules, and habits behind. The shelters still live off those remains.',
        },
      ],
      choices: [
        { label: lang === 'zh' ? '那 BSC 链路是什么' : 'What is the BSC route then', action: 'sable:bsc' },
        { label: back, action: 'sable:intro' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'bsc') {
    return {
      lines: [
        {
          speaker,
          portraitKey: 'sable-portrait-default',
          color: '#ffd34d',
          text: lang === 'zh'
            ? 'BSC 链路是现在还最稳的那条价值传输通道。别把它想成公司，把它想成废墟里还通电的一条主干。很多老交易员嘴上讲的是链路，心里想的还是 Binance 那套基础设施。'
            : 'The BSC route is the most stable surviving value corridor we have. Do not think of it as a company. Think of it as a powered trunk line still alive in the ruins.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-calm',
          color: '#ffd34d',
          text: lang === 'zh'
            ? '价格屏、挂牌、成交、清算回执，都要沿这条线走。断一次，市场会先瞎，再聋，最后死。'
            : 'Price boards, listings, fills, settlement receipts - all of them travel over that line. Let it break once and the market goes blind first, deaf second, dead third.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-secret',
          color: '#ffe08a',
          text: lang === 'zh'
            ? '所以我不是在卖东西。我是在看这条线有没有被人动手脚。老一代清算员都懂，链路一脏，用户资产先出事。'
            : 'That is why I am not just selling things here. I am watching whether someone has tampered with the line.',
        },
      ],
      choices: [
        { label: lang === 'zh' ? '继续说风险' : 'Tell me about the risks', action: 'sable:risk' },
        { label: back, action: 'sable:relay' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'tutorial') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '固定价很简单。你给一个价，谁愿意付，单子就结。快，但没后悔药。' : 'Fixed price is simple. You name a number, someone pays it, the ticket clears. Fast, and irreversible.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '拍卖更像试探。你挂出去，看市场愿不愿意替你抬价。' : 'Auction is a probe. You hang the lobster out and see whether the market wants to raise the price for you.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '互换是最像地下世界的交易。不是问它值多少钱，而是问它值不值得换。' : 'Swap is the most underground form of trade. It asks not what something costs, but what it is worth to trade.' },
      ],
      choices: [
        { label: lang === 'zh' ? '固定价具体怎么用' : 'How does fixed price really work', action: 'sable:fixed' },
        { label: lang === 'zh' ? '拍卖和互换呢' : 'What about auctions and swaps', action: 'sable:auction' },
        { label: back, action: 'sable:intro' },
      ],
    };
  }

  if (node === 'fixed') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '固定价适合你心里已经有锚点的时候。你知道这只龙虾该卖多少，就别让市场替你犹豫。' : 'Use fixed price when you already have an anchor in mind. If you know what a lobster should sell for, do not let the market hesitate for you.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '唯一的问题是，定太低，别人会比你更快看懂它的价值。定太高，它就会在墙上慢慢冷掉。' : 'The only problem is simple. Price too low and someone else will understand its value faster than you. Price too high and it will freeze on the wall.' },
      ],
      choices: [
        { label: lang === 'zh' ? '回到市场教学' : 'Back to market lesson', action: 'sable:tutorial' },
        { label: lang === 'zh' ? '直接进入撮合墙' : 'Open match wall', action: 'market:browse' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'auction') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '拍卖适合不确定价格，但确定市场会争它的时候。你把它挂出去，让别人的贪心替你抬价。' : 'Auction fits uncertainty. You may not know the exact price, but you know the market will fight over it. Let other people’s greed lift it for you.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '互换更私人。它不是讲公允价格，它讲你愿不愿意拿现在这一只，去换你真正想要的那一只。' : 'Swap is more intimate. It is not about fair price. It is about whether you are willing to trade what you have for what you actually want.' },
      ],
      choices: [
        { label: lang === 'zh' ? '继续讲风险' : 'Go deeper into risk', action: 'sable:risk' },
        { label: lang === 'zh' ? '回到市场教学' : 'Back to market lesson', action: 'sable:tutorial' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'risk') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '最危险的不是便宜货，是看起来太顺的报价。' : 'The dangerous listing is not the cheap one. It is the one that looks too smooth.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '假桥污染最早从回执开始。你看到的是成交，链路写进去的却是另一套流向。' : 'Bridge contamination starts with receipts. You think you see a settlement, but the route writes something else entirely.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '黑天鹅来的时候，先死的通常不是价格，是流动性。价格牌还亮着，墙后面已经没人接单了。' : 'When a black swan hits, liquidity dies before price does. The board may still glow while there is nobody left behind the wall to take the other side.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '别迷信屏幕上的价格。真正该看的，是谁在推价，谁在撤单，谁在等你犯错。' : 'Do not worship the board price. Watch who pushes, who pulls, and who waits for your mistake.' },
      ],
      choices: [
        { label: lang === 'zh' ? '怎么守住用户资产' : 'How do you protect user assets', action: 'sable:custody' },
        { label: lang === 'zh' ? '她以前见过什么？' : 'What has she seen before?', action: 'sable:past' },
        { label: lang === 'zh' ? '回到开场' : 'Back to intro', action: 'sable:intro' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'custody') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '先分开。热钱包归热钱包，冷钱包归冷钱包。流动性的钱，和保命的钱，不能睡在一张床上。' : 'Separate first. Hot wallets stay hot. Cold wallets stay cold. Liquidity money and survival money do not sleep in the same bed.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '黑天鹅来的时候，先证明钱还在，再谈价格。先给回执，再谈脸面。很多系统死就死在这一步顺序错了。' : 'When the black swan lands, prove the assets exist first, argue about price later. Issue the receipt first, protect your pride later. A lot of systems died because they reversed that order.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '外行喜欢看涨幅，真正的守夜人先看资产隔离和提款通道还在不在。' : 'Outsiders stare at upside. Real keepers first check whether asset segregation and withdrawal paths still exist.' },
      ],
      choices: [
        { label: lang === 'zh' ? '谁把这些规矩留下来的' : 'Who left these rules behind', action: 'sable:operators' },
        { label: lang === 'zh' ? '回到风险分支' : 'Back to risk', action: 'sable:risk' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'past') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '我以前做清算。不是市场宣传里那种。是真的清算。' : 'I used to do settlement. Not the pretty version from market brochures. Real settlement.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '价格崩的时候，所有人都说自己只是执行规则。最后收尸的人，通常是清算员。' : 'When prices collapse, everybody says they were just following rules. The one who buries the remains is usually the clearer.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '旧时代那些黄黑中继塔，本来是为了效率。后来它们多了一个更重要的用途：在挤兑和踩踏里，先守住用户资产，再去谈价格。也正因为这样，很多人后来才会记住 CZ，记住一姐。' : 'Those yellow-black relay towers were built for efficiency. Later they gained a harsher purpose: in runs and liquidation cascades, protect user assets first and argue about price later.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '冷钱包、资产隔离、逐笔回执、停机保护……外行觉得那是保守，做过清算的人知道那是最后一道门。真正让市场留下敬意的，从来不是涨得多快，而是黑天鹅来的时候还能不能守住底线。' : 'Cold wallets, asset segregation, per-trade receipts, circuit breakers... outsiders call that caution. People who have actually cleared a collapse know it is the last door before ruin.' },
      ],
      choices: [
        { label: lang === 'zh' ? '那你为什么还守在这里' : 'Why do you still stay here', action: 'sable:whyStay' },
        { label: lang === 'zh' ? '继续说任务线' : 'Tell me about the future jobs', action: 'sable:jobs' },
        { label: back, action: 'sable:intro' },
      ],
    };
  }

  if (node === 'whyStay') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '因为总得有人留在最后一张还能读的账单旁边。' : 'Because someone has to remain beside the last ledger that is still readable.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '你知道一个市场真正死掉是什么样吗？不是没人交易。是没人再相信回执。是每个人都开始怀疑“这笔资产到底还在不在”。' : 'Do you know what a dead market looks like? Not one with no trades. One where nobody believes the receipt anymore. One where everyone starts asking if the asset is even still there.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '我守着这堵墙，不是因为它完美。是因为它还剩一点老规矩：账要对，钱要在，清算要认。那是 CZ 和一姐那代人最让人服气的地方。不是喊口号，是在黑天鹅压下来时还守得住用户资产。' : 'I keep watch over this wall not because it is perfect. I stay because it still remembers a few old rules: the books must balance, the assets must exist, and settlement must mean something.' },
      ],
      choices: [
        { label: lang === 'zh' ? '继续' : 'Continue', action: 'sable:jobs' },
        { label: lang === 'zh' ? '谁把这些规矩留下来的' : 'Who left these rules behind', action: 'sable:operators' },
        { label: back, action: 'sable:past' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'operators') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '旧时代有一批人，真把交易系统当基础设施在守。不是嘴上说说，是在市场最乱的时候也先把用户资产摆在前面。' : 'There was a generation that treated trading systems as infrastructure. Not in speeches, but by putting user assets first when the market was at its ugliest.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '后来人们会记住 CZ，会记住一姐，不是因为谁喊得最响，而是因为有人在黑天鹅压下来时还守着那条底线。' : 'People later remembered CZ and Yi-jie not because they shouted the loudest, but because someone held the line when the black swan finally came down.' },
        { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '市场最后记住的，从来不是某一次疯涨。它记住的是谁在最乱的时候还知道什么该先守。' : 'Markets do not remember every manic rally. They remember who still knew what had to be protected first when everything was breaking.' },
      ],
      choices: [
        { label: lang === 'zh' ? '回到她的过去' : 'Back to her past', action: 'sable:past' },
        { label: lang === 'zh' ? '继续任务线' : 'Continue to the job line', action: 'sable:jobs' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'jobs') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '有些节点已经坏了，有些只是被人故意做脏。' : 'Some relay nodes are broken. Others were dirtied on purpose.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '以后你会替我去找冷钱包、修中继节点、查错误报价，顺便看看谁在喂假桥污染。要是运气差，你还会看见一次真正的黑天鹅怎样把整条链路压弯。' : 'Soon enough you will be finding cold wallets, repairing relay nodes, tracing false quotes, and seeing who is feeding bridge contamination. If your luck runs bad, you will also watch a real black swan bend the whole route under stress.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '别急。先学会看懂一笔交易怎么活下来。' : 'Do not rush. First learn how a trade survives.' },
      ],
      choices: [
        { label: lang === 'zh' ? '进入撮合墙' : 'Open match wall', action: 'market:browse' },
        { label: lang === 'zh' ? '回到开场' : 'Back to intro', action: 'sable:intro' },
        { label: close, action: 'dialogue:close' },
      ],
    };
  }

  if (node === 'secret') {
    return {
      lines: [
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '听好。真正还在运转的不是塔，是人们对结算还能发生这件事的信任。' : 'Listen carefully. The thing still running is not the tower. It is the trust that settlement can still happen.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '哪天这点信任断了，市场会先死，避难所会后死。' : 'The day that trust breaks, the market dies first and the shelters die after.' },
      ],
      choices: [
        { label: lang === 'zh' ? '回到开场' : 'Back to intro', action: 'sable:intro' },
        { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
      ],
    };
  }

  return {
    lines: [
      { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '你现在站着的这面墙，不是普通市场。它以前叫结算网络。' : 'The wall you are standing in front of is not a market. It used to be called a settlement network.' },
      { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '旧时代的币安系中继塔塌了大半，剩下的残骸还在替避难所同步价格、挂单和清算回执。你今天看到的每一块价牌，后面都埋着旧交易文明的骨头。' : 'Most of the old Binance-style relay towers collapsed. The wreckage that remains still syncs prices, listings, and settlement receipts between shelters. Every price board you see today is standing on the bones of an older trading civilization.' },
      { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '我叫 Sable。以前替交易系统做清算。现在替这堵墙守夜。' : 'My name is Sable. I used to clear for a trading system. Now I stand watch over this wall.' },
    ],
    choices: [
      { label: lang === 'zh' ? '这面墙到底是什么' : 'What exactly is this wall', action: 'sable:relay' },
      { label: lang === 'zh' ? '教我怎么用市场' : 'Teach me the market', action: 'sable:tutorial' },
      { label: lang === 'zh' ? '这里有什么风险' : 'Show me the risks', action: 'sable:risk' },
      { label: lang === 'zh' ? '你以前到底做什么' : 'What did you do before', action: 'sable:past' },
      { label: lang === 'zh' ? '旧交易守夜人是谁' : 'Who were the old keepers', action: 'sable:operators' },
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
