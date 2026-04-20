import type { TerminalNFADetail } from '@/app/api/_lib/nfas';
import type { MemorySnapshotPayload, MemorySummaryPayload } from '@/app/api/_lib/memory';
import type { AutonomyStatusPayload } from '@/app/api/_lib/autonomy';
import type { WorldSummaryPayload } from '@/app/api/_lib/world';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

export type CommandIntent = 'mining' | 'arena' | 'auto' | 'mint' | 'memory' | 'status' | 'unknown';

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
  return /记住|记下来|写进记忆|写入记忆|长期记忆|CML|以后你|你叫|叫你|你的名字|你的性格|你的人设|说话方式|口癖|身份|人格/i.test(source);
}

export function inferTerminalIntent(input: string, slashCommand?: string): CommandIntent {
  const source = slashCommand || input;
  const normalized = source.toLowerCase();

  if (normalized.includes('mint') || normalized.includes('铸造')) return 'mint';
  if (normalized.includes('mine') || normalized.includes('挖矿') || normalized.includes('任务')) return 'mining';
  if (normalized.includes('pk') || normalized.includes('竞技') || normalized.includes('大逃杀') || normalized.includes('battle')) return 'arena';
  if (normalized.includes('directive') || normalized.includes('代理') || normalized.includes('自治') || normalized.includes('auto')) return 'auto';
  if (looksLikeMemoryWrite(source) || normalized.includes('memory') || normalized.includes('sleep')) return 'memory';
  if (normalized.includes('状态') || normalized.includes('余额') || normalized.includes('储备') || normalized.includes('upkeep')) return 'status';
  return 'unknown';
}

export function buildSeedCards(snapshot: TerminalChatSnapshot): TerminalCard[] {
  const { detail, memorySummary } = snapshot;
  const body =
    memorySummary?.identity ||
    detail.greeting ||
    detail.memorySummary ||
    `${detail.displayName} 在等你开口。你可以直接说去挖矿、看竞技、开代理，或者先聊两句。`;

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
          body: '行，先看这轮任务。别急着签，奖励和加点看清楚再动。',
          tone: 'growth',
        },
        {
          id: cardId('proposal-mine'),
          type: 'proposal',
          label: '动作卡',
          title: '任务挖矿',
          body: '抽任务、看奖励、确认后上链。',
          details: [
            { label: '储备', value: formatLedger(detail.ledgerBalanceCLW), tone: 'warm' },
            { label: '主属性', value: growth.label, tone: 'growth' },
            { label: '任务', value: `${detail.taskTotal}次` },
            { label: '结果', value: '奖励 + 属性' },
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
            ? `大逃杀 #${world.battleRoyale.matchId} 正在场上。先看房间和质押，别把币丢进看不懂的局。`
            : '可以。PK 和大逃杀分开看，点进去再决定下注。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-arena'),
          type: 'proposal',
          label: '动作卡',
          title: '竞技',
          body: '查看 PK、房间、大逃杀奖励和历史。',
          details: [
            { label: '战绩', value: `${detail.pkWins}胜/${detail.pkLosses}败`, tone: detail.pkWins >= detail.pkLosses ? 'growth' : 'cool' },
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
          body: autonomy?.enabled ? '代理开着。你改边界，我按新的口径行动。' : '可以开。先定预算、保底和动作范围。',
          tone: 'cool',
        },
        {
          id: cardId('proposal-auto'),
          type: 'proposal',
          label: '动作卡',
          title: '代理',
          body: '设置策略、预算、保底和提示词。',
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
    case 'mint':
      cards.push(
        {
          id: cardId('reply-mint'),
          type: 'message',
          role: 'system',
          label: '铸造',
          title: '',
          body: '先铸造一只。出来以后，它会直接进这个对话口。',
          tone: 'warm',
        },
        {
          id: cardId('proposal-mint'),
          type: 'proposal',
          label: '动作卡',
          title: '铸造 NFA',
          body: '付款、等待揭示、接入终端。',
          details: [
            { label: '结果', value: '新 NFA' },
            { label: '入口', value: '铸造' },
          ],
          actions: [{ label: '打开铸造', intent: 'mint' }],
        },
      );
      break;
    case 'memory': {
      const candidate = compact(input, 140);
      const isWrite = looksLikeMemoryWrite(input);
      cards.push(
        {
          id: cardId('reply-memory'),
          type: 'message',
          role: 'nfa',
          label: '回复',
          title: '',
          body: isWrite
            ? '这句我想留下。你确认，我只把记忆根写上链。'
            : (memorySummary?.identity || detail.memorySummary || '现在能读到的记忆还很浅。你可以告诉我一句想留下的话。'),
          tone: 'cool',
          meta: memorySummary ? `pulse ${memorySummary.pulse.toFixed(2)}` : undefined,
        },
      );
      if (isWrite) {
        cards.push({
          id: cardId('proposal-memory'),
          type: 'proposal',
          label: '记忆卡',
          title: '写入长期记忆',
          body: `“${candidate}”`,
          details: [
            { label: '类型', value: /名字|你叫|叫你|身份|人设|性格|口癖|说话方式/.test(input) ? '身份' : '经历', tone: 'growth' },
            { label: '方式', value: 'CML hash', tone: 'cool' },
            { label: '上链', value: '需要签名' },
          ],
          actions: [{ label: '确认记忆', intent: 'memory', memoryText: candidate }],
        });
      }
      break;
    }
    case 'status':
      cards.push({
        id: cardId('reply-status'),
        type: 'message',
        role: 'system',
        label: '状态',
        title: '',
        body: `储备 ${formatLedger(detail.ledgerBalanceCLW)}，日维护 ${formatLedger(detail.upkeepDailyCLW)}，当前：${detail.statusLabel}。`,
        tone: 'warm',
      });
      break;
    default:
      cards.push({
        id: cardId('reply-unknown'),
        type: 'message',
        role: 'nfa',
        label: '回复',
        title: '',
        body: '我听见了。直接说你想做什么：挖矿、竞技、代理、记忆。',
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
      label: '大逃杀',
      title: '',
      body: `#${world.battleRoyale.matchId} 满员了，等揭示。窗口到了以后，任何人都能触发结算。`,
      tone: 'alert',
      meta: `当前：${detail.displayName}`,
    });
  }

  if (detail.upkeepDays !== null && detail.upkeepDays <= 2) {
    cards.push({
      id: `event-upkeep-${detail.tokenId}`,
      type: 'message',
      role: 'nfa',
      label: '维护',
      title: '',
      body: '储备快见底了。先补一下，不然行动会断。',
      tone: 'alert',
      meta: `续航 ${detail.upkeepDays}天`,
    });
  }

  return cards;
}
