import { NextResponse } from 'next/server';

import { getReceiptByRequestId, parseRequestId } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await context.params;
    const receipt = await getReceiptByRequestId(parseRequestId(requestId));
    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
