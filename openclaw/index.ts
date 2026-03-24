/**
 * Claw World OpenClaw Adapter
 *
 * Entry point for OpenClaw bot integration.
 * Supports Telegram, Feishu (Lark), and plain text terminals.
 *
 * Usage:
 *   import { parseCommand, GameContractClient, formatLobsterStatus } from './openclaw';
 */

export { parseCommand, parsePKSubCommand, parseTaskSubCommand, parseMarketSubCommand } from './commandRouter';
export { GameContractClient } from './contracts';
export type { ContractAddresses } from './contracts';
export {
  formatLobsterStatus,
  formatPKMatch,
  formatTaskResult,
  formatWorldState,
  formatHelp,
} from './formatter';
export { buildLobsterSystemPrompt, handleDialogue } from './dialogue';
export type { AIProvider, ChatMessage } from './dialogue';
export * from './types';
