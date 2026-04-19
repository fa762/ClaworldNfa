import { NextResponse } from 'next/server';

import { getMemoryTimeline } from '@/app/api/_lib/memory';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await context.params;
    const parsed = Number(tokenId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(20, Number(searchParams.get('limit') || '6')));
    return NextResponse.json({ snapshots: getMemoryTimeline(parsed, limit) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
