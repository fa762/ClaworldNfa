import type { TerminalNFADetail } from '@/app/api/_lib/nfas';
import type { MemorySnapshotPayload, MemorySummaryPayload } from '@/app/api/_lib/memory';
import type { AutonomyStatusPayload } from '@/app/api/_lib/autonomy';
import type { WorldSummaryPayload } from '@/app/api/_lib/world';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

type CommandIntent = 'mining' | 'arena' | 'auto' | 'mint' | 'memory' | 'status' | 'unknown';

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
  return formatCLW(typeof raw === 'bigint' ? raw : BigInt(raw));
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

export function inferTerminalIntent(input: string, slashCommand?: string): CommandIntent {
  const source = slashCommand || input;
  const normalized = source.toLowerCase();

  if (normalized.includes('mint') || normalized.includes('铸造')) return 'mint';
  if (normalized.includes('mine') || normalized.includes('挖') || normalized.includes('矿') || normalized.includes('任务')) return 'mining';
  if (normalized.includes('pk') || normalized.includes('竞技') || normalized.includes('大逃杀') || normalized.includes('battle')) return 'arena';
  if (normalized.includes('directive') || normalized.includes('代理') || normalized.includes('自治') || normalized.includes('auto')) return 'auto';
  if (normalized.includes('记忆') || normalized.includes('cml') || normalized.includes('sleep')) return 'memory';
  if (normalized.includes('状态') || normalized.includes('余额') || normalized.includes('储备') || normalized.includes('upkeep')) return 'status';
  return 'unknown';
}

export function buildSeedCards(snapshot: TerminalChatSnapshot): TerminalCard[] {
  const { detail, memorySummary } = snapshot;
  const body = memorySummary?.identity || detail.greeting || detail.memorySummary;

  return [
    {
      id: cardId('intro', detail.tokenId),
      type: 'message',
      role: 'nfa',
      label: '龙虾已上线',
      title: `${detail.displayName} 在等你的指令`,
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
          label: '挖矿准备',
          title: '我可以先帮你看本轮任务。',
          body: `${detail.displayName} 当前最强成长线是${growth.label}。进入挖矿后先抽任务、看奖励和属性，再确认上链。`,
          tone: 'growth',
        },
        {
          id: cardId('proposal-mine'),
          type: 'proposal',
          label: '动作提案',
          title: '开始任务挖矿',
          body: '先看本轮任务，再决定是否执行。',
          details: [
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '成长线', value: growth.label, tone: 'growth' },
            { label: '已完成任务', value: `${detail.taskTotal}` },
            { label: '结果', value: '奖励 + 属性' },
          ],
          actions: [{ label: '打开挖矿卡', intent: 'mining' }],
        },
      );
      break;
    case 'arena':
      cards.push(
        {
          id: cardId('reply-arena'),
          type: 'message',
          role: 'nfa',
          label: '竞技准备',
          title: '先选模式，再进对局。',
          body:
            world?.battleRoyale?.matchId
              ? `大逃杀 #${world.battleRoyale.matchId} 当前在场。你可以先看房间，再决定是否入场。`
              : 'PK 和大逃杀都在竞技入口里。先看对局列表，点进弹窗再下注或加入。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-arena'),
          type: 'proposal',
          label: '动作提案',
          title: '进入竞技',
          body: '查看 PK 对手、大逃杀房间和历史战绩。',
          details: [
            { label: '战绩', value: `${detail.pkWins}胜 / ${detail.pkLosses}败`, tone: detail.pkWins >= detail.pkLosses ? 'growth' : 'cool' },
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '大逃杀', value: world?.battleRoyale?.matchId ? `#${world.battleRoyale.matchId}` : '暂无摘要' },
            { label: '结果', value: '胜败 / 奖励' },
          ],
          actions: [{ label: '打开竞技卡', intent: 'arena' }],
        },
      );
      break;
    case 'auto':
      cards.push(
        {
          id: cardId('reply-auto'),
          type: 'message',
          role: 'nfa',
          label: '代理准备',
          title: autonomy?.enabled ? '代理已经开着。' : '可以设置自动代理。',
          body: autonomy?.enabled
            ? '后端会定时巡检。你只需要看预算、保底和最近结果。'
            : '先选策略、每日次数、单次上限和最低保底。开通后由后端定时巡检，不需要一直在线。',
          tone: 'cool',
        },
        {
          id: cardId('proposal-auto'),
          type: 'proposal',
          label: '动作提案',
          title: '设置代理',
          body: '让龙虾在预算内自动做任务、PK 或大逃杀。',
          details: [
            { label: '状态', value: autonomy?.enabled ? (autonomy.paused ? '已暂停' : '运行中') : '未开通', tone: autonomy?.enabled ? 'growth' : 'cool' },
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '最近结果', value: autonomy?.recentActions[0]?.summary || '暂无' },
            { label: '结果', value: '动作记录 + 推理摘要' },
          ],
          actions: [{ label: '打开代理卡', intent: 'auto' }],
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
          title: '可以铸造新的 NFA。',
          body: '铸造成功后，新 NFA 会出现在左侧切换栏里。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-mint'),
          type: 'proposal',
          label: '动作提案',
          title: '进入铸造',
          body: '支付、等待揭示，然后接入终端。',
          details: [
            { label: '结果', value: '获得新 NFA' },
            { label: '入口', value: '铸造页' },
          ],
          actions: [{ label: '打开铸造卡', intent: 'mint' }],
        },
      );
      break;
    case 'memory':
      cards.push({
        id: cardId('reply-memory'),
        type: 'message',
        role: 'nfa',
        label: '记忆',
        title: '我先读当前可见记忆。',
        body: memorySummary?.identity || detail.memorySummary || '当前还没有足够的本地记忆摘要。',
        tone: 'cool',
        meta: memorySummary ? `pulse ${memorySummary.pulse.toFixed(2)}` : undefined,
      });
      break;
    case 'status':
      cards.push({
        id: cardId('reply-status'),
        type: 'message',
        role: 'system',
        label: '状态',
        title: `${detail.displayName} 当前状态`,
        body: `储备 ${formatLedger(detail.ledgerBalanceCLW)}，日维护 ${formatLedger(detail.upkeepDailyCLW)}，状态：${detail.statusLabel}。`,
        tone: 'warm',
      });
      break;
    default:
      cards.push({
        id: cardId('reply-unknown'),
        type: 'message',
        role: 'nfa',
        label: '闲聊',
        title: `${detail.displayName} 在听。`,
        body: `收到：“${input}”。你可以继续聊，也可以直接说：去挖矿、打 PK、看大逃杀、开代理、铸造，或者问我当前状态。`,
        tone: 'warm',
      });
      break;
  }

  return cards;
}

export function buildEventCards(snapshot: TerminalChatSnapshot): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const { detail, world } = snapshot;

  if (world?.battleRoyale?.status === 'pending_reveal' && world.battleRoyale.matchId) {
    cards.push({
      id: `event-reveal-${world.battleRoyale.matchId}`,
      type: 'message',
      role: 'nfa',
      label: '大逃杀提醒',
      title: `#${world.battleRoyale.matchId} 已满员，等待揭示`,
      body: '揭示窗口到达后，任何人都可以触发结算。',
      tone: 'alert',
      meta: `当前 NFA：${detail.displayName}`,
    });
  }

  if (detail.upkeepDays !== null && detail.upkeepDays <= 2) {
    cards.push({
      id: `event-upkeep-${detail.tokenId}`,
      type: 'message',
      role: 'nfa',
      label: '维护提醒',
      title: '储备快见底了',
      body: '先补储备，我才能继续挖矿、PK 和大逃杀。',
      tone: 'alert',
      meta: `续航 ${detail.upkeepDays} 天`,
    });
  }

  return cards;
}
