import { type Address } from 'viem';

const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'mainnet').toLowerCase();
const fallbackChainId = appEnv === 'testnet' ? '97' : '56';
const rawChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || fallbackChainId);
const isMainnet = rawChainId === 56;

const MAINNET_AUTONOMY_DEFAULTS = {
  clawNFA: '0xAa2094798B5892191124eae9D77E337544FFAE48',
  clawRouter: '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5',
  worldState: '0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA',
  clwToken: '0x3b486c191c74c9945fa944a3ddde24acdd63ffff',
  taskSkill: '0xaed370784536e31BE4A5D0Dbb1bF275c98179D10',
  pkSkill: '0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF',
  marketSkill: '0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54',
  depositRouter: '0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269',
  battleRoyale: '0x2B2182326Fd659156B2B119034A72D1C2cC9758D',
  autonomyRegistry: '0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044',
  autonomyDelegationRegistry: '0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa',
  oracleActionHub: '0xEdd04D821ab9E8eCD5723189A615333c3509f1D5',
  autonomyFinalizationHub: '0x65F850536bE1B844c407418d8FbaE795045061bd',
  worldEventSkill: '0xdD1273990234D591c098e1E029876F0236Ef8bD3',
  taskSkillAdapter: '0xe7a7E66F9F05eC14925B155C4261F32603857E8E',
  pkSkillAdapter: '0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c',
  battleRoyaleAdapter: '0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc',
  autonomyOperator: '0x567f863A3dB5CBaf59796F6524b1b3ca1793911C',
} as const;

export const addresses = {
  clawNFA: (process.env.NEXT_PUBLIC_CLAWNFA_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.clawNFA : '')) as Address,
  clawRouter: (process.env.NEXT_PUBLIC_CLAWROUTER_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.clawRouter : '')) as Address,
  worldState: (process.env.NEXT_PUBLIC_WORLDSTATE_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.worldState : '')) as Address,
  genesisVault: process.env.NEXT_PUBLIC_GENESIS_VAULT_ADDRESS as Address,
  clwToken: (process.env.NEXT_PUBLIC_CLW_TOKEN_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.clwToken : '')) as Address,
  flapPortal: process.env.NEXT_PUBLIC_FLAP_PORTAL_ADDRESS as Address,
  pancakeRouter: process.env.NEXT_PUBLIC_PANCAKE_ROUTER_ADDRESS as Address,
  // Phase 4: New contracts
  depositRouter: (process.env.NEXT_PUBLIC_DEPOSIT_ROUTER_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.depositRouter : '')) as Address,
  personalityEngine: process.env.NEXT_PUBLIC_PERSONALITY_ENGINE_ADDRESS as Address,
  pkSkill: (process.env.NEXT_PUBLIC_PKSKILL_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.pkSkill : '')) as Address,
  taskSkill: (process.env.NEXT_PUBLIC_TASKSKILL_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.taskSkill : '')) as Address,
  marketSkill: (process.env.NEXT_PUBLIC_MARKETSKILL_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.marketSkill : '')) as Address,
  battleRoyale: (process.env.NEXT_PUBLIC_BATTLE_ROYALE_ADDRESS ||
    (isMainnet ? MAINNET_AUTONOMY_DEFAULTS.battleRoyale : '')) as Address,
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

export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ||
  (isMainnet ? 'https://bsc-rpc.publicnode.com' : 'https://data-seed-prebsc-1-s1.binance.org:8545');

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
