import { NextResponse } from 'next/server';

import { parseTokenId } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

function backendBaseUrl() {
  return (
    process.env.CLAWORLD_API_URL ||
    process.env.CLAWORLD_BACKEND_API_URL ||
    process.env.CLAWORLD_AI_BACKEND_URL ||
    ''
  ).replace(/\/+$/, '');
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokenId = parseTokenId(id);
    const baseUrl = backendBaseUrl();
    if (!baseUrl) {
      return NextResponse.json({ error: 'Backend API is not configured' }, { status: 503 });
    }

    const input = new URL(request.url);
    const target = new URL(`/nfa/${tokenId}/summary`, baseUrl);
    for (const key of ['window', 'limit', 'refresh', 'details']) {
      const value = input.searchParams.get(key);
      if (value) target.searchParams.set(key, value);
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    const token =
      process.env.CLAWORLD_API_TOKEN ||
      process.env.CLAWORLD_BACKEND_API_TOKEN ||
      process.env.CLAWORLD_AI_BACKEND_TOKEN ||
      '';
    if (token) headers.authorization = `Bearer ${token}`;

    const response = await fetch(target, { headers, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: 'Invalid backend response' }, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: message.includes('Invalid') ? 400 : 500 });
  }
}
