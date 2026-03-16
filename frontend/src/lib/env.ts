/**
 * Environment configuration for Claw World
 * Three modes: local (mock data), testnet (BSC testnet), mainnet (BSC mainnet)
 */

export type AppEnv = 'local' | 'testnet' | 'mainnet';

export const appEnv: AppEnv = (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) || 'local';

/** True when running in local demo mode with mock data */
export const isDemoMode = appEnv === 'local';

/** True when on BSC testnet */
export const isTestnet = appEnv === 'testnet';

/** True when on BSC mainnet */
export const isMainnet = appEnv === 'mainnet';

/** Human-readable environment label */
export const envLabel: Record<AppEnv, string> = {
  local: '本地演示',
  testnet: '测试网',
  mainnet: '主网',
};

/** Environment badge color classes */
export const envBadgeClass: Record<AppEnv, string> = {
  local: 'bg-purple-900/50 text-purple-300 border-purple-500/30',
  testnet: 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30',
  mainnet: 'bg-green-900/50 text-green-300 border-green-500/30',
};
