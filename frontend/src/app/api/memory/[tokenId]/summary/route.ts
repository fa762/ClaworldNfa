import { NextResponse } from 'next/server';

import { getMemorySummaryRuntime } from '@/app/api/_lib/memory';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await context.params;
    const parsed = Number(tokenId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 });
    }
    const summary = await getMemorySummaryRuntime(parsed);
    if (!summary) {
      return NextResponse.json({ error: `No CML memory for NFA #${parsed}` }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
