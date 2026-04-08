import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { addresses, chainId, ipfsGateway, rpcUrl } from '@/contracts/addresses';
import { resolveIpfsUrl } from '@/lib/ipfs';

export const runtime = 'nodejs';

const chain = chainId === 56 ? bsc : bscTestnet;
const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const IPFS_HASH_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/;

function resolveMetadataUrl(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith('ipfs://')) {
    return `${ipfsGateway}${uri.slice(7)}`;
  }
  if (IPFS_HASH_REGEX.test(uri)) {
    return `${ipfsGateway}${uri}`;
  }
  if (uri.startsWith('https://')) {
    return uri;
  }
  return null;
}

function normalizeId(rawId: string): bigint {
  if (!/^\d+$/.test(rawId)) {
    throw new Error('Invalid agent id');
  }
  return BigInt(rawId);
}

function normalizeAgentMetadata(raw: any) {
  return {
    persona: raw?.persona ?? raw?.[0] ?? '',
    experience: raw?.experience ?? raw?.[1] ?? '',
    voiceHash: raw?.voiceHash ?? raw?.[2] ?? '',
    animationURI: raw?.animationURI ?? raw?.[3] ?? '',
    vaultURI: raw?.vaultURI ?? raw?.[4] ?? '',
    vaultHash: raw?.vaultHash ?? raw?.[5] ?? '',
  };
}

function normalizeAgentState(raw: any) {
  return {
    balance: String(raw?.balance ?? raw?.[0] ?? 0n),
    active: Boolean(raw?.active ?? raw?.[1]),
    logicAddress: raw?.logicAddress ?? raw?.[2] ?? '',
    createdAt: Number(raw?.createdAt ?? raw?.[3] ?? 0n),
    tokenOwner: raw?.tokenOwner ?? raw?.[4] ?? '',
  };
}

async function loadOffchainMetadata(metadataURI: string) {
  const metadataUrl = resolveMetadataUrl(metadataURI);
  if (!metadataUrl) {
    return { metadataUrl: null, offchainMetadata: null };
  }

  const response = await fetch(metadataUrl, { cache: 'no-store' });
  if (!response.ok) {
    return { metadataUrl, offchainMetadata: null };
  }

  const offchainMetadata = await response.json();
  return { metadataUrl, offchainMetadata };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!addresses.clawNFA) {
      return NextResponse.json({ error: 'ClawNFA address is not configured' }, { status: 500 });
    }

    const { id } = await context.params;
    const tokenId = normalizeId(id);

    const [agentMetadataResult, agentStateResult] = await Promise.all([
      publicClient.readContract({
        address: addresses.clawNFA,
        abi: ClawNFAABI,
        functionName: 'getAgentMetadata',
        args: [tokenId],
      }),
      publicClient.readContract({
        address: addresses.clawNFA,
        abi: ClawNFAABI,
        functionName: 'getAgentState',
        args: [tokenId],
      }),
    ]);

    const metadataTuple = Array.isArray(agentMetadataResult) ? agentMetadataResult[0] : agentMetadataResult;
    const metadataURI = Array.isArray(agentMetadataResult) ? String(agentMetadataResult[1] ?? '') : '';
    const metadata = normalizeAgentMetadata(metadataTuple);
    const agentState = normalizeAgentState(agentStateResult);

    const { metadataUrl, offchainMetadata } = await loadOffchainMetadata(metadataURI);
    const image = resolveIpfsUrl(String(offchainMetadata?.image ?? metadata.vaultURI ?? ''));

    return NextResponse.json({
      id: Number(tokenId),
      chainId,
      contractAddress: addresses.clawNFA,
      owner: agentState.tokenOwner,
      active: agentState.active,
      balance: agentState.balance,
      createdAt: agentState.createdAt,
      logicAddress: agentState.logicAddress,
      tokenUri: metadataURI,
      metadataUrl,
      name: offchainMetadata?.name ?? `Claworld NFA #${id}`,
      description: offchainMetadata?.description ?? 'On-chain autonomous NFA in Claworld.',
      image,
      attributes: Array.isArray(offchainMetadata?.attributes) ? offchainMetadata.attributes : [],
      metadata,
      agentState,
      rawOffchainMetadata: offchainMetadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Invalid agent id' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
