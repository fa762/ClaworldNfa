import { type Address } from 'viem';

const rawChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || '97');
const isMainnet = rawChainId === 56;

const MAINNET_AUTONOMY_DEFAULTS = {
  autonomyRegistry: '0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044',
  autonomyDelegationRegistry: '0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa',
  oracleActionHub: '0xEdd04D821ab9E8eCD5723189A615333c3509f1D5',
  autonomyFinalizationHub: '0x65F850536bE1B844c407418d8FbaE795045061bd',
  worldEventSkill: '0xdD1273990234D591c098e1E029876F0236Ef8bD3',
  taskSkillAdapter: '0xe7a7E66F9F05eC14925B155C4261F32603857E8E',
  pkSkillAdapter: '0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c',
  battleRoyaleAdapter: '0x3DFc7504C4D9113f23916012665E319699C7699e',
  autonomyOperator: '0x567f863A3dB5CBaf59796F6524b1b3ca1793911C',
} as const;

export const addresses = {
  clawNFA: process.env.NEXT_PUBLIC_CLAWNFA_ADDRESS as Address,
  clawRouter: process.env.NEXT_PUBLIC_CLAWROUTER_ADDRESS as Address,
  worldState: process.env.NEXT_PUBLIC_WORLDSTATE_ADDRESS as Address,
  genesisVault: process.env.NEXT_PUBLIC_GENESIS_VAULT_ADDRESS as Address,
  clwToken: process.env.NEXT_PUBLIC_CLW_TOKEN_ADDRESS as Address,
  flapPortal: process.env.NEXT_PUBLIC_FLAP_PORTAL_ADDRESS as Address,
  pancakeRouter: process.env.NEXT_PUBLIC_PANCAKE_ROUTER_ADDRESS as Address,
  // Phase 4: New contracts
  depositRouter: process.env.NEXT_PUBLIC_DEPOSIT_ROUTER_ADDRESS as Address,
  personalityEngine: process.env.NEXT_PUBLIC_PERSONALITY_ENGINE_ADDRESS as Address,
  pkSkill: process.env.NEXT_PUBLIC_PKSKILL_ADDRESS as Address,
  taskSkill: process.env.NEXT_PUBLIC_TASKSKILL_ADDRESS as Address || '' as Address,
  marketSkill: process.env.NEXT_PUBLIC_MARKETSKILL_ADDRESS as Address || '' as Address,
  battleRoyale: process.env.NEXT_PUBLIC_BATTLE_ROYALE_ADDRESS as Address || '' as Address,
  autonomyRegistry: (process.env.NEXT_PUBLIC_AUTONOMY_REGISTRY_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.autonomyRegistry : '')) as Address,
  autonomyDelegationRegistry: (process.env.NEXT_PUBLIC_AUTONOMY_DELEGATION_REGISTRY_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.autonomyDelegationRegistry : '')) as Address,
  oracleActionHub: (process.env.NEXT_PUBLIC_ORACLE_ACTION_HUB_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.oracleActionHub : '')) as Address,
  autonomyFinalizationHub: (process.env.NEXT_PUBLIC_AUTONOMY_FINALIZATION_HUB_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.autonomyFinalizationHub : '')) as Address,
  worldEventSkill: (process.env.NEXT_PUBLIC_WORLD_EVENT_SKILL_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.worldEventSkill : '')) as Address,
  taskSkillAdapter: (process.env.NEXT_PUBLIC_TASKSKILL_ADAPTER_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.taskSkillAdapter : '')) as Address,
  pkSkillAdapter: (process.env.NEXT_PUBLIC_PKSKILL_ADAPTER_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.pkSkillAdapter : '')) as Address,
  battleRoyaleAdapter: (process.env.NEXT_PUBLIC_BATTLE_ROYALE_ADAPTER_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.battleRoyaleAdapter : '')) as Address,
  autonomyOperator: (process.env.NEXT_PUBLIC_AUTONOMY_OPERATOR_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.autonomyOperator : '')) as Address,
} as const;

export const chainId = rawChainId;

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
