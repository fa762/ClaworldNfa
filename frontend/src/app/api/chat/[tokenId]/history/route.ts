import { NextResponse } from 'next/server';

import { getAutonomyStatus } from '@/app/api/_lib/autonomy';
import { getMemorySummaryRuntime, getMemoryTimelineRuntime } from '@/app/api/_lib/memory';
import { getNfaDetail } from '@/app/api/_lib/nfas';
import { buildSeedCards } from '@/app/api/_lib/terminal-chat';
import { getWorldSummary } from '@/app/api/_lib/world';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await context.params;
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');

    const [detail, world, autonomy, memorySummary, memoryTimeline] = await Promise.all([
      getNfaDetail(tokenId, owner),
      getWorldSummary().catch(() => null),
      getAutonomyStatus(Number(tokenId)).catch(() => null),
      getMemorySummaryRuntime(Number(tokenId)),
      getMemoryTimelineRuntime(Number(tokenId), 3),
    ]);

    return NextResponse.json({
      messages: buildSeedCards({
        detail,
        world,
        autonomy,
        memorySummary,
        memoryTimeline,
      }),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Invalid token id' ? 400 : message.includes('does not belong') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
