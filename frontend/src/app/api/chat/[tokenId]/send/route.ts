import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { requestBackendChat } from '@/app/api/_lib/backend-chat';
import { requestDirectLlm } from '@/app/api/_lib/direct-llm';
import { getMemorySummary, getMemoryTimeline } from '@/app/api/_lib/memory';
import { getNfaDetail } from '@/app/api/_lib/nfas';
import { buildIntentCards, inferTerminalIntent } from '@/app/api/_lib/terminal-chat';
import { getWorldSummary } from '@/app/api/_lib/world';
import type { TerminalChatStreamEvent } from '@/lib/terminal-cards';

export const runtime = 'nodejs';

function writeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
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
      history?: unknown;
      engine?: {
        provider?: string;
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      };
    };

    const content = body.content?.trim() || '';
    const slashCommand = body.slashCommand?.trim() || undefined;
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
      (() => {
        try {
          return Promise.resolve(getMemorySummary(Number(tokenId)));
        } catch {
          return Promise.resolve(null);
        }
      })(),
      (() => {
        try {
          return Promise.resolve(getMemoryTimeline(Number(tokenId), 3));
        } catch {
          return Promise.resolve([]);
        }
      })(),
    ]);

    const snapshot = {
      detail,
      world,
      autonomy,
      memorySummary,
      memoryTimeline,
    };

    const history = Array.isArray(body.history) ? (body.history as any) : [];

    const backendCards = await requestBackendChat({
      tokenId,
      owner: body.owner,
      content,
      slashCommand,
      history,
      snapshot,
      engine: body.engine,
    }).catch((error) => {
      console.warn('[terminal-chat] backend fallback:', error);
      return null;
    });

    let cards = backendCards?.length ? backendCards : null;

    if (!cards) {
      const llmCards = await requestDirectLlm({
        tokenId,
        content,
        history,
        snapshot,
      }).catch((error) => {
        console.warn('[terminal-chat] direct-llm fallback:', error);
        return null;
      });
      if (llmCards?.length) cards = llmCards;
    }

    if (!cards) {
      cards = buildIntentCards(
        inferTerminalIntent(content, slashCommand),
        content,
        snapshot,
      );
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
