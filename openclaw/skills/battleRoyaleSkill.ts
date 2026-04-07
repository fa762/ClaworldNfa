/**
 * Claw World OpenClaw — Battle Royale Skill
 *
 * Battle Royale game where 10 players stake CLW across 10 rooms.
 * When 10 players are in, a future block hash randomly selects the losing room.
 * Losers forfeit all stakes: 10% → treasury, 90% → survivors (proportional).
 *
 * Flow:
 *   1. latestOpenMatch()          → get current matchId
 *   2. enterRoom(matchId, roomId, amount) → stake CLW
 *   3. Watch RoundTriggered event → countdown to revealBlock
 *   4. reveal(matchId)            → auto-called by frontend, distributes prizes
 */

import type { ethers } from 'ethers';
import type { AIProvider } from '../types';
import { type SkillLang, t } from '../lang';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BRMatchInfo {
  matchId:      number;
  status:       'OPEN' | 'PENDING_REVEAL' | 'SETTLED';
  totalPlayers: number;
  revealBlock:  number;
  losingRoom:   number;  // 0 = not yet settled
  totalStaked:  string;  // formatted CLW
  roundId:      number;
}

export interface BRRoomInfo {
  roomId:      number;
  players:     string[];
  totalStaked: string;   // formatted CLW
}

export interface BRPlayerInfo {
  roomId: number;   // 0 = not entered
  stake:  string;   // formatted CLW
}

export interface BRMatchSnapshot {
  rooms: BRRoomInfo[];
}

export interface BRRevealResult {
  losingRoom:    number;
  loserTotal:    string;
  treasuryFee:   string;
  survivorPrize: string;
  narrative:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status enum matching contract
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, BRMatchInfo['status']> = {
  0: 'OPEN',
  1: 'PENDING_REVEAL',
  2: 'SETTLED',
};

const MIN_STAKE_CLW = 100;
const REVEAL_DELAY_BLOCKS = 5;
const BSC_BLOCK_TIME_MS = 3000; // ~3 seconds per block

// ─────────────────────────────────────────────────────────────────────────────
// AI Prompt Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildRoomAdvicePrompt(snapshot: BRMatchSnapshot, lang: SkillLang = 'zh'): string {
  const roomLines = snapshot.rooms.map(r =>
    `  Room ${r.roomId}: ${r.players.length} players, ${r.totalStaked} CLW staked`,
  ).join('\n');

  return [
    'You are the tactical advisor for Claw World Battle Royale.',
    'Players stake CLW into rooms. The losing room (selected randomly) loses everything.',
    'Losers: 100% forfeited. Survivors: get their stake back + proportional share of loser pool.',
    '',
    'Current match room distribution:',
    roomLines,
    '',
    'The room is selected uniformly at random among occupied rooms.',
    '',
    t(lang, 'Analyze the risk/reward for each room and give strategic advice in Chinese.', 'Analyze the risk/reward for each room and give strategic advice in English.'),
    'Consider: more players in a room = more survivors to share prize, but still same 1-in-N room risk.',
    'A room with fewer players but the same stake risk as others might be better or worse.',
    '',
    'Return a JSON object with:',
    '  recommendedRoom: number (1-10, or 0 if no rooms have players)',
    t(lang, '  reasoning: string (2-3句中文建议)', '  reasoning: string (2-3 sentences in English)'),
    '  riskLevel: "low" | "medium" | "high"',
    '',
    'Return ONLY the JSON object.',
  ].join('\n');
}

function buildResultNarrativePrompt(
  matchId: number,
  losingRoom: number,
  loserTotal: string,
  survivorPrize: string,
  playerCount: number,
  lang: SkillLang = 'zh',
): string {
  return [
    'You are the narrator for Claw World Battle Royale.',
    t(lang, 'Write a dramatic 3-4 sentence result announcement in Chinese.', 'Write a dramatic 3-4 sentence result announcement in English.'),
    '',
    `Match #${matchId} has ended.`,
    `The Boss descended upon Room ${losingRoom}!`,
    `Total CLW in losing room: ${loserTotal} CLW`,
    `Survivor prize pool: ${survivorPrize} CLW distributed to ${playerCount - 1} other rooms`,
    '',
    'Make it dramatic, like a battle royale announcer. Reference the "Boss" descending on the room.',
    'Return ONLY the narrative text.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// BattleRoyaleSkill class
// ─────────────────────────────────────────────────────────────────────────────

export class BattleRoyaleSkill {
  private contract: ethers.Contract;
  private ai: AIProvider;

  constructor(contract: ethers.Contract, ai: AIProvider) {
    this.contract = contract;
    this.ai = ai;
  }

  // ─── Match Info ──────────────────────────────────────────────────────────

  /**
   * Get the current open match ID. Returns 0 if none.
   */
  async getLatestOpenMatch(): Promise<number> {
    const id = await this.contract.latestOpenMatch();
    return Number(id);
  }

  /**
   * Get full match info.
   */
  async getMatchInfo(matchId: number): Promise<BRMatchInfo> {
    const [status, totalPlayers, revealBlock, losingRoom, total, roundId] =
      await this.contract.getMatchInfo(matchId);

    return {
      matchId,
      status:       STATUS_MAP[Number(status)] ?? 'OPEN',
      totalPlayers: Number(totalPlayers),
      revealBlock:  Number(revealBlock),
      losingRoom:   Number(losingRoom),
      totalStaked:  this._formatCLW(total),
      roundId:      Number(roundId),
    };
  }

  /**
   * Get snapshot of all 10 rooms for a match (player counts + totals).
   */
  async getMatchSnapshot(matchId: number): Promise<BRMatchSnapshot> {
    const [playerCounts, roomTotals] = await this.contract.getMatchSnapshot(matchId);

    const rooms: BRRoomInfo[] = [];
    for (let i = 0; i < 10; i++) {
      rooms.push({
        roomId:      i + 1,
        players:     [], // full player list loaded on demand
        totalStaked: this._formatCLW(roomTotals[i]),
      });
      // patch in count as array length hint
      (rooms[i] as any).playerCount = Number(playerCounts[i]);
    }

    return { rooms };
  }

  /**
   * Get players in a specific room.
   */
  async getRoomPlayers(matchId: number, roomId: number): Promise<string[]> {
    return this.contract.getRoomPlayers(matchId, roomId);
  }

  /**
   * Check if a player has entered a match and which room.
   */
  async getPlayerInfo(matchId: number, address: string): Promise<BRPlayerInfo> {
    const [roomId, stake] = await this.contract.getPlayerInfo(matchId, address);
    return {
      roomId: Number(roomId),
      stake:  this._formatCLW(stake),
    };
  }

  // ─── Countdown Helper ───────────────────────────────────────────────────

  /**
   * Estimate seconds remaining until reveal is possible.
   * Returns 0 if already past revealBlock.
   */
  estimateRevealCountdown(revealBlock: number, currentBlock: number): number {
    const blocksLeft = revealBlock - currentBlock;
    if (blocksLeft <= 0) return 0;
    return blocksLeft * (BSC_BLOCK_TIME_MS / 1000);
  }

  // ─── AI Advice ──────────────────────────────────────────────────────────

  /**
   * Use AI to advise which room to enter based on current match state.
   */
  async adviseRoom(matchId: number): Promise<{
    recommendedRoom: number;
    reasoning: string;
    riskLevel: string;
  }> {
    const snapshot = await this.getMatchSnapshot(matchId);

    try {
      const prompt = buildRoomAdvicePrompt(snapshot);
      const advice = await this.ai.chatJSON<{
        recommendedRoom: number;
        reasoning: string;
        riskLevel: string;
      }>(prompt, `Advise which room to enter for Battle Royale match #${matchId}.`);

      return {
        recommendedRoom: Math.min(10, Math.max(0, Number(advice.recommendedRoom) || 0)),
        reasoning:       typeof advice.reasoning === 'string' ? advice.reasoning : '数据不足，无法给出建议。',
        riskLevel:       ['low', 'medium', 'high'].includes(advice.riskLevel) ? advice.riskLevel : 'medium',
      };
    } catch {
      return {
        recommendedRoom: 0,
        reasoning:       '暂时无法获取AI建议，请根据当前房间人数和质押量自行判断。',
        riskLevel:       'medium',
      };
    }
  }

  /**
   * Generate a dramatic narrative for a settled match result.
   */
  async generateResultNarrative(
    matchId: number,
    losingRoom: number,
    loserTotal: string,
    survivorPrize: string,
    occupiedRoomCount: number,
  ): Promise<string> {
    try {
      const prompt = buildResultNarrativePrompt(
        matchId, losingRoom, loserTotal, survivorPrize, occupiedRoomCount,
      );
      const narrative = await this.ai.chat(
        prompt,
        `Generate result narrative for Battle Royale match #${matchId}.`,
      );
      return narrative?.trim() ?? this._defaultNarrative(losingRoom);
    } catch {
      return this._defaultNarrative(losingRoom);
    }
  }

  // ─── Formatting ─────────────────────────────────────────────────────────

  private _formatCLW(wei: ethers.BigNumber | bigint | string): string {
    try {
      const { ethers: e } = require('ethers');
      return e.utils.formatEther(wei.toString());
    } catch {
      return '0';
    }
  }

  private _defaultNarrative(losingRoom: number): string {
    return `Boss降临了${losingRoom}号房间！该房间的玩家损失了全部质押，幸存者们分享了战利品。`;
  }
}
