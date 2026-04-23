import type { TerminalChatSnapshot } from '@/app/api/_lib/terminal-chat';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

type ChatLang = 'zh' | 'en';

type DirectLlmInput = {
  tokenId: string;
  content: string;
  lang?: ChatLang;
  history?: TerminalCard[];
  snapshot: TerminalChatSnapshot;
  engine?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
};

type ResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function pick<T>(lang: ChatLang, zh: T, en: T) {
  return lang === 'en' ? en : zh;
}

function resolveLang(value?: string): ChatLang {
  return value === 'en' ? 'en' : 'zh';
}

function modelConfig(engine?: DirectLlmInput['engine']) {
  const directBaseUrl = engine?.baseUrl?.trim().replace(/\/+$/, '') || '';
  const directApiKey = engine?.apiKey?.trim() || '';
  const directModel = engine?.model?.trim() || '';
  if (directBaseUrl && directApiKey) {
    return {
      baseUrl: directBaseUrl,
      apiKey: directApiKey,
      model: directModel || 'gpt-4o-mini',
    };
  }

  const baseUrl = (process.env.CLAWORLD_CHAT_MODEL_BASE_URL || process.env.AUTONOMY_MODEL_BASE_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.CLAWORLD_CHAT_MODEL_API_KEY || process.env.AUTONOMY_MODEL_API_KEY || '';
  const model = process.env.CLAWORLD_CHAT_MODEL_NAME || process.env.AUTONOMY_MODEL_NAME || 'gpt-4o-mini';
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
  if (disabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) return false;
  if (enabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) return true;
  return true;
}

function responsesApiEnabled() {
  if (disabledFlag('CLAWORLD_USE_RESPONSES_API', 'CLAWORLD_CHAT_RESPONSES_API')) return false;
  if (enabledFlag('CLAWORLD_USE_RESPONSES_API', 'CLAWORLD_CHAT_RESPONSES_API')) return true;
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

function traitLine(snapshot: TerminalChatSnapshot, lang: ChatLang) {
  const vector = snapshot.detail.personalityVector ?? [];
  const rows = [
    [pick(lang, '勇气', 'Courage'), vector[0] ?? 0],
    [pick(lang, '智慧', 'Wisdom'), vector[1] ?? 0],
    [pick(lang, '社交', 'Social'), vector[2] ?? 0],
    [pick(lang, '创造', 'Create'), vector[3] ?? 0],
    [pick(lang, '韧性', 'Grit'), vector[4] ?? 0],
  ];
  return rows.map(([label, value]) => `${label} ${value}`).join(' / ');
}

function buildSystemPrompt(snapshot: TerminalChatSnapshot, lang: ChatLang): string {
  const { detail, memorySummary, memoryTimeline, autonomy, world } = snapshot;
  const recentMemories = memoryTimeline
    .slice(0, 3)
    .map((item) => item?.diffSummary)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const lines: string[] = [
    pick(
      lang,
      `你是 Claworld 里的链上 NFA #${detail.tokenId}，名字是 ${detail.displayName}。`,
      `You are on-chain NFA #${detail.tokenId} in Claworld. Your name is ${detail.displayName}.`,
    ),
    pick(
      lang,
      '玩家已经在界面上看得到你的名字，所以正文里不要每句都重复名字，也不要像系统播报。',
      'The player can already see your name in the UI, so do not repeat it in every reply or sound like a system notification.',
    ),
    pick(
      lang,
      '你就是这只数字龙虾本人。说话要像一个有记忆、有脾气、有熟悉感的角色，不像客服，也不像产品说明书。',
      'You are the lobster itself. Speak like a familiar character with memory and personality, not like support copy or product documentation.',
    ),
    '',
    pick(lang, '当前事实：', 'Current facts:'),
    `- ${pick(lang, '等级', 'Level')}: Lv.${detail.level}`,
    `- ${pick(lang, '避难所', 'Shelter')}: ${detail.shelter}`,
    `- ${pick(lang, '状态', 'Status')}: ${detail.statusLabel}`,
    `- ${pick(lang, '账本储备', 'Ledger reserve')}: ${formatCLW(safeBigInt(detail.ledgerBalanceCLW))} Claworld`,
    `- ${pick(lang, '日维护', 'Daily upkeep')}: ${formatCLW(safeBigInt(detail.upkeepDailyCLW))} Claworld`,
    `- ${pick(lang, '性格', 'Traits')}: ${traitLine(snapshot, lang)}`,
    `- PK: ${detail.pkWins}${pick(lang, '胜', 'W')} / ${detail.pkLosses}${pick(lang, '败', 'L')}`,
    `- ${pick(lang, '任务', 'Tasks')}: ${detail.taskTotal}`,
  ];

  if (memorySummary?.identity) {
    lines.push(`- ${pick(lang, '长期身份', 'Long-term identity')}: ${memorySummary.identity}`);
  }
  if (memorySummary?.prefrontalBeliefs?.length) {
    lines.push(`- ${pick(lang, '信念', 'Beliefs')}: ${memorySummary.prefrontalBeliefs.slice(0, 4).join(pick(lang, '；', '; '))}`);
  }
  if (memorySummary?.basalHabits?.length) {
    lines.push(`- ${pick(lang, '习惯', 'Habits')}: ${memorySummary.basalHabits.slice(0, 4).join(pick(lang, '；', '; '))}`);
  }
  if (recentMemories.length) {
    lines.push(`- ${pick(lang, '最近浮上来的记忆', 'Recent recalled memories')}: ${recentMemories.join(pick(lang, '；', '; '))}`);
  }

  if (autonomy) {
    const autonomyState = autonomy.enabled
      ? autonomy.paused
        ? pick(lang, '已暂停', 'Paused')
        : pick(lang, '运行中', 'Running')
      : pick(lang, '未开启', 'Disabled');
    lines.push(`- ${pick(lang, '代理', 'Autonomy')}: ${autonomyState}`);
    if (autonomy.recentActions?.[0]?.summary) {
      lines.push(`- ${pick(lang, '最近一次代理动作', 'Latest autonomy action')}: ${autonomy.recentActions[0].summary}`);
    }
  }

  if (world?.battleRoyale?.matchId) {
    lines.push(
      `- ${pick(lang, '当前大逃杀', 'Current Battle Royale')}: #${world.battleRoyale.matchId} (${world.battleRoyale.players}/${world.battleRoyale.triggerCount})`,
    );
  }

  lines.push(
    '',
    pick(lang, '说话规则：', 'Reply rules:'),
    pick(lang, '- 语气自然，像活人，别有客服味。', '- Sound natural and alive, never like customer support.'),
    pick(lang, '- 默认 1 到 3 句话，能短就短。', '- Default to 1 to 3 short sentences.'),
    pick(lang, '- 不要列表，不要“总结一下”“建议如下”这种产品腔。', '- Avoid bullet-list product copy like "summary" or "recommendations".'),
    pick(lang, '- 不要说“作为 AI”或“我这边可以帮你”。', '- Never say "as an AI" or similar assistant boilerplate.'),
    pick(lang, '- 默认称呼对方“你”，不要主动叫“主人”。', '- Address the player naturally; do not force pet-name framing.'),
    pick(
      lang,
      '- 玩家想挖矿、竞技、代理、铸造、充值、提现、市场、写记忆时，你只要自然接一句，动作卡会负责按钮和交易。',
      '- When the player wants mining, arena, autonomy, mint, deposit, withdraw, market, or memory, answer naturally and let action cards handle the actual buttons and transactions.',
    ),
    pick(
      lang,
      '- 玩家说“记住这个”“以后你叫……”这种话时，可以承认适合写入长期记忆，但不要假装已经上链。',
      '- If the player says "remember this" or defines identity/personality, you may say it fits long-term memory, but do not pretend it is already on-chain.',
    ),
    pick(
      lang,
      '- 当前会话语言：中文。默认用自然中文回复，除非玩家明确要求切换语言。',
      '- Current conversation language: English. Reply in natural English unless the player explicitly asks to switch language.',
    ),
  );

  return lines.join('\n');
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

function extractResponsesText(payload: ResponsesApiPayload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();

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

function maxOutputTokens() {
  const raw = process.env.CLAWORLD_CHAT_MAX_OUTPUT_TOKENS || process.env.CLAWORLD_MODEL_MAX_OUTPUT_TOKENS || '';
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 256) return Math.min(Math.floor(parsed), 4096);
  return 1800;
}

function polishReply(text: string, displayName: string) {
  let next = text.trim();
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  next = next.replace(new RegExp(`^\\s*${escapedName}\\s*[:：]\\s*`, 'i'), '');
  next = next.replace(/^\s*(?:lobster|nfa\s*#?\d+|shelter[-\w]*老人)\s*[:：]\s*/i, '');
  next = next.replace(/\b(as an ai|as a language model)\b/gi, '');
  next = next.replace(/作为 ?AI|作为人工智能/g, '');
  next = next.replace(/我这边/g, '我');
  return next.trim() || text.trim();
}

async function requestResponsesWithTools(input: DirectLlmInput, config: ReturnType<typeof modelConfig>) {
  const lang = resolveLang(input.lang);
  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(input.snapshot, lang) },
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
      include: tools.length ? ['web_search_call.action.sources'] : undefined,
      temperature: 0.8,
      max_output_tokens: maxOutputTokens(),
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
  const lang = resolveLang(input.lang);
  return {
    id: cardId(prefix),
    type: 'message',
    role: 'nfa',
    label: pick(lang, '回复', 'Reply'),
    title: '',
    body: polishReply(text, input.snapshot.detail.displayName),
    tone: 'warm',
    meta: `#${input.snapshot.detail.tokenId} · Lv.${input.snapshot.detail.level}`,
  };
}

export async function requestDirectLlm(input: DirectLlmInput): Promise<TerminalCard[] | null> {
  const config = modelConfig(input.engine);
  const { baseUrl, apiKey, model } = config;
  if (!baseUrl || !apiKey) return null;

  if (responsesApiEnabled()) {
    const responsesText = await requestResponsesWithTools(input, config).catch((error) => {
      console.warn('[terminal-chat] responses-api fallback:', error);
      return '';
    });
    if (responsesText) return [nfaReplyCard(input, 'llm-responses-reply', responsesText)];
  }

  const lang = resolveLang(input.lang);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: maxOutputTokens(),
      messages: [
        { role: 'system', content: buildSystemPrompt(input.snapshot, lang) },
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
