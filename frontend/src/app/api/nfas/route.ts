import { NextResponse } from 'next/server';

import { listOwnedNfas } from '@/app/api/_lib/nfas';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');

    if (!owner) {
      return NextResponse.json({ error: 'Missing owner query parameter.' }, { status: 400 });
    }

    const items = await listOwnedNfas(owner);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
