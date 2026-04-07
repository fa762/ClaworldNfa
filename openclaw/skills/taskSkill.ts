/**
 * Claw World OpenClaw — Task Skill
 *
 * Core game loop: AI generates 3 tasks based on lobster personality + WorldState,
 * player picks one, task completes immediately, rewards distributed on-chain.
 *
 * Match score = dot product of lobster personality vector and task personality vector,
 * scaled to 0-20000. High match score means the lobster is well-suited for the task,
 * yielding better rewards and personality growth.
 */

import { ethers } from 'ethers';
import type { GameContractClient } from '../contracts';
import type {
  AIProvider,
  TaskDefinition,
  TaskSession,
  LobsterState,
} from '../types';
import {
  TASK_TYPE_ICONS,
} from '../types';
import { getRarityName, getShelterName, getTaskTypeName, type SkillLang, t } from '../lang';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const BASE_REWARDS: Record<TaskDefinition['difficulty'], { xp: number; clw: number }> = {
  easy: { xp: 20, clw: 20 },
  medium: { xp: 40, clw: 40 },
  hard: { xp: 60, clw: 60 },
};

/** Maximum match score the contract accepts (uint16). */
const MAX_MATCH_SCORE = 20000;

/** Personality dimension names for prompts. */
const PERSONALITY_DIMS = ['courage', 'wisdom', 'social', 'create', 'grit'] as const;

/** Minimum personality delta threshold — matchScore >= 10000 triggers +1 drift. */
const DRIFT_THRESHOLD = 10000;

// --------------------------------------------------------------------------
// AI Prompt Helpers
// --------------------------------------------------------------------------

function buildTaskGenerationPrompt(
  state: LobsterState,
  worldRewardMultiplier: number,
  activeEvents: string[],
  lang: SkillLang = 'zh',
): string {
  const personality = `courage=${state.courage}, wisdom=${state.wisdom}, social=${state.social}, create=${state.create}, grit=${state.grit}`;
  const genes = `STR=${state.str}, DEF=${state.def}, SPD=${state.spd}, VIT=${state.vit}`;
  const eventText = activeEvents.length > 0 ? activeEvents.join(', ') : 'none';

  return [
    t(lang, '你是 Claw Civilization Universe 的任务生成器。', 'You are the task generator for Claw Civilization Universe.'),
    '',
    `Lobster stats — Level ${state.level}, Rarity ${getRarityName(lang, state.rarity)}, Shelter ${getShelterName(lang, state.shelter)}`,
    `Personality: ${personality}`,
    `Genes: ${genes}`,
    `World reward multiplier: ${worldRewardMultiplier}%, Active events: ${eventText}`,
    '',
    'Generate exactly 3 tasks the player can choose from.',
    'Each task MUST be a JSON object with these fields:',
    '  taskType: integer 0-4 (0=courage, 1=wisdom, 2=social, 3=create, 4=grit)',
    t(lang, '  title: 中文短任务名（最多20字）', '  title: short task name in English (max 20 chars)'),
    t(lang, '  description: 1-2句中文描述', '  description: 1-2 sentence description in English'),
    '  personalityVector: array of 5 integers that sum to 100, representing [courage, wisdom, social, create, grit] weight',
    '  difficulty: one of "easy", "medium", "hard"',
    '',
    'Guidelines:',
    '- Offer variety: different taskTypes and difficulties.',
    '- At least one task should align with the lobster\'s strongest personality dimension.',
    '- At least one task should challenge a weaker dimension.',
    '- Flavor the task themes based on the lobster\'s shelter environment.',
    '- Higher level lobsters should get more complex/interesting tasks.',
    '',
    'Return ONLY a JSON array of 3 task objects. No markdown, no explanation.',
  ].join('\n');
}

// --------------------------------------------------------------------------
// TaskSkill class
// --------------------------------------------------------------------------

export class TaskSkill {
  private client: GameContractClient;
  private ai: AIProvider;
  private sessions: Map<number, TaskSession> = new Map();

  constructor(client: GameContractClient, ai: AIProvider) {
    this.client = client;
    this.ai = ai;
  }

  // --------------------------------------------------------------------------
  // Generate 3 tasks using AI
  // --------------------------------------------------------------------------

  async generateTasks(nfaId: number): Promise<TaskSession> {
    // Fetch on-chain state
    const [lobsterStatus, worldState] = await Promise.all([
      this.client.getLobsterStatus(nfaId),
      this.client.getWorldState(),
    ]);

    const { state } = lobsterStatus;

    // Build prompt and call AI
    const systemPrompt = buildTaskGenerationPrompt(
      state,
      worldState.rewardMultiplier,
      worldState.activeEvents,
    );

    const rawTasks = await this.ai.chatJSON<TaskDefinition[]>(
      systemPrompt,
      `Generate 3 tasks for lobster #${nfaId}.`,
    );

    // Validate and normalize the AI output
    const tasks = validateAndNormalizeTasks(rawTasks);

    const session: TaskSession = {
      nfaId,
      tasks,
      selectedIndex: null,
      status: 'choosing',
      generatedAt: Date.now(),
    };

    this.sessions.set(nfaId, session);
    return session;
  }

  // --------------------------------------------------------------------------
  // Accept task and complete on-chain
  // --------------------------------------------------------------------------

  async acceptAndComplete(
    nfaId: number,
    choice: number,
  ): Promise<{
    txHash: string;
    matchScore: number;
    xpReward: number;
    clwReward: number;
    personalityDrift: { dimension: number; delta: number } | null;
  }> {
    const session = this.sessions.get(nfaId);
    if (!session) {
      throw new Error(`No active task session for NFA #${nfaId}. Call generateTasks first.`);
    }
    if (session.status === 'completed') {
      throw new Error(`Task session for NFA #${nfaId} is already completed.`);
    }
    if (choice < 0 || choice >= session.tasks.length) {
      throw new Error(`Invalid choice ${choice}. Must be 0-${session.tasks.length - 1}.`);
    }

    const task = session.tasks[choice];

    // Fetch current lobster state for match score calculation
    const { state } = await this.client.getLobsterStatus(nfaId);
    const matchScore = this.calculateMatchScore(state, task);

    // Determine rewards from difficulty tier
    const baseReward = BASE_REWARDS[task.difficulty];
    const xpReward = baseReward.xp;
    const clwReward = baseReward.clw;

    // Submit on-chain via operator
    const txHash = await this.client.completeTypedTask(
      nfaId,
      task.taskType,
      xpReward,
      clwReward,
      matchScore,
    );

    // Determine personality drift
    // Contract applies +1 to the task's personality dimension when matchScore >= 10000
    let personalityDrift: { dimension: number; delta: number } | null = null;
    if (matchScore >= DRIFT_THRESHOLD) {
      personalityDrift = { dimension: task.taskType, delta: 1 };
    }

    // Update session
    session.selectedIndex = choice;
    session.status = 'completed';

    return { txHash, matchScore, xpReward, clwReward, personalityDrift };
  }

  // --------------------------------------------------------------------------
  // Calculate match score
  // --------------------------------------------------------------------------

  /**
   * matchScore = floor(dot(personality, taskVector) / 50), capped at MAX_MATCH_SCORE.
   *
   * Example: personality = [70, 40, 30, 30, 30], taskVector = [80, 5, 5, 5, 5]
   *   dot = 70*80 + 40*5 + 30*5 + 30*5 + 30*5 = 5600 + 200 + 150 + 150 + 150 = 6250
   *   matchScore = floor(6250 / 50) = 125  (low — task is courage-focused but personality spread)
   *
   * With maxed personality [100, 100, 100, 100, 100] and vector [20,20,20,20,20]:
   *   dot = 10000, matchScore = 200
   *
   * With specialized personality [100, 10, 10, 10, 10] and matching vector [80,5,5,5,5]:
   *   dot = 8000 + 50 + 50 + 50 + 50 = 8200, matchScore = 164
   *
   * Realistic maximum is around 16000-20000 with very high personality stats.
   */
  calculateMatchScore(state: LobsterState, task: TaskDefinition): number {
    const personality = [state.courage, state.wisdom, state.social, state.create, state.grit];
    const weights = task.personalityVector;

    let dot = 0;
    for (let i = 0; i < 5; i++) {
      dot += personality[i] * weights[i];
    }

    const score = Math.floor(dot / 50);
    return Math.min(score, MAX_MATCH_SCORE);
  }

  // --------------------------------------------------------------------------
  // Session management
  // --------------------------------------------------------------------------

  getSession(nfaId: number): TaskSession | undefined {
    return this.sessions.get(nfaId);
  }

  clearSession(nfaId: number): void {
    this.sessions.delete(nfaId);
  }
}

// --------------------------------------------------------------------------
// Validation helpers
// --------------------------------------------------------------------------

const VALID_TASK_TYPES = new Set([0, 1, 2, 3, 4]);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

function validateAndNormalizeTasks(raw: unknown): TaskDefinition[] {
  if (!Array.isArray(raw) || raw.length < 3) {
    throw new Error('AI did not return a valid array of 3 tasks.');
  }

  const tasks = raw.slice(0, 3);

  return tasks.map((t: unknown, idx: number) => {
    if (typeof t !== 'object' || t === null) {
      throw new Error(`Task ${idx} is not a valid object.`);
    }

    const task = t as Record<string, unknown>;

    // taskType
    const taskType = Number(task.taskType);
    if (!VALID_TASK_TYPES.has(taskType)) {
      throw new Error(`Task ${idx}: invalid taskType ${task.taskType}. Must be 0-4.`);
    }

    // title
    const title = String(task.title ?? '').trim();
    if (!title) {
      throw new Error(`Task ${idx}: missing title.`);
    }

    // description
    const description = String(task.description ?? '').trim();
    if (!description) {
      throw new Error(`Task ${idx}: missing description.`);
    }

    // personalityVector
    const pv = task.personalityVector;
    if (!Array.isArray(pv) || pv.length !== 5) {
      throw new Error(`Task ${idx}: personalityVector must be an array of 5 numbers.`);
    }
    const personalityVector = pv.map((v: unknown) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.round(n);
    });

    // Normalize so sum = 100
    const sum = personalityVector.reduce((a: number, b: number) => a + b, 0);
    if (sum === 0) {
      // Fallback: equal weight
      personalityVector.fill(20);
    } else if (sum !== 100) {
      const scale = 100 / sum;
      let accumulated = 0;
      for (let i = 0; i < 4; i++) {
        personalityVector[i] = Math.round(personalityVector[i] * scale);
        accumulated += personalityVector[i];
      }
      personalityVector[4] = 100 - accumulated; // ensure exact sum
    }

    // difficulty
    const difficulty = String(task.difficulty ?? 'medium').toLowerCase();
    if (!VALID_DIFFICULTIES.has(difficulty)) {
      throw new Error(`Task ${idx}: invalid difficulty "${task.difficulty}". Must be easy/medium/hard.`);
    }

    const baseReward = BASE_REWARDS[difficulty as TaskDefinition['difficulty']];

    return {
      taskType,
      title,
      description,
      personalityVector,
      baseXP: baseReward.xp,
      baseCLW: baseReward.clw,
      difficulty: difficulty as TaskDefinition['difficulty'],
    };
  });
}
