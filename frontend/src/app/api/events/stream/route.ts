import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { getMemorySummary, getMemoryTimeline } from '@/app/api/_lib/memory';
import { getNfaDetail } from '@/app/api/_lib/nfas';
import { buildEventCards } from '@/app/api/_lib/terminal-chat';
import { getWorldSummary } from '@/app/api/_lib/world';
import type { TerminalChatStreamEvent } from '@/lib/terminal-cards';

export const runtime = 'nodejs';

function writeEvent(event: string, payload: unknown, id?: string) {
  const prefix = id ? `id: ${id}\n` : '';
  return `${prefix}event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  const tokenId = url.searchParams.get('tokenId');
  const owner = url.searchParams.get('owner');

  if (!tokenId) {
    return new Response(JSON.stringify({ error: 'Missing tokenId query parameter.' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const [detail, world, autonomy, memorySummary, memoryTimeline] = await Promise.all([
      getNfaDetail(tokenId, owner),
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
          return Promise.resolve(getMemoryTimeline(Number(tokenId), 1));
        } catch {
          return Promise.resolve([]);
        }
      })(),
    ]);

    const cards = buildEventCards({
      detail,
      world,
      autonomy,
      memorySummary,
      memoryTimeline,
    });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(':keep-alive\n\n'));

        for (const card of cards) {
          const payload: TerminalChatStreamEvent = { type: 'card', card };
          controller.enqueue(encoder.encode(writeEvent('card', payload, card.id)));
        }

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(':keep-alive\n\n'));
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {},
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
