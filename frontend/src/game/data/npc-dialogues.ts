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
      { speaker: lang === 'zh' ? '任务终端' : 'Task Terminal', portraitKey: 'npc-task-art', text: lang === 'zh' ? `NFA #${nfaId} 验证通过。主导属性: ${top.name} (${top.val})` : `NFA #${nfaId} verified. Dominant trait: ${top.name} (${top.val})`, color: '#ffd700' },
      { speaker: lang === 'zh' ? '任务终端' : 'Task Terminal', portraitKey: 'npc-task-art', text: lang === 'zh' ? '当前有 3 项任务可领取，完成可获得 Claworld 奖励。' : 'Three tasks are available. Completing one will grant Claworld rewards.', color: '#ffd700' },
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
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', portraitKey: 'npc-pk-art', text: lang === 'zh' ? '欢迎来到擂台。' : 'Welcome to the arena.', color: '#ff4444' },
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', portraitKey: 'npc-pk-art', text: lang === 'zh' ? `NFA #${nfaId} 已登记。选择你的策略。` : `NFA #${nfaId} registered. Choose your strategy.`, color: '#ff4444' },
      { speaker: lang === 'zh' ? '竞技终端' : 'Arena Terminal', portraitKey: 'npc-pk-art', text: lang === 'zh' ? '全攻克全防，全防克平衡，平衡克全攻。性格加成可能改变结果。' : 'Aggro beats Guard, Guard beats Balance, Balance beats Aggro. Personality bonuses may change the outcome.', color: '#ff4444' },
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
          ? '你来得正好。墙刚安静一会儿，再晚一点，这里又要吵起来了。'
          : 'You came at the right time. The wall just went quiet. Give it another minute and it will start shouting again.',
        color: '#ffd34d',
      },
      {
        speaker: lang === 'zh' ? 'Sable' : 'Sable',
        portraitKey: 'sable-portrait-calm',
        text: lang === 'zh'
          ? '我叫 Sable。挂单、回执、清算，我都盯着。谁想在这堵墙上动手脚，通常躲不过我的眼。'
          : 'I am Sable. Listings, receipts, settlement, I watch all of it. Anyone trying to dirty this wall rarely gets past me.',
        color: '#ffd34d',
      },
      {
        speaker: lang === 'zh' ? 'Sable' : 'Sable',
        portraitKey: 'sable-portrait-warning',
        text: lang === 'zh'
          ? '后面那口老骨头还连着旧时代留下来的黄黑中继塔。价牌、成交、清算回执，到今天还靠它撑着。'
          : 'That old skeleton behind me still hooks into the yellow-black relay towers left from the old age. Price boards, fills, and settlement receipts still lean on it.',
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
            ? '你看到的是一堵墙。我看到的是一条还没断干净的命脉。早些年，它只是中继塔边上的侧终端，收价格，吐回执，把一笔笔账对上。'
            : 'You see a wall. I see a lifeline that never fully broke. Years ago it was only a side terminal on a relay tower, swallowing prices, spitting receipts, and balancing books one trade at a time.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-calm',
          color: '#ffd34d',
          text: lang === 'zh'
            ? '那时候大家太迷信速度了。塔一根根亮起来以后，价格跑得比人快，恐慌也跟着跑，清算员常常连水都来不及喝一口。后来老交易员提起那批塔，嘴里总会顺带提到 Binance，提到 CZ，提到一姐。'
            : 'Back then people worshipped speed a little too much. Once those towers lit up, prices outran people, panic followed close behind, and clearers barely had time to swallow water. Old traders still bring up Binance, CZ, and Yi-jie when they talk about that era.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-warning',
          color: '#ffb84d',
          text: lang === 'zh'
            ? '后来塔塌了不少，规矩却没塌完。线路还在，习惯还在，清算的手法也还在。避难所今天能喘着气，多半就是靠这些残骸撑着。'
            : 'Later many towers fell, but the rules did not fall with them. The rails survived, the habits survived, even the clearing instincts survived. The shelters are still breathing off those remains.',
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
            ? 'BSC 链路现在还算稳。你可以把它当成废墟里最后一条还通电的主干线。很多人嘴上讲链路，心里想的其实还是旧时代那套黄黑基础设施。'
            : 'The BSC route is still stable enough. Think of it as the last powered trunk line left in the ruins. Plenty of people say route, but what they really remember is that old yellow-black infrastructure.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-calm',
          color: '#ffd34d',
          text: lang === 'zh'
            ? '价牌会亮，挂单会走，成交会回来，回执也能落地，靠的都是这条线。它真要抖一下，市场先发盲，后发疯。'
            : 'Boards glow, listings move, fills return, receipts land because of that line. If it really shudders, the market goes blind first and mad right after.',
        },
        {
          speaker,
          portraitKey: 'sable-portrait-secret',
          color: '#ffe08a',
          text: lang === 'zh'
            ? '所以我天天守在这儿。我怕的不是慢一点，我怕有人把线做脏。线一脏，先疼的永远是用户资产。'
            : 'That is why I stay here every day. I can live with slow. What I do not live with is a dirty route, because user assets feel that pain first.',
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
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '固定价最省心。你心里有数，就直接给价，别陪市场演戏。' : 'Fixed price is the cleanest route. If you know your number, set it and stop performing for the market.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '拍卖更像放风。你把它挂出去，看一眼人群里到底有多少贪心会自己冒头。' : 'Auction is closer to releasing scent into the air. You hang it up and watch how much greed rises by itself.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '互换就更私人了。两边都得点头，这笔账才走得顺。很多时候，人想要的从来都不是最贵那只。' : 'Swap is more personal. Both sides need to nod before the trade feels right. Most of the time people are not chasing the most expensive one anyway.' },
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
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '你心里已经有价，就用固定价。墙上的噪音很多，别把决定权全扔给它。' : 'If the number is already in your head, use fixed price. The wall is noisy. Do not hand all of your decision-making over to it.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '怕的就两件事。挂低了，别人会比你更快看懂它的价值；挂高了，它就在这儿吹冷风，一天比一天难看。' : 'There are only two real fears. Price it low and someone else sees its value faster than you do. Price it high and it hangs here in the cold, looking sadder by the day.' },
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
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '拍卖适合你闻到竞争味道的时候。你未必知道它该值多少，但你知道会有人抢。那就把它挂出去，让人群自己把价抬起来。' : 'Auction fits the moment you can smell competition in the air. You may not know the exact number, but you know people will fight. Let the crowd lift the price for you.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '互换更像握手。它讲的是执念，不是表格。很多人来这堵墙前，嘴里谈价格，心里想的却一直是某一只。' : 'Swap feels more like a handshake. It is about attachment, not spreadsheets. People talk about price here, but deep down many of them came looking for one specific thing.' },
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
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '我最怕那种太顺的单子。顺得像有人提前替你把路都铺好了。' : 'The listings I fear most are the ones that feel too smooth, as if someone laid the road for you in advance.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '假桥污染刚冒头的时候很安静，先脏的往往是回执。你眼里看见的是成交，链路里写下的却可能是另一回事。' : 'When bridge contamination first appears it is quiet. The first thing it dirties is usually the receipt. You see a fill while the route records something else.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '黑天鹅真落下来，先塌的常常不是价格，是流动性。牌子还亮着，墙后面的人已经悄悄退光了。' : 'When a real black swan lands, liquidity often breaks before price does. The board is still glowing while the people behind the wall are already gone.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '所以别只盯着数字。看看谁在抬价，谁在撤单，谁一直安静地等别人犯错。' : 'So do not stare only at numbers. Watch who lifts price, who pulls orders, and who waits quietly for someone else to make the mistake.' },
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
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '先把钱分开。热的归热的，冷的归冷的。要拿去跑流动性的，别和保命的钱挤在一处。' : 'Separate the money first. Hot stays hot. Cold stays cold. The funds you send into liquidity should never sleep beside the money keeping you alive.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '真出事的时候，先证明资产还在，再谈价格漂成什么样。回执要先给，人心才能稳。很多系统就是在这一步顺序乱了，后面全跟着塌。' : 'When things truly break, prove the assets still exist before arguing over where price drifted. Give the receipt first so people can breathe. Many systems died because they got that order wrong.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '外行爱聊涨幅。我这种守夜的人，先看提款路还通不通，账还能不能对得上。' : 'Outsiders love to talk upside. People like me check whether withdrawals still flow and whether the books can still be balanced.' },
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
        { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '我以前做清算。真刀真枪那种。电话一响，基本就知道外面又有人熬不过今晚了。' : 'I used to do real settlement. The kind where a ringing phone already meant someone out there would not survive the night unchanged.' },
        { speaker, portraitKey: 'sable-portrait-warning', color: '#ffb84d', text: lang === 'zh' ? '价格砸下来的时候，谁都爱说自己只是在照规矩办。最后留下来收尾、把烂账一张张捡起来的人，常常还是清算员。' : 'When price breaks, everyone loves to say they were only following procedure. The person left picking through the mess, one broken line at a time, is usually the clearer.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '那批黄黑中继塔最早是为了效率搭起来的。后来大家才慢慢明白，它们真正值钱的地方，是风暴压下来时还能先把用户资产护住。很多人后来记住 CZ，记住一姐，多半也因为这个。' : 'Those yellow-black relay towers were built for speed at first. Later people learned their real worth was in how they protected user assets when the storm came down. A lot of people remembered CZ and Yi-jie for exactly that.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '冷钱包、资产隔离、逐笔回执、停机保护……平时听着烦，真到黑天鹅落下来，那些麻烦会突然变成命。市场最后愿意留下敬意，也往往因为这点。' : 'Cold wallets, asset segregation, per-trade receipts, circuit breakers... they sound annoying in calm weather. When the black swan lands, those annoyances become lifelines. That is usually what earns respect in the end.' },
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
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '市场真死的时候，先坏掉的是信任。回执一旦没人信，每个人心里都会开始打鼓：那笔资产到底还在不在。' : 'When a market truly dies, trust breaks before anything else. Once nobody believes the receipt, every mind starts asking whether the asset is even still there.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '这堵墙谈不上完美，我也从没把它当神像供着。我留下来，只因为它还记得几条老规矩：账要对，钱要在，清算说出口就得算数。那一代人最让我服气的，也就是这点。风暴压下来时，他们守住了底线。' : 'This wall is far from perfect, and I have never worshipped it. I stay because it still remembers a few old rules: the books must balance, the assets must exist, and settlement must mean what it says. That is what I respected about that generation. They held the line when the storm came down.' },
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
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '旧时代确实有一批人，把交易系统当基础设施守着。行情最乱的时候，他们先看用户资产，再看脸面。' : 'There was a generation that guarded trading systems like infrastructure. When the market turned ugly, they checked user assets before they checked their pride.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '后来大家记住 CZ，记住一姐，多半也因为这个。风暴砸下来的时候，线没断，底线也没丢。' : 'People later remembered CZ and Yi-jie for that reason too. When the storm hit, the rails held and the principles held with them.' },
        { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '市场会忘掉很多暴涨的夜晚，却会记住谁在最乱的时候还知道先护住什么。' : 'Markets forget plenty of euphoric nights. They remember who still knew what had to be protected first when everything turned chaotic.' },
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
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '现在还有些节点坏着，有些干脆就是被人故意做脏的。光看表面，你分不出来。' : 'Some nodes are broken right now. Some were dirtied on purpose. From the surface alone you cannot tell which is which.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '以后你得替我跑几趟。找冷钱包，修中继节点，查错误报价，顺着假桥污染把人揪出来。运气要是差一点，你还会亲眼看见黑天鹅怎么把整条链路压弯。' : 'Soon you will be running a few jobs for me. Finding cold wallets, repairing relay nodes, tracing false quotes, dragging out whoever keeps feeding bridge contamination. If your luck is bad, you will also watch a black swan bend the whole route in front of you.' },
        { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '先别逞强。先学会看一笔交易怎么活下来，再学会怎么把它从风暴里带回来。' : 'Do not try to look brave too early. First learn how a trade survives. Then learn how to bring it back through a storm.' },
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
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '听好。真正撑着这里运转的，从来不只是一座塔。撑着这地方的，是人们还愿意相信清算还能发生，相信回执不会骗人。' : 'Listen carefully. What keeps this place moving was never just a tower. It is the belief that settlement can still happen and receipts still mean something.' },
        { speaker, portraitKey: 'sable-portrait-secret', color: '#ffe08a', text: lang === 'zh' ? '哪天这点信任断了，市场会先冷，避难所也撑不了太久。' : 'The day that trust snaps, the market goes cold first and the shelters will not last much longer after that.' },
      ],
      choices: [
        { label: lang === 'zh' ? '回到开场' : 'Back to intro', action: 'sable:intro' },
        { label: lang === 'zh' ? '离开' : 'Leave', action: 'dialogue:close' },
      ],
    };
  }

  return {
    lines: [
      { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '站近点，别怕。墙会吵，人不用。' : 'Come closer. Do not worry. The wall makes noise. I do not have to.' },
      { speaker, portraitKey: 'sable-portrait-calm', color: '#ffd34d', text: lang === 'zh' ? '你眼前这地方，白天像市场，半夜更像一台喘着气的老机器。旧时代的黄黑中继塔塌了大半，剩下这点骨头还在替避难所同步价格、挂单和清算回执。' : 'What you see here looks like a market in daylight and an old machine breathing through the night after dark. Most of the yellow-black relay towers collapsed long ago. These leftover bones still sync prices, listings, and settlement receipts for the shelters.' },
      { speaker, portraitKey: 'sable-portrait-default', color: '#ffd34d', text: lang === 'zh' ? '我叫 Sable。以前做清算，现在替这堵墙守夜。你要挂牌、查价，或者只是想听点真话，都可以来找我。' : 'My name is Sable. I used to handle settlement. Now I keep watch over this wall. If you want to list, check price, or just hear the truth, talk to me.' },
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

