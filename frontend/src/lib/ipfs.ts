import { ipfsGateway } from '@/contracts/addresses';

export function resolveIpfsUrl(uri: string): string {
  if (!uri) return '/placeholder-nft.svg';
  if (uri.startsWith('ipfs://')) {
    return `${ipfsGateway}${uri.slice(7)}`;
  }
  if (uri.startsWith('Qm') || uri.startsWith('bafy')) {
    return `${ipfsGateway}${uri}`;
  }
  return uri;
}
