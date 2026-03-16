import { type Address } from 'viem';

export const addresses = {
  clawNFA: process.env.NEXT_PUBLIC_CLAWNFA_ADDRESS as Address,
  clawRouter: process.env.NEXT_PUBLIC_CLAWROUTER_ADDRESS as Address,
  worldState: process.env.NEXT_PUBLIC_WORLDSTATE_ADDRESS as Address,
  genesisVault: process.env.NEXT_PUBLIC_GENESIS_VAULT_ADDRESS as Address,
  clwToken: process.env.NEXT_PUBLIC_CLW_TOKEN_ADDRESS as Address,
  flapPortal: process.env.NEXT_PUBLIC_FLAP_PORTAL_ADDRESS as Address,
  pancakeRouter: process.env.NEXT_PUBLIC_PANCAKE_ROUTER_ADDRESS as Address,
} as const;

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';

export const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';

export const deployBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || '0');

export const isTestnet = chainId === 97;

export function getBscScanUrl(path: string): string {
  const base = isTestnet ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
  return `${base}/${path}`;
}

export function getBscScanAddressUrl(address: string): string {
  return getBscScanUrl(`address/${address}`);
}

export function getBscScanTxUrl(hash: string): string {
  return getBscScanUrl(`tx/${hash}`);
}
