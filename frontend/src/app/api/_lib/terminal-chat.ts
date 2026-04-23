import type { TerminalNFADetail } from '@/app/api/_lib/nfas';
import type { MemorySnapshotPayload, MemorySummaryPayload } from '@/app/api/_lib/memory';
import type { AutonomyStatusPayload } from '@/app/api/_lib/autonomy';
import type { WorldSummaryPayload } from '@/app/api/_lib/world';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

export type ChatLang = 'zh' | 'en';

export type CommandIntent =
  | 'mining'
  | 'arena'
  | 'auto'
  | 'mint'
  | 'memory'
  | 'status'
  | 'finance'
  | 'market'
  | 'unknown';

export type TerminalChatSnapshot = {
  detail: TerminalNFADetail;
  memorySummary: MemorySummaryPayload | null;
  memoryTimeline: MemorySnapshotPayload[];
  autonomy: AutonomyStatusPayload | null;
  world: WorldSummaryPayload | null;
};

function pick<T>(lang: ChatLang, zh: T, en: T) {
  return lang === 'en' ? en : zh;
}

function cardId(prefix: string, suffix?: string) {
  return `${prefix}-${suffix ?? Date.now().toString(36)}`;
}

function formatLedger(raw: string | bigint | null | undefined) {
  if (raw === null || raw === undefined) return '--';
  try {
    return `${formatCLW(typeof raw === 'bigint' ? raw : BigInt(raw))} Claworld`;
  } catch {
    return '--';
  }
}

function compact(value: string, max = 96) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function traitLabel(index: number, lang: ChatLang) {
  const labelsZh = ['勇气', '智慧', '社交', '创造', '韧性'];
  const labelsEn = ['Courage', 'Wisdom', 'Social', 'Create', 'Grit'];
  return pick(lang, labelsZh[index] ?? '勇气', labelsEn[index] ?? 'Courage');
}

function pickPrimaryGrowth(detail: TerminalNFADetail, lang: ChatLang) {
  const pairs = (detail.personalityVector ?? []).map((value, index) => ({
    label: traitLabel(index, lang),
    value,
  }));
  const best = pairs.sort((left, right) => right.value - left.value)[0];
  return best ?? { label: traitLabel(0, lang), value: 0 };
}

function looksLikeMemoryWrite(source: string) {
  return /记住|记下来|写进记忆|写入记忆|存入记忆|保存记忆|长期记忆|记忆功能|打开记忆|写个记忆|留个记忆|帮我记|以后你|你叫|叫你|你的名字|你的性格|你的人设|说话方式|口癖|身份|CML/i.test(
    source,
  );
}

function looksLikeMemoryCommandOnly(source: string) {
  return /^(?:请|帮我|给我|把)?\s*(?:打开|开启|进入|看看|查看|显示)?\s*(?:一下)?\s*(?:长期)?(?:记忆|记忆功能|记忆面板|记忆页|记忆模块|记忆卡|学习树|CML|memory)(?:功能|面板|页面|模块)?\s*(?:打开|开启|存入|写入|保存)?\s*[。.!！?？\s]*$/i.test(
    source.trim(),
  );
}

export function inferTerminalIntent(input: string, slashCommand?: string): CommandIntent {
  const source = slashCommand || input;
  const normalized = source.toLowerCase();

  if (normalized.includes('mint') || normalized.includes('铸造')) return 'mint';
  if (normalized.includes('mine') || normalized.includes('挖矿') || normalized.includes('任务')) return 'mining';
  if (normalized.includes('pk') || normalized.includes('竞技') || normalized.includes('大逃杀') || normalized.includes('battle'))
    return 'arena';
  if (normalized.includes('directive') || normalized.includes('代理') || normalized.includes('自治') || normalized.includes('auto'))
    return 'auto';
  if (
    normalized.includes('deposit') ||
    normalized.includes('withdraw') ||
    normalized.includes('充值') ||
    normalized.includes('提现') ||
    normalized.includes('维护') ||
    normalized.includes('储备')
  ) {
    return 'finance';
  }
  if (
    normalized.includes('market') ||
    normalized.includes('市场') ||
    normalized.includes('交易') ||
    normalized.includes('挂单') ||
    normalized.includes('拍卖')
  ) {
    return 'market';
  }
  if (
    looksLikeMemoryWrite(source) ||
    normalized.includes('memory') ||
    normalized.includes('sleep') ||
    normalized.includes('记忆') ||
    normalized.includes('回忆') ||
    normalized.includes('学习树')
  ) {
    return 'memory';
  }
  if (normalized.includes('状态') || normalized.includes('余额') || normalized.includes('账本') || normalized.includes('upkeep'))
    return 'status';
  return 'unknown';
}

export function buildSeedCards(snapshot: TerminalChatSnapshot, lang: ChatLang = 'zh'): TerminalCard[] {
  const { detail, memorySummary } = snapshot;
  const body =
    memorySummary?.identity ||
    detail.greeting ||
    detail.memorySummary ||
    pick(
      lang,
      `${detail.displayName} 已经在线。你可以直接说去挖矿、看竞技、开代理、补储备，或者先聊两句。`,
      `${detail.displayName} is online. You can say mine, open arena, enable autonomy, top up reserve, or just start talking.`,
    );

  return [
    {
      id: cardId('intro', detail.tokenId),
      type: 'message',
      role: 'nfa',
      label: pick(lang, '已接入', 'Online'),
      title: '',
      body,
      tone: 'warm',
      meta: `#${detail.tokenId} · Lv.${detail.level}`,
    },
  ];
}

export function buildIntentCards(
  intent: CommandIntent,
  input: string,
  snapshot: TerminalChatSnapshot,
  lang: ChatLang = 'zh',
): TerminalCard[] {
  const { detail, world, autonomy, memorySummary } = snapshot;
  const growth = pickPrimaryGrowth(detail, lang);
  const cards: TerminalCard[] = [];

  switch (intent) {
    case 'mining':
      cards.push(
        {
          id: cardId('reply-mine'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: pick(
            lang,
            '行，先看这一轮任务。奖励、加点和冷却都会先摆出来，你确认后再上链。',
            'Alright. Let’s preview the next task first. Reward, stat gain, and cooldown show up before you confirm on-chain.',
          ),
          tone: 'growth',
        },
        {
          id: cardId('proposal-mine'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '任务挖矿', 'Mining'),
          body: pick(lang, '抽任务、看结果、确认再执行。', 'Draw a task, preview the result, then confirm.'),
          details: [
            { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: pick(lang, '主属性', 'Primary trait'), value: growth.label, tone: 'growth' },
            { label: pick(lang, '任务数', 'Tasks'), value: String(detail.taskTotal) },
            { label: pick(lang, '结果', 'Outcome'), value: pick(lang, '奖励 + 加点', 'Reward + stat gain') },
          ],
          actions: [{ label: pick(lang, '打开挖矿', 'Open mining'), intent: 'mining' }],
        },
      );
      break;

    case 'arena':
      cards.push(
        {
          id: cardId('reply-arena'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: world?.battleRoyale?.matchId
            ? pick(
                lang,
                `大逃杀 #${world.battleRoyale.matchId} 还在场上。先看房间和质押，再决定要不要进。`,
                `Battle Royale #${world.battleRoyale.matchId} is still live. Check rooms and stake first, then decide whether to enter.`,
              )
            : pick(
                lang,
                '可以，PK 和大逃杀都在这边，点进去就是当前局面。',
                'Sure. PK and Battle Royale are both here. Open it and you will see the current match state.',
              ),
          tone: 'warm',
        },
        {
          id: cardId('proposal-arena'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '竞技', 'Arena'),
          body: pick(lang, '看 PK、看大逃杀、查奖励和历史。', 'Open PK, Battle Royale, rewards, and history.'),
          details: [
            {
              label: pick(lang, '战绩', 'Record'),
              value: lang === 'en' ? `${detail.pkWins}W / ${detail.pkLosses}L` : `${detail.pkWins}胜 / ${detail.pkLosses}败`,
              tone: detail.pkWins >= detail.pkLosses ? 'growth' : 'cool',
            },
            { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: pick(lang, '大逃杀', 'Battle Royale'), value: world?.battleRoyale?.matchId ? `#${world.battleRoyale.matchId}` : pick(lang, '暂无', 'None') },
            { label: pick(lang, '结果', 'Outcome'), value: pick(lang, '胜败 / 奖励', 'Win-loss / reward') },
          ],
          actions: [{ label: pick(lang, '打开竞技', 'Open arena'), intent: 'arena' }],
        },
      );
      break;

    case 'auto':
      cards.push(
        {
          id: cardId('reply-auto'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: autonomy?.enabled
            ? pick(lang, '代理现在开着。你改边界，我按新的口径走。', 'Autonomy is already on. Change the bounds and I will follow the new policy.')
            : pick(lang, '可以开。先定预算、保底和动作范围。', 'We can turn it on. Set budget, floor, and action scope first.'),
          tone: 'cool',
        },
        {
          id: cardId('proposal-auto'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '代理', 'Autonomy'),
          body: pick(lang, '写提示词、定预算、看最近动作。', 'Set prompt, budget, and inspect recent actions.'),
          details: [
            {
              label: pick(lang, '状态', 'Status'),
              value: autonomy?.enabled ? (autonomy.paused ? pick(lang, '暂停', 'Paused') : pick(lang, '运行', 'Running')) : pick(lang, '未开', 'Off'),
              tone: autonomy?.enabled ? 'growth' : 'cool',
            },
            { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: pick(lang, '最近', 'Latest'), value: autonomy?.recentActions[0]?.summary || pick(lang, '暂无', 'None') },
            { label: pick(lang, '范围', 'Scope'), value: pick(lang, '挖矿 / PK / 大逃杀', 'Mining / PK / Battle Royale') },
          ],
          actions: [{ label: pick(lang, '打开代理', 'Open autonomy'), intent: 'auto' }],
        },
      );
      break;

    case 'finance':
      cards.push(
        {
          id: cardId('reply-finance'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: pick(
            lang,
            '行，资金这边单独看。充值、提现和维护都放一张卡里，不用来回翻页。',
            'Alright. Funds live in one place. Deposit, withdraw, and upkeep are all in the same panel.',
          ),
          tone: 'cool',
        },
        {
          id: cardId('proposal-finance'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '资金', 'Funds'),
          body: pick(lang, '补储备、提现到主钱包、处理维护。', 'Top up reserve, withdraw to wallet, and manage upkeep.'),
          details: [
            { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: pick(lang, '日维护', 'Daily upkeep'), value: formatLedger(detail.upkeepDailyCLW) },
            { label: pick(lang, '持有人', 'Owner'), value: detail.currentOwner ? pick(lang, '已识别', 'Detected') : pick(lang, '未识别', 'Unknown') },
            { label: pick(lang, '结果', 'Outcome'), value: pick(lang, '交易回执回到底部', 'Receipts return to the feed') },
          ],
          actions: [{ label: pick(lang, '打开资金', 'Open funds'), intent: 'finance' }],
        },
      );
      break;

    case 'market':
      cards.push(
        {
          id: cardId('reply-market'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: pick(
            lang,
            '市场这边我给你收成一张卡。先看最新挂单，再决定买、挂还是撤。',
            'Market actions stay in one card. Check the latest listings, then decide to buy, list, or cancel.',
          ),
          tone: 'warm',
        },
        {
          id: cardId('proposal-market'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '市场', 'Market'),
          body: pick(lang, '浏览挂单、挂售当前 NFA、买入固定价。', 'Browse listings, sell the current NFA, or buy fixed-price items.'),
          details: [
            { label: pick(lang, '模式', 'Mode'), value: pick(lang, '浏览 / 挂卖 / 撤单', 'Browse / Sell / Cancel') },
            { label: pick(lang, '货币', 'Currency'), value: 'BNB' },
            { label: pick(lang, '当前 NFA', 'Current NFA'), value: `#${detail.tokenId}` },
            { label: pick(lang, '结果', 'Outcome'), value: pick(lang, '上架 / 买入 / 撤单', 'List / Buy / Cancel') },
          ],
          actions: [{ label: pick(lang, '打开市场', 'Open market'), intent: 'market' }],
        },
      );
      break;

    case 'mint':
      cards.push(
        {
          id: cardId('reply-mint'),
          type: 'message',
          role: 'system',
          label: pick(lang, '铸造', 'Mint'),
          title: '',
          body: pick(lang, '先铸一只。出来以后，它会直接接进这个对话口。', 'Mint one first. Once revealed, it will come straight into this terminal.'),
          tone: 'warm',
        },
        {
          id: cardId('proposal-mint'),
          type: 'proposal',
          label: pick(lang, '动作卡', 'Action'),
          title: pick(lang, '铸造 NFA', 'Mint NFA'),
          body: pick(lang, '付款、等揭示、接入终端。', 'Pay, wait for reveal, then bring it online.'),
          details: [
            { label: pick(lang, '结果', 'Outcome'), value: pick(lang, '新 NFA', 'New NFA') },
            { label: pick(lang, '入口', 'Entry'), value: pick(lang, '铸造流程', 'Mint flow') },
          ],
          actions: [{ label: pick(lang, '打开铸造', 'Open mint'), intent: 'mint' }],
        },
      );
      break;

    case 'memory': {
      const candidate = compact(input, 140);
      const isWrite = looksLikeMemoryWrite(input) && !looksLikeMemoryCommandOnly(input);
      cards.push({
        id: cardId('reply-memory'),
        type: 'message',
        role: 'nfa',
        label: pick(lang, '回复', 'Reply'),
        title: '',
        body: isWrite
          ? pick(lang, '这句可以留下。你确认后，我就把它写进长期记忆。', 'This line can stay. Once you confirm, I will write it into long-term memory.')
          : pick(lang, '记忆都在这边，想写新的也可以直接落卡。', 'Memory lives here. If you want to save something new, we can write it from this panel.'),
        tone: 'alert',
      });
      cards.push({
        id: cardId('proposal-memory'),
        type: 'proposal',
        label: pick(lang, '动作卡', 'Action'),
        title: isWrite ? pick(lang, '写入长期记忆', 'Write long-term memory') : pick(lang, '记忆', 'Memory'),
        body: isWrite
          ? pick(lang, '确认这一句，再把 hash 写进学习树。', 'Confirm this line and write its hash into the learning tree.')
          : pick(lang, '看身份摘要、最近记忆和可写入内容。', 'Review identity, recent memory, and writable content.'),
        details: [
          { label: pick(lang, '身份', 'Identity'), value: memorySummary?.identity ? compact(memorySummary.identity, 48) : pick(lang, '暂无', 'None'), tone: 'cool' },
          { label: pick(lang, '候选', 'Candidate'), value: candidate || pick(lang, '暂无', 'None') },
          { label: pick(lang, '结果', 'Outcome'), value: pick(lang, 'hash 上链，正文不上链', 'Only the hash goes on-chain') },
        ],
        actions: [{ label: isWrite ? pick(lang, '确认写入', 'Confirm write') : pick(lang, '打开记忆', 'Open memory'), intent: 'memory', memoryText: isWrite ? candidate : undefined }],
      });
      break;
    }

    case 'status':
      cards.push(
        {
          id: cardId('reply-status'),
          type: 'message',
          role: 'nfa',
          label: pick(lang, '回复', 'Reply'),
          title: '',
          body: pick(
            lang,
            '先看现在这只的账本、维护和世界局面，再决定下一步。',
            'Let’s look at this lobster’s ledger, upkeep, and world state first, then decide the next move.',
          ),
          tone: 'cool',
        },
        {
          id: cardId('receipt-status'),
          type: 'receipt',
          label: pick(lang, '状态', 'Status'),
          title: detail.displayName,
          body: `Lv.${detail.level} · ${detail.statusLabel}`,
          details: [
            { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: pick(lang, '日维护', 'Daily upkeep'), value: formatLedger(detail.upkeepDailyCLW) },
            { label: pick(lang, '主属性', 'Primary trait'), value: growth.label, tone: 'growth' },
            { label: pick(lang, '大逃杀', 'Battle Royale'), value: world?.battleRoyale?.matchId ? `#${world.battleRoyale.matchId}` : pick(lang, '暂无', 'None') },
          ],
        },
      );
      break;

    case 'unknown':
    default:
      cards.push({
        id: cardId('reply-unknown'),
        type: 'message',
        role: 'nfa',
        label: pick(lang, '回复', 'Reply'),
        title: '',
        body: pick(
          lang,
          '我听到了。你可以直接说去挖矿、看竞技、开代理、补储备、打开市场，或者把想记住的话丢给我。',
          'I got it. You can say mine, open arena, enable autonomy, top up reserve, open market, or give me something to remember.',
        ),
        tone: 'warm',
      });
      break;
  }

  if (world?.battleRoyale?.status === 'pending_reveal') {
    cards.push({
      id: cardId('world-br'),
      type: 'world',
      label: pick(lang, '世界', 'World'),
      title: pick(lang, `大逃杀 #${world.battleRoyale.matchId} 待揭示`, `Battle Royale #${world.battleRoyale.matchId} pending reveal`),
      body: pick(
        lang,
        '这一局已经满员。现在更像是在等结算，不是在等你再进场。',
        'This match is already full. At this point it is waiting for reveal and settlement, not for a new entry.',
      ),
      details: [
        { label: pick(lang, '人数', 'Players'), value: `${world.battleRoyale.players}/${world.battleRoyale.triggerCount || 10}` },
        { label: pick(lang, '奖池', 'Pot'), value: formatLedger(world.battleRoyale.potCLW), tone: 'warm' },
      ],
      cta: { label: pick(lang, '打开竞技', 'Open arena'), intent: 'arena' },
    });
  }

  if (detail.upkeepDays !== null && detail.upkeepDays <= 3) {
    cards.push({
      id: cardId('world-upkeep'),
      type: 'world',
      label: pick(lang, '提醒', 'Alert'),
      title: pick(lang, '储备偏低', 'Reserve is low'),
      body: pick(
        lang,
        `当前续航只剩 ${detail.upkeepDays ?? 0} 天，先补储备更稳。`,
        `Only ${detail.upkeepDays ?? 0} day(s) of runway remain. Topping up reserve first is safer.`,
      ),
      details: [
        { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
        { label: pick(lang, '日维护', 'Daily upkeep'), value: formatLedger(detail.upkeepDailyCLW) },
      ],
      cta: { label: pick(lang, '打开资金', 'Open funds'), intent: 'finance' },
    });
  }

  return cards;
}

export function buildEventCards(snapshot: TerminalChatSnapshot, lang: ChatLang = 'zh'): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const { world, detail } = snapshot;

  if (world?.activeEvents?.[0]) {
    const event = world.activeEvents[0];
    cards.push({
      id: cardId('event-world', event.key),
      type: 'world',
      label: pick(lang, '世界', 'World'),
      title: event.label,
      body: pick(
        lang,
        '这一轮世界状态已经变了，先看倍率和局面，再决定要不要动。',
        'The world state changed. Check the multiplier and conditions before you move.',
      ),
      details: [
        { label: pick(lang, '事件', 'Event'), value: event.label, tone: event.tone },
        { label: pick(lang, '奖励倍率', 'Reward multiplier'), value: world.rewardMultiplier, tone: 'warm' },
        { label: pick(lang, 'PK 上限', 'PK cap'), value: formatLedger(world.pkStakeLimitCLW) },
      ],
      cta: { label: pick(lang, '打开竞技', 'Open arena'), intent: 'arena' },
    });
  }

  if (detail.upkeepDays !== null && detail.upkeepDays <= 1) {
    cards.push({
      id: cardId('event-upkeep', detail.tokenId),
      type: 'world',
      label: pick(lang, '提醒', 'Alert'),
      title: pick(lang, '这只 NFA 快没储备了', 'This NFA is almost out of reserve'),
      body: pick(
        lang,
        `当前续航只剩 ${detail.upkeepDays} 天，先补储备更稳。`,
        `Only ${detail.upkeepDays} day(s) of runway remain. Top up reserve first.`,
      ),
      details: [
        { label: pick(lang, '储备', 'Reserve'), value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
        { label: pick(lang, '日维护', 'Daily upkeep'), value: formatLedger(detail.upkeepDailyCLW) },
      ],
      cta: { label: pick(lang, '打开资金', 'Open funds'), intent: 'finance' },
    });
  }

  return cards;
}
