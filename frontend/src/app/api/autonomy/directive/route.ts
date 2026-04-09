import { NextResponse } from 'next/server';
import { createPublicClient, getAddress, http, parseAbi, recoverMessageAddress } from 'viem';
import type { Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { chainId, addresses, rpcUrl } from '@/contracts/addresses';
import {
  getStoredAutonomyDirective,
  saveStoredAutonomyDirective,
  type StoredAutonomyDirectiveStyle,
} from '@/lib/server/autonomyDirectiveStore';

export const runtime = 'nodejs';

const nfaAbi = parseAbi(['function ownerOf(uint256 tokenId) view returns (address)']);
const chain = chainId === 56 ? bsc : bscTestnet;
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

function buildDirectiveMessage(
  tokenId: number,
  actionKind: number,
  style: StoredAutonomyDirectiveStyle,
  text: string,
  issuedAt: number
) {
  return [
    'Clawworld Autonomy Directive',
    `tokenId:${tokenId}`,
    `actionKind:${actionKind}`,
    `style:${style}`,
    `text:${text}`,
    `issuedAt:${issuedAt}`,
  ].join('\n');
}

function parseQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenId = Number(searchParams.get('tokenId') || '0');
  const actionKind = Number(searchParams.get('actionKind') || '-1');
  if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Invalid tokenId');
  if (!Number.isInteger(actionKind) || actionKind < 0) throw new Error('Invalid actionKind');
  return { tokenId, actionKind };
}

function parseBody(body: unknown): {
  tokenId: number;
  actionKind: number;
  style: StoredAutonomyDirectiveStyle;
  text: string;
  issuedAt: number;
  signer: Address;
  signature: `0x${string}`;
} {
  const payload = body as {
    tokenId?: number;
    actionKind?: number;
    style?: StoredAutonomyDirectiveStyle;
    text?: string;
    issuedAt?: number;
    signer?: string;
    signature?: string;
  };

  const tokenId = Number(payload.tokenId ?? 0);
  const actionKind = Number(payload.actionKind ?? -1);
  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 220) : '';
  const issuedAt = Number(payload.issuedAt ?? 0);

  if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Invalid tokenId');
  if (!Number.isInteger(actionKind) || actionKind < 0) throw new Error('Invalid actionKind');
  if (payload.style !== 'tight' && payload.style !== 'balanced' && payload.style !== 'expressive') {
    throw new Error('Invalid style');
  }
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) throw new Error('Invalid issuedAt');
  if (Math.abs(Date.now() - issuedAt) > 15 * 60 * 1000) throw new Error('Directive signature expired');
  if (typeof payload.signer !== 'string' || !payload.signer.startsWith('0x')) throw new Error('Invalid signer');
  if (typeof payload.signature !== 'string' || !payload.signature.startsWith('0x')) throw new Error('Invalid signature');

  return {
    tokenId,
    actionKind,
    style: payload.style,
    text,
    issuedAt,
    signer: getAddress(payload.signer),
    signature: payload.signature as `0x${string}`,
  };
}

export async function GET(request: Request) {
  try {
    const { tokenId, actionKind } = parseQuery(request);
    const record = getStoredAutonomyDirective(tokenId, actionKind);
    return NextResponse.json({
      tokenId,
      actionKind,
      style: record?.style ?? 'balanced',
      text: record?.text ?? '',
      updatedAt: record?.updatedAt ?? null,
      updatedBy: record?.updatedBy ?? null,
      messageTemplate: buildDirectiveMessage(tokenId, actionKind, record?.style ?? 'balanced', record?.text ?? '', 0),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseBody(await request.json());
    const owner = await publicClient.readContract({
      address: addresses.clawNFA,
      abi: nfaAbi,
      functionName: 'ownerOf',
      args: [BigInt(payload.tokenId)],
    });
    const ownerAddress = getAddress(owner);
    if (ownerAddress !== payload.signer) {
      return NextResponse.json({ error: 'Only the current NFA owner can update directives.' }, { status: 403 });
    }

    const expectedMessage = buildDirectiveMessage(
      payload.tokenId,
      payload.actionKind,
      payload.style,
      payload.text,
      payload.issuedAt
    );
    const recovered = getAddress(await recoverMessageAddress({ message: expectedMessage, signature: payload.signature }));
    if (recovered !== payload.signer) {
      return NextResponse.json({ error: 'Signature does not match signer.' }, { status: 401 });
    }

    const saved = saveStoredAutonomyDirective({
      tokenId: payload.tokenId,
      actionKind: payload.actionKind,
      style: payload.style,
      text: payload.text,
      updatedAt: Date.now(),
      updatedBy: payload.signer,
    });

    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
