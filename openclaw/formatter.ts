/**
 * Claw World OpenClaw Adapter — Message Formatter
 *
 * Three output modes:
 *   - rich: Feishu (Markdown + buttons + cards)
 *   - telegram: Telegram Markdown (inline keyboard)
 *   - plain: Pure ASCII text
 */

import type { LobsterState, PKMatch, GameResponse, OutputFormat, TaskDefinition, MarketListing } from './types';
import { TASK_TYPE_ICONS } from './types';
import { getJobName, getListingTypeName, getPkPhaseName, getRarityName, getShelterName, getStrategyName, getTaskTypeName, type SkillLang, t } from './lang';

// ============================================
// LOBSTER STATUS
// ============================================

export function formatLobsterStatus(
  nfaId: number,
  state: LobsterState,
  clwBalance: string,
  jobClass: number,
  active: boolean,
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  const rarity = getRarityName(lang, state.rarity);
  const shelter = getShelterName(lang, state.shelter);
  const job = getJobName(lang, jobClass);
  const status = active ? t(lang, '● 活跃', '● Active') : t(lang, '○ 休眠', '○ Dormant');

  if (format === 'plain') {
    return {
      text: [
          `=== ${t(lang, '龙虾', 'Lobster')} #${nfaId} ===`,
          `${t(lang, '稀有度', 'Rarity')}: ${rarity} | ${t(lang, '避难所', 'Shelter')}: ${shelter}`,
          `${t(lang, '等级', 'Level')}: ${state.level} | XP: ${state.xp}/${(state.level + 1) * 100}`,
          `${t(lang, '职业', 'Job')}: ${job} | ${t(lang, '状态', 'Status')}: ${status}`,
          `CLW: ${clwBalance}`,
        ``,
        `-- SPECIAL --`,
        `勇气: ${_bar(state.courage)} ${state.courage}`,
        `智慧: ${_bar(state.wisdom)} ${state.wisdom}`,
        `社交: ${_bar(state.social)} ${state.social}`,
        `创造: ${_bar(state.create)} ${state.create}`,
        `毅力: ${_bar(state.grit)} ${state.grit}`,
        ``,
        `-- DNA --`,
        `STR: ${_bar(state.str)} ${state.str}`,
        `DEF: ${_bar(state.def)} ${state.def}`,
        `SPD: ${_bar(state.spd)} ${state.spd}`,
        `VIT: ${_bar(state.vit)} ${state.vit}`,
      ].join('\n'),
    };
  }

  if (format === 'telegram') {
    return {
      text: [
         `🦞 *${t(lang, '龙虾', 'Lobster')} #${nfaId}* ${status}`,
        `\`${rarity}\` | \`${shelter}\` | \`${job}\``,
        `📊 Lv.${state.level} | XP: ${state.xp}/${(state.level + 1) * 100}`,
        `💰 CLW: ${clwBalance}`,
        ``,
        `*SPECIAL*`,
        `勇气 \`${'█'.repeat(Math.floor(state.courage / 10))}${'░'.repeat(10 - Math.floor(state.courage / 10))}\` ${state.courage}`,
        `智慧 \`${'█'.repeat(Math.floor(state.wisdom / 10))}${'░'.repeat(10 - Math.floor(state.wisdom / 10))}\` ${state.wisdom}`,
        `社交 \`${'█'.repeat(Math.floor(state.social / 10))}${'░'.repeat(10 - Math.floor(state.social / 10))}\` ${state.social}`,
        `创造 \`${'█'.repeat(Math.floor(state.create / 10))}${'░'.repeat(10 - Math.floor(state.create / 10))}\` ${state.create}`,
        `毅力 \`${'█'.repeat(Math.floor(state.grit / 10))}${'░'.repeat(10 - Math.floor(state.grit / 10))}\` ${state.grit}`,
        ``,
        `*DNA*`,
        `STR \`${state.str}\` DEF \`${state.def}\` SPD \`${state.spd}\` VIT \`${state.vit}\``,
      ].join('\n'),
    };
  }

  // Rich (Feishu)
  return {
    text: [
       `## 🦞 ${t(lang, '龙虾', 'Lobster')} #${nfaId} ${status}`,
       `**${t(lang, '稀有度', 'Rarity')}:** ${rarity} | **${t(lang, '避难所', 'Shelter')}:** ${shelter} | **${t(lang, '职业', 'Job')}:** ${job}`,
       `**${t(lang, '等级', 'Level')}:** ${state.level} | **XP:** ${state.xp}/${(state.level + 1) * 100} | **CLW:** ${clwBalance}`,
      ``,
      `### SPECIAL`,
      `| 维度 | 值 | 进度 |`,
      `|------|-----|------|`,
      `| 勇气 | ${state.courage} | ${_mdBar(state.courage)} |`,
      `| 智慧 | ${state.wisdom} | ${_mdBar(state.wisdom)} |`,
      `| 社交 | ${state.social} | ${_mdBar(state.social)} |`,
      `| 创造 | ${state.create} | ${_mdBar(state.create)} |`,
      `| 毅力 | ${state.grit} | ${_mdBar(state.grit)} |`,
      ``,
      `### DNA`,
      `STR: ${state.str} | DEF: ${state.def} | SPD: ${state.spd} | VIT: ${state.vit}`,
    ].join('\n'),
    buttons: [
      { label: '📋 任务', action: '/task list' },
      { label: '⚔️ 对战', action: '/pk list' },
      { label: '🏪 市场', action: '/market list' },
      { label: '💰 充值', action: '/deposit' },
    ],
  };
}

// ============================================
// PK MATCH
// ============================================

export function formatPKMatch(
  matchId: number,
  match: PKMatch,
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  const phase = getPkPhaseName(lang, match.phase);
  const stakeStr = (Number(match.stake) / 1e18).toFixed(0);

  if (format === 'plain') {
    return {
      text: [
        `=== PK #${matchId} ===`,
        `状态: ${phase}`,
        `A: #${match.nfaA} | B: #${match.nfaB || '等待'}`,
        `赌注: ${stakeStr} CLW (每方)`,
        match.phase === 4 ? `结果: A-${getStrategyName(lang, match.strategyA)} vs B-${getStrategyName(lang, match.strategyB)}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  // telegram / rich
  return {
    text: [
      `⚔️ **PK #${matchId}** — ${phase}`,
      `🦞 A: #${match.nfaA} vs B: #${match.nfaB || '等待对手'}`,
      `💰 赌注: ${stakeStr} CLW`,
      match.phase === 4 ? `🎯 策略: ${getStrategyName(lang, match.strategyA)} vs ${getStrategyName(lang, match.strategyB)}` : '',
    ].filter(Boolean).join('\n'),
    buttons: match.phase === 0 ? [{ label: '加入对战', action: `/pk join ${matchId}` }] : undefined,
  };
}

// ============================================
// TASK RESULT
// ============================================

export function formatTaskResult(
  nfaId: number,
  taskType: number,
  clwReward: string,
  xpReward: number,
  personalityDelta: { dimension: number; delta: number } | null,
  format: OutputFormat
): GameResponse {
  const dimNames = ['勇气', '智慧', '社交', '创造', '毅力'];
  const deltaStr = personalityDelta
    ? `${dimNames[personalityDelta.dimension]} ${personalityDelta.delta > 0 ? '+' : ''}${personalityDelta.delta}`
    : '';

  if (format === 'plain') {
    return {
      text: [
        `=== 任务完成 ===`,
        `龙虾 #${nfaId}`,
        `奖励: ${clwReward} CLW + ${xpReward} XP`,
        deltaStr ? `性格变化: ${deltaStr}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  return {
    text: [
      `✅ **任务完成！**`,
      `🦞 龙虾 #${nfaId}`,
      `💰 +${clwReward} CLW | 📊 +${xpReward} XP`,
      deltaStr ? `🧬 ${deltaStr}` : '',
    ].filter(Boolean).join('\n'),
  };
}

// ============================================
// WORLD STATE
// ============================================

export function formatWorldState(
  rewardMul: number,
  pkStakeLimit: string,
  mutationBonus: number,
  dailyCostMul: number,
  activeEvents: string[],
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  const mul = (v: number) => (v / 10000).toFixed(1) + 'x';

  if (format === 'plain') {
    return {
      text: [
         `=== ${t(lang, '世界状态', 'World State')} ===`,
         `${t(lang, '奖励倍率', 'Reward Multiplier')}: ${mul(rewardMul)}`,
         `${t(lang, 'PK 上限', 'PK Limit')}: ${pkStakeLimit} CLW`,
         `${t(lang, '变异倍率', 'Mutation Multiplier')}: ${mul(mutationBonus)}`,
         `${t(lang, '日常消耗', 'Daily Cost')}: ${mul(dailyCostMul)}`,
         activeEvents.length > 0 ? `${t(lang, '活跃事件', 'Active Events')}: ${activeEvents.join(', ')}` : t(lang, '无活跃事件', 'No active events'),
       ].join('\n'),
    };
  }

  return {
    text: [
      `🌍 **世界状态**`,
      `| 参数 | 值 |`,
      `|------|-----|`,
      `| 奖励倍率 | ${mul(rewardMul)} |`,
      `| PK上限 | ${pkStakeLimit} CLW |`,
      `| 变异倍率 | ${mul(mutationBonus)} |`,
      `| 日常消耗 | ${mul(dailyCostMul)} |`,
      activeEvents.length > 0 ? `\n🎭 **活跃事件:** ${activeEvents.join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  };
}

// ============================================
// HELP
// ============================================

export function formatHelp(format: OutputFormat, lang: SkillLang = 'zh'): GameResponse {
  const commands = [
    ['/wallet [init|unlock]', t(lang, '钱包管理', 'Wallet management')],
    ['/status [id]', t(lang, '查看龙虾状态', 'View lobster status')],
    ['/task list|accept', t(lang, '任务系统', 'Task system')],
    ['/pk create|join|commit|reveal|settle', t(lang, 'PvP 对战', 'PvP battle')],
    ['/market list|sell|buy|cancel', t(lang, '市场交易', 'Market trading')],
    ['/deposit <amount>', t(lang, '充值 CLW', 'Deposit CLW')],
    ['/withdraw <amount>', t(lang, '提取 CLW', 'Withdraw CLW')],
    ['/job [id]', t(lang, '查看职业', 'View job')],
    ['/world', t(lang, '查看世界状态', 'View world state')],
    ['/help', t(lang, '显示帮助', 'Show help')],
  ];

  if (format === 'plain') {
    return {
      text: [
         `=== ${t(lang, 'Claw World 命令', 'Claw World Commands')} ===`,
         ...commands.map(([cmd, desc]) => `  ${cmd.padEnd(35)} ${desc}`),
         '',
         t(lang, '直接输入文字与你的龙虾对话！', 'Just type naturally to talk with your lobster!'),
       ].join('\n'),
    };
  }

  return {
    text: [
       `## 🦞 ${t(lang, 'Claw World 命令', 'Claw World Commands')}`,
       `| ${t(lang, '命令', 'Command')} | ${t(lang, '说明', 'Description')} |`,
       '|------|------|',
       ...commands.map(([cmd, desc]) => `| \`${cmd}\` | ${desc} |`),
       '',
       `💬 ${t(lang, '直接输入文字与你的龙虾对话！', 'Just type naturally to talk with your lobster!')}`,
     ].join('\n'),
  };
}

// ============================================
// TASK LIST
// ============================================

export function formatTaskList(
  nfaId: number,
  tasks: TaskDefinition[],
  matchScores: number[],
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  if (format === 'plain') {
    const lines = [`=== 🦞 可接任务 (#${nfaId}) ===`];
    tasks.forEach((t, i) => {
      const mul = (matchScores[i] / 10000).toFixed(1);
      const bar = _bar(Math.min(matchScores[i] / 200, 100));
      lines.push(`[${i + 1}] ${TASK_TYPE_ICONS[t.taskType]} ${t.title.padEnd(14)} 匹配: ${bar} ${mul}x   类型: ${getTaskTypeName(lang, t.taskType)}`);
      lines.push(`    "${t.description}"`);
      lines.push(`    奖励: ${t.baseCLW} CLW + ${t.baseXP} XP\n`);
    });
    lines.push('> /task accept <1|2|3>');
    return { text: lines.join('\n') };
  }

  if (format === 'telegram') {
    const lines = [`🦞 *龙虾 #${nfaId} 可接任务*\n`];
    tasks.forEach((t, i) => {
      const mul = (matchScores[i] / 10000).toFixed(1);
      const emoji = matchScores[i] >= 15000 ? '🟢' : matchScores[i] >= 10000 ? '🟡' : '🔴';
      lines.push(`${emoji} *${i + 1}. ${t.title}* (${getTaskTypeName(lang, t.taskType)}) ${mul}x`);
      lines.push(`  ${t.description}`);
      lines.push(`  💰 ${t.baseCLW} CLW + ${t.baseXP} XP\n`);
    });
    return {
      text: lines.join('\n'),
      buttons: tasks.map((_, i) => ({ label: `接取任务${i + 1}`, action: `/task accept ${i + 1}` })),
    };
  }

  // Rich (Feishu)
  const lines = [`## 🦞 龙虾 #${nfaId} 可接任务\n`];
  lines.push('| # | 任务 | 类型 | 匹配度 | 奖励 |');
  lines.push('|---|------|------|--------|------|');
  tasks.forEach((t, i) => {
    const mul = (matchScores[i] / 10000).toFixed(1);
    lines.push(`| ${i + 1} | ${t.title} | ${getTaskTypeName(lang, t.taskType)} | ${mul}x | ${t.baseCLW} CLW + ${t.baseXP} XP |`);
  });
  return {
    text: lines.join('\n'),
    buttons: tasks.map((_, i) => ({ label: `接取任务${i + 1}`, action: `/task accept ${i + 1}` })),
  };
}

// ============================================
// PK STRATEGY ADVICE
// ============================================

export function formatStrategyAdvice(
  matchId: number,
  advice: { recommendedStrategy: number; confidence: number; reasoning: string },
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  const stName = getStrategyName(lang, advice.recommendedStrategy);
  if (format === 'plain') {
    return {
      text: [
        `=== ⚔️ 策略建议 (PK #${matchId}) ===`,
        `龙虾建议: 「${advice.reasoning}」`,
        `推荐策略: [${advice.recommendedStrategy}] ${stName} (信心: ${advice.confidence}%)`,
        ``,
        `> /pk commit ${advice.recommendedStrategy}`,
      ].join('\n'),
    };
  }
  return {
    text: [
      `⚔️ **策略建议** (PK #${matchId})`,
      `💬 _${advice.reasoning}_`,
      `🎯 推荐: **${stName}** (信心 ${advice.confidence}%)`,
    ].join('\n'),
    buttons: [0, 1, 2].map(s => ({ label: getStrategyName(lang, s), action: `/pk commit ${s}` })),
  };
}

// ============================================
// PK NARRATIVE
// ============================================

export function formatBattleNarrative(
  matchId: number,
  narrative: string,
  winnerId: number,
  loserId: number,
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  if (format === 'plain') {
    return {
      text: [
        `=== ⚔️ 战斗报告 (PK #${matchId}) ===`,
        ``,
        narrative,
        ``,
        `胜者: #${winnerId} | 败者: #${loserId}`,
      ].join('\n'),
    };
  }
  return {
    text: [
      `⚔️ **战斗报告** (PK #${matchId})`,
      ``,
      `_${narrative}_`,
      ``,
      `🏆 胜者: **#${winnerId}** | 败者: #${loserId}`,
    ].join('\n'),
  };
}

// ============================================
// MARKET LISTING
// ============================================

export function formatMarketList(
  listings: MarketListing[],
  format: OutputFormat,
  lang: SkillLang = 'zh'
): GameResponse {
  if (listings.length === 0) {
    return { text: format === 'plain' ? '=== 🏪 市场 ===\n暂无在售商品' : '🏪 **市场** — 暂无在售商品' };
  }

  if (format === 'plain') {
    const lines = ['=== 🏪 市场 ===', 'ID   类型    NFA    价格         状态'];
    for (const l of listings) {
      const typeName = getListingTypeName(lang, l.listingType);
      let priceStr = `${l.price} BNB`;
      if (l.listingType === 1) priceStr = `${l.price} BNB起`;
      if (l.listingType === 2) priceStr = `换 #${l.swapTargetId}`;
      const timeStr = l.listingType === 1 ? _remainingTime(l.endTime) : '在售';
      lines.push(`#${String(l.listingId).padEnd(4)} ${typeName.padEnd(6)} #${String(l.nfaId).padEnd(5)} ${priceStr.padEnd(13)} ${timeStr}`);
    }
    return { text: lines.join('\n') };
  }

  const lines = [`🏪 **市场** (${listings.length} 件在售)\n`];
  lines.push('| ID | 类型 | NFA | 价格 | 状态 |');
  lines.push('|----|------|-----|------|------|');
  for (const l of listings) {
    const typeName = getListingTypeName(lang, l.listingType);
    let priceStr = `${l.price} BNB`;
    if (l.listingType === 1) priceStr = `${l.price} BNB起`;
    if (l.listingType === 2) priceStr = `换 #${l.swapTargetId}`;
    const timeStr = l.listingType === 1 ? _remainingTime(l.endTime) : '在售';
    lines.push(`| #${l.listingId} | ${typeName} | #${l.nfaId} | ${priceStr} | ${timeStr} |`);
  }
  return {
    text: lines.join('\n'),
    buttons: listings.slice(0, 3).map(l => ({
      label: l.listingType === 0 ? `购买 #${l.listingId}` : `查看 #${l.listingId}`,
      action: l.listingType === 0 ? `/market buy ${l.listingId}` : `/market info ${l.listingId}`,
    })),
  };
}

function _remainingTime(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTimestamp - now;
  if (diff <= 0) return '已结束';
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  return hours > 0 ? `剩余 ${hours}h${mins}m` : `剩余 ${mins}m`;
}

// ============================================
// HELPERS
// ============================================

function _bar(value: number, width: number = 10): string {
  const filled = Math.floor(value / (100 / width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function _mdBar(value: number): string {
  return `${'■'.repeat(Math.floor(value / 10))}${'□'.repeat(10 - Math.floor(value / 10))}`;
}
