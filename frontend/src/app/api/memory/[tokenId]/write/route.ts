import { NextResponse } from 'next/server';

import { writeMemoryRuntime } from '@/app/api/_lib/memory';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  try {
    const { tokenId } = await context.params;
    const parsed = Number(tokenId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 });
    }

    const body = (await request.json()) as {
      content?: string;
      owner?: string | null;
      memoryRoot?: string | null;
    };
    const content = body.content?.trim() || '';
    if (!content) {
      return NextResponse.json({ error: 'Memory content is required' }, { status: 400 });
    }

    const result = await writeMemoryRuntime({
      tokenId: parsed,
      content,
      owner: body.owner || null,
      memoryRoot: body.memoryRoot || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Memory write failed' },
      { status: 500 },
    );
  }
}
