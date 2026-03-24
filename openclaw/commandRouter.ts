/**
 * Claw World OpenClaw Adapter — Command Router
 *
 * Parses user text input into game commands.
 * Supports: /status, /task, /pk, /market, /deposit, /withdraw, /help
 */

import type { GameCommand } from './types';

const COMMAND_PATTERNS: Record<string, RegExp> = {
  status:   /^\/(status|s)(?:\s+(\d+))?$/i,
  task:     /^\/(task|t)(?:\s+(.+))?$/i,
  pk:       /^\/(pk|pvp|battle)(?:\s+(.+))?$/i,
  market:   /^\/(market|m)(?:\s+(.+))?$/i,
  deposit:  /^\/(deposit|d)(?:\s+(.+))?$/i,
  withdraw: /^\/(withdraw|w)(?:\s+(.+))?$/i,
  wallet:   /^\/(wallet|chain)(?:\s+(.+))?$/i,
  help:     /^\/(help|h|\?)$/i,
  job:      /^\/(job|class)(?:\s+(\d+))?$/i,
  world:    /^\/(world|ws)$/i,
};

/**
 * Parse raw user input into a structured GameCommand.
 * Returns null if the input is not a command (should be forwarded to AI dialogue).
 */
export function parseCommand(input: string, sender: string, defaultNfaId?: number): GameCommand | null {
  const trimmed = input.trim();

  for (const [command, pattern] of Object.entries(COMMAND_PATTERNS)) {
    const match = trimmed.match(pattern);
    if (match) {
      const argsStr = match[2] || match[1] || '';
      const args = argsStr ? argsStr.trim().split(/\s+/) : [];

      // Try to extract nfaId from first numeric arg, fallback to default
      let nfaId = defaultNfaId;
      if (args.length > 0 && /^\d+$/.test(args[0])) {
        nfaId = parseInt(args[0]);
      }

      return {
        command,
        args,
        nfaId,
        sender,
        rawInput: trimmed,
      };
    }
  }

  return null; // Not a command → forward to AI dialogue
}

/**
 * Parse PK sub-commands:
 *   /pk create <stake>
 *   /pk join <matchId>
 *   /pk commit <matchId> <strategy> <salt>
 *   /pk reveal <matchId> <strategy> <salt>
 *   /pk settle <matchId>
 *   /pk list
 *   /pk cancel <matchId>
 */
export function parsePKSubCommand(args: string[]): {
  action: string;
  matchId?: number;
  stake?: string;
  strategy?: number;
  salt?: string;
} {
  if (args.length === 0) return { action: 'list' };

  const action = args[0].toLowerCase();

  switch (action) {
    case 'create':
      return { action: 'create', stake: args[1] || '100' };
    case 'join':
      return { action: 'join', matchId: parseInt(args[1]) };
    case 'commit':
      return {
        action: 'commit',
        matchId: parseInt(args[1]),
        strategy: parseInt(args[2]),
        salt: args[3],
      };
    case 'reveal':
      return {
        action: 'reveal',
        matchId: parseInt(args[1]),
        strategy: parseInt(args[2]),
        salt: args[3],
      };
    case 'settle':
      return { action: 'settle', matchId: parseInt(args[1]) };
    case 'cancel':
      return { action: 'cancel', matchId: parseInt(args[1]) };
    default:
      return { action: 'list' };
  }
}

/**
 * Parse task sub-commands:
 *   /task list
 *   /task accept <taskType>
 *   /task complete <taskType>
 */
export function parseTaskSubCommand(args: string[]): {
  action: string;
  taskType?: number;
} {
  if (args.length === 0) return { action: 'list' };
  const action = args[0].toLowerCase();
  return {
    action,
    taskType: args[1] ? parseInt(args[1]) : undefined,
  };
}

/**
 * Parse market sub-commands:
 *   /market list
 *   /market sell <nfaId> <price>
 *   /market buy <listingId>
 *   /market cancel <listingId>
 */
export function parseMarketSubCommand(args: string[]): {
  action: string;
  nfaId?: number;
  price?: string;
  listingId?: number;
} {
  if (args.length === 0) return { action: 'list' };
  const action = args[0].toLowerCase();

  switch (action) {
    case 'sell':
      return { action: 'sell', nfaId: parseInt(args[1]), price: args[2] };
    case 'buy':
      return { action: 'buy', listingId: parseInt(args[1]) };
    case 'cancel':
      return { action: 'cancel', listingId: parseInt(args[1]) };
    default:
      return { action: 'list' };
  }
}
