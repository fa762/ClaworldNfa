import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { requestBackendChat } from '@/app/api/_lib/backend-chat';
import { buildChainQueryCards } from '@/app/api/_lib/chain-queries';
import { requestDirectLlm } from '@/app/api/_lib/direct-llm';
import { getMemorySummaryRuntime, getMemoryTimelineRuntime } from '@/app/api/_lib/memory';
import { getNfaDetail } from '@/app/api/_lib/nfas';
import { buildIntentCards, inferTerminalIntent, type CommandIntent } from '@/app/api/_lib/terminal-chat';
import { buildTokenRiskCards } from '@/app/api/_lib/token-risk';
import { getWorldSummary } from '@/app/api/_lib/world';
import { coerceTerminalCards, type TerminalCard, type TerminalChatStreamEvent } from '@/lib/terminal-cards';

export const runtime = 'nodejs';

function writeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function isActionIntent(intent: CommandIntent) {
  return (
    intent === 'mining' ||
    intent === 'arena' ||
    intent === 'auto' ||
    intent === 'memory' ||
    intent === 'mint' ||
    intent === 'finance' ||
    intent === 'market'
  );
}

function hasActionProposal(cards: TerminalCard[]) {
  return cards.some((card) => card.type === 'proposal' && card.actions.some((action) => action.intent));
}

function proposalCards(cards: TerminalCard[]) {
  return cards.filter((card) => card.type === 'proposal');
}

type TerminalChatBody = {
  content?: string;
  slashCommand?: string;
  owner?: string | null;
  lang?: 'zh' | 'en';
  history?: unknown;
  engine?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  memoryOverride?: {
    summary?: unknown;
    timeline?: unknown;
  };
};

type BackendProxyResponse = {
  cards?: unknown;
  messages?: unknown;
  card?: unknown;
  reply?: string;
  text?: string;
  message?: string;
  content?: string;
  output_text?: string;
};

function backendBaseUrl() {
  return (
    process.env.CLAWORLD_API_URL ||
    process.env.CLAWORLD_BACKEND_API_URL ||
    process.env.CLAWORLD_AI_BACKEND_URL ||
    process.env.AUTONOMY_BACKEND_API_URL ||
    ''
  ).replace(/\/+$/, '');
}

function backendChatPath(tokenId: string) {
  const template = process.env.CLAWORLD_CHAT_PATH || process.env.CLAWORLD_BACKEND_CHAT_PATH || '/chat/{tokenId}/send';
  return template.replace('{tokenId}', encodeURIComponent(tokenId));
}

function backendChatUrl(tokenId: string) {
  const baseUrl = backendBaseUrl();
  if (!baseUrl) return null;
  const path = backendChatPath(tokenId);
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
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

function backendFirstEnabled() {
  if (disabledFlag('CLAWORLD_BACKEND_FIRST', 'CLAWORLD_FRONTEND_BACKEND_FIRST')) return false;
  return true;
}

function localFallbackAllowed() {
  if (enabledFlag('CLAWORLD_FRONTEND_LOCAL_FALLBACK', 'CLAWORLD_ALLOW_VERCEL_CPU_FALLBACK')) return true;
  if (disabledFlag('CLAWORLD_FRONTEND_LOCAL_FALLBACK', 'CLAWORLD_ALLOW_VERCEL_CPU_FALLBACK')) return false;
  return !backendBaseUrl();
}

function backendRequired() {
  return backendFirstEnabled() && !localFallbackAllowed();
}

function backendToolCapabilities() {
  const webSearch = !disabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS');
  return {
    webSearch,
    chainRead: true,
    chainActionCards: true,
    memoryRead: true,
    memoryWriteIntent: true,
    autonomyDirectives: true,
    tokenRiskScan: true,
  };
}

function normalizeBackendJsonCards(payload: BackendProxyResponse, tokenId: string, lang: 'zh' | 'en') {
  const directCard = payload.card ? coerceTerminalCards([payload.card]) : [];
  const cards = directCard.length ? directCard : coerceTerminalCards(payload.cards || payload.messages);
  if (cards.length) return cards;

  const text = (payload.reply || payload.text || payload.message || payload.content || payload.output_text || '').trim();
  if (!text) return [];

  return [
    {
      id: `backend-reply-${tokenId}-${Date.now().toString(36)}`,
      type: 'message' as const,
      role: 'nfa' as const,
      label: lang === 'en' ? 'Reply' : '回复',
      title: '',
      body: text,
      tone: 'warm' as const,
    },
  ];
}

function sseFromCards(cards: TerminalCard[], encoder: TextEncoder) {
  return new ReadableStream({
    start(controller) {
      for (const card of cards) {
        const payload: TerminalChatStreamEvent = { type: 'card', card };
        controller.enqueue(encoder.encode(writeEvent('card', payload)));
      }
      const donePayload: TerminalChatStreamEvent = {
        type: 'done',
        messageId: cards.at(-1)?.id || `done-${Date.now()}`,
      };
      controller.enqueue(encoder.encode(writeEvent('done', donePayload)));
      controller.close();
    },
  });
}

function sseError(message: string, encoder: TextEncoder) {
  return new ReadableStream({
    start(controller) {
      const payload: TerminalChatStreamEvent = { type: 'error', message };
      controller.enqueue(encoder.encode(writeEvent('error', payload)));
      controller.close();
    },
  });
}

async function proxyToBackend(tokenId: string, body: TerminalChatBody, encoder: TextEncoder) {
  const url = backendChatUrl(tokenId);
  if (!url || !backendFirstEnabled()) return null;

  const lang = body.lang === 'en' ? 'en' : 'zh';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const token =
    process.env.CLAWORLD_API_TOKEN ||
    process.env.CLAWORLD_BACKEND_API_TOKEN ||
    process.env.CLAWORLD_AI_BACKEND_TOKEN ||
    '';
  if (token) headers.authorization = `Bearer ${token}`;

  const capabilities = backendToolCapabilities();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...body,
      tokenId,
      lang,
      language: lang,
      uiLang: lang,
      replyLanguage: lang,
      backendFirst: true,
      frontendRole: 'display_only',
      capabilities,
      tools: {
        webSearch: capabilities.webSearch,
        web_search: capabilities.webSearch,
        search: capabilities.webSearch,
        chainRead: true,
        actionCards: true,
        memoryRead: true,
        memoryWriteIntent: true,
        autonomyDirectives: true,
        tokenRiskScan: true,
        caScan: true,
      },
      toolPolicy: {
        runtime: 'backend_only',
        frontend: 'display_only',
        chainWrite: 'intent_card_only',
        memoryWrite: 'backend_validated',
        tokenRiskScan: 'backend_only',
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Backend chat API ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') && response.body) {
    return new Response(response.body, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  }

  const payload = (await response.json()) as BackendProxyResponse;
  const cards = normalizeBackendJsonCards(payload, tokenId, lang);
  return new Response(sseFromCards(cards, encoder), {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

function isQuestionLikeRequest(content: string, slashCommand?: string) {
  if (slashCommand) return false;
  const source = content.toLowerCase();
  return /多少|几|查|查询|看一下|看看|当前|现在|本月|这个月|有没有|是不是|是否|为什么|原因|怎么|如何|规则|上限|限制|可不可以|能不能|还能|剩多少|\?|？|why|how|what|current|now|month|limit|cap|balance|status|record|stats|claim|reward|earn/.test(
    source,
  );
}

function isExplicitActionRequest(content: string, slashCommand?: string) {
  if (slashCommand) return true;
  const source = content.toLowerCase();
  const actionVerb =
    /帮我|我要|我想|想要|去|开|打开|开始|执行|参加|加入|进入|打一场|来一场|领取|充值|提现|买|购买|挂卖|撤单|可以.*吗|能不能|能否|可不可以|要不要|should i|can i|could you|please|let'?s|open|start|execute|join|enter|claim|deposit|withdraw|buy|list|cancel/.test(source);
  const actionTarget =
    /挖矿|任务|竞技|pk|大逃杀|battle|代理|自治|auto|记忆|memory|铸造|mint|资金|充值|提现|deposit|withdraw|市场|market|挂单/.test(source);
  return actionVerb && actionTarget;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const encoder = new TextEncoder();

  try {
    const { tokenId } = await context.params;
    const body = (await request.json()) as TerminalChatBody;

    const content = body.content?.trim() || '';
    const slashCommand = body.slashCommand?.trim() || undefined;
    const lang = body.lang === 'en' ? 'en' : 'zh';
    if (!content && !slashCommand) {
      return new Response(JSON.stringify({ error: 'Missing content.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    if (backendRequired() && !backendChatUrl(tokenId)) {
      return new Response(sseError('Backend API is not configured: set CLAWORLD_API_URL.', encoder), {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      });
    }

    try {
      const backendResponse = await proxyToBackend(tokenId, body, encoder);
      if (backendResponse) return backendResponse;
    } catch (error) {
      console.warn('[terminal-chat] backend proxy failed:', error);
      if (!localFallbackAllowed()) {
        return new Response(sseError(error instanceof Error ? error.message : 'Backend unavailable', encoder), {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
          },
        });
      }
    }

    const [detail, world, autonomy, memorySummary, memoryTimeline] = await Promise.all([
      getNfaDetail(tokenId, body.owner),
      getWorldSummary().catch(() => null),
      getAutonomyStatus(Number(tokenId)).catch(() => null),
      getMemorySummaryRuntime(Number(tokenId)),
      getMemoryTimelineRuntime(Number(tokenId), 3),
    ]);

    const snapshot = {
      detail,
      world,
      autonomy,
      memorySummary,
      memoryTimeline,
    };

    if (body.memoryOverride?.summary && typeof body.memoryOverride.summary === 'object') {
      snapshot.memorySummary = body.memoryOverride.summary as typeof snapshot.memorySummary;
    }
    if (Array.isArray(body.memoryOverride?.timeline)) {
      snapshot.memoryTimeline = body.memoryOverride.timeline as typeof snapshot.memoryTimeline;
    }

    const history = coerceTerminalCards(body.history);

    const intent = inferTerminalIntent(content, slashCommand);
    const questionLike = isQuestionLikeRequest(content, slashCommand);
    const explicitActionRequest = isActionIntent(intent) && isExplicitActionRequest(content, slashCommand);
    const shouldOpenAction = isActionIntent(intent) && (!questionLike || explicitActionRequest);

    const tokenRiskCards = await buildTokenRiskCards({
      input: content,
      slashCommand,
      lang,
    });

    const chainQueryCards = tokenRiskCards?.length
      ? null
      : await buildChainQueryCards({
      input: content,
      slashCommand,
      owner: body.owner,
      snapshot,
      lang,
    });
    const isChainQuery = Boolean(chainQueryCards?.length);
    const isTokenRiskQuery = Boolean(tokenRiskCards?.length);

    let cards = tokenRiskCards?.length ? tokenRiskCards : chainQueryCards?.length ? chainQueryCards : null;

    const backendCards = cards
      ? null
      : await requestBackendChat({
          tokenId,
          owner: body.owner,
          content,
          slashCommand,
          history,
          snapshot,
          engine: body.engine,
          lang,
        }).catch((error) => {
          console.warn('[terminal-chat] backend fallback:', error);
          return null;
        });

    if (!cards && backendCards?.length) cards = backendCards;

    const shouldAttachActionProposal = shouldOpenAction && ((!isChainQuery && !isTokenRiskQuery) || explicitActionRequest);

    if (cards && shouldAttachActionProposal && !hasActionProposal(cards)) {
      cards = [...cards, ...proposalCards(buildIntentCards(intent, content, snapshot, lang))];
    }

    if (!cards && !shouldOpenAction) {
      const llmCards = await requestDirectLlm({
        tokenId,
        content,
        history,
        snapshot,
        engine: body.engine,
        lang,
      }).catch((error) => {
        console.warn('[terminal-chat] direct-llm fallback:', error);
        return null;
      });
      if (llmCards?.length) cards = llmCards;
    }

    if (cards && shouldAttachActionProposal && !hasActionProposal(cards)) {
      cards = [...cards, ...proposalCards(buildIntentCards(intent, content, snapshot, lang))];
    }

    if (!cards) {
      cards = buildIntentCards(shouldOpenAction ? intent : 'unknown', content, snapshot, lang);
    }

    const stream = new ReadableStream({
      start(controller) {
        for (const card of cards) {
          const payload: TerminalChatStreamEvent = { type: 'card', card };
          controller.enqueue(encoder.encode(writeEvent('card', payload)));
        }

        const donePayload: TerminalChatStreamEvent = {
          type: 'done',
          messageId: cards.at(-1)?.id || `done-${Date.now()}`,
        };
        controller.enqueue(encoder.encode(writeEvent('done', donePayload)));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  } catch (error) {
    const stream = new ReadableStream({
      start(controller) {
        const payload: TerminalChatStreamEvent = {
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        controller.enqueue(encoder.encode(writeEvent('error', payload)));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  }
}
