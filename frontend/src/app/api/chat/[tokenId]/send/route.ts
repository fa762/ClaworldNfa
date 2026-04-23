import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { requestBackendChat } from '@/app/api/_lib/backend-chat';
import { buildChainQueryCards } from '@/app/api/_lib/chain-queries';
import { requestDirectLlm } from '@/app/api/_lib/direct-llm';
import { getMemorySummaryRuntime, getMemoryTimelineRuntime } from '@/app/api/_lib/memory';
import { getNfaDetail } from '@/app/api/_lib/nfas';
import { buildIntentCards, inferTerminalIntent, type CommandIntent } from '@/app/api/_lib/terminal-chat';
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

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const encoder = new TextEncoder();

  try {
    const { tokenId } = await context.params;
    const body = (await request.json()) as {
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

    const content = body.content?.trim() || '';
    const slashCommand = body.slashCommand?.trim() || undefined;
    const lang = body.lang === 'en' ? 'en' : 'zh';
    if (!content && !slashCommand) {
      return new Response(JSON.stringify({ error: 'Missing content.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
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
    const shouldOpenAction = isActionIntent(intent);

    const chainQueryCards = await buildChainQueryCards({
      input: content,
      slashCommand,
      owner: body.owner,
      snapshot,
      lang,
    });
    const isChainQuery = Boolean(chainQueryCards?.length);

    let cards = chainQueryCards?.length ? chainQueryCards : null;

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

    if (cards && shouldOpenAction && !isChainQuery && !hasActionProposal(cards)) {
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

    if (cards && shouldOpenAction && !isChainQuery && !hasActionProposal(cards)) {
      cards = [...cards, ...proposalCards(buildIntentCards(intent, content, snapshot, lang))];
    }

    if (!cards) {
      cards = buildIntentCards(intent, content, snapshot, lang);
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
