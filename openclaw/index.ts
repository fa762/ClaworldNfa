/**
 * Claw World OpenClaw Adapter
 *
 * Entry point for OpenClaw bot integration.
 * Supports Telegram, Feishu (Lark), and plain text terminals.
 *
 * Usage:
 *   import { ClawEngine } from './openclaw';
 *   const engine = new ClawEngine(client, ai, 'telegram');
 *   const response = await engine.handleInput('/task list', sender, nfaId);
 */

// Core engine
export { ClawEngine } from './engine';

// Command routing
export { parseCommand, parsePKSubCommand, parseTaskSubCommand, parseMarketSubCommand } from './commandRouter';

// Contract interaction
export { GameContractClient } from './contracts';
export type { ContractAddresses } from './contracts';

// Skills
export { TaskSkill } from './skills/taskSkill';
export { PKSkill } from './skills/pkSkill';
export { MarketSkill } from './skills/marketSkill';
export { OracleSkill, MockIPFSUploader } from './skills/oracleSkill';
export type { IPFSUploader } from './skills/oracleSkill';

// Formatters
export {
  formatLobsterStatus,
  formatPKMatch,
  formatTaskResult,
  formatWorldState,
  formatHelp,
  formatTaskList,
  formatStrategyAdvice,
  formatBattleNarrative,
  formatMarketList,
} from './formatter';

// Dialogue
export {
  buildLobsterSystemPrompt,
  handleDialogue,
  buildTaskGenerationPrompt,
  buildStrategyAdvicePrompt,
  buildBattleNarrativePrompt,
  buildPriceAdvicePrompt,
  buildOracleReasoningPrompt,
} from './dialogue';

// Types
export * from './types';
