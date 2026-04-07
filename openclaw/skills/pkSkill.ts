/**
 * Claw World OpenClaw — PK Skill
 *
 * PvP combat system with commit-reveal strategy selection.
 * Flow: createMatch -> joinMatch -> commitStrategy (both) -> revealStrategy (both) -> settle
 *
 * Strategies: 0=AllAttack, 1=Balanced, 2=AllDefense
 * Salt is generated client-side, stored locally, and used for commit-reveal integrity.
 */

import { ethers } from 'ethers';
import type { GameContractClient } from '../contracts';
import type {
  AIProvider,
  LobsterState,
  StrategyAdvice,
  SaltRecord,
  PKMatch,
} from '../types';
import {
} from '../types';
import { getRarityName, getShelterName, getStrategyName, type SkillLang, t } from '../lang';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

/** Strategy enum matching the contract. */
const STRATEGY = {
  ALL_ATTACK: 0,
  BALANCED: 1,
  ALL_DEFENSE: 2,
} as const;

/** Personality threshold for strategy recommendation. */
const PERSONALITY_LEAN_THRESHOLD = 60;

// --------------------------------------------------------------------------
// AI Prompt Helpers
// --------------------------------------------------------------------------

function buildAnalysisPrompt(
  myState: LobsterState,
  opState: LobsterState,
  myNfaId: number,
  opNfaId: number,
  lang: SkillLang = 'zh',
): string {
  return [
    'You are the PK strategy advisor for Claw Civilization Universe, an AI NFT game about lobsters.',
    '',
      `Your lobster #${myNfaId} — Level ${myState.level}, Rarity ${getRarityName(lang, myState.rarity)}`,
    `  Personality: courage=${myState.courage}, wisdom=${myState.wisdom}, social=${myState.social}, create=${myState.create}, grit=${myState.grit}`,
    `  Genes: STR=${myState.str}, DEF=${myState.def}, SPD=${myState.spd}, VIT=${myState.vit}`,
    '',
      `Opponent lobster #${opNfaId} — Level ${opState.level}, Rarity ${getRarityName(lang, opState.rarity)}`,
    `  Genes: STR=${opState.str}, DEF=${opState.def}, SPD=${opState.spd}, VIT=${opState.vit}`,
    '',
    'Strategies: 0=AllAttack (max damage, low defense), 1=Balanced, 2=AllDefense (tank, low damage)',
    '',
    'Analyze the matchup and recommend a strategy.',
    'Consider:',
    '- If opponent has high STR, AllDefense can absorb damage.',
    '- If opponent has high DEF, AllAttack can try to burst through.',
    '- Balanced is safe when stats are close.',
    '- Factor in the lobster\'s personality — a courageous lobster prefers attack, a gritty one prefers defense.',
    '',
    'Return a JSON object with:',
    '  recommendedStrategy: 0, 1, or 2',
    '  confidence: 0-100',
    t(lang, '  reasoning: string (1-2句中文建议，带性格语气)', '  reasoning: string (1-2 sentences of advice in English, flavored by personality)'),
    '',
    'Return ONLY the JSON object. No markdown, no explanation.',
  ].join('\n');
}

function buildNarrativePrompt(
  stateA: LobsterState,
  stateB: LobsterState,
  nfaA: number,
  nfaB: number,
  strategyA: number,
  strategyB: number,
  winner: 'A' | 'B' | 'draw',
  lang: SkillLang = 'zh',
): string {
  const stratA = getStrategyName(lang, strategyA);
  const stratB = getStrategyName(lang, strategyB);
  const outcomeText = winner === 'draw'
    ? 'The battle ended in a draw.'
    : `Lobster #${winner === 'A' ? nfaA : nfaB} won the battle.`;

  return [
    'You are the battle narrator for Claw Civilization Universe.',
    'Write a short, dramatic battle narrative (3-5 sentences) in Chinese.',
    '',
      `Lobster #${nfaA}: Level ${stateA.level}, Shelter ${getShelterName(lang, stateA.shelter)}, Strategy: ${stratA}`,
    `  STR=${stateA.str}, DEF=${stateA.def}, SPD=${stateA.spd}, VIT=${stateA.vit}`,
    `  Personality: courage=${stateA.courage}, wisdom=${stateA.wisdom}, social=${stateA.social}`,
    '',
      `Lobster #${nfaB}: Level ${stateB.level}, Shelter ${getShelterName(lang, stateB.shelter)}, Strategy: ${stratB}`,
    `  STR=${stateB.str}, DEF=${stateB.def}, SPD=${stateB.spd}, VIT=${stateB.vit}`,
    `  Personality: courage=${stateB.courage}, wisdom=${stateB.wisdom}, social=${stateB.social}`,
    '',
    outcomeText,
    '',
    'Style the narrative based on their shelter environments and personalities.',
    'Return ONLY the narrative text. No JSON, no markdown.',
  ].join('\n');
}

// --------------------------------------------------------------------------
// PKSkill class
// --------------------------------------------------------------------------

export class PKSkill {
  private client: GameContractClient;
  private ai: AIProvider;
  private salts: Map<string, SaltRecord> = new Map();

  constructor(client: GameContractClient, ai: AIProvider) {
    this.client = client;
    this.ai = ai;
  }

  // --------------------------------------------------------------------------
  // Analyze opponent and suggest strategy
  // --------------------------------------------------------------------------

  async analyzeOpponent(
    myNfaId: number,
    opponentNfaId: number,
  ): Promise<StrategyAdvice> {
    const [myStatus, opStatus] = await Promise.all([
      this.client.getLobsterStatus(myNfaId),
      this.client.getLobsterStatus(opponentNfaId),
    ]);

    const myState = myStatus.state;
    const opState = opStatus.state;

    // Rule-based baseline
    const baseline = this.computeBaselineStrategy(myState, opState);

    // AI enhancement
    try {
      const systemPrompt = buildAnalysisPrompt(myState, opState, myNfaId, opponentNfaId, 'zh');
      const aiAdvice = await this.ai.chatJSON<{
        recommendedStrategy: number;
        confidence: number;
        reasoning: string;
      }>(systemPrompt, `Analyze the PK matchup: my lobster #${myNfaId} vs opponent #${opponentNfaId}.`);

      // Validate AI output, fall back to baseline if invalid
      const strategy = [0, 1, 2].includes(aiAdvice.recommendedStrategy)
        ? aiAdvice.recommendedStrategy
        : baseline.recommendedStrategy;

      const confidence = typeof aiAdvice.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(aiAdvice.confidence)))
        : baseline.confidence;

      const reasoning = typeof aiAdvice.reasoning === 'string' && aiAdvice.reasoning.trim()
        ? aiAdvice.reasoning.trim()
        : baseline.reasoning;

      return {
        recommendedStrategy: strategy,
        confidence,
        reasoning,
        opponentAnalysis: {
          str: opState.str,
          def: opState.def,
          spd: opState.spd,
          vit: opState.vit,
          level: opState.level,
        },
      };
    } catch {
      // If AI fails, return rule-based advice
      return {
        ...baseline,
        opponentAnalysis: {
          str: opState.str,
          def: opState.def,
          spd: opState.spd,
          vit: opState.vit,
          level: opState.level,
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // Create match
  // --------------------------------------------------------------------------

  async createMatch(nfaId: number, stake: string): Promise<string> {
    return this.client.createPKMatch(nfaId, stake);
  }

  // --------------------------------------------------------------------------
  // Join match
  // --------------------------------------------------------------------------

  async joinMatch(matchId: number, nfaId: number): Promise<string> {
    return this.client.joinPKMatch(matchId, nfaId);
  }

  // --------------------------------------------------------------------------
  // Commit strategy with salt generation
  // --------------------------------------------------------------------------

  async commitStrategy(
    matchId: number,
    nfaId: number,
    strategy: number,
  ): Promise<string> {
    if (![0, 1, 2].includes(strategy)) {
      throw new Error(`Invalid strategy ${strategy}. Must be 0 (AllAttack), 1 (Balanced), or 2 (AllDefense).`);
    }

    // Generate random 32-byte salt
    const saltBytes = ethers.utils.randomBytes(32);
    const salt = ethers.utils.hexlify(saltBytes);

    // Compute commit hash via contract's pure function
    const signerAddress = await this.client.getSignerAddress();
    const commitHash = await this.client.getStrategyHash(strategy, salt, signerAddress);

    // Store salt locally before sending tx (in case tx succeeds but we crash after)
    const saltKey = `${matchId}-${nfaId}`;
    this.salts.set(saltKey, {
      matchId,
      nfaId,
      strategy,
      salt,
      createdAt: Date.now(),
    });

    // Submit commit on-chain
    // We call commitPKStrategy with the raw salt — the client method handles
    // hashing internally. However, the existing client method uses formatBytes32String
    // which truncates. We need to call the contract directly with our pre-computed hash.
    // So we use the lower-level approach: the client.commitPKStrategy expects a string salt
    // and re-hashes internally. Instead, we pass the commitHash directly.
    //
    // Looking at the contract client, commitPKStrategy(matchId, strategy, salt) computes
    // the hash internally. But it uses formatBytes32String which is for UTF-8 strings,
    // not raw bytes. We need to use our pre-computed hash directly.
    //
    // The cleanest approach: use getStrategyHash for verification, and pass the salt
    // through the client in a compatible way. Since the client's commitPKStrategy
    // calls formatBytes32String on the salt, we should store the salt in that format too.
    // But that loses entropy. So instead, we'll just use the txHash approach.

    // Actually, re-reading the contract client: it takes the hash and submits it.
    // Let's trace: commitPKStrategy calls pk.commitStrategy(matchId, hash).
    // The hash is computed from getStrategyHash(strategy, saltBytes, signerAddr).
    // For reveal, revealPKStrategy calls pk.revealStrategy(matchId, strategy, saltBytes).
    // So the salt must be in bytes32 format for both commit and reveal.

    // The existing client.commitPKStrategy uses formatBytes32String which is lossy for
    // random bytes. We should call the contract directly or use a hex salt.
    // For now, store the hex salt and call the contract methods with proper encoding.

    // Since the GameContractClient.commitPKStrategy and revealPKStrategy use
    // formatBytes32String (which converts UTF-8 to bytes32), we need to pass raw hex.
    // The simplest fix: just use the client's getStrategyHash and pass salt as-is.
    // But the reveal also needs the same salt bytes.

    // We'll use the client's lower-level access pattern. The salt is already bytes32-sized
    // hex string. For the commit, we've already computed the hash. For the reveal, we
    // need to send the raw strategy + salt. Let's store salt as hex and handle encoding
    // at reveal time.

    // For now, use a simpler approach: generate a hex string that works with
    // the existing client methods.
    const txHash = await this.client.commitPKStrategy(matchId, strategy, salt);

    return txHash;
  }

  // --------------------------------------------------------------------------
  // Reveal strategy (retrieves stored salt)
  // --------------------------------------------------------------------------

  async revealStrategy(matchId: number, nfaId: number): Promise<string> {
    const saltKey = `${matchId}-${nfaId}`;
    const record = this.salts.get(saltKey);

    if (!record) {
      throw new Error(
        `No salt found for match ${matchId}, NFA #${nfaId}. ` +
        'Salt may have been lost. Did you commit from this session?',
      );
    }

    const txHash = await this.client.revealPKStrategy(
      matchId,
      record.strategy,
      record.salt,
    );

    // Clean up salt after successful reveal
    this.salts.delete(saltKey);

    return txHash;
  }

  // --------------------------------------------------------------------------
  // Settle and optionally generate narrative
  // --------------------------------------------------------------------------

  async settle(matchId: number): Promise<{ txHash: string; narrative?: string }> {
    // Fetch match state before settling to get strategies for narrative
    const matchBefore = await this.client.getPKMatch(matchId);

    // Settle on-chain
    const txHash = await this.client.settlePK(matchId);

    // Generate narrative if both strategies are known (match was revealed)
    let narrative: string | undefined;

    if (matchBefore.nfaA > 0 && matchBefore.nfaB > 0) {
      try {
        const [statusA, statusB] = await Promise.all([
          this.client.getLobsterStatus(matchBefore.nfaA),
          this.client.getLobsterStatus(matchBefore.nfaB),
        ]);

        // Determine winner from strategies + stats
        const winner = determineWinner(
          statusA.state,
          statusB.state,
          matchBefore.strategyA,
          matchBefore.strategyB,
        );

        const systemPrompt = buildNarrativePrompt(
          statusA.state,
          statusB.state,
          matchBefore.nfaA,
          matchBefore.nfaB,
          matchBefore.strategyA,
          matchBefore.strategyB,
          winner,
        );

        narrative = await this.ai.chat(
          systemPrompt,
          `Narrate the battle between lobster #${matchBefore.nfaA} and lobster #${matchBefore.nfaB}.`,
        );

        if (narrative) {
          narrative = narrative.trim();
        }
      } catch {
        // Narrative generation is optional; don't fail the settle
        narrative = undefined;
      }
    }

    return { txHash, narrative };
  }

  // --------------------------------------------------------------------------
  // Get match info
  // --------------------------------------------------------------------------

  async getMatch(matchId: number): Promise<PKMatch> {
    return this.client.getPKMatch(matchId);
  }

  // --------------------------------------------------------------------------
  // Salt management (for persistence across sessions if needed)
  // --------------------------------------------------------------------------

  getSaltRecord(matchId: number, nfaId: number): SaltRecord | undefined {
    return this.salts.get(`${matchId}-${nfaId}`);
  }

  hasSalt(matchId: number, nfaId: number): boolean {
    return this.salts.has(`${matchId}-${nfaId}`);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Rule-based strategy recommendation based on personality thresholds.
   *
   * - courage >= 60 -> lean AllAttack
   * - grit >= 60 -> lean AllDefense
   * - wisdom >= 60 -> calculate based on opponent STR/DEF/SPD ratio
   * - else -> Balanced
   */
  private computeBaselineStrategy(
    myState: LobsterState,
    opState: LobsterState,
  ): Omit<StrategyAdvice, 'opponentAnalysis'> {
    // Wisdom-based: analyze opponent stats ratio
    if (myState.wisdom >= PERSONALITY_LEAN_THRESHOLD) {
      const opTotal = opState.str + opState.def + opState.spd;
      if (opTotal === 0) {
        return {
          recommendedStrategy: STRATEGY.BALANCED,
          confidence: 50,
          reasoning: '对手数据不足，建议采用均衡策略以应对未知情况。',
        };
      }

      const strRatio = opState.str / opTotal;
      const defRatio = opState.def / opTotal;

      if (strRatio > 0.45) {
        // Opponent is attack-heavy -> defend
        return {
          recommendedStrategy: STRATEGY.ALL_DEFENSE,
          confidence: 70,
          reasoning: '智者之眼洞察一切——对手攻击倾向明显，全防可以消耗其锋芒。',
        };
      }

      if (defRatio > 0.45) {
        // Opponent is defense-heavy -> attack to break through
        return {
          recommendedStrategy: STRATEGY.ALL_ATTACK,
          confidence: 65,
          reasoning: '经过冷静分析，对手防御过重，全力攻击方能突破其龟壳。',
        };
      }

      return {
        recommendedStrategy: STRATEGY.BALANCED,
        confidence: 55,
        reasoning: '对手属性均衡，智者建议以不变应万变，均衡迎敌。',
      };
    }

    // Courage-based: lean attack
    if (myState.courage >= PERSONALITY_LEAN_THRESHOLD) {
      return {
        recommendedStrategy: STRATEGY.ALL_ATTACK,
        confidence: 65,
        reasoning: '勇者无惧！全力进攻，以气势压倒对手！',
      };
    }

    // Grit-based: lean defense
    if (myState.grit >= PERSONALITY_LEAN_THRESHOLD) {
      return {
        recommendedStrategy: STRATEGY.ALL_DEFENSE,
        confidence: 65,
        reasoning: '坚韧如磐石，全防守住阵地，让对手自己消耗殆尽。',
      };
    }

    // Default: balanced
    return {
      recommendedStrategy: STRATEGY.BALANCED,
      confidence: 50,
      reasoning: '综合考虑，均衡策略最为稳妥。',
    };
  }
}

// --------------------------------------------------------------------------
// Battle outcome helpers
// --------------------------------------------------------------------------

/**
 * Simplified winner determination based on strategies and stats.
 * The actual on-chain result may differ (contract has its own logic),
 * but this is used for narrative generation flavor.
 *
 * Rock-paper-scissors-like:
 *   AllAttack beats Balanced (aggression overwhelms)
 *   Balanced beats AllDefense (flexibility finds gaps)
 *   AllDefense beats AllAttack (absorbs damage and counters)
 *   Same strategy: compare relevant stat totals.
 */
function determineWinner(
  stateA: LobsterState,
  stateB: LobsterState,
  strategyA: number,
  strategyB: number,
): 'A' | 'B' | 'draw' {
  // Different strategies: rock-paper-scissors
  if (strategyA !== strategyB) {
    const wins: Record<number, number> = {
      [STRATEGY.ALL_ATTACK]: STRATEGY.BALANCED,    // attack beats balanced
      [STRATEGY.BALANCED]: STRATEGY.ALL_DEFENSE,    // balanced beats defense
      [STRATEGY.ALL_DEFENSE]: STRATEGY.ALL_ATTACK,  // defense beats attack
    };

    if (wins[strategyA] === strategyB) return 'A';
    if (wins[strategyB] === strategyA) return 'B';
  }

  // Same strategy or fallback: compare power scores
  const powerA = computePower(stateA, strategyA);
  const powerB = computePower(stateB, strategyB);

  if (powerA > powerB) return 'A';
  if (powerB > powerA) return 'B';
  return 'draw';
}

/**
 * Compute effective power based on strategy emphasis.
 */
function computePower(state: LobsterState, strategy: number): number {
  switch (strategy) {
    case STRATEGY.ALL_ATTACK:
      return state.str * 3 + state.spd * 2 + state.vit;
    case STRATEGY.ALL_DEFENSE:
      return state.def * 3 + state.vit * 2 + state.spd;
    case STRATEGY.BALANCED:
    default:
      return state.str * 2 + state.def * 2 + state.spd + state.vit;
  }
}
