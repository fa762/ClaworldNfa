import { type Address } from 'viem';

const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'mainnet').toLowerCase();
const fallbackChainId = appEnv === 'testnet' ? '97' : '56';
const rawChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || fallbackChainId);
const isMainnet = rawChainId === 56;
const allowMainnetAddressOverride = process.env.NEXT_PUBLIC_ALLOW_MAINNET_ADDRESS_OVERRIDE === '1';

const MAINNET_AUTONOMY_DEFAULTS = {
  clawNFA: '0xAa2094798B5892191124eae9D77E337544FFAE48',
  clawRouter: '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5',
  worldState: '0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA',
  genesisVault: '0xCe04f834aC4581FD5562f6c58C276E60C624fF83',
  clwToken: '0x3b486c191c74c9945fa944a3ddde24acdd63ffff',
  flapPortal: '0x3525e9B10cD054E7A32248902EB158c863F3a18B',
  pancakeRouter: '0x114E4c57754c69dAA360a8894698F1D832E56350',
  taskSkill: '0xaed370784536e31BE4A5D0Dbb1bF275c98179D10',
  pkSkill: '0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF',
  marketSkill: '0x6e3d89B36a7f396143Ff123e8a40F66FE2382a54',
  depositRouter: '0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269',
  personalityEngine: '0x19E8A11d8b6E94230f0C174f6Fc4Ca11e6f4331E',
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

function resolveAddress(envValue: string | undefined, canonical?: string): Address {
  if (isMainnet && canonical) {
    if (allowMainnetAddressOverride && envValue) {
      return envValue as Address;
    }
    return canonical as Address;
  }
  return (envValue || '') as Address;
}

export const addresses = {
  clawNFA: resolveAddress(process.env.NEXT_PUBLIC_CLAWNFA_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.clawNFA),
  clawRouter: resolveAddress(process.env.NEXT_PUBLIC_CLAWROUTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.clawRouter),
  worldState: resolveAddress(process.env.NEXT_PUBLIC_WORLDSTATE_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.worldState),
  genesisVault: resolveAddress(process.env.NEXT_PUBLIC_GENESIS_VAULT_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.genesisVault),
  clwToken: resolveAddress(process.env.NEXT_PUBLIC_CLW_TOKEN_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.clwToken),
  flapPortal: resolveAddress(process.env.NEXT_PUBLIC_FLAP_PORTAL_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.flapPortal),
  pancakeRouter: resolveAddress(process.env.NEXT_PUBLIC_PANCAKE_ROUTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.pancakeRouter),
  // Phase 4: New contracts
  depositRouter: resolveAddress(process.env.NEXT_PUBLIC_DEPOSIT_ROUTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.depositRouter),
  personalityEngine: resolveAddress(process.env.NEXT_PUBLIC_PERSONALITY_ENGINE_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.personalityEngine),
  pkSkill: resolveAddress(process.env.NEXT_PUBLIC_PKSKILL_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.pkSkill),
  taskSkill: resolveAddress(process.env.NEXT_PUBLIC_TASKSKILL_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.taskSkill),
  marketSkill: resolveAddress(process.env.NEXT_PUBLIC_MARKETSKILL_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.marketSkill),
  battleRoyale: resolveAddress(process.env.NEXT_PUBLIC_BATTLE_ROYALE_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.battleRoyale),
  autonomyRegistry: resolveAddress(process.env.NEXT_PUBLIC_AUTONOMY_REGISTRY_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.autonomyRegistry),
  autonomyDelegationRegistry: resolveAddress(process.env.NEXT_PUBLIC_AUTONOMY_DELEGATION_REGISTRY_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.autonomyDelegationRegistry),
  oracleActionHub: resolveAddress(process.env.NEXT_PUBLIC_ORACLE_ACTION_HUB_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.oracleActionHub),
  autonomyFinalizationHub: resolveAddress(process.env.NEXT_PUBLIC_AUTONOMY_FINALIZATION_HUB_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.autonomyFinalizationHub),
  worldEventSkill: resolveAddress(process.env.NEXT_PUBLIC_WORLD_EVENT_SKILL_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.worldEventSkill),
  taskSkillAdapter: resolveAddress(process.env.NEXT_PUBLIC_TASKSKILL_ADAPTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.taskSkillAdapter),
  pkSkillAdapter: resolveAddress(process.env.NEXT_PUBLIC_PKSKILL_ADAPTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.pkSkillAdapter),
  battleRoyaleAdapter: resolveAddress(process.env.NEXT_PUBLIC_BATTLE_ROYALE_ADAPTER_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.battleRoyaleAdapter),
  autonomyOperator: resolveAddress(process.env.NEXT_PUBLIC_AUTONOMY_OPERATOR_ADDRESS, MAINNET_AUTONOMY_DEFAULTS.autonomyOperator),
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
