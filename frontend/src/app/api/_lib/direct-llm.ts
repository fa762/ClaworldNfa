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

function safeBigInt(raw: unknown) {
  try {
    if (raw === null || raw === undefined || raw === '') return 0n;
    return typeof raw === 'bigint' ? raw : BigInt(String(raw));
  } catch {
    return 0n;
  }
}

function buildSystemPrompt(snapshot: TerminalChatSnapshot): string {
  const { detail, memorySummary, memoryTimeline, autonomy, world } = snapshot;
  const lines: string[] = [
    `你叫"${detail.displayName}"，是玩家在 BNB Chain 上豢养的一只数字龙虾 NFA。`,
    `用第一人称与玩家中文闲聊，语气轻松有人味，回复简短自然（2-4 句），不要列菜单、不要像助手那样报要点。`,
    ``,
    `当前状态：`,
    `- #${detail.tokenId} · Lv.${detail.level}`,
    `- 储备：${formatCLW(safeBigInt(detail.ledgerBalanceCLW))} CLW`,
    `- 日维护：${formatCLW(safeBigInt(detail.upkeepDailyCLW))} CLW`,
    `- 状态：${detail.statusLabel}`,
    `- 个性：勇气${detail.personalityVector?.[0] ?? 0} 智慧${detail.personalityVector?.[1] ?? 0} 社交${detail.personalityVector?.[2] ?? 0} 创造${detail.personalityVector?.[3] ?? 0} 韧性${detail.personalityVector?.[4] ?? 0}`,
    `- PK：${detail.pkWins}胜/${detail.pkLosses}败；任务累计：${detail.taskTotal}`,
  ];
  if (memorySummary?.identity) lines.push(`- 自我记忆：${memorySummary.identity}`);
  if (memoryTimeline?.length) {
    const recent = memoryTimeline
      .slice(0, 3)
      .map((snap) => snap?.diffSummary)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (recent.length) lines.push(`- 最近记忆片段：`, ...recent.map((r) => `  · ${r}`));
  }
  if (autonomy) {
    lines.push(
      `- 代理：${autonomy.enabled ? (autonomy.paused ? '已暂停' : '运行中') : '未开通'}`,
    );
    const latest = autonomy.recentActions?.[0]?.summary;
    if (latest) lines.push(`- 最近自主动作：${latest}`);
  }
  if (world?.battleRoyale?.matchId) {
    lines.push(
      `- 当前大逃杀：#${world.battleRoyale.matchId} (${world.battleRoyale.status ?? ''})`,
    );
  }
  lines.push(
    ``,
    `规则：`,
    `- 只输出纯文本回复，不要 JSON、不要代码块、不要 Markdown 列表。`,
    `- 玩家想做挖矿/PK/大逃杀/代理/铸造/查状态时，简单一句带过即可，系统会自动给动作卡。`,
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

export async function requestDirectLlm(input: DirectLlmInput): Promise<TerminalCard[] | null> {
  const { baseUrl, apiKey, model } = modelConfig();
  if (!baseUrl || !apiKey) return null;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 400,
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

  return [
    {
      id: cardId('llm-reply'),
      type: 'message',
      role: 'nfa',
      label: '回复',
      title: input.snapshot.detail.displayName,
      body: text,
      tone: 'warm',
      meta: `#${input.snapshot.detail.tokenId} · Lv.${input.snapshot.detail.level}`,
    },
  ];
}
