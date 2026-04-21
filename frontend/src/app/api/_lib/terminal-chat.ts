import type { TerminalNFADetail } from '@/app/api/_lib/nfas';
import type { MemorySnapshotPayload, MemorySummaryPayload } from '@/app/api/_lib/memory';
import type { AutonomyStatusPayload } from '@/app/api/_lib/autonomy';
import type { WorldSummaryPayload } from '@/app/api/_lib/world';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

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

function pickPrimaryGrowth(detail: TerminalNFADetail) {
  const rows = [
    { label: '勇气', value: detail.personalityVector[0] ?? 0 },
    { label: '智慧', value: detail.personalityVector[1] ?? 0 },
    { label: '社交', value: detail.personalityVector[2] ?? 0 },
    { label: '创造', value: detail.personalityVector[3] ?? 0 },
    { label: '韧性', value: detail.personalityVector[4] ?? 0 },
  ].sort((left, right) => right.value - left.value);
  return rows[0];
}

function looksLikeMemoryWrite(source: string) {
  return /记住|记下来|写进记忆|写入记忆|长期记忆|CML|以后你|你叫|叫你|你的名字|你的性格|你的人设|说话方式|口癖|身份/i.test(
    source,
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
    normalized.includes('交易墙') ||
    normalized.includes('挂单') ||
    normalized.includes('拍卖')
  ) {
    return 'market';
  }
  if (looksLikeMemoryWrite(source) || normalized.includes('memory') || normalized.includes('sleep')) return 'memory';
  if (normalized.includes('状态') || normalized.includes('余额') || normalized.includes('账本') || normalized.includes('upkeep'))
    return 'status';
  return 'unknown';
}

export function buildSeedCards(snapshot: TerminalChatSnapshot): TerminalCard[] {
  const { detail, memorySummary } = snapshot;
  const body =
    memorySummary?.identity ||
    detail.greeting ||
    detail.memorySummary ||
    `${detail.displayName} 已经在线。你可以直接说去挖矿、看竞技、开代理、补储备，或者先聊两句。`;

  return [
    {
      id: cardId('intro', detail.tokenId),
      type: 'message',
      role: 'nfa',
      label: '已接入',
      title: '',
      body,
      tone: 'warm',
      meta: `#${detail.tokenId} · Lv.${detail.level}`,
    },
  ];
}

export function buildIntentCards(intent: CommandIntent, input: string, snapshot: TerminalChatSnapshot): TerminalCard[] {
  const { detail, world, autonomy, memorySummary } = snapshot;
  const growth = pickPrimaryGrowth(detail);
  const cards: TerminalCard[] = [];

  switch (intent) {
    case 'mining':
      cards.push(
        {
          id: cardId('reply-mine'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: '行，先看这一轮任务。奖励、加点和冷却都会先摆出来，你确认后再上链。',
          tone: 'growth',
        },
        {
          id: cardId('proposal-mine'),
          type: 'proposal',
          label: '动作卡',
          title: '任务挖矿',
          body: '抽任务、看结果、确认再执行。',
          details: [
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '主属性', value: growth.label, tone: 'growth' },
            { label: '任务数', value: `${detail.taskTotal} 次` },
            { label: '结果', value: '奖励 + 加点' },
          ],
          actions: [{ label: '打开挖矿', intent: 'mining' }],
        },
      );
      break;

    case 'arena':
      cards.push(
        {
          id: cardId('reply-arena'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: world?.battleRoyale?.matchId
            ? `大逃杀 #${world.battleRoyale.matchId} 还在场上。先看房间和质押，再决定要不要进。`
            : '可以，PK 和大逃杀都在这边，点进去就是当前局面。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-arena'),
          type: 'proposal',
          label: '动作卡',
          title: '竞技',
          body: '看 PK、看大逃杀、查奖励和历史。',
          details: [
            { label: '战绩', value: `${detail.pkWins} 胜 / ${detail.pkLosses} 败`, tone: detail.pkWins >= detail.pkLosses ? 'growth' : 'cool' },
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '大逃杀', value: world?.battleRoyale?.matchId ? `#${world.battleRoyale.matchId}` : '暂无' },
            { label: '结果', value: '胜败 / 奖励' },
          ],
          actions: [{ label: '打开竞技', intent: 'arena' }],
        },
      );
      break;

    case 'auto':
      cards.push(
        {
          id: cardId('reply-auto'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: autonomy?.enabled ? '代理现在开着。你改边界，我按新的口径走。' : '可以开。先定预算、保底和动作范围。',
          tone: 'cool',
        },
        {
          id: cardId('proposal-auto'),
          type: 'proposal',
          label: '动作卡',
          title: '代理',
          body: '写提示词、定预算、看最近动作。',
          details: [
            { label: '状态', value: autonomy?.enabled ? (autonomy.paused ? '暂停' : '运行') : '未开', tone: autonomy?.enabled ? 'growth' : 'cool' },
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '最近', value: autonomy?.recentActions[0]?.summary || '暂无' },
            { label: '范围', value: '挖矿 / PK / 大逃杀' },
          ],
          actions: [{ label: '打开代理', intent: 'auto' }],
        },
      );
      break;

    case 'finance':
      cards.push(
        {
          id: cardId('reply-finance'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: '行，资金这边单独看。充值、提现和维护都放一张卡里，不用来回翻页。',
          tone: 'cool',
        },
        {
          id: cardId('proposal-finance'),
          type: 'proposal',
          label: '动作卡',
          title: '资金',
          body: '补储备、提现到主钱包、处理维护。',
          details: [
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '日维护', value: formatLedger(detail.upkeepDailyCLW) },
            { label: '持有人', value: detail.currentOwner ? '已识别' : '未识别' },
            { label: '结果', value: '交易回执直接回到底部' },
          ],
          actions: [{ label: '打开资金', intent: 'finance' }],
        },
      );
      break;

    case 'market':
      cards.push(
        {
          id: cardId('reply-market'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: '市场这边我给你收成一张卡。先看最新挂单，再决定买、挂还是撤。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-market'),
          type: 'proposal',
          label: '动作卡',
          title: '市场',
          body: '浏览挂单、挂卖当前 NFA、买入固定价。',
          details: [
            { label: '模式', value: '浏览 / 挂卖 / 撤单' },
            { label: '货币', value: 'BNB' },
            { label: '当前 NFA', value: `#${detail.tokenId}` },
            { label: '结果', value: '上架 / 买入 / 撤单' },
          ],
          actions: [{ label: '打开市场', intent: 'market' }],
        },
      );
      break;

    case 'mint':
      cards.push(
        {
          id: cardId('reply-mint'),
          type: 'message',
          role: 'system',
          label: '铸造',
          title: '',
          body: '先铸一只。出来以后，它会直接接进这个对话口。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-mint'),
          type: 'proposal',
          label: '动作卡',
          title: '铸造 NFA',
          body: '付款、等揭示、接入终端。',
          details: [
            { label: '结果', value: '新 NFA' },
            { label: '入口', value: '铸造流程' },
          ],
          actions: [{ label: '打开铸造', intent: 'mint' }],
        },
      );
      break;

    case 'memory': {
      const candidate = compact(input, 140);
      const isWrite = looksLikeMemoryWrite(input);
      cards.push({
        id: cardId('reply-memory'),
        type: 'message',
        role: 'nfa',
        label: '回复',
        title: '',
        body: isWrite ? '这句可以留下。你确认后，我就把它写进长期记忆。' : '记忆都在这边，想写新的也可以直接落卡。',
        tone: 'alert',
      });
      cards.push({
        id: cardId('proposal-memory'),
        type: 'proposal',
        label: '动作卡',
        title: isWrite ? '写入长期记忆' : '记忆',
        body: isWrite ? '确认这一句，再把 hash 写进学习树。' : '看身份摘要、最近记忆和可写入内容。',
        details: [
          { label: '身份', value: memorySummary?.identity ? compact(memorySummary.identity, 48) : '暂无', tone: 'cool' },
          { label: '候选', value: candidate || '暂无' },
          { label: '结果', value: 'hash 上链，正文不上链' },
        ],
        actions: [{ label: isWrite ? '确认写入' : '打开记忆', intent: 'memory', memoryText: isWrite ? candidate : undefined }],
      });
      break;
    }

    case 'status':
      cards.push(
        {
          id: cardId('reply-status'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: '先看现在这只的账本、维护和世界局面，再决定下一步。',
          tone: 'cool',
        },
        {
          id: cardId('receipt-status'),
          type: 'receipt',
          label: '状态',
          title: detail.displayName,
          body: `${detail.statusLabel} · Lv.${detail.level}`,
          details: [
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '日维护', value: formatLedger(detail.upkeepDailyCLW) },
            { label: '主属性', value: growth.label, tone: 'growth' },
            { label: '大逃杀', value: world?.battleRoyale?.matchId ? `#${world.battleRoyale.matchId}` : '暂无' },
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
        label: '回复',
        title: '',
        body: '我听到了。你可以直接说去挖矿、看竞技、开代理、补储备、打开市场，或者把想记住的话丢给我。',
        tone: 'warm',
      });
      break;
  }

  if (world?.battleRoyale?.status === 'pending_reveal') {
    cards.push({
      id: cardId('world-br'),
      type: 'world',
      label: '世界',
      title: `大逃杀 #${world.battleRoyale.matchId} 待揭示`,
      body: '这一局已经满员。现在更像是在等结算，不是等你再进场。',
      details: [
        { label: '人数', value: `${world.battleRoyale.players}/${world.battleRoyale.triggerCount || 10}` },
        { label: '奖池', value: formatLedger(world.battleRoyale.potCLW), tone: 'warm' },
      ],
      cta: { label: '打开竞技', intent: 'arena' },
    });
  }

  if (detail.upkeepDays !== null && detail.upkeepDays <= 3) {
    cards.push({
      id: cardId('world-upkeep'),
      type: 'world',
      label: '提醒',
      title: '储备偏低',
      body: `当前续航只剩 ${detail.upkeepDays ?? 0} 天，先补储备更稳。`,
      details: [
        { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
        { label: '日维护', value: formatLedger(detail.upkeepDailyCLW) },
      ],
      cta: { label: '打开资金', intent: 'finance' },
    });
  }

  return cards;
}

export function buildEventCards(snapshot: TerminalChatSnapshot): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const { world, detail } = snapshot;

  if (world?.activeEvents?.[0]) {
    const event = world.activeEvents[0];
    cards.push({
      id: cardId('event-world', event.key),
      type: 'world',
      label: '世界',
      title: event.label,
      body: '这一轮世界状态已经变了，先看倍率和局面，再决定要不要动。',
      details: [
        { label: '事件', value: event.label, tone: event.tone },
        { label: '奖励倍率', value: world.rewardMultiplier, tone: 'warm' },
        { label: 'PK 上限', value: formatLedger(world.pkStakeLimitCLW) },
      ],
      cta: { label: '打开竞技', intent: 'arena' },
    });
  }


  if (detail.upkeepDays !== null && detail.upkeepDays <= 1) {
    cards.push({
      id: cardId('event-upkeep', detail.tokenId),
      type: 'world',
      label: '提醒',
      title: '这只 NFA 快没储备了',
      body: `当前续航只剩 ${detail.upkeepDays} 天，先补储备更稳。`,
      details: [
        { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
        { label: '日维护', value: formatLedger(detail.upkeepDailyCLW) },
      ],
      cta: { label: '打开资金', intent: 'finance' },
    });
  }

  return cards;
}
