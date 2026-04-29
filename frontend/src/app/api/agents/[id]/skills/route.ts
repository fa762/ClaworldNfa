import { NextResponse } from 'next/server';

import { listAgentSkills, parseTokenId } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokenId = parseTokenId(id);
    return NextResponse.json({
      tokenId: String(tokenId),
      skills: listAgentSkills(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
