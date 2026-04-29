import { NextResponse } from 'next/server';

import { buildProjectAgentCard, originFromRequest } from '@/app/api/_lib/agent-runtime';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return NextResponse.json(buildProjectAgentCard(originFromRequest(request)));
}
