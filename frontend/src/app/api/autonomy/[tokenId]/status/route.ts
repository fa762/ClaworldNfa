import { NextResponse } from 'next/server';

import { getAutonomyStatus } from '@/app/api/_lib/autonomy';

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
    return NextResponse.json(await getAutonomyStatus(parsed));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
