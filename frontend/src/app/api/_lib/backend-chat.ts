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

function normalizeBackendCards(payload: BackendChatResponse, tokenId: string): TerminalCard[] {
  const cards = payload.cards || payload.messages;
  if (Array.isArray(cards)) {
    return cards;
  }

  const text = payload.reply || payload.text;
  if (!text) {
    return [];
  }

  return [
    {
      id: `backend-reply-${tokenId}-${Date.now().toString(36)}`,
      type: 'message',
      role: 'nfa',
      label: '回复',
      title: '我听到了',
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
        cards.push(value.card);
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
