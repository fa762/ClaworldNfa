import type { TerminalChatSnapshot } from '@/app/api/_lib/terminal-chat';
import type { TerminalCard } from '@/lib/terminal-cards';

type BackendChatRequest = {
  tokenId: string;
  owner?: string | null;
  content: string;
  slashCommand?: string;
  history?: TerminalCard[];
  snapshot: TerminalChatSnapshot;
  engine?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
};

type BackendToolCapabilities = {
  webSearch: boolean;
  chainRead: boolean;
  chainActionCards: boolean;
  memoryRead: boolean;
  memoryWriteIntent: boolean;
  autonomyDirectives: boolean;
};

type BackendChatResponse = {
  cards?: TerminalCard[];
  messages?: TerminalCard[];
  reply?: string;
  text?: string;
};

function backendBaseUrl() {
  const value =
    process.env.CLAWORLD_API_URL ||
    process.env.CLAWORLD_BACKEND_API_URL ||
    process.env.CLAWORLD_AI_BACKEND_URL ||
    process.env.AUTONOMY_BACKEND_API_URL ||
    '';
  return value.replace(/\/+$/, '');
}

function backendChatPath(tokenId: string) {
  const template =
    process.env.CLAWORLD_CHAT_PATH ||
    process.env.CLAWORLD_BACKEND_CHAT_PATH ||
    '/chat/{tokenId}/send';
  return template.replace('{tokenId}', encodeURIComponent(tokenId));
}

function buildUrl(tokenId: string) {
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

function webSearchEnabled() {
  if (disabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) {
    return false;
  }
  if (enabledFlag('CLAWORLD_ENABLE_WEB_TOOLS', 'CLAWORLD_CHAT_WEB_SEARCH', 'CLAWORLD_AI_WEB_TOOLS')) {
    return true;
  }
  return true;
}

function toolCapabilities(): BackendToolCapabilities {
  return {
    webSearch: webSearchEnabled(),
    chainRead: true,
    chainActionCards: true,
    memoryRead: true,
    memoryWriteIntent: true,
    autonomyDirectives: true,
  };
}

function polishBackendText(text: string) {
  const polished = text
    .replace(/^\s*(?:SHELTER[-\w]*|NFA\s*#?\d+|#\d+|龙虾|伙伴|助手|AI)\s*[：:]\s*/i, '')
    .replace(/^\s*[\w\u4e00-\u9fa5]{1,16}\s*[：:]\s*/u, '')
    .replace(/作为(?:一个)?AI(?:助手|模型)?[，,]?\s*/g, '')
    .replace(/我这边/g, '我')
    .trim();
  return polished || text.trim();
}

function normalizeBackendCard(card: TerminalCard): TerminalCard {
  if (card.type !== 'message') return card;
  const sourceText = [card.body, card.title].filter((value) => typeof value === 'string' && value.trim().length > 0).join('\n').trim();
  return {
    ...card,
    title: '',
    body: polishBackendText(sourceText),
  };
}

function normalizeBackendCards(payload: BackendChatResponse, tokenId: string): TerminalCard[] {
  const cards = payload.cards || payload.messages;
  if (Array.isArray(cards)) {
    return cards.map(normalizeBackendCard);
  }

  const text = polishBackendText(payload.reply || payload.text || '');
  if (!text) {
    return [];
  }

  return [
    {
      id: `backend-reply-${tokenId}-${Date.now().toString(36)}`,
      type: 'message',
      role: 'nfa',
      label: '回复',
      title: '',
      body: text,
      tone: 'warm',
    },
  ];
}

function parseSseCards(raw: string): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const blocks = raw.split('\n\n');

  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) continue;

    try {
      const payload = JSON.parse(dataLines.join('\n')) as unknown;
      const value = payload as { type?: string; card?: TerminalCard };
      if (value.type === 'card' && value.card) {
        cards.push(normalizeBackendCard(value.card));
      }
    } catch {
      // Ignore malformed backend event blocks and keep parsing the rest.
    }
  }

  return cards;
}

export async function requestBackendChat(input: BackendChatRequest): Promise<TerminalCard[] | null> {
  const url = buildUrl(input.tokenId);
  if (!url) return null;
  const capabilities = toolCapabilities();
  const allowedTools = [
    capabilities.webSearch ? 'web_search' : null,
    'chain_read',
    'action_cards',
    'memory_read',
    'memory_write_intent',
    'autonomy_directives',
  ].filter((item): item is string => Boolean(item));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const token =
    process.env.CLAWORLD_API_TOKEN ||
    process.env.CLAWORLD_BACKEND_API_TOKEN ||
    process.env.CLAWORLD_AI_BACKEND_TOKEN ||
    '';
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tokenId: input.tokenId,
      owner: input.owner,
      content: input.content,
      slashCommand: input.slashCommand,
      history: input.history ?? [],
      context: {
        nfa: input.snapshot.detail,
        memory: input.snapshot.memorySummary,
        memoryTimeline: input.snapshot.memoryTimeline,
        autonomy: input.snapshot.autonomy,
        world: input.snapshot.world,
      },
      capabilities,
      tools: {
        webSearch: capabilities.webSearch,
        web_search: capabilities.webSearch,
        search: capabilities.webSearch,
        chainRead: capabilities.chainRead,
        actionCards: capabilities.chainActionCards,
        memoryRead: capabilities.memoryRead,
        memoryWriteIntent: capabilities.memoryWriteIntent,
        autonomyDirectives: capabilities.autonomyDirectives,
      },
      allowedTools,
      toolPermissions: {
        web_search: capabilities.webSearch ? 'allowed' : 'disabled',
        chain_read: 'allowed',
        action_cards: 'allowed',
        memory_read: 'allowed',
        memory_write_intent: 'allowed',
        autonomy_directives: 'allowed',
      },
      toolPolicy: {
        webSearch: 'backend_only',
        chainWrite: 'intent_card_only',
        memoryWrite: 'backend_validated',
      },
      engine: input.engine?.apiKey
        ? {
            mode: 'byok',
            provider: input.engine.provider,
            apiKey: input.engine.apiKey,
            baseUrl: input.engine.baseUrl,
            model: input.engine.model,
          }
        : {
            mode: 'project',
            provider: input.engine?.provider,
            model: input.engine?.model,
          },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Backend chat API ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    return parseSseCards(await response.text());
  }

  const payload = (await response.json()) as BackendChatResponse;
  return normalizeBackendCards(payload, input.tokenId);
}
