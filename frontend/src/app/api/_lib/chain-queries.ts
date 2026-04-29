import { getAddress, isAddress, type Address } from 'viem';

import type { AutonomyStatusPayload } from '@/app/api/_lib/autonomy';
import { ensureConfigured, publicClient } from '@/app/api/_lib/chain';
import type { TerminalChatSnapshot } from '@/app/api/_lib/terminal-chat';
import { BattleRoyaleABI } from '@/contracts/abis/BattleRoyale';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { PersonalityEngineABI } from '@/contracts/abis/PersonalityEngine';
import { PKSkillABI } from '@/contracts/abis/PKSkill';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import type { TerminalCard, TerminalDetailRow, TerminalProposalAction, TerminalTone } from '@/lib/terminal-cards';

type ChainLang = 'zh' | 'en';

const TRAITS_ZH = ['勇气', '智慧', '社交', '创造', '韧性'] as const;
const TRAITS_EN = ['Courage', 'Wisdom', 'Social', 'Create', 'Grit'] as const;
const TRAITS = TRAITS_ZH;
const MONTHLY_TRAIT_CAP = 10;
const BR_STATUS_LABELS_ZH = ['开放中', '待揭示', '已结算'] as const;
const BR_STATUS_LABELS_EN = ['Open', 'Pending reveal', 'Settled'] as const;

type ChainQueryKind =
  | 'monthly_growth'
  | 'earnings'
  | 'traits'
  | 'balance'
  | 'tasks'
  | 'pk'
  | 'battle_royale'
  | 'autonomy'
  | 'world';

type ChainQueryInput = {
  input: string;
  slashCommand?: string;
  owner?: string | null;
  lang?: 'zh' | 'en';
  snapshot: TerminalChatSnapshot;
};

function cardId(kind: string) {
  return `chain-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeText(input: string, slashCommand?: string) {
  return `${slashCommand ?? ''} ${input}`.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAny(source: string, words: string[]) {
  return words.some((word) => source.includes(word));
}

function hasQuestionSignal(source: string) {
  return /多少|几|查|查询|看一下|看看|当前|现在|本月|这个月|有没有|是不是|是否|为什么|原因|怎么|如何|规则|上限|限制|可不可以领|能领|还能|剩多少|统计|记录|战绩|余额|状态|\?|？|why|how|what|current|now|month|limit|cap|balance|status|record|stats|claim|reward|earn/.test(source);
}

function inferChainQueryKind(input: string, slashCommand?: string): ChainQueryKind | null {
  const source = normalizeText(input, slashCommand);
  if (!source) return null;

  if (source.startsWith('/query') || source.startsWith('/查')) return 'traits';

  const actionOnly = /^(去|打开|开始|执行|参加|加入|开|铸造|充值|提现|挖矿|竞技|代理|市场|go|open|start|execute|join|mint|deposit|withdraw|mine|arena|auto|market)\b/.test(source);
  if (actionOnly && !hasQuestionSignal(source)) return null;

  if (
    hasAny(source, ['本月', '这个月', '月上限', '月度', '每月', 'this month', 'monthly', 'month', 'cap', 'limit']) &&
    hasAny(source, ['加点', '增加', '涨', '成长', '属性', '五围', '勇气', '智慧', '社交', '创造', '韧性', '有限', '限制', '上限', '封顶', 'trait', 'traits', 'growth', 'gain', 'increase', 'courage', 'wisdom', 'social', 'create', 'grit'])
  ) {
    return 'monthly_growth';
  }

  if (
    hasAny(source, ['赚', '收入', '收益', '获得', '拿了', '领了', '奖励', 'earn', 'earned', 'income', 'profit', 'reward', 'rewards']) &&
    hasAny(source, ['代币', 'claworld', '币', '本月', '这个月', '多少', '几', 'token', 'tokens', 'coin', 'month'])
  ) {
    return 'earnings';
  }

  if (hasAny(source, ['五围', '性格', '属性', '勇气', '智慧', '社交', '创造', '韧性', 'trait', 'traits', 'stats', 'courage', 'wisdom', 'social', 'create', 'grit']) && hasQuestionSignal(source)) {
    return 'traits';
  }

  if (hasAny(source, ['余额', '储备', '账本', '钱包', 'claworld', '代币', '维护', '续航', 'balance', 'reserve', 'ledger', 'wallet', 'upkeep', 'runway', 'token']) && hasQuestionSignal(source)) {
    return 'balance';
  }

  if (hasAny(source, ['任务', '挖矿', '冷却', '任务数', '任务属性', 'task', 'tasks', 'mine', 'mining', 'cooldown']) && hasQuestionSignal(source)) {
    return 'tasks';
  }

  if (hasAny(source, ['pk', '胜败', '胜率', '战绩', '赢了', '输了', 'win', 'loss', 'record', 'arena']) && hasQuestionSignal(source)) {
    return 'pk';
  }

  if (hasAny(source, ['大逃杀', 'battle', 'battle royale', '房间', '奖池', '揭示', '淘汰', '领奖', '领取奖励', 'room', 'pot', 'reveal', 'eliminated', 'claim']) && hasQuestionSignal(source)) {
    return 'battle_royale';
  }

  if (hasAny(source, ['代理', '自治', '自动', '最近做了什么', '做过什么', 'auto', 'autonomy', 'proxy', 'recent action']) && hasQuestionSignal(source)) {
    return 'autonomy';
  }

  if (hasAny(source, ['世界', '倍率', '事件', '全局', 'world', 'multiplier', 'event', 'global']) && hasQuestionSignal(source)) {
    return 'world';
  }

  return null;
}

function fmtWei(value: bigint | string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '--';
  try {
    return `${formatCLW(typeof value === 'bigint' ? value : BigInt(value))} Claworld`;
  } catch {
    return '--';
  }
}

function fmtSigned(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function pick<T>(lang: ChainLang, zh: T, en: T) {
  return lang === 'en' ? en : zh;
}

function traitName(index: number, lang: ChainLang) {
  const labels = lang === 'en' ? TRAITS_EN : TRAITS_ZH;
  return labels[index] ?? labels[0];
}

function locale(lang: ChainLang) {
  return lang === 'en' ? 'en-US' : 'zh-CN';
}

function shortAddress(value: string | null | undefined) {
  if (!value) return '--';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function traitRows(values: readonly number[], lang: ChainLang): TerminalDetailRow[] {
  return TRAITS.map((_, index) => ({
    label: traitName(index, lang),
    value: String(values[index] ?? 0),
    tone: index === 0 ? 'warm' : index === 4 ? 'growth' : 'cool',
  }));
}

function messageCard(lang: ChainLang, body: string, tone: TerminalTone = 'cool'): TerminalCard {
  return {
    id: cardId('message'),
    type: 'message',
    role: 'nfa',
    label: pick(lang, '回复', 'Reply'),
    title: '',
    body,
    tone,
  };
}

function receiptCard(
  lang: ChainLang,
  kind: string,
  title: string,
  body: string,
  details: TerminalDetailRow[],
  cta?: TerminalProposalAction,
): TerminalCard {
  return {
    id: cardId(kind),
    type: 'receipt',
    label: pick(lang, '链上查询', 'Chain query'),
    title,
    body,
    details,
    cta,
  };
}

function parseTaskStats(raw: unknown) {
  const value = raw as readonly unknown[] | Record<string, unknown>;
  return {
    total: Number((value as any)?.total ?? (value as any)?.[0] ?? 0),
    earned: BigInt((value as any)?.clwEarned ?? (value as any)?.[1] ?? 0),
    counts: [
      Number((value as any)?.courage ?? (value as any)?.[2] ?? 0),
      Number((value as any)?.wisdom ?? (value as any)?.[3] ?? 0),
      Number((value as any)?.social ?? (value as any)?.[4] ?? 0),
      Number((value as any)?.create ?? (value as any)?.[5] ?? 0),
      Number((value as any)?.grit ?? (value as any)?.[6] ?? 0),
    ],
  };
}

function parsePkStats(raw: unknown) {
  const value = raw as readonly unknown[] | Record<string, unknown>;
  return {
    wins: Number((value as any)?.wins ?? (value as any)?.[0] ?? 0),
    losses: Number((value as any)?.losses ?? (value as any)?.[1] ?? 0),
    won: BigInt((value as any)?.clwWon ?? (value as any)?.[2] ?? 0),
    lost: BigInt((value as any)?.clwLost ?? (value as any)?.[3] ?? 0),
  };
}

async function readMonthlyGrowth(tokenId: bigint) {
  ensureConfigured(['personalityEngine']);
  const values = await Promise.all(
    TRAITS.map((_, index) =>
      publicClient
        .readContract({
          address: addresses.personalityEngine,
          abi: PersonalityEngineABI,
          functionName: 'personalityChangesThisMonth',
          args: [tokenId, index],
        })
        .catch(() =>
          publicClient.readContract({
            address: addresses.clawRouter,
            abi: ClawRouterABI,
            functionName: 'personalityChangesThisMonth',
            args: [tokenId, index],
          }),
        ),
    ),
  );

  const monthStart = await publicClient
    .readContract({
      address: addresses.personalityEngine,
      abi: PersonalityEngineABI,
      functionName: 'personalityMonthStart',
      args: [tokenId],
    })
    .catch(() =>
      publicClient.readContract({
        address: addresses.clawRouter,
        abi: ClawRouterABI,
        functionName: 'personalityMonthStart',
        args: [tokenId],
      }),
    );

  return {
    values: values.map((value) => Number(value)),
    monthStart: BigInt(monthStart as bigint),
  };
}

async function buildMonthlyGrowthCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  const tokenId = BigInt(snapshot.detail.tokenId);
  const { values, monthStart } = await readMonthlyGrowth(tokenId);
  const usedPositive = values.map((value) => Math.max(0, value));
  const mainIndex = usedPositive.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);
  const details: TerminalDetailRow[] = TRAITS.map((_, index) => {
    const used = usedPositive[index] ?? 0;
    const remaining = Math.max(0, MONTHLY_TRAIT_CAP - used);
    return {
      label: traitName(index, lang),
      value: pick(lang, `${fmtSigned(values[index] ?? 0)} / ${MONTHLY_TRAIT_CAP}，剩 ${remaining}`, `${fmtSigned(values[index] ?? 0)} / ${MONTHLY_TRAIT_CAP}, ${remaining} left`),
      tone: used > 0 ? 'growth' : 'cool',
    };
  });

  if (monthStart > 0n) {
    details.push({ label: pick(lang, '月初记录', 'Month start'), value: new Date(Number(monthStart) * 1000).toLocaleDateString(locale(lang)) });
  }

  const changed = values.filter((value) => value !== 0);
  const body = changed.length
    ? pick(lang, `本月${traitName(mainIndex, lang)}涨得最多：${fmtSigned(values[mainIndex] ?? 0)}。`, `${traitName(mainIndex, lang)} gained the most this month: ${fmtSigned(values[mainIndex] ?? 0)}.`)
    : pick(lang, '这个月五围还没有产生加点。', 'No trait growth has been recorded this month yet.');

  return [
    messageCard(lang, body, changed.length ? 'growth' : 'cool'),
    receiptCard(lang, 'monthly-growth', pick(lang, '本月五围加点', 'Monthly trait growth'), pick(lang, '每项本月上限 10 点。', 'Each trait can gain up to 10 points this month.'), details),
  ];
}

function buildTraitCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  const values = snapshot.detail.personalityVector ?? [];
  const topIndex = values.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);
  const dna = snapshot.detail.dnaTraits;
  return [
    messageCard(lang, pick(lang, `现在主属性是${traitName(topIndex, lang)}，五围和 PK 基因我直接列出来。`, `The strongest trait is ${traitName(topIndex, lang)}. I listed traits and PK genes below.`), 'cool'),
    receiptCard(lang, 'traits', pick(lang, '当前属性', 'Current stats'), `Lv.${snapshot.detail.level} · ${snapshot.detail.shelter}`, [
      ...traitRows(values, lang),
      { label: 'STR', value: String(dna.str), tone: 'warm' },
      { label: 'DEF', value: String(dna.def), tone: 'cool' },
      { label: 'SPD', value: String(dna.spd), tone: 'growth' },
      { label: 'VIT', value: String(dna.vit), tone: 'alert' },
    ]),
  ];
}

async function buildBalanceCards(snapshot: TerminalChatSnapshot, rawOwner: string | null | undefined, lang: ChainLang) {
  ensureConfigured(['clwToken', 'clawRouter']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const owner = rawOwner && isAddress(rawOwner) ? getAddress(rawOwner) : snapshot.detail.currentOwner && isAddress(snapshot.detail.currentOwner) ? getAddress(snapshot.detail.currentOwner) : null;
  const [ledger, dailyCost, walletBalance] = await Promise.all([
    publicClient.readContract({ address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'clwBalances', args: [tokenId] }) as Promise<bigint>,
    publicClient.readContract({ address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'getDailyCost', args: [tokenId] }) as Promise<bigint>,
    owner
      ? (publicClient.readContract({ address: addresses.clwToken, abi: ERC20ABI, functionName: 'balanceOf', args: [owner] }) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);
  const days = dailyCost > 0n ? Number(ledger / dailyCost) : null;
  return [
    messageCard(lang, pick(lang, `NFA 账本 ${fmtWei(ledger)}，${days === null ? '续航暂时算不出来' : `大约还能撑 ${days} 天`}。`, `NFA ledger has ${fmtWei(ledger)}. ${days === null ? 'Runway is not available yet.' : `Runway is about ${days} day(s).`}`), 'cool'),
    receiptCard(lang, 'balance', pick(lang, '资金状态', 'Funds'), pick(lang, '钱包余额和 NFA 账本分开看。', 'Wallet balance and NFA ledger reserve are tracked separately.'), [
      { label: pick(lang, '钱包 Claworld', 'Wallet Claworld'), value: owner ? fmtWei(walletBalance) : pick(lang, '未识别钱包', 'Wallet unknown'), tone: 'growth' },
      { label: pick(lang, 'NFA 账本', 'NFA ledger'), value: fmtWei(ledger), tone: 'warm' },
      { label: pick(lang, '日维护', 'Daily upkeep'), value: fmtWei(dailyCost) },
      { label: pick(lang, '续航', 'Runway'), value: days === null ? '--' : pick(lang, `${days} 天`, `${days} day(s)`), tone: days !== null && days <= 3 ? 'alert' : 'growth' },
      { label: pick(lang, '钱包', 'Wallet'), value: owner ? shortAddress(owner) : '--' },
    ], { label: pick(lang, '打开资金', 'Open funds'), intent: 'finance' }),
  ];
}

async function buildTaskCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  ensureConfigured(['taskSkill']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const [statsRaw, lastTaskTime] = await Promise.all([
    publicClient.readContract({ address: addresses.taskSkill, abi: TaskSkillABI, functionName: 'getTaskStats', args: [tokenId] }),
    publicClient.readContract({ address: addresses.taskSkill, abi: TaskSkillABI, functionName: 'lastTaskTime', args: [tokenId] }) as Promise<bigint>,
  ]);
  const stats = parseTaskStats(statsRaw);
  const readyAt = lastTaskTime > 0n ? Number(lastTaskTime + 4n * 60n * 60n) : 0;
  const now = Math.floor(Date.now() / 1000);
  const cooldownMinutes = Math.ceil((readyAt - now) / 60);
  const cooldown = readyAt > now ? pick(lang, `${cooldownMinutes} 分钟`, `${cooldownMinutes} min`) : pick(lang, '可开始', 'Ready');
  return [
    messageCard(lang, pick(lang, `已完成 ${stats.total} 次任务，累计 ${fmtWei(stats.earned)}。`, `${stats.total} task(s) completed, ${fmtWei(stats.earned)} earned in total.`), 'growth'),
    receiptCard(lang, 'tasks', pick(lang, '任务统计', 'Task stats'), pick(lang, '五类任务分布来自链上统计。', 'Task type distribution comes from on-chain stats.'), [
      { label: pick(lang, '总任务', 'Total tasks'), value: pick(lang, `${stats.total} 次`, `${stats.total}`), tone: 'growth' },
      { label: pick(lang, '累计收益', 'Total earned'), value: fmtWei(stats.earned), tone: 'warm' },
      { label: pick(lang, '冷却', 'Cooldown'), value: cooldown, tone: readyAt > now ? 'alert' : 'growth' },
      ...TRAITS.map((_, index) => ({ label: traitName(index, lang), value: pick(lang, `${stats.counts[index] ?? 0} 次`, `${stats.counts[index] ?? 0}`), tone: (stats.counts[index] ?? 0) > 0 ? 'cool' : undefined } satisfies TerminalDetailRow)),
    ], { label: pick(lang, '打开挖矿', 'Open mining'), intent: 'mining' }),
  ];
}

async function buildPkCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  ensureConfigured(['pkSkill']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const stats = parsePkStats(
    await publicClient.readContract({ address: addresses.pkSkill, abi: PKSkillABI, functionName: 'getPkStats', args: [tokenId] }),
  );
  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
  return [
    messageCard(lang, total > 0 ? pick(lang, `PK 战绩 ${stats.wins}胜/${stats.losses}败，胜率 ${winRate}%。`, `PK record: ${stats.wins}W / ${stats.losses}L, ${winRate}% win rate.`) : pick(lang, '这只还没有 PK 结算记录。', 'This NFA has no settled PK record yet.'), 'warm'),
    receiptCard(lang, 'pk', pick(lang, 'PK 战绩', 'PK record'), pick(lang, '胜败和收益来自 PKSkill 链上统计。', 'Wins, losses, and rewards come from PKSkill on-chain stats.'), [
      { label: pick(lang, '胜', 'Wins'), value: String(stats.wins), tone: 'growth' },
      { label: pick(lang, '败', 'Losses'), value: String(stats.losses), tone: stats.losses > 0 ? 'alert' : 'cool' },
      { label: pick(lang, '胜率', 'Win rate'), value: `${winRate}%`, tone: winRate >= 50 ? 'growth' : 'cool' },
      { label: pick(lang, '累计赢得', 'Total won'), value: fmtWei(stats.won), tone: 'warm' },
      { label: pick(lang, '累计投入/损失', 'Total staked/lost'), value: fmtWei(stats.lost) },
    ], { label: pick(lang, '打开竞技', 'Open arena'), intent: 'arena' }),
  ];
}

function brStatusLabel(status: number | string | null | undefined, lang: ChainLang) {
  if (typeof status === 'string') {
    if (status === 'open') return pick(lang, '开放中', 'Open');
    if (status === 'pending_reveal') return pick(lang, '待揭示', 'Pending reveal');
    if (status === 'settled') return pick(lang, '已结算', 'Settled');
    return pick(lang, '未知', 'Unknown');
  }
  const labels = lang === 'en' ? BR_STATUS_LABELS_EN : BR_STATUS_LABELS_ZH;
  return labels[Number(status)] ?? pick(lang, '未知', 'Unknown');
}

async function readCurrentBattleRoyaleId() {
  const [latestOpen, matchCount] = await Promise.all([
    publicClient.readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'latestOpenMatch' }) as Promise<bigint>,
    publicClient.readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'matchCount' }) as Promise<bigint>,
  ]);
  return latestOpen > 0n ? latestOpen : matchCount;
}

async function readBattleRoyaleClaimables(matchCount: bigint, tokenId: bigint, owner?: string | null) {
  const participant = (await publicClient
    .readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'participantForNfa', args: [tokenId] })
    .catch(() => null)) as Address | null;
  const ownerAddress = owner && isAddress(owner) ? getAddress(owner) : null;
  const candidates = [participant, ownerAddress].filter((value): value is Address => Boolean(value));
  const start = matchCount > 8n ? matchCount - 7n : 1n;
  let total = 0n;
  let bestMatch = 0n;

  for (let matchId = start; matchId <= matchCount; matchId++) {
    const values = await Promise.all(
      candidates.map((candidate) =>
        publicClient
          .readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'getClaimable', args: [matchId, candidate] })
          .catch(() => 0n),
      ),
    );
    const amount = values.reduce((sum, value) => sum + BigInt(value as bigint), 0n);
    if (amount > 0n) {
      total += amount;
      bestMatch = matchId;
    }
  }

  return { total, bestMatch, participant };
}

async function buildBattleRoyaleCards(snapshot: TerminalChatSnapshot, owner: string | null | undefined, lang: ChainLang) {
  ensureConfigured(['battleRoyale']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const currentMatchId = await readCurrentBattleRoyaleId();
  if (currentMatchId <= 0n) {
    return [messageCard(lang, pick(lang, '现在还没有大逃杀对局。', 'There is no Battle Royale match right now.'), 'cool')];
  }

  const [matchInfo, matchConfig, snapshotRaw, settlement, claimables] = await Promise.all([
    publicClient.readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'getMatchInfo', args: [currentMatchId] }) as Promise<readonly [number, number, bigint, number, bigint, bigint]>,
    publicClient.readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'getMatchConfig', args: [currentMatchId] }) as Promise<readonly [bigint, number, bigint, number]>,
    publicClient.readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'getMatchSnapshot', args: [currentMatchId] }) as Promise<readonly [readonly bigint[], readonly bigint[]]>,
    publicClient
      .readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'getMatchSettlement', args: [currentMatchId] })
      .catch(() => null) as Promise<readonly [bigint, bigint, bigint, bigint, bigint, boolean] | null>,
    readBattleRoyaleClaimables(currentMatchId, tokenId, owner),
  ]);

  const status = Number(matchInfo[0]);
  const playerCounts = Array.from(snapshotRaw[0] ?? []).map((value) => Number(value));
  const roomTotals = Array.from(snapshotRaw[1] ?? []).map((value) => BigInt(value));
  const filledRooms = playerCounts
    .map((count, index) => (count > 0 ? pick(lang, `${index + 1}房 ${count}人`, `Room ${index + 1}: ${count}`) : null))
    .filter(Boolean)
    .join(' / ') || pick(lang, '暂无', 'None');
  const body = pick(
    lang,
    `大逃杀 #${currentMatchId.toString()}：${brStatusLabel(status, lang)}，${Number(matchInfo[1])}/${Number(matchConfig[1])} 人。`,
    `Battle Royale #${currentMatchId.toString()}: ${brStatusLabel(status, lang)}, ${Number(matchInfo[1])}/${Number(matchConfig[1])} players.`,
  );
  const details: TerminalDetailRow[] = [
    { label: pick(lang, '当前局', 'Match'), value: `#${currentMatchId.toString()}`, tone: 'warm' },
    { label: pick(lang, '状态', 'Status'), value: brStatusLabel(status, lang), tone: status === 1 ? 'alert' : status === 2 ? 'growth' : 'cool' },
    { label: pick(lang, '人数', 'Players'), value: `${Number(matchInfo[1])}/${Number(matchConfig[1])}` },
    { label: pick(lang, '奖池', 'Pot'), value: fmtWei(BigInt(matchInfo[4])), tone: 'warm' },
    { label: pick(lang, '最低质押', 'Min stake'), value: fmtWei(BigInt(matchConfig[0])) },
    { label: pick(lang, '房间', 'Rooms'), value: filledRooms },
    { label: pick(lang, '可领取', 'Claimable'), value: claimables.total > 0n ? `${fmtWei(claimables.total)}${claimables.bestMatch > 0n ? ` · #${claimables.bestMatch}` : ''}` : pick(lang, '暂无', 'None'), tone: claimables.total > 0n ? 'growth' : 'cool' },
  ];

  if (status >= 2) {
    details.push({ label: pick(lang, '淘汰房', 'Eliminated room'), value: Number(matchInfo[3]) > 0 ? pick(lang, `${Number(matchInfo[3])}号房`, `Room ${Number(matchInfo[3])}`) : '--', tone: 'alert' });
  }
  if (settlement) {
    details.push({ label: pick(lang, '10%销毁/金库', '10% burn/treasury'), value: fmtWei(BigInt(settlement[2])), tone: 'alert' });
    details.push({ label: pick(lang, '幸存奖励池', 'Survivor pool'), value: fmtWei(BigInt(settlement[3])), tone: 'growth' });
  }

  return [
    messageCard(lang, body, status === 1 ? 'alert' : 'warm'),
    receiptCard(lang, 'battle-royale', pick(lang, '大逃杀查询', 'Battle Royale query'), pick(lang, '房间、奖池、奖励都来自链上。', 'Rooms, pot, and rewards are read from chain.'), details, { label: pick(lang, '打开竞技', 'Open arena'), intent: 'arena' }),
  ];
}

async function buildEarningsCards(snapshot: TerminalChatSnapshot, owner: string | null | undefined, lang: ChainLang) {
  ensureConfigured(['clawRouter']);
  const tokenId = BigInt(snapshot.detail.tokenId);

  const [ledger, taskStatsRaw, pkStatsRaw, matchCount] = await Promise.all([
    publicClient
      .readContract({ address: addresses.clawRouter, abi: ClawRouterABI, functionName: 'clwBalances', args: [tokenId] })
      .catch(() => null) as Promise<bigint | null>,
    publicClient
      .readContract({ address: addresses.taskSkill, abi: TaskSkillABI, functionName: 'getTaskStats', args: [tokenId] })
      .catch(() => null),
    publicClient
      .readContract({ address: addresses.pkSkill, abi: PKSkillABI, functionName: 'getPkStats', args: [tokenId] })
      .catch(() => null),
    addresses.battleRoyale
      ? (publicClient
          .readContract({ address: addresses.battleRoyale, abi: BattleRoyaleABI, functionName: 'matchCount' })
          .catch(() => 0n) as Promise<bigint>)
      : Promise.resolve(0n),
  ]);

  const taskStats = taskStatsRaw ? parseTaskStats(taskStatsRaw) : null;
  const pkStats = pkStatsRaw ? parsePkStats(pkStatsRaw) : null;
  const battleClaim =
    matchCount > 0n ? await readBattleRoyaleClaimables(matchCount, tokenId, owner).catch(() => null) : null;
  const knownIncome = (taskStats?.earned ?? 0n) + (pkStats?.won ?? 0n) + (battleClaim?.total ?? 0n);

  return [
    messageCard(lang, pick(lang, '这是查询，不会打开动作卡。链上现在没有“本月代币收益”的直接字段；我先把能准确读到的收益列出来。', 'This is a query, so I will not open an action card. Chain does not expose exact monthly token earnings yet; I listed the reliable totals I can read.'), 'cool'),
    receiptCard(lang, 'earnings', pick(lang, '收益查询', 'Earnings query'), pick(lang, '月度收益需要后端索引事件后才能精确拆月。', 'Exact monthly earnings need backend event indexing.'), [
      { label: pick(lang, '任务累计收益', 'Task earned'), value: taskStats ? fmtWei(taskStats.earned) : '--', tone: 'growth' },
      { label: pick(lang, 'PK 累计赢得', 'PK won'), value: pkStats ? fmtWei(pkStats.won) : '--', tone: 'warm' },
      { label: pick(lang, 'PK 累计投入/损失', 'PK staked/lost'), value: pkStats ? fmtWei(pkStats.lost) : '--' },
      { label: pick(lang, '大逃杀可领取', 'BR claimable'), value: battleClaim ? fmtWei(battleClaim.total) : '--', tone: battleClaim && battleClaim.total > 0n ? 'growth' : 'cool' },
      { label: pick(lang, '当前 NFA 账本', 'Current NFA ledger'), value: ledger === null ? '--' : fmtWei(ledger), tone: 'warm' },
      { label: pick(lang, '可确定合计', 'Known total'), value: fmtWei(knownIncome), tone: 'growth' },
    ], { label: pick(lang, '打开资金', 'Open funds'), intent: 'finance' }),
  ];
}

function buildAutonomyCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  const autonomy: AutonomyStatusPayload | null = snapshot.autonomy;
  const recent = autonomy?.recentActions?.[0] ?? null;
  const enabled = Boolean(autonomy?.enabled);
  return [
    messageCard(lang, recent ? pick(lang, `最近一次代理：${recent.summary}`, `Latest autonomy action: ${recent.summary}`) : enabled ? pick(lang, '代理开着，但最近还没有新动作。', 'Autonomy is on, but there is no recent action yet.') : pick(lang, '代理现在没开。', 'Autonomy is off right now.'), enabled ? 'cool' : 'warm'),
    receiptCard(lang, 'autonomy', pick(lang, '代理状态', 'Autonomy status'), pick(lang, '只展示用户主动查询的代理信息。', 'Autonomy info is shown only after the user asks for it.'), [
      { label: pick(lang, '状态', 'Status'), value: enabled ? (autonomy?.paused ? pick(lang, '暂停', 'Paused') : pick(lang, '运行', 'Running')) : pick(lang, '未开', 'Off'), tone: enabled ? 'growth' : 'cool' },
      { label: pick(lang, '预算', 'Budget'), value: autonomy ? `${fmtWei(autonomy.budget.usedCLW)} / ${fmtWei(autonomy.budget.totalCLW)}` : '--' },
      { label: pick(lang, '最近动作', 'Latest action'), value: recent?.summary ?? pick(lang, '暂无', 'None') },
      { label: pick(lang, '推理证明', 'Reasoning proof'), value: recent?.reasoningCid ?? pick(lang, '暂无', 'None') },
    ], { label: pick(lang, '打开代理', 'Open autonomy'), intent: 'auto' }),
  ];
}

function buildWorldCards(snapshot: TerminalChatSnapshot, lang: ChainLang) {
  const world = snapshot.world;
  if (!world) return null;
  return [
    messageCard(lang, pick(lang, `世界倍率 ${world.rewardMultiplier}，PK 上限 ${fmtWei(world.pkStakeLimitCLW)}。`, `World multiplier is ${world.rewardMultiplier}; PK cap is ${fmtWei(world.pkStakeLimitCLW)}.`), 'cool'),
    receiptCard(lang, 'world', pick(lang, '世界状态', 'World state'), pick(lang, '当前世界参数来自 WorldState。', 'Current world parameters come from WorldState.'), [
      { label: pick(lang, '奖励倍率', 'Reward multiplier'), value: world.rewardMultiplier, tone: 'warm' },
      { label: pick(lang, 'PK 上限', 'PK cap'), value: fmtWei(world.pkStakeLimitCLW) },
      { label: pick(lang, '变异加成', 'Mutation bonus'), value: world.mutationBonus },
      { label: pick(lang, '维护倍率', 'Upkeep multiplier'), value: world.dailyCostMultiplier },
      { label: pick(lang, '事件', 'Events'), value: world.activeEvents.map((event) => event.label).join(' / ') || pick(lang, '暂无', 'None') },
    ]),
  ];
}

export async function buildChainQueryCards(input: ChainQueryInput): Promise<TerminalCard[] | null> {
  const lang = input.lang === 'en' ? 'en' : 'zh';
  const kind = inferChainQueryKind(input.input, input.slashCommand);
  if (!kind) return null;

  try {
    if (kind === 'monthly_growth') return await buildMonthlyGrowthCards(input.snapshot, lang);
    if (kind === 'earnings') return await buildEarningsCards(input.snapshot, input.owner, lang);
    if (kind === 'traits') return buildTraitCards(input.snapshot, lang);
    if (kind === 'balance') return await buildBalanceCards(input.snapshot, input.owner, lang);
    if (kind === 'tasks') return await buildTaskCards(input.snapshot, lang);
    if (kind === 'pk') return await buildPkCards(input.snapshot, lang);
    if (kind === 'battle_royale') return await buildBattleRoyaleCards(input.snapshot, input.owner, lang);
    if (kind === 'autonomy') return buildAutonomyCards(input.snapshot, lang);
    if (kind === 'world') return buildWorldCards(input.snapshot, lang);
  } catch (error) {
    console.warn('[terminal-chat] chain query failed:', error);
    return [
      messageCard(lang, pick(lang, '这次链上查询没读出来，可能是 RPC 暂时慢了。你可以再发一次。', 'This chain query did not come back. RPC may be slow; try once more.'), 'alert'),
      receiptCard(lang, 'query-error', pick(lang, '链上查询失败', 'Chain query failed'), error instanceof Error ? error.message.slice(0, 160) : pick(lang, '未知错误', 'Unknown error'), [
        { label: pick(lang, '查询', 'Query'), value: kind },
        { label: pick(lang, '结果', 'Result'), value: pick(lang, '失败', 'Failed'), tone: 'alert' },
      ]),
    ];
  }

  return null;
}
