/**
 * Claw World OpenClaw Adapter — Shared Types
 */

export interface LobsterState {
  rarity: number;
  shelter: number;
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
  str: number;
  def: number;
  spd: number;
  vit: number;
  mutation1: string;
  mutation2: string;
  level: number;
  xp: number;
  lastUpkeepTime: number;
}

export interface PKMatch {
  nfaA: number;
  nfaB: number;
  commitA: string;
  commitB: string;
  strategyA: number;
  strategyB: number;
  stake: bigint;
  phase: number; // 0=OPEN, 1=JOINED, 2=COMMITTED, 3=REVEALED, 4=SETTLED, 5=CANCELLED
  phaseTimestamp: number;
  revealedA: boolean;
  revealedB: boolean;
}

export interface GameCommand {
  command: string;
  args: string[];
  nfaId?: number;
  sender: string;
  rawInput: string;
}

export interface GameResponse {
  text: string;
  buttons?: Button[];
  imageUrl?: string;
  txHash?: string;
  error?: string;
}

export interface Button {
  label: string;
  action: string;
}

export type OutputFormat = 'rich' | 'telegram' | 'plain';

export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const RARITY_NAMES_CN = ['普通', '稀有', '史诗', '传说', '神话'];
export const SHELTER_NAMES = ['珊瑚礁', '深渊', '海藻林', '海沟', '礁石', '火山', '废土', '虚空'];
export const STRATEGY_NAMES = ['全攻', '均衡', '全防'];
export const JOB_NAMES = ['Explorer', 'Diplomat', 'Creator', 'Guardian', 'Scholar', 'Pioneer'];
export const JOB_NAMES_CN = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱'];
export const PK_PHASE_NAMES = ['等待对手', '已加入', '提交策略', '已揭示', '已结算', '已取消'];
