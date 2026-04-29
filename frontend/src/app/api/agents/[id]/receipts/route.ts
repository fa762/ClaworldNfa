import { NextResponse } from 'next/server';

import { getAgentReceipts, parseReceiptQuery, parseTokenId } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokenId = parseTokenId(id);
    const query = parseReceiptQuery(request);
    const page = await getAgentReceipts(tokenId, query);
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
