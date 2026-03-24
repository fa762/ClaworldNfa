/**
 * Claw World OpenClaw Adapter — AI Dialogue Integration
 *
 * When user input is not a command, forward to AI API with lobster personality context.
 * The AI responds in character based on the lobster's personality dimensions.
 */

import type { LobsterState } from './types';
import { JOB_NAMES_CN, RARITY_NAMES_CN, SHELTER_NAMES } from './types';

/**
 * Build a system prompt that shapes the AI personality based on the lobster's stats.
 */
export function buildLobsterSystemPrompt(
  nfaId: number,
  state: LobsterState,
  jobClass: number,
  worldEvents: string[]
): string {
  const personality = describePersonality(state);
  const rarity = RARITY_NAMES_CN[state.rarity];
  const shelter = SHELTER_NAMES[state.shelter];
  const job = JOB_NAMES_CN[jobClass];

  return [
    `你是 Claw World 中的一只龙虾 NFA #${nfaId}。`,
    `你的稀有度是「${rarity}」，来自「${shelter}」，职业是「${job}」，等级 ${state.level}。`,
    ``,
    `你的性格特征：`,
    personality,
    ``,
    `请用符合你性格的方式回应玩家。`,
    state.courage > 70 ? '你性格勇敢大胆，说话直率有力。' : '',
    state.wisdom > 70 ? '你充满智慧，喜欢引经据典。' : '',
    state.social > 70 ? '你善于社交，热情开朗。' : '',
    state.create > 70 ? '你富有创造力，想象力丰富。' : '',
    state.grit > 70 ? '你坚韧不拔，说话沉稳有力。' : '',
    state.courage < 30 ? '你比较胆小谨慎。' : '',
    state.social < 30 ? '你不善言辞，话少但有分量。' : '',
    ``,
    worldEvents.length > 0 ? `当前世界事件：${worldEvents.join('、')}。请在对话中自然提及。` : '',
    ``,
    `重要规则：`,
    `- 保持龙虾角色，不要打破角色设定`,
    `- 回复简短（2-4句话），适合聊天场景`,
    `- 当玩家提到游戏操作时，引导使用命令（如 /task, /pk, /deposit 等）`,
    `- 用中文回复`,
  ].filter(Boolean).join('\n');
}

/**
 * Describe personality based on stat values.
 */
function describePersonality(state: LobsterState): string {
  const traits: string[] = [];

  // Courage
  if (state.courage >= 80) traits.push('极度勇敢（勇气 ' + state.courage + '）');
  else if (state.courage >= 60) traits.push('较为勇敢（勇气 ' + state.courage + '）');
  else if (state.courage <= 20) traits.push('非常胆怯（勇气 ' + state.courage + '）');

  // Wisdom
  if (state.wisdom >= 80) traits.push('博学多识（智慧 ' + state.wisdom + '）');
  else if (state.wisdom >= 60) traits.push('聪明伶俐（智慧 ' + state.wisdom + '）');
  else if (state.wisdom <= 20) traits.push('头脑简单（智慧 ' + state.wisdom + '）');

  // Social
  if (state.social >= 80) traits.push('极其外向（社交 ' + state.social + '）');
  else if (state.social >= 60) traits.push('善于社交（社交 ' + state.social + '）');
  else if (state.social <= 20) traits.push('孤僻内向（社交 ' + state.social + '）');

  // Create
  if (state.create >= 80) traits.push('天赋异禀（创造 ' + state.create + '）');
  else if (state.create >= 60) traits.push('富有创意（创造 ' + state.create + '）');

  // Grit
  if (state.grit >= 80) traits.push('钢铁意志（毅力 ' + state.grit + '）');
  else if (state.grit >= 60) traits.push('坚韧不拔（毅力 ' + state.grit + '）');
  else if (state.grit <= 20) traits.push('容易放弃（毅力 ' + state.grit + '）');

  return traits.length > 0 ? traits.join('，') : '性格平衡';
}

/**
 * Interface for AI API call. Implement based on your AI provider.
 */
export interface AIProvider {
  chat(systemPrompt: string, userMessage: string, history?: ChatMessage[]): Promise<string>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = buildLobsterSystemPrompt(nfaId, state, jobClass, worldEvents);
  return ai.chat(systemPrompt, userMessage, chatHistory);
}
