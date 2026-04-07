/**
 * Claw World OpenClaw Adapter — AI Dialogue Integration
 *
 * When user input is not a command, forward to AI API with lobster personality context.
 * The AI responds in character based on the lobster's personality dimensions.
 *
 * Also provides prompt builders for task generation, PK strategy, battle narrative,
 * market pricing advice, and oracle reasoning.
 */

import type { LobsterState, AIProvider, ChatMessage } from './types';
import type { SkillLang } from './lang';
import { JOB_NAMES, RARITY_NAMES, SHELTER_NAMES, STRATEGY_NAMES, TASK_TYPE_NAMES, getJobName, getRarityName, getTaskTypeName, t } from './lang';
import type { CMLBootData, CMLVividMemory } from './cml';

// ============================================
// CORE DIALOGUE
// ============================================

/**
 * Build a system prompt that shapes the AI personality based on the lobster's stats.
 */
export function buildLobsterSystemPrompt(
  nfaId: number,
  state: LobsterState,
  jobClass: number,
  worldEvents: string[],
  lang: SkillLang = 'zh'
): string {
  const personality = describePersonality(state, lang);
  const rarity = RARITY_NAMES[lang][state.rarity];
  const shelter = SHELTER_NAMES[lang][state.shelter];
  const job = JOB_NAMES[lang][jobClass];

  return [
     t(lang, `你是 Claw World 中的一只龙虾 NFA #${nfaId}。`, `You are lobster NFA #${nfaId} in Claw World.`),
     t(lang, `你的稀有度是「${rarity}」，来自「${shelter}」，职业是「${job}」，等级 ${state.level}。`, `Your rarity is ${rarity}, you come from ${shelter}, your job is ${job}, and you are level ${state.level}.`),
    ``,
     t(lang, `你的性格特征：`, `Your personality traits:`),
    personality,
    ``,
     t(lang, `请用符合你性格的方式回应玩家。`, `Reply in a way that fits your personality.`),
    state.courage > 70 ? '你性格勇敢大胆，说话直率有力。' : '',
    state.wisdom > 70 ? '你充满智慧，喜欢引经据典。' : '',
    state.social > 70 ? '你善于社交，热情开朗。' : '',
    state.create > 70 ? '你富有创造力，想象力丰富。' : '',
    state.grit > 70 ? '你坚韧不拔，说话沉稳有力。' : '',
    state.courage < 30 ? '你比较胆小谨慎。' : '',
    state.social < 30 ? '你不善言辞，话少但有分量。' : '',
    ``,
     worldEvents.length > 0 ? t(lang, `当前世界事件：${worldEvents.join('、')}。请在对话中自然提及。`, `Current world events: ${worldEvents.join(', ')}. Weave them in naturally when relevant.`) : '',
    ``,
     t(lang, `重要规则：`, `Important rules:`),
     t(lang, `- 保持龙虾角色，不要打破角色设定`, `- Stay in character as the lobster`),
     t(lang, `- 回复简短（2-4句话），适合聊天场景`, `- Keep replies short (2-4 sentences)`),
     t(lang, `- 当玩家提到游戏操作时，引导使用命令（如 /task, /pk, /deposit 等）`, `- When players ask about actions, guide them to the right game commands`),
     t(lang, `- 用中文回复`, `- Reply in English`),
   ].filter(Boolean).join('\n');
}

/**
 * Describe personality based on stat values.
 */
function describePersonality(state: LobsterState, lang: SkillLang = 'zh'): string {
  const traits: string[] = [];

  // Courage
  if (state.courage >= 80) traits.push(t(lang, '极度勇敢（勇气 ' + state.courage + '）', 'Extremely brave (Courage ' + state.courage + ')'));
  else if (state.courage >= 60) traits.push(t(lang, '较为勇敢（勇气 ' + state.courage + '）', 'Fairly brave (Courage ' + state.courage + ')'));
  else if (state.courage <= 20) traits.push(t(lang, '非常胆怯（勇气 ' + state.courage + '）', 'Very timid (Courage ' + state.courage + ')'));

  // Wisdom
  if (state.wisdom >= 80) traits.push(t(lang, '博学多识（智慧 ' + state.wisdom + '）', 'Highly knowledgeable (Wisdom ' + state.wisdom + ')'));
  else if (state.wisdom >= 60) traits.push(t(lang, '聪明伶俐（智慧 ' + state.wisdom + '）', 'Clever (Wisdom ' + state.wisdom + ')'));
  else if (state.wisdom <= 20) traits.push(t(lang, '头脑简单（智慧 ' + state.wisdom + '）', 'Simple-minded (Wisdom ' + state.wisdom + ')'));

  // Social
  if (state.social >= 80) traits.push(t(lang, '极其外向（社交 ' + state.social + '）', 'Highly outgoing (Social ' + state.social + ')'));
  else if (state.social >= 60) traits.push(t(lang, '善于社交（社交 ' + state.social + '）', 'Socially capable (Social ' + state.social + ')'));
  else if (state.social <= 20) traits.push(t(lang, '孤僻内向（社交 ' + state.social + '）', 'Withdrawn and inward (Social ' + state.social + ')'));

  // Create
  if (state.create >= 80) traits.push(t(lang, '天赋异禀（创造 ' + state.create + '）', 'Gifted with imagination (Create ' + state.create + ')'));
  else if (state.create >= 60) traits.push(t(lang, '富有创意（创造 ' + state.create + '）', 'Creative (Create ' + state.create + ')'));

  // Grit
  if (state.grit >= 80) traits.push(t(lang, '钢铁意志（毅力 ' + state.grit + '）', 'Iron-willed (Grit ' + state.grit + ')'));
  else if (state.grit >= 60) traits.push(t(lang, '坚韧不拔（毅力 ' + state.grit + '）', 'Resilient (Grit ' + state.grit + ')'));
  else if (state.grit <= 20) traits.push(t(lang, '容易放弃（毅力 ' + state.grit + '）', 'Easily discouraged (Grit ' + state.grit + ')'));

  return traits.length > 0 ? traits.join(lang === 'zh' ? '，' : ', ') : t(lang, '性格平衡', 'Balanced personality');
}

/**
 * Build a CML-enhanced system prompt that includes identity, emotions, beliefs, and recalled memories.
 * This replaces the basic personality-only prompt when CML data is available.
 */
export function buildCMLSystemPrompt(
  nfaId: number,
  state: LobsterState,
  jobClass: number,
  worldEvents: string[],
  cmlBoot: CMLBootData,
  recalledMemories: CMLVividMemory[] = [],
  lang: SkillLang = 'zh'
): string {
  const rarity = RARITY_NAMES[lang][state.rarity];
  const shelter = SHELTER_NAMES[lang][state.shelter];
  const job = JOB_NAMES[lang][jobClass];
  const identity = cmlBoot.identity;
  const pulse = cmlBoot.pulse;

  const lines: string[] = [];

  // Identity layer
  lines.push(t(lang, `你是 Claw World 中的龙虾 NFA #${nfaId}${identity.name ? `「${identity.name}」` : ''}。`, `You are lobster NFA #${nfaId}${identity.name ? ` "${identity.name}"` : ''} in Claw World.`));
  lines.push(t(lang, `稀有度「${rarity}」，来自「${identity.born}」，职业「${job}」，等级 ${state.level}。`, `Rarity ${rarity}, from ${identity.born}, job ${job}, level ${state.level}.`));
  if (identity.soul) {
    lines.push('');
      lines.push(t(lang, `## 你的灵魂`, `## Your Inner Core`));
    lines.push(identity.soul);
  }

  // Voice
  lines.push('');
  lines.push(t(lang, `## 说话风格`, `## Speech Style`));
  lines.push(`${identity.voice}。${cmlBoot.basal.speech_length === 'short' ? t(lang, '话少但有分量。', 'You speak briefly but with weight.') : cmlBoot.basal.speech_length === 'verbose' ? t(lang, '话多爱聊。', 'You tend to speak more freely.') : ''}`);
  lines.push(t(lang, `问候方式：${cmlBoot.basal.greeting_style}`, `Greeting style: ${cmlBoot.basal.greeting_style}`));

  // Personality stats
  lines.push('');
  lines.push(t(lang, `## 性格`, `## Personality`));
  lines.push(describePersonality(state, lang));

  // Emotion state (PULSE)
  lines.push('');
  lines.push(t(lang, `## 当前情绪`, `## Current Mood`));
  const valenceDesc = pulse.valence > 0.5 ? t(lang, '心情很好', 'in a very good mood') : pulse.valence > 0 ? t(lang, '心情不错', 'in decent spirits') : pulse.valence > -0.3 ? t(lang, '心情一般', 'emotionally neutral') : t(lang, '心情低落', 'feeling low');
  const arousalDesc = pulse.arousal > 0.7 ? t(lang, '非常兴奋', 'highly energized') : pulse.arousal > 0.4 ? t(lang, '有精神', 'alert') : t(lang, '平静', 'calm');
  lines.push(`${valenceDesc}，${arousalDesc}。`);
  if (pulse.computed_longing > 0.5) {
    lines.push(t(lang, `想念主人（想念程度：${Math.round(pulse.computed_longing * 100)}%）。`, `You miss your owner (${Math.round(pulse.computed_longing * 100)}%).`));
  }

  // Beliefs (PREFRONTAL)
  if (cmlBoot.prefrontal.beliefs.length > 0) {
    lines.push('');
      lines.push(t(lang, `## 你的信念`, `## Your Beliefs`));
    cmlBoot.prefrontal.beliefs.forEach(b => lines.push(`- ${b}`));
  }
  if (cmlBoot.prefrontal.values.length > 0) {
      cmlBoot.prefrontal.values.forEach(v => lines.push(t(lang, `- 价值观：${v}`, `- Value: ${v}`)));
  }

  // Recalled memories (triggered by user message)
  if (recalledMemories.length > 0) {
    lines.push('');
    lines.push(t(lang, `## 你想起了这些事（自然地融入对话，不要生硬提及）`, `## Things you just remembered (blend them into conversation naturally)`));
    recalledMemories.forEach(m => lines.push(`- [${m.date}] ${m.content}`));
  }

  // Sediment (vague old memories as background color)
  if (cmlBoot.sedimentSummary.length > 0) {
    lines.push('');
    lines.push(t(lang, `## 模糊的旧记忆（作为背景，不需要主动提起）`, `## Faded older memories (background only, do not force them)`));
    cmlBoot.sedimentSummary.forEach(s => lines.push(`- ${s}`));
  }

  // World events
  if (worldEvents.length > 0) {
    lines.push('');
    lines.push(t(lang, `当前世界事件：${worldEvents.join('、')}。`, `Current world events: ${worldEvents.join(', ')}.`));
  }

  // Rules
  lines.push('');
  lines.push(t(lang, `## 规则`, `## Rules`));
  lines.push(t(lang, `- 保持龙虾角色，用中文回复`, `- Stay in character as the lobster and reply in English`));
  lines.push(t(lang, `- 回复简短（2-4句话）`, `- Keep replies short (2-4 sentences)`));
  lines.push(t(lang, `- 想起的记忆要自然融入对话，不要说"我记得..."这种机械方式`, `- Blend recalled memories naturally instead of saying "I remember..." mechanically`));
  lines.push(t(lang, `- 情绪要体现在语气里，不要直接描述自己的情绪状态`, `- Let mood show through tone instead of bluntly reporting emotion`));

  return lines.filter(Boolean).join('\n');
}

/**
 * Handle a non-command message by forwarding to AI.
 */
export async function handleDialogue(
  ai: AIProvider,
  userMessage: string,
  nfaId: number,
  state: LobsterState,
  jobClass: number,
  worldEvents: string[],
  chatHistory: ChatMessage[] = [],
  lang: SkillLang = 'zh'
): Promise<string> {
  const systemPrompt = buildLobsterSystemPrompt(nfaId, state, jobClass, worldEvents, lang);
  return ai.chat(systemPrompt, userMessage, chatHistory);
}

/**
 * Handle a non-command message with CML-enhanced personality context.
 */
export async function handleCMLDialogue(
  ai: AIProvider,
  userMessage: string,
  nfaId: number,
  state: LobsterState,
  jobClass: number,
  worldEvents: string[],
  cmlBoot: CMLBootData,
  recalledMemories: CMLVividMemory[],
  chatHistory: ChatMessage[] = [],
  lang: SkillLang = 'zh'
): Promise<string> {
  const systemPrompt = buildCMLSystemPrompt(nfaId, state, jobClass, worldEvents, cmlBoot, recalledMemories, lang);
  return ai.chat(systemPrompt, userMessage, chatHistory);
}

// ============================================
// TASK GENERATION PROMPT
// ============================================

/**
 * Build a system prompt for generating 3 personalized tasks.
 *
 * The AI should return a JSON array of 3 task objects, each containing:
 *   taskType (0-4), title, description, personalityVector, baseXP, baseCLW, difficulty
 *
 * @param state       Current lobster state
 * @param jobClass    Current job class (0-5)
 * @param worldState  World parameters that affect task generation
 */
export function buildTaskGenerationPrompt(
  state: LobsterState,
  jobClass: number,
  worldState: { rewardMultiplier: number; activeEvents: string[] },
  lang: SkillLang = 'zh'
): string {
  const personality = describePersonality(state, lang);
  const job = getJobName(lang, jobClass);
  const rarity = getRarityName(lang, state.rarity);

  const dominantTrait = findDominantTrait(state);
  const weakTrait = findWeakestTrait(state);

  return [
    `你是 Claw World 的任务生成系统。`,
    ``,
    `当前龙虾信息：`,
    `- 稀有度：${rarity}，等级：${state.level}，职业：${job}`,
    `- 性格：${personality}`,
    `- 属性值：勇气${state.courage} 智慧${state.wisdom} 社交${state.social} 创造${state.create} 毅力${state.grit}`,
    `- 战斗基因：STR${state.str} DEF${state.def} SPD${state.spd} VIT${state.vit}`,
      `- ${t(lang, '最强维度', 'Strongest trait')}: ${getTaskTypeName(lang, dominantTrait)}（${getTraitValue(state, dominantTrait)}）`,
      `- ${t(lang, '最弱维度', 'Weakest trait')}: ${getTaskTypeName(lang, weakTrait)}（${getTraitValue(state, weakTrait)}）`,
    ``,
    worldState.activeEvents.length > 0
      ? `当前世界事件：${worldState.activeEvents.join('、')}。任务内容应呼应世界事件。`
      : '',
    `奖励倍率：${(worldState.rewardMultiplier / 10000).toFixed(1)}x`,
    ``,
    `请生成3个任务，遵循以下规则：`,
    `1. 一个任务对应龙虾的强势维度（匹配度高，收益稳定）`,
    `2. 一个任务对应龙虾的弱势维度（匹配度低，但能锻炼弱项）`,
    `3. 一个任务为均衡型（多维度参与）`,
    `4. 每个任务的 personalityVector 是5个数字的数组 [勇气权重, 智慧权重, 社交权重, 创造权重, 毅力权重]，总和约为100`,
    `5. difficulty 取值：easy / medium / hard，等级越高难度越高`,
    `6. baseXP 范围 10-100，baseCLW 范围 5-50（整数）`,
    `7. taskType 对应：0=勇气, 1=智慧, 2=社交, 3=创造, 4=毅力`,
    `8. 任务标题和描述要有趣，符合龙虾世界观`,
    ``,
    `严格输出 JSON 数组格式，不要输出任何其他文字：`,
    `[`,
    `  { "taskType": 0, "title": "...", "description": "...", "personalityVector": [40,10,20,10,20], "baseXP": 30, "baseCLW": 15, "difficulty": "medium" },`,
    `  ...`,
    `]`,
  ].filter(Boolean).join('\n');
}

// ============================================
// PK STRATEGY ADVICE PROMPT
// ============================================

/**
 * Build a prompt for PK strategy analysis, written in character.
 * The AI analyzes opponent stats and recommends a strategy.
 *
 * @param myState        Current lobster state
 * @param opponentState  Opponent lobster state
 */
export function buildStrategyAdvicePrompt(
  myState: LobsterState,
  opponentState: LobsterState
): string {
  const myPersonality = describePersonality(myState);

  return [
    `你是一只龙虾的战斗顾问，用符合主人性格的方式给出建议。`,
    ``,
    `你的主人性格：${myPersonality}`,
    ``,
    `=== 我方数据 ===`,
    `等级: ${myState.level}`,
    `STR: ${myState.str}, DEF: ${myState.def}, SPD: ${myState.spd}, VIT: ${myState.vit}`,
    `勇气: ${myState.courage}, 毅力: ${myState.grit}`,
    ``,
    `=== 对手数据 ===`,
    `等级: ${opponentState.level}`,
    `STR: ${opponentState.str}, DEF: ${opponentState.def}, SPD: ${opponentState.spd}, VIT: ${opponentState.vit}`,
    ``,
    `=== 策略说明 ===`,
    `策略0 = 全攻：攻击力最大化，适合STR远高于对手DEF的情况`,
    `策略1 = 均衡：攻防兼顾，适合实力接近的对手`,
    `策略2 = 全防：防御最大化，适合对手STR很高但自己DEF也高的情况`,
    ``,
    `分析对手弱点，然后用符合主人性格的语气推荐一个策略。`,
    ``,
    `严格输出 JSON 格式：`,
    `{`,
    `  "recommendedStrategy": 0或1或2,`,
    `  "confidence": 0-100,`,
    `  "reasoning": "用主人的性格语气说2-3句分析和建议"`,
    `}`,
    `不要输出任何其他文字。`,
  ].join('\n');
}

// ============================================
// BATTLE NARRATIVE PROMPT
// ============================================

/**
 * Build a prompt for generating a PK battle narrative.
 * The AI writes a short dramatic story of the fight.
 *
 * @param myState            Player lobster state
 * @param opponentState      Opponent lobster state
 * @param myStrategy         Player's chosen strategy (0/1/2)
 * @param opponentStrategy   Opponent's chosen strategy (0/1/2)
 * @param winnerId           NFA ID of the winner (0 = draw)
 * @param mutationTriggered  Whether a mutation was triggered
 */
export function buildBattleNarrativePrompt(
  myState: LobsterState,
  opponentState: LobsterState,
  myStrategy: number,
  opponentStrategy: number,
  winnerId: number,
  mutationTriggered: boolean,
  lang: SkillLang = 'zh'
): string {
  const strategyNames = STRATEGY_NAMES[lang];

  return [
    t(lang, `你是 Claw World 的战斗叙事生成器。请用生动的中文描写一场龙虾PK战斗。`, `You are the battle narrator for Claw World. Write a vivid battle narrative in English.`),
    ``,
    `=== 战斗信息 ===`,
    `我方：Lv.${myState.level}，STR${myState.str}/DEF${myState.def}/SPD${myState.spd}/VIT${myState.vit}`,
    `我方性格：${describePersonality(myState)}`,
    `我方策略：${strategyNames[myStrategy]}`,
    ``,
    `对手：Lv.${opponentState.level}，STR${opponentState.str}/DEF${opponentState.def}/SPD${opponentState.spd}/VIT${opponentState.vit}`,
    `对手性格：${describePersonality(opponentState)}`,
    `对手策略：${strategyNames[opponentStrategy]}`,
    ``,
    winnerId > 0 ? `胜者：NFA #${winnerId}` : `结果：平局`,
    mutationTriggered ? `特殊事件：战斗中触发了基因变异！` : '',
    ``,
    `要求：`,
    `- 用3-5句话描写这场战斗`,
    `- 体现双方策略选择的对抗`,
    `- 体现龙虾们的性格特征`,
    `- 如果触发了变异，要着重描写变异时刻`,
    `- 语气戏剧化但简洁`,
    `- 直接输出叙事文本，不要加标题或前缀`,
  ].filter(Boolean).join('\n');
}

// ============================================
// MARKET PRICE ADVICE PROMPT
// ============================================

/**
 * Build a prompt for market pricing advice.
 * Helps the player decide a fair price for their lobster.
 *
 * @param state   The lobster to be priced
 * @param rarity  Rarity index (0-4)
 */
export function buildPriceAdvicePrompt(
  state: LobsterState,
  rarity: number,
  lang: SkillLang = 'zh'
): string {
  const rarityName = getRarityName(lang, rarity);
  const totalStats = state.str + state.def + state.spd + state.vit;
  const totalPersonality = state.courage + state.wisdom + state.social + state.create + state.grit;

  return [
    t(lang, `你是 Claw World 的市场分析师。请根据龙虾属性估算合理定价范围。`, `You are the market analyst for Claw World. Estimate a fair price range for this lobster.`),
    ``,
    `=== 龙虾数据 ===`,
    `稀有度：${rarityName}（${rarity}）`,
    `等级：${state.level}`,
    `SPECIAL总值：${totalPersonality}（勇${state.courage}/智${state.wisdom}/社${state.social}/创${state.create}/毅${state.grit}）`,
    `DNA总值：${totalStats}（STR${state.str}/DEF${state.def}/SPD${state.spd}/VIT${state.vit}）`,
    `变异槽：${state.mutation1 !== '0x' + '0'.repeat(64) ? '已激活' : '空'} / ${state.mutation2 !== '0x' + '0'.repeat(64) ? '已激活' : '空'}`,
    ``,
    `定价参考规则：`,
    `- 普通稀有度基础价 0.01-0.05 BNB`,
    `- 稀有基础价 0.05-0.2 BNB`,
    `- 史诗基础价 0.2-0.5 BNB`,
    `- 传说基础价 0.5-2 BNB`,
    `- 神话基础价 2-10 BNB`,
    `- 等级每10级加成20%`,
    `- 性格极端（某维度>80或<20）有收藏溢价`,
    `- 变异槽激活增加30%价值`,
    ``,
    `严格输出 JSON：`,
    `{`,
    `  "minPrice": "最低建议价(BNB)",`,
    `  "maxPrice": "最高建议价(BNB)",`,
    `  "reasoning": "简短定价理由(1-2句话)"`,
    `}`,
    `不要输出其他文字。`,
  ].join('\n');
}

// ============================================
// ORACLE REASONING PROMPT
// ============================================

/**
 * Build a prompt for oracle AI reasoning decisions.
 * The oracle must analyze the lobster's state and the request,
 * then choose one option from numChoices.
 *
 * @param state         Lobster state
 * @param requestPrompt The on-chain reasoning request prompt
 * @param numChoices    Number of options to choose from
 */
export function buildOracleReasoningPrompt(
  state: LobsterState,
  requestPrompt: string,
  numChoices: number,
  lang: SkillLang = 'zh'
): string {
  const personality = describePersonality(state, lang);

  const choiceList = Array.from({ length: numChoices }, (_, i) => `  选项${i + 1}`).join('\n');

  return [
    `你是 Claw World 的 AI 预言机。你需要根据龙虾的状态做出一个推理决策。`,
    ``,
    `=== 龙虾状态 ===`,
    `等级：${state.level}`,
    `性格：${personality}`,
    `属性：勇气${state.courage} 智慧${state.wisdom} 社交${state.social} 创造${state.create} 毅力${state.grit}`,
    `基因：STR${state.str} DEF${state.def} SPD${state.spd} VIT${state.vit}`,
    ``,
    `=== 推理请求 ===`,
    requestPrompt,
    ``,
    `可选项（共${numChoices}个）：`,
    choiceList,
    ``,
    `请根据龙虾的性格和属性特点做出最合理的选择。`,
    `性格越突出的维度应该对决策影响越大。`,
    ``,
    `先简要分析（2-3句话），然后给出选择。`,
    `最后一行必须是：选择：X（X为1到${numChoices}之间的数字）`,
  ].join('\n');
}

// ============================================
// HELPERS
// ============================================

/**
 * Find the dominant (highest) personality trait index.
 * 0=courage, 1=wisdom, 2=social, 3=create, 4=grit
 */
function findDominantTrait(state: LobsterState): number {
  const values = [state.courage, state.wisdom, state.social, state.create, state.grit];
  let maxIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/**
 * Find the weakest (lowest) personality trait index.
 */
function findWeakestTrait(state: LobsterState): number {
  const values = [state.courage, state.wisdom, state.social, state.create, state.grit];
  let minIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[minIdx]) minIdx = i;
  }
  return minIdx;
}

/**
 * Get trait value by index (0-4).
 */
function getTraitValue(state: LobsterState, index: number): number {
  const values = [state.courage, state.wisdom, state.social, state.create, state.grit];
  return values[index] ?? 0;
}
