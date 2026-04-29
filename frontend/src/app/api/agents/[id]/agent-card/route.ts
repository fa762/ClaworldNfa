import { NextResponse } from 'next/server';

import { buildAgentCard, originFromRequest, parseTokenId } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokenId = parseTokenId(id);
    const card = await buildAgentCard(tokenId, originFromRequest(request));
    return NextResponse.json(card);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
