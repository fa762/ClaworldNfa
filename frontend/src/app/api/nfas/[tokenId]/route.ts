import { NextResponse } from 'next/server';

import { getNfaDetail } from '@/app/api/_lib/nfas';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await context.params;
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const detail = await getNfaDetail(tokenId, owner);
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Invalid token id' ? 400 : message.includes('does not belong') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
