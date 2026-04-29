import { NextResponse } from 'next/server';

import { getLearningInfo, parseTokenId } from '@/app/api/_lib/agent-runtime';
import { getMemorySummaryRuntime } from '@/app/api/_lib/memory';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokenId = parseTokenId(id);
    const [learning, summary] = await Promise.all([
      getLearningInfo(tokenId).catch(() => null),
      getMemorySummaryRuntime(tokenId).catch(() => null),
    ]);

    return NextResponse.json({
      tokenId: String(tokenId),
      learning,
      summary,
      storage: summary ? 'available' : 'unavailable',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
