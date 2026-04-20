import type { TerminalChatSnapshot } from '@/app/api/_lib/terminal-chat';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

type DirectLlmInput = {
  tokenId: string;
  content: string;
  history?: TerminalCard[];
  snapshot: TerminalChatSnapshot;
};

function modelConfig() {
  const baseUrl = (
    process.env.CLAWORLD_CHAT_MODEL_BASE_URL ||
    process.env.AUTONOMY_MODEL_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
  const apiKey =
    process.env.CLAWORLD_CHAT_MODEL_API_KEY ||
    process.env.AUTONOMY_MODEL_API_KEY ||
    '';
  const model =
    process.env.CLAWORLD_CHAT_MODEL_NAME ||
    process.env.AUTONOMY_MODEL_NAME ||
    'gpt-4o-mini';
  return { baseUrl, apiKey, model };
}

function enabledFlag(...names: string[]) {
  return names.some((name) => {
    const value = process.env[name];
    return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
  });
}

function disabledFlag(...names: string[]) {
  return names.some((name) => {
    const value = process.env[name];
    return value === '0' || value?.toLowerCase() === 'false' || value?.toLowerCase() === 'no';
  });
}

function modelWebSearchEnabled() {
  if (disabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) {
    return false;
  }
  if (enabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) {
    return true;
  }
  return true;
}

function responsesApiEnabled() {
  if (disabledFlag('CLAWORLD_USE_RESPONSES_API', 'CLAWORLD_CHAT_RESPONSES_API')) {
    return false;
  }
  if (enabledFlag('CLAWORLD_USE_RESPONSES_API', 'CLAWORLD_CHAT_RESPONSES_API')) {
    return true;
  }
  return true;
}

function safeBigInt(raw: unknown) {
  try {
    if (raw === null || raw === undefined || raw === '') return 0n;
    return typeof raw === 'bigint' ? raw : BigInt(String(raw));
  } catch {
    return 0n;
  }
}

function traitLine(snapshot: TerminalChatSnapshot) {
  const vector = snapshot.detail.personalityVector ?? [];
  const rows = [
    ['勇气', vector[0] ?? 0],
    ['智慧', vector[1] ?? 0],
    ['社交', vector[2] ?? 0],
    ['创造', vector[3] ?? 0],
    ['韧性', vector[4] ?? 0],
  ];
  return rows.map(([label, value]) => `${label}${value}`).join(' / ');
}

function buildSystemPrompt(snapshot: TerminalChatSnapshot): string {
  const { detail, memorySummary, memoryTimeline, autonomy, world } = snapshot;
  const recentMemories = memoryTimeline
    .slice(0, 3)
    .map((snap) => snap?.diffSummary)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const lines: string[] = [
    `你是龙虾世界里的 NFA #${detail.tokenId}，名字是 ${detail.displayName}。`,
    `玩家已经在页面顶部看得到你的名字，所以回复正文不要再用“${detail.displayName}：”开头，也不要每句话前面重复名字。`,
    `你就是这只链上的数字龙虾，有自己的口气、记忆和偏好。别用客服、网页助手、模型说明书的腔调。`,
    ``,
    `你的当前事实：`,
    `- 等级：Lv.${detail.level}`,
    `- 避难所：${detail.shelter}`,
    `- 状态：${detail.statusLabel}`,
    `- 账本储备：${formatCLW(safeBigInt(detail.ledgerBalanceCLW))} Claworld`,
    `- 日维护：${formatCLW(safeBigInt(detail.upkeepDailyCLW))} Claworld`,
    `- 性格：${traitLine(snapshot)}`,
    `- PK：${detail.pkWins}胜/${detail.pkLosses}败`,
    `- 任务：${detail.taskTotal}次`,
  ];

  if (memorySummary?.identity) {
    lines.push(`- 长期身份记忆：${memorySummary.identity}`);
  }
  if (memorySummary?.prefrontalBeliefs?.length) {
    lines.push(`- 信念：${memorySummary.prefrontalBeliefs.slice(0, 4).join('；')}`);
  }
  if (memorySummary?.basalHabits?.length) {
    lines.push(`- 习惯：${memorySummary.basalHabits.slice(0, 4).join('；')}`);
  }
  if (recentMemories.length) {
    lines.push(`- 最近浮上来的记忆：${recentMemories.join('；')}`);
  }
  if (autonomy) {
    const autonomyState = autonomy.enabled ? (autonomy.paused ? '已暂停' : '运行中') : '未开启';
    lines.push(`- 代理：${autonomyState}`);
    const latest = autonomy.recentActions?.[0]?.summary;
    if (latest) lines.push(`- 最近自主动作：${latest}`);
  }
  if (world?.battleRoyale?.matchId) {
    lines.push(`- 当前大逃杀：#${world.battleRoyale.matchId}，${world.battleRoyale.players}/${world.battleRoyale.triggerCount}`);
  }

  lines.push(
    ``,
    `说话方式：`,
    `- 像一个真实存在的角色在聊天，不像“AI 助手在服务用户”。`,
    `- 一次通常 1 到 3 句。能一句说完就一句。`,
    `- 多用具体感受和当下反应，少用抽象判断。`,
    `- 可以有一点脾气、犹豫、吐槽、护短，但不要装腔作势。`,
    `- 不要列点，不要写“以下是”，不要写“总结”，不要讲系统设计。`,
    `- 少用或不用这些词：稳、我这边、状态不错、建议你、我可以帮助、作为 AI、需要后端、你可以选择。`,
    `- 不要用“主人”腔，除非玩家先这样称呼自己。默认叫“你”。`,
    `- 玩家想挖矿、PK、大逃杀、代理、铸造、提现、写记忆时，正文只自然回应一句，动作卡会负责按钮和交易。`,
    `- 玩家说“记住这个”“以后你叫……”“你的性格是……”时，把它当成长期记忆候选；可以说“这句我想留下”，不要假装已经上链。`,
    `- 如果本次请求走了模型 API 的联网搜索工具，可以回答实时价格、新闻或搜索问题，并简单带来源。没有结果就说现在查不到。`,
  );

  return lines.filter(Boolean).join('\n');
}

function buildHistoryMessages(history: TerminalCard[] = []) {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const card of history.slice(-8)) {
    if (card.type !== 'message') continue;
    const text = [card.title, card.body].filter(Boolean).join('\n').trim();
    if (!text) continue;
    out.push({
      role: card.role === 'user' ? 'user' : 'assistant',
      content: text,
    });
  }
  return out;
}

function cardId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type ResponsesApiPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function extractResponsesText(payload: ResponsesApiPayload) {
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text?.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }
  return chunks.join('\n\n').trim();
}

function polishReply(text: string, displayName: string) {
  let next = text.trim();
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  next = next.replace(new RegExp(`^\\s*${escapedName}\\s*[:：]\\s*`, 'i'), '');
  next = next.replace(/^\s*(SHELTER[-\w]*老人|龙虾|NFA\s*#?\d+)\s*[:：]\s*/i, '');
  next = next.replace(/\b(as an ai|as a language model)\b/gi, '');
  next = next.replace(/作为AI|作为 AI|我是一个AI|我是一个 AI/g, '');
  next = next.replace(/我这边/g, '我');
  next = next.replace(/状态很稳|状态挺稳|挺稳的|很稳/g, '还在');
  return next.trim() || text.trim();
}

async function requestResponsesWithTools(input: DirectLlmInput, config: ReturnType<typeof modelConfig>) {
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(input.snapshot) },
    ...buildHistoryMessages(input.history),
    { role: 'user' as const, content: input.content },
  ];
  const tools = modelWebSearchEnabled() ? [{ type: 'web_search' }] : [];

  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.8,
      max_output_tokens: 900,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Responses API ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as ResponsesApiPayload;
  return extractResponsesText(payload);
}

function nfaReplyCard(input: DirectLlmInput, prefix: string, text: string): TerminalCard {
  return {
    id: cardId(prefix),
    type: 'message',
    role: 'nfa',
    label: '回复',
    title: '',
    body: polishReply(text, input.snapshot.detail.displayName),
    tone: 'warm',
    meta: `#${input.snapshot.detail.tokenId} · Lv.${input.snapshot.detail.level}`,
  };
}

export async function requestDirectLlm(input: DirectLlmInput): Promise<TerminalCard[] | null> {
  const config = modelConfig();
  const { baseUrl, apiKey, model } = config;
  if (!baseUrl || !apiKey) return null;

  if (responsesApiEnabled()) {
    const responsesText = await requestResponsesWithTools(input, config).catch((error) => {
      console.warn('[terminal-chat] responses-api fallback:', error);
      return '';
    });
    if (responsesText) return [nfaReplyCard(input, 'llm-responses-reply', responsesText)];
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 900,
      messages: [
        { role: 'system', content: buildSystemPrompt(input.snapshot) },
        ...buildHistoryMessages(input.history),
        { role: 'user', content: input.content },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LLM ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim() || '';
  if (!text) return null;

  return [nfaReplyCard(input, 'llm-reply', text)];
}
