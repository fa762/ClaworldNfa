import { ipfsGateway } from '@/contracts/addresses';

const IPFS_HASH_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{50,})$/;

export function resolveIpfsUrl(uri: string): string {
  if (!uri) return '/placeholder-nft.svg';
  if (uri.startsWith('ipfs://')) {
    const hash = uri.slice(7);
    return `${ipfsGateway}${hash}`;
  }
  // Validate bare IPFS hashes to prevent injection
  if (IPFS_HASH_REGEX.test(uri)) {
    return `${ipfsGateway}${uri}`;
  }
  // Allow HTTPS URLs directly
  if (uri.startsWith('https://')) {
    return uri;
  }
  return '/placeholder-nft.svg';
}
