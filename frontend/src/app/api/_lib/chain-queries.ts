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

const TRAITS = ['勇气', '智慧', '社交', '创造', '韧性'] as const;
const MONTHLY_TRAIT_CAP = 10;
const BR_STATUS_LABELS = ['开放中', '待揭示', '已结算'] as const;

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
  return /多少|几|查|查询|看一下|看看|当前|现在|本月|这个月|有没有|是不是|是否|规则|上限|限制|可不可以领|能领|还能|剩多少|统计|记录|战绩|余额|状态/.test(source);
}

function inferChainQueryKind(input: string, slashCommand?: string): ChainQueryKind | null {
  const source = normalizeText(input, slashCommand);
  if (!source) return null;

  if (source.startsWith('/query') || source.startsWith('/查')) return 'traits';

  const actionOnly = /^(去|打开|开始|执行|参加|加入|开|铸造|充值|提现|挖矿|竞技|代理|市场)\b/.test(source);
  if (actionOnly && !hasQuestionSignal(source)) return null;

  if (
    hasAny(source, ['本月', '这个月', '月上限', '月度', '每月']) &&
    hasAny(source, ['加点', '增加', '涨', '成长', '属性', '五围', '勇气', '智慧', '社交', '创造', '韧性', '有限', '限制', '上限', '封顶'])
  ) {
    return 'monthly_growth';
  }

  if (
    hasAny(source, ['赚', '收入', '收益', '获得', '拿了', '领了', '奖励']) &&
    hasAny(source, ['代币', 'claworld', '币', '本月', '这个月', '多少', '几'])
  ) {
    return 'earnings';
  }

  if (hasAny(source, ['五围', '性格', '属性', '勇气', '智慧', '社交', '创造', '韧性']) && hasQuestionSignal(source)) {
    return 'traits';
  }

  if (hasAny(source, ['余额', '储备', '账本', '钱包', 'claworld', '代币', '维护', '续航']) && hasQuestionSignal(source)) {
    return 'balance';
  }

  if (hasAny(source, ['任务', '挖矿', '冷却', '任务数', '任务属性']) && hasQuestionSignal(source)) {
    return 'tasks';
  }

  if (hasAny(source, ['pk', '胜败', '胜率', '战绩', '赢了', '输了']) && hasQuestionSignal(source)) {
    return 'pk';
  }

  if (hasAny(source, ['大逃杀', 'battle', '房间', '奖池', '揭示', '淘汰', '领奖', '领取奖励']) && hasQuestionSignal(source)) {
    return 'battle_royale';
  }

  if (hasAny(source, ['代理', '自治', '自动', '最近做了什么', '做过什么']) && hasQuestionSignal(source)) {
    return 'autonomy';
  }

  if (hasAny(source, ['世界', '倍率', '事件', '全局']) && hasQuestionSignal(source)) {
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

function shortAddress(value: string | null | undefined) {
  if (!value) return '--';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function traitRows(values: readonly number[]): TerminalDetailRow[] {
  return TRAITS.map((label, index) => ({
    label,
    value: String(values[index] ?? 0),
    tone: index === 0 ? 'warm' : index === 4 ? 'growth' : 'cool',
  }));
}

function messageCard(body: string, tone: TerminalTone = 'cool'): TerminalCard {
  return {
    id: cardId('message'),
    type: 'message',
    role: 'nfa',
    label: '回复',
    title: '',
    body,
    tone,
  };
}

function receiptCard(
  kind: string,
  title: string,
  body: string,
  details: TerminalDetailRow[],
  cta?: TerminalProposalAction,
): TerminalCard {
  return {
    id: cardId(kind),
    type: 'receipt',
    label: '链上查询',
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

async function buildMonthlyGrowthCards(snapshot: TerminalChatSnapshot) {
  const tokenId = BigInt(snapshot.detail.tokenId);
  const { values, monthStart } = await readMonthlyGrowth(tokenId);
  const usedPositive = values.map((value) => Math.max(0, value));
  const mainIndex = usedPositive.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);
  const details: TerminalDetailRow[] = TRAITS.map((label, index) => {
    const used = usedPositive[index] ?? 0;
    const remaining = Math.max(0, MONTHLY_TRAIT_CAP - used);
    return {
      label,
      value: `${fmtSigned(values[index] ?? 0)} / ${MONTHLY_TRAIT_CAP}，剩 ${remaining}`,
      tone: used > 0 ? 'growth' : 'cool',
    };
  });

  if (monthStart > 0n) {
    details.push({ label: '月初记录', value: new Date(Number(monthStart) * 1000).toLocaleDateString('zh-CN') });
  }

  const changed = values.filter((value) => value !== 0);
  const body = changed.length
    ? `本月${TRAITS[mainIndex]}涨得最多：${fmtSigned(values[mainIndex] ?? 0)}。`
    : '这个月五围还没有产生加点。';

  return [
    messageCard(body, changed.length ? 'growth' : 'cool'),
    receiptCard('monthly-growth', '本月五围加点', '每项本月上限 10 点。', details),
  ];
}

function buildTraitCards(snapshot: TerminalChatSnapshot) {
  const values = snapshot.detail.personalityVector ?? [];
  const topIndex = values.reduce((best, current, index, rows) => (current > rows[best] ? index : best), 0);
  const dna = snapshot.detail.dnaTraits;
  return [
    messageCard(`现在主属性是${TRAITS[topIndex] ?? '勇气'}，五围和 PK 基因我直接列出来。`, 'cool'),
    receiptCard('traits', '当前属性', `Lv.${snapshot.detail.level} · ${snapshot.detail.shelter}`, [
      ...traitRows(values),
      { label: 'STR', value: String(dna.str), tone: 'warm' },
      { label: 'DEF', value: String(dna.def), tone: 'cool' },
      { label: 'SPD', value: String(dna.spd), tone: 'growth' },
      { label: 'VIT', value: String(dna.vit), tone: 'alert' },
    ]),
  ];
}

async function buildBalanceCards(snapshot: TerminalChatSnapshot, rawOwner?: string | null) {
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
    messageCard(`NFA 账本 ${fmtWei(ledger)}，${days === null ? '续航暂时算不出来' : `大约还能撑 ${days} 天`}。`, 'cool'),
    receiptCard('balance', '资金状态', '钱包余额和 NFA 账本分开看。', [
      { label: '钱包 Claworld', value: owner ? fmtWei(walletBalance) : '未识别钱包', tone: 'growth' },
      { label: 'NFA 账本', value: fmtWei(ledger), tone: 'warm' },
      { label: '日维护', value: fmtWei(dailyCost) },
      { label: '续航', value: days === null ? '--' : `${days} 天`, tone: days !== null && days <= 3 ? 'alert' : 'growth' },
      { label: '钱包', value: owner ? shortAddress(owner) : '--' },
    ], { label: '打开资金', intent: 'finance' }),
  ];
}

async function buildTaskCards(snapshot: TerminalChatSnapshot) {
  ensureConfigured(['taskSkill']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const [statsRaw, lastTaskTime] = await Promise.all([
    publicClient.readContract({ address: addresses.taskSkill, abi: TaskSkillABI, functionName: 'getTaskStats', args: [tokenId] }),
    publicClient.readContract({ address: addresses.taskSkill, abi: TaskSkillABI, functionName: 'lastTaskTime', args: [tokenId] }) as Promise<bigint>,
  ]);
  const stats = parseTaskStats(statsRaw);
  const readyAt = lastTaskTime > 0n ? Number(lastTaskTime + 4n * 60n * 60n) : 0;
  const now = Math.floor(Date.now() / 1000);
  const cooldown = readyAt > now ? `${Math.ceil((readyAt - now) / 60)} 分钟` : '可开始';
  return [
    messageCard(`已完成 ${stats.total} 次任务，累计 ${fmtWei(stats.earned)}。`, 'growth'),
    receiptCard('tasks', '任务统计', '五类任务分布来自链上统计。', [
      { label: '总任务', value: `${stats.total} 次`, tone: 'growth' },
      { label: '累计收益', value: fmtWei(stats.earned), tone: 'warm' },
      { label: '冷却', value: cooldown, tone: readyAt > now ? 'alert' : 'growth' },
      ...TRAITS.map((label, index) => ({ label, value: `${stats.counts[index] ?? 0} 次`, tone: (stats.counts[index] ?? 0) > 0 ? 'cool' : undefined } satisfies TerminalDetailRow)),
    ], { label: '打开挖矿', intent: 'mining' }),
  ];
}

async function buildPkCards(snapshot: TerminalChatSnapshot) {
  ensureConfigured(['pkSkill']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const stats = parsePkStats(
    await publicClient.readContract({ address: addresses.pkSkill, abi: PKSkillABI, functionName: 'getPkStats', args: [tokenId] }),
  );
  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
  return [
    messageCard(total > 0 ? `PK 战绩 ${stats.wins}胜/${stats.losses}败，胜率 ${winRate}%。` : '这只还没有 PK 结算记录。', 'warm'),
    receiptCard('pk', 'PK 战绩', '胜败和收益来自 PKSkill 链上统计。', [
      { label: '胜', value: String(stats.wins), tone: 'growth' },
      { label: '败', value: String(stats.losses), tone: stats.losses > 0 ? 'alert' : 'cool' },
      { label: '胜率', value: `${winRate}%`, tone: winRate >= 50 ? 'growth' : 'cool' },
      { label: '累计赢得', value: fmtWei(stats.won), tone: 'warm' },
      { label: '累计投入/损失', value: fmtWei(stats.lost) },
    ], { label: '打开竞技', intent: 'arena' }),
  ];
}

function brStatusLabel(status: number | string | null | undefined) {
  if (typeof status === 'string') {
    if (status === 'open') return '开放中';
    if (status === 'pending_reveal') return '待揭示';
    if (status === 'settled') return '已结算';
    return '未知';
  }
  return BR_STATUS_LABELS[Number(status)] ?? '未知';
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

async function buildBattleRoyaleCards(snapshot: TerminalChatSnapshot, owner?: string | null) {
  ensureConfigured(['battleRoyale']);
  const tokenId = BigInt(snapshot.detail.tokenId);
  const currentMatchId = await readCurrentBattleRoyaleId();
  if (currentMatchId <= 0n) {
    return [messageCard('现在还没有大逃杀对局。', 'cool')];
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
  const filledRooms = playerCounts.map((count, index) => (count > 0 ? `${index + 1}房 ${count}人` : null)).filter(Boolean).join(' / ') || '暂无';
  const body = `大逃杀 #${currentMatchId.toString()}：${brStatusLabel(status)}，${Number(matchInfo[1])}/${Number(matchConfig[1])} 人。`;
  const details: TerminalDetailRow[] = [
    { label: '当前局', value: `#${currentMatchId.toString()}`, tone: 'warm' },
    { label: '状态', value: brStatusLabel(status), tone: status === 1 ? 'alert' : status === 2 ? 'growth' : 'cool' },
    { label: '人数', value: `${Number(matchInfo[1])}/${Number(matchConfig[1])}` },
    { label: '奖池', value: fmtWei(BigInt(matchInfo[4])), tone: 'warm' },
    { label: '最低质押', value: fmtWei(BigInt(matchConfig[0])) },
    { label: '房间', value: filledRooms },
    { label: '可领取', value: claimables.total > 0n ? `${fmtWei(claimables.total)}${claimables.bestMatch > 0n ? ` · #${claimables.bestMatch}` : ''}` : '暂无', tone: claimables.total > 0n ? 'growth' : 'cool' },
  ];

  if (status >= 2) {
    details.push({ label: '淘汰房', value: Number(matchInfo[3]) > 0 ? `${Number(matchInfo[3])}号房` : '--', tone: 'alert' });
  }
  if (settlement) {
    details.push({ label: '10%销毁/金库', value: fmtWei(BigInt(settlement[2])), tone: 'alert' });
    details.push({ label: '幸存奖励池', value: fmtWei(BigInt(settlement[3])), tone: 'growth' });
  }

  return [
    messageCard(body, status === 1 ? 'alert' : 'warm'),
    receiptCard('battle-royale', '大逃杀查询', '房间、奖池、奖励都来自链上。', details, { label: '打开竞技', intent: 'arena' }),
  ];
}

async function buildEarningsCards(snapshot: TerminalChatSnapshot, owner?: string | null) {
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
    messageCard('这是查询，不会打开动作卡。链上现在没有“本月代币收益”的直接字段；我先把能准确读到的收益列出来。', 'cool'),
    receiptCard('earnings', '收益查询', '月度收益需要后端索引事件后才能精确拆月。', [
      { label: '任务累计收益', value: taskStats ? fmtWei(taskStats.earned) : '--', tone: 'growth' },
      { label: 'PK 累计赢得', value: pkStats ? fmtWei(pkStats.won) : '--', tone: 'warm' },
      { label: 'PK 累计投入/损失', value: pkStats ? fmtWei(pkStats.lost) : '--' },
      { label: '大逃杀可领取', value: battleClaim ? fmtWei(battleClaim.total) : '--', tone: battleClaim && battleClaim.total > 0n ? 'growth' : 'cool' },
      { label: '当前 NFA 账本', value: ledger === null ? '--' : fmtWei(ledger), tone: 'warm' },
      { label: '可确定合计', value: fmtWei(knownIncome), tone: 'growth' },
    ], { label: '打开资金', intent: 'finance' }),
  ];
}

function buildAutonomyCards(snapshot: TerminalChatSnapshot) {
  const autonomy: AutonomyStatusPayload | null = snapshot.autonomy;
  const recent = autonomy?.recentActions?.[0] ?? null;
  const enabled = Boolean(autonomy?.enabled);
  return [
    messageCard(recent ? `最近一次代理：${recent.summary}` : enabled ? '代理开着，但最近还没有新动作。' : '代理现在没开。', enabled ? 'cool' : 'warm'),
    receiptCard('autonomy', '代理状态', '只展示用户主动查询的代理信息。', [
      { label: '状态', value: enabled ? (autonomy?.paused ? '暂停' : '运行') : '未开', tone: enabled ? 'growth' : 'cool' },
      { label: '预算', value: autonomy ? `${fmtWei(autonomy.budget.usedCLW)} / ${fmtWei(autonomy.budget.totalCLW)}` : '--' },
      { label: '最近动作', value: recent?.summary ?? '暂无' },
      { label: '推理证明', value: recent?.reasoningCid ?? '暂无' },
    ], { label: '打开代理', intent: 'auto' }),
  ];
}

function buildWorldCards(snapshot: TerminalChatSnapshot) {
  const world = snapshot.world;
  if (!world) return null;
  return [
    messageCard(`世界倍率 ${world.rewardMultiplier}，PK 上限 ${fmtWei(world.pkStakeLimitCLW)}。`, 'cool'),
    receiptCard('world', '世界状态', '当前世界参数来自 WorldState。', [
      { label: '奖励倍率', value: world.rewardMultiplier, tone: 'warm' },
      { label: 'PK 上限', value: fmtWei(world.pkStakeLimitCLW) },
      { label: '变异加成', value: world.mutationBonus },
      { label: '维护倍率', value: world.dailyCostMultiplier },
      { label: '事件', value: world.activeEvents.map((event) => event.label).join(' / ') || '暂无' },
    ]),
  ];
}

export async function buildChainQueryCards(input: ChainQueryInput): Promise<TerminalCard[] | null> {
  const kind = inferChainQueryKind(input.input, input.slashCommand);
  if (!kind) return null;

  try {
    if (kind === 'monthly_growth') return await buildMonthlyGrowthCards(input.snapshot);
    if (kind === 'earnings') return await buildEarningsCards(input.snapshot, input.owner);
    if (kind === 'traits') return buildTraitCards(input.snapshot);
    if (kind === 'balance') return await buildBalanceCards(input.snapshot, input.owner);
    if (kind === 'tasks') return await buildTaskCards(input.snapshot);
    if (kind === 'pk') return await buildPkCards(input.snapshot);
    if (kind === 'battle_royale') return await buildBattleRoyaleCards(input.snapshot, input.owner);
    if (kind === 'autonomy') return buildAutonomyCards(input.snapshot);
    if (kind === 'world') return buildWorldCards(input.snapshot);
  } catch (error) {
    console.warn('[terminal-chat] chain query failed:', error);
    return [
      messageCard('这次链上查询没读出来，可能是 RPC 暂时慢了。你可以再发一次。', 'alert'),
      receiptCard('query-error', '链上查询失败', error instanceof Error ? error.message.slice(0, 160) : '未知错误', [
        { label: '查询', value: kind },
        { label: '结果', value: '失败', tone: 'alert' },
      ]),
    ];
  }

  return null;
}
