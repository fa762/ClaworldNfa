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

function isImageContentType(contentType: string | null): boolean {
  return Boolean(contentType && contentType.toLowerCase().startsWith('image/'));
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

function buildAttributes(
  tokenId: bigint,
  metadata: ReturnType<typeof normalizeAgentMetadata>,
  agentState: ReturnType<typeof normalizeAgentState>,
  offchainAttributes: unknown,
) {
  if (Array.isArray(offchainAttributes) && offchainAttributes.length > 0) {
    return offchainAttributes;
  }

  const attributes = [
    { trait_type: 'Token ID', value: tokenId.toString() },
    { trait_type: 'Owner', value: agentState.tokenOwner },
    { trait_type: 'Active', value: agentState.active ? 'true' : 'false' },
    { trait_type: 'Balance', value: agentState.balance },
    { trait_type: 'Created At', value: String(agentState.createdAt) },
    { trait_type: 'Logic Address', value: agentState.logicAddress },
  ];

  if (metadata.persona) {
    attributes.push({ trait_type: 'Persona', value: metadata.persona });
  }
  if (metadata.experience) {
    attributes.push({ trait_type: 'Experience', value: metadata.experience });
  }
  if (metadata.voiceHash) {
    attributes.push({ trait_type: 'Voice Hash', value: metadata.voiceHash });
  }
  if (metadata.animationURI) {
    attributes.push({ trait_type: 'Animation URI', value: metadata.animationURI });
  }
  if (metadata.vaultURI) {
    attributes.push({ trait_type: 'Vault URI', value: metadata.vaultURI });
  }
  if (metadata.vaultHash) {
    attributes.push({ trait_type: 'Vault Hash', value: metadata.vaultHash });
  }

  return attributes;
}

async function loadOffchainMetadata(metadataURI: string) {
  const metadataUrl = resolveMetadataUrl(metadataURI);
  if (!metadataUrl) {
    return { metadataUrl: null, offchainMetadata: null, directImageUrl: null };
  }

  const response = await fetch(metadataUrl, { cache: 'no-store' });
  if (!response.ok) {
    return { metadataUrl, offchainMetadata: null, directImageUrl: null };
  }

  const contentType = response.headers.get('content-type');
  if (isImageContentType(contentType)) {
    return { metadataUrl, offchainMetadata: null, directImageUrl: metadataUrl };
  }

  if (!contentType?.toLowerCase().includes('json')) {
    return { metadataUrl, offchainMetadata: null, directImageUrl: null };
  }

  const offchainMetadata = await response.json();
  return { metadataUrl, offchainMetadata, directImageUrl: null };
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

    const { metadataUrl, offchainMetadata, directImageUrl } = await loadOffchainMetadata(metadataURI);
    const image = directImageUrl ?? resolveIpfsUrl(String(offchainMetadata?.image ?? metadata.vaultURI ?? ''));
    const animationUrl = resolveMetadataUrl(String(offchainMetadata?.animation_url ?? metadata.animationURI ?? ''));
    const attributes = buildAttributes(tokenId, metadata, agentState, offchainMetadata?.attributes);

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
      animation_url: animationUrl,
      attributes,
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
