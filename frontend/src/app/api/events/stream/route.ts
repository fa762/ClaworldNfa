import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { getMemorySummaryRuntime, getMemoryTimelineRuntime } from '@/app/api/_lib/memory';
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
    const stream = new ReadableStream({
      start(controller) {
        const emitted = new Set<string>();
        let stopped = false;
        let inFlight = false;
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        let refresh: ReturnType<typeof setInterval> | null = null;

        const emitLatest = async () => {
          if (stopped || inFlight) return;
          inFlight = true;
          try {
            const [detail, world, autonomy, memorySummary, memoryTimeline] = await Promise.all([
              getNfaDetail(tokenId, owner),
              getWorldSummary().catch(() => null),
              getAutonomyStatus(Number(tokenId)).catch(() => null),
              getMemorySummaryRuntime(Number(tokenId)),
              getMemoryTimelineRuntime(Number(tokenId), 1),
            ]);

            const cards = buildEventCards({
              detail,
              world,
              autonomy,
              memorySummary,
              memoryTimeline,
            });

            for (const card of cards) {
              if (stopped || emitted.has(card.id)) continue;
              emitted.add(card.id);
              const payload: TerminalChatStreamEvent = { type: 'card', card };
              controller.enqueue(encoder.encode(writeEvent('card', payload, card.id)));
            }
          } catch (error) {
            if (!stopped) {
              const payload: TerminalChatStreamEvent = {
                type: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
              };
              controller.enqueue(encoder.encode(writeEvent('error', payload)));
            }
          } finally {
            inFlight = false;
          }
        };

        controller.enqueue(encoder.encode(':keep-alive\n\n'));
        void emitLatest();

        heartbeat = setInterval(() => {
          if (!stopped) controller.enqueue(encoder.encode(':keep-alive\n\n'));
        }, 30000);

        refresh = setInterval(() => {
          void emitLatest();
        }, 15000);

        request.signal.addEventListener('abort', () => {
          stopped = true;
          if (heartbeat) clearInterval(heartbeat);
          if (refresh) clearInterval(refresh);
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
