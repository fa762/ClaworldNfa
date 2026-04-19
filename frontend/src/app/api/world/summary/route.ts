import { NextResponse } from 'next/server';

import { getWorldSummary } from '@/app/api/_lib/world';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getWorldSummary());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
