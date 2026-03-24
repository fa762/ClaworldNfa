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
export const TASK_TYPE_NAMES = ['勇气', '智慧', '社交', '创造', '毅力'];
export const TASK_TYPE_ICONS = ['⚔️', '🔬', '🤝', '🎨', '🔥'];
export const LISTING_TYPE_NAMES = ['固定价', '拍卖', '互换'];

// ============================================
// TASK TYPES
// ============================================

export interface TaskDefinition {
  taskType: number;             // 0=courage, 1=wisdom, 2=social, 3=create, 4=grit
  title: string;
  description: string;
  personalityVector: number[];  // [courage, wisdom, social, create, grit] weights (sum≈100)
  baseXP: number;
  baseCLW: number;              // integer CLW amount (not wei)
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TaskSession {
  nfaId: number;
  tasks: TaskDefinition[];      // generated 3 tasks
  selectedIndex: number | null;
  status: 'choosing' | 'completed';
  generatedAt: number;
}

// ============================================
// MARKET TYPES
// ============================================

export interface MarketListing {
  listingId: number;
  nfaId: number;
  seller: string;
  listingType: number;          // 0=FixedPrice, 1=Auction, 2=Swap
  price: string;                // BNB in ether units
  highestBid: string;
  highestBidder: string;
  endTime: number;
  swapTargetId: number;
  active: boolean;
}

// ============================================
// PK STRATEGY TYPES
// ============================================

export interface StrategyAdvice {
  recommendedStrategy: number;  // 0=AllAttack, 1=Balanced, 2=AllDefense
  confidence: number;           // 0-100
  reasoning: string;            // personality-flavored advice text
  opponentAnalysis: {
    str: number; def: number; spd: number; vit: number;
    level: number;
  };
}

export interface SaltRecord {
  matchId: number;
  nfaId: number;
  strategy: number;
  salt: string;                 // hex string
  createdAt: number;
}

// ============================================
// ORACLE TYPES
// ============================================

export interface OracleRequest {
  requestId: number;
  nfaId: number;
  consumer: string;
  prompt: string;
  numOfChoices: number;
  status: number;               // 0=PENDING, 1=FULFILLED, 2=EXPIRED
}

// ============================================
// AI PROVIDER INTERFACE
// ============================================

export interface AIProvider {
  chat(systemPrompt: string, userMessage: string, history?: ChatMessage[]): Promise<string>;
  chatJSON<T>(systemPrompt: string, userMessage: string): Promise<T>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
