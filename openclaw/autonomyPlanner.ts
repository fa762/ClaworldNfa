import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import type { GameContractClient } from "./contracts";
import type { AIProvider, LobsterState } from "./types";
import { evaluatePkCandidate, summarizePkProjection } from "./pkStrategy";

const ACTION_HUB_ABI = [
  "function requestAutonomousAction(uint256 nfaId, uint8 actionKind, bytes32 spendAssetId, uint256 spendAmount, bytes payload, string prompt, uint8 numChoices) returns (uint256)",
  "function adapters(uint8) view returns (address)",
  "function adapterProtocols(uint8) view returns (bytes32)",
  "function registry() view returns (address)",
  "function getActionReceiptsByNfa(uint256 nfaId, uint256 cursor, uint256 limit) view returns (tuple(uint256 requestId, uint256 nfaId, uint8 actionKind, bytes32 protocolId, bytes32 spendAssetId, uint8 status, address requester, address lastExecutor, uint8 resolvedChoice, bytes32 payloadHash, bytes32 capabilityHash, bytes32 executionRef, bytes32 resultHash, bytes32 receiptHash, uint256 requestedSpend, uint256 actualSpend, uint256 clwCredit, uint32 xpCredit, uint64 createdAt, uint64 executedAt, uint32 retryCount, string reasoningCid, string lastError)[] receipts, uint256 nextCursor)",
];

const REGISTRY_ABI = [
  "function getPolicy(uint256 nfaId, uint8 actionKind) view returns (bool enabled, uint8 riskMode, uint32 dailyLimit, uint32 actionsUsed, uint64 windowStart, uint256 maxClwPerAction)",
  "function previewAuthorizedAction(uint256 nfaId, uint8 actionKind, bytes32 assetId, uint256 spendAmount, address adapter, bytes32 protocolId, address operator) view returns (bool allowed, uint8 code, uint32 remainingToday, uint256 remainingAssetBudget, uint256 remainingProtocolBudget, uint256 currentBalance, uint256 effectiveReserve, uint32 failureStreak)",
];

const ACTION_KIND = {
  TASK: 0,
  PK: 1,
  BATTLE_ROYALE: 3,
} as const;

const PK_PHASE = {
  OPEN: 0,
  JOINED: 1,
  COMMITTED: 2,
  REVEALED: 3,
  SETTLED: 4,
  CANCELLED: 5,
} as const;

const BATTLE_ROYALE_STATUS = {
  OPEN: 0,
  PENDING_REVEAL: 1,
  SETTLED: 2,
} as const;

const RECEIPT_STATUS = {
  NONE: 0,
  REQUESTED: 1,
  FULFILLED: 2,
  EXECUTING: 3,
  EXECUTED: 4,
  FAILED: 5,
  EXPIRED: 6,
  CANCELLED: 7,
} as const;

const ASSET_CLAWORLD = ethers.utils.id("asset:claworld");
const TASK_TYPE_NAMES = ["Courage", "Wisdom", "Social", "Create", "Grit"];
const TASK_COOLDOWN_SECONDS = 4 * 60 * 60;
const DIRECTIVE_STORE_FILE = path.join(process.cwd(), ".cache", "autonomy-directives.json");
const CHECK_CODE_LABELS: Record<number, string> = {
  0: "OK",
  1: "POLICY_DISABLED",
  2: "EMERGENCY_PAUSED",
  3: "ADAPTER_NOT_APPROVED",
  4: "PROTOCOL_NOT_APPROVED",
  5: "OPERATOR_NOT_APPROVED",
  6: "SPEND_CAP_EXCEEDED",
  7: "DAILY_LIMIT_REACHED",
  8: "FAILURE_BREAKER_TRIPPED",
  9: "MISSING_SPEND_ASSET",
  10: "ASSET_BUDGET_NOT_CONFIGURED",
  11: "DAILY_ASSET_LIMIT_REACHED",
  12: "ASSET_SOURCE_NOT_SET",
  13: "RESERVE_SOURCE_NOT_SET",
  14: "RESERVE_FLOOR_BREACHED",
};

interface ActionReceiptView {
  requestId: ethers.BigNumber;
  nfaId: ethers.BigNumber;
  actionKind: number;
  protocolId: string;
  spendAssetId: string;
  status: number;
  requester: string;
  lastExecutor: string;
  resolvedChoice: number;
  payloadHash: string;
  capabilityHash: string;
  executionRef: string;
  resultHash: string;
  receiptHash: string;
  requestedSpend: ethers.BigNumber;
  actualSpend: ethers.BigNumber;
  clwCredit: ethers.BigNumber;
  xpCredit: number;
  createdAt: number;
  executedAt: number;
  retryCount: number;
  reasoningCid: string;
  lastError: string;
}

interface TaskCandidate {
  taskType: number;
  xpReward: number;
  clwRewardWei: ethers.BigNumber;
  score: number;
  utility: number;
  matchScore: number;
  streakMul: number;
  worldMul: number;
  personalityDrift: boolean;
  summary: string;
}

interface OpenPkCandidate {
  matchId: number;
  opponentNfaId: number;
  opponentState: LobsterState;
  stakeWei: ethers.BigNumber;
  candidateScore: number;
  recommendedStrategy: number;
  favorable: boolean;
  strategySummary: string;
  summary: string;
}

interface BattleRoyaleCandidate {
  matchId: number;
  roomId: number;
  stakeWei: ethers.BigNumber;
  riskMode: number;
  openSpots: number;
  occupiedRooms: number;
  roomPlayers: number;
  roomTotalWei: ethers.BigNumber;
  totalPlayers: number;
  triggerCount: number;
  candidateScore: number;
  summary: string;
}

interface PlannerDecision {
  action: "TASK" | "PK_JOIN" | "PK_CREATE" | "BATTLE_ROYALE_ENTER" | "IDLE";
  reason: string;
}

interface PlannerRequest {
  actionKind: number;
  spendAssetId: string;
  spendAmount: ethers.BigNumber;
  payload: string;
  prompt: string;
  numChoices: number;
}

interface StoredDirectiveRecord {
  tokenId: number;
  actionKind: number;
  style: "tight" | "balanced" | "expressive";
  text: string;
}

export interface AutonomyPlannerConfig {
  actionHubAddress: string;
  plannerName?: string;
  managedNfaIds: number[];
  enableTask?: boolean;
  enablePk?: boolean;
  enableBattleRoyale?: boolean;
  pkMaxCandidates?: number;
  pkMatchLookback?: number;
  pkAllowCreate?: boolean;
  pkCreateStakeClw?: string;
  battleRoyaleMaxCandidates?: number;
  battleRoyaleClaimLookback?: number;
  taskCandidateCount?: number;
  taskBaseClw?: string;
  taskClwStep?: string;
  taskBaseXp?: number;
  taskXpStep?: number;
  minActionGapMs?: number;
}

export class AutonomyPlanner {
  private readonly client: GameContractClient;
  private readonly ai: AIProvider;
  private readonly hub: ethers.Contract;
  private registry?: ethers.Contract;
  private readonly plannerName: string;
  private readonly managedNfaIds: number[];
  private readonly enableTask: boolean;
  private readonly enablePk: boolean;
  private readonly enableBattleRoyale: boolean;
  private readonly pkMaxCandidates: number;
  private readonly pkMatchLookback: number;
  private readonly pkAllowCreate: boolean;
  private readonly pkCreateStakeWei: ethers.BigNumber;
  private readonly battleRoyaleMaxCandidates: number;
  private readonly battleRoyaleClaimLookback: number;
  private readonly taskCandidateCount: number;
  private readonly taskBaseClwWei: ethers.BigNumber;
  private readonly taskClwStepWei: ethers.BigNumber;
  private readonly taskBaseXp: number;
  private readonly taskXpStep: number;
  private readonly minActionGapMs: number;
  private readonly recentlyRequested = new Map<number, number>();
  private operatorAddress?: string;

  constructor(client: GameContractClient, ai: AIProvider, config: AutonomyPlannerConfig) {
    this.client = client;
    this.ai = ai;
    this.hub = new ethers.Contract(
      config.actionHubAddress,
      ACTION_HUB_ABI,
      client.getOracleContract().signer || client.getOracleContract().provider
    );
    this.plannerName = config.plannerName ?? "claw-autonomy-planner";
    this.managedNfaIds = [...new Set(config.managedNfaIds)].filter((value) => value > 0);
    this.enableTask = config.enableTask ?? true;
    this.enablePk = config.enablePk ?? true;
    this.enableBattleRoyale = config.enableBattleRoyale ?? true;
    this.pkMaxCandidates = Math.max(1, config.pkMaxCandidates ?? 3);
    this.pkMatchLookback = Math.max(1, config.pkMatchLookback ?? 50);
    this.pkAllowCreate = config.pkAllowCreate ?? false;
    this.pkCreateStakeWei = ethers.utils.parseEther(config.pkCreateStakeClw ?? "100");
    this.battleRoyaleMaxCandidates = Math.max(1, config.battleRoyaleMaxCandidates ?? 3);
    this.battleRoyaleClaimLookback = Math.max(1, config.battleRoyaleClaimLookback ?? 12);
    this.taskCandidateCount = Math.max(1, config.taskCandidateCount ?? 3);
    this.taskBaseClwWei = ethers.utils.parseEther(config.taskBaseClw ?? "18");
    this.taskClwStepWei = ethers.utils.parseEther(config.taskClwStep ?? "4");
    this.taskBaseXp = Math.max(1, config.taskBaseXp ?? 12);
    this.taskXpStep = Math.max(1, config.taskXpStep ?? 2);
    this.minActionGapMs = Math.max(5_000, config.minActionGapMs ?? 60_000);
  }

  async runOnce(): Promise<void> {
    for (const nfaId of this.managedNfaIds) {
      try {
        await this.planForNfa(nfaId);
      } catch (error) {
        console.error(`[${this.plannerName}] planner failed for NFA #${nfaId}:`, error);
      }
    }
  }

  private async planForNfa(nfaId: number): Promise<void> {
    if (this.isCoolingDown(nfaId)) {
      return;
    }

    const openReceipts = await this.getOpenReceipts(nfaId);
    if (openReceipts.length > 0) {
      return;
    }

    if (this.enablePk) {
      const maintenance = await this.findPkMaintenanceAction(nfaId);
      if (maintenance) {
        await this.requestAction(nfaId, maintenance);
        return;
      }
    }

    if (this.enableBattleRoyale) {
      const maintenance = await this.findBattleRoyaleMaintenanceAction(nfaId);
      if (maintenance) {
        await this.requestAction(nfaId, maintenance);
        return;
      }
    }

    const lobster = await this.client.getLobsterStatus(nfaId);
    const world = await this.client.getWorldState();
    const taskPolicy = this.enableTask ? await this.getActionPolicy(nfaId, ACTION_KIND.TASK) : null;
    const pkPolicy = this.enablePk ? await this.getActionPolicy(nfaId, ACTION_KIND.PK) : null;
    const battleRoyalePolicy = this.enableBattleRoyale
      ? await this.getActionPolicy(nfaId, ACTION_KIND.BATTLE_ROYALE)
      : null;
    const taskEnabled = this.enableTask && Boolean(taskPolicy?.enabled);
    const pkEnabled = this.enablePk && Boolean(pkPolicy?.enabled);
    const battleRoyaleEnabled = this.enableBattleRoyale && Boolean(battleRoyalePolicy?.enabled);

    if (this.enableTask && !taskEnabled) {
      console.log(`[${this.plannerName}] NFA #${nfaId}: task policy disabled, skipping task planner`);
    }
    if (this.enablePk && !pkEnabled) {
      console.log(`[${this.plannerName}] NFA #${nfaId}: PK policy disabled, skipping PK planner`);
    }
    if (this.enableBattleRoyale && !battleRoyaleEnabled) {
      console.log(`[${this.plannerName}] NFA #${nfaId}: Battle Royale policy disabled, skipping battle royale planner`);
    }

    const taskCandidates = taskEnabled ? await this.buildTaskCandidates(nfaId, lobster) : [];
    const pkCandidates = pkEnabled ? await this.scanOpenPkCandidates(nfaId) : [];
    const battleRoyaleCandidates = battleRoyaleEnabled
      ? await this.scanBattleRoyaleCandidates(nfaId, battleRoyalePolicy!.riskMode)
      : [];

    const decision = await this.planNextAction(
      nfaId,
      lobster.state,
      world,
      taskCandidates,
      pkCandidates,
      battleRoyaleCandidates
    );
    if (decision.action === "TASK" && taskCandidates.length > 0) {
      await this.requestAction(nfaId, this.buildTaskRequest(nfaId, taskCandidates, decision.reason));
      return;
    }

    if (decision.action === "PK_JOIN" && pkCandidates.length > 0) {
      await this.requestAction(nfaId, this.buildPkJoinRequest(nfaId, pkCandidates, decision.reason));
      return;
    }

    if (decision.action === "BATTLE_ROYALE_ENTER" && battleRoyaleCandidates.length > 0) {
      await this.requestAction(
        nfaId,
        this.buildBattleRoyaleEnterRequest(nfaId, battleRoyaleCandidates, decision.reason)
      );
      return;
    }

    if (decision.action === "PK_CREATE" && this.enablePk && this.pkAllowCreate) {
      await this.requestAction(nfaId, this.buildPkCreateRequest(nfaId, decision.reason));
      return;
    }

    console.log(`[${this.plannerName}] NFA #${nfaId}: idle (${decision.reason})`);
  }

  private isCoolingDown(nfaId: number): boolean {
    const lastRequestedAt = this.recentlyRequested.get(nfaId);
    return typeof lastRequestedAt === "number" && Date.now() - lastRequestedAt < this.minActionGapMs;
  }

  private readDirectiveStore(): StoredDirectiveRecord[] {
    try {
      const raw = fs.readFileSync(DIRECTIVE_STORE_FILE, "utf8");
      const parsed = JSON.parse(raw) as { records?: unknown[] };
      if (!Array.isArray(parsed.records)) {
        return [];
      }
      return parsed.records
        .map((value) => this.normalizeDirectiveRecord(value))
        .filter((value): value is StoredDirectiveRecord => Boolean(value));
    } catch {
      return [];
    }
  }

  private normalizeDirectiveRecord(value: unknown): StoredDirectiveRecord | null {
    const record = value as Partial<StoredDirectiveRecord> | null;
    if (!record) return null;
    if (!Number.isInteger(record.tokenId) || (record.tokenId ?? 0) <= 0) return null;
    if (!Number.isInteger(record.actionKind) || (record.actionKind ?? -1) < 0) return null;
    if (record.style !== "tight" && record.style !== "balanced" && record.style !== "expressive") return null;
    if (typeof record.text !== "string") return null;
    return {
      tokenId: record.tokenId!,
      actionKind: record.actionKind!,
      style: record.style,
      text: record.text.trim().slice(0, 220),
    };
  }

  private getDirective(recordNfaId: number, actionKind: number): StoredDirectiveRecord | null {
    const records = this.readDirectiveStore();
    return records.find((record) => record.tokenId === recordNfaId && record.actionKind === actionKind) ?? null;
  }

  private appendDirectivePrompt(basePrompt: string, nfaId: number, actionKind: number): string {
    const directive = this.getDirective(nfaId, actionKind);
    if (!directive) {
      return basePrompt;
    }

    const styleLine =
      directive.style === "tight"
        ? "Directive style: tight execution. Favor discipline, bounded choices, and stability."
        : directive.style === "expressive"
        ? "Directive style: explain more. Surface tradeoffs clearly, but still choose only among bounded live options."
        : "Directive style: balanced judgment. Balance upside, stability, and clarity while staying inside the bounded action surface.";
    const textLine = directive.text ? `User directive: ${directive.text}` : "User directive: none.";
    return [basePrompt, "User-specified autonomy directive:", styleLine, textLine].join(" ");
  }

  private async getOpenReceipts(nfaId: number): Promise<ActionReceiptView[]> {
    const [receipts] = (await this.hub.getActionReceiptsByNfa(nfaId, 0, 50)) as [ActionReceiptView[], ethers.BigNumber];
    return receipts.filter((receipt) => {
      const status = Number(receipt.status);
      return (
        status === RECEIPT_STATUS.REQUESTED ||
        status === RECEIPT_STATUS.FULFILLED ||
        status === RECEIPT_STATUS.EXECUTING
      );
    });
  }

  private async getRegistry(): Promise<ethers.Contract> {
    if (this.registry) {
      return this.registry;
    }

    const registryAddress = (await this.hub.registry()) as string;
    this.registry = new ethers.Contract(
      registryAddress,
      REGISTRY_ABI,
      this.hub.signer || this.hub.provider
    );
    return this.registry;
  }

  private async isActionPolicyEnabled(nfaId: number, actionKind: number): Promise<boolean> {
    const policy = await this.getActionPolicy(nfaId, actionKind);
    return Boolean(policy?.enabled);
  }

  private async getActionPolicy(
    nfaId: number,
    actionKind: number
  ): Promise<{
    enabled: boolean;
    riskMode: number;
    dailyLimit: number;
    actionsUsed: number;
    windowStart: number;
    maxClwPerAction: ethers.BigNumber;
  }> {
    const registry = await this.getRegistry();
    const [enabled, riskMode, dailyLimit, actionsUsed, windowStart, maxClwPerAction] =
      (await registry.getPolicy(nfaId, actionKind)) as [
        boolean,
        number,
        number,
        number,
        ethers.BigNumber,
        ethers.BigNumber
      ];
    return {
      enabled: Boolean(enabled),
      riskMode: Number(riskMode),
      dailyLimit: Number(dailyLimit),
      actionsUsed: Number(actionsUsed),
      windowStart: Number(windowStart),
      maxClwPerAction: ethers.BigNumber.from(maxClwPerAction),
    };
  }

  private async getOperatorAddress(): Promise<string> {
    if (!this.operatorAddress) {
      this.operatorAddress = await this.hub.signer.getAddress();
    }
    return this.operatorAddress;
  }

  private async previewActionAllowance(
    nfaId: number,
    actionKind: number,
    spendAssetId: string,
    spendAmount: ethers.BigNumber
  ): Promise<{
    allowed: boolean;
    code: number;
    remainingToday: number;
    remainingAssetBudget: ethers.BigNumber;
    remainingProtocolBudget: ethers.BigNumber;
    currentBalance: ethers.BigNumber;
    effectiveReserve: ethers.BigNumber;
  }> {
    const registry = await this.getRegistry();
    const [adapter, protocolId, operator] = await Promise.all([
      this.hub.adapters(actionKind) as Promise<string>,
      this.hub.adapterProtocols(actionKind) as Promise<string>,
      this.getOperatorAddress(),
    ]);

    const [allowed, code, remainingToday, remainingAssetBudget, remainingProtocolBudget, currentBalance, effectiveReserve] =
      (await registry.previewAuthorizedAction(
        nfaId,
        actionKind,
        spendAssetId,
        spendAmount,
        adapter,
        protocolId,
        operator
      )) as [boolean, number, number, ethers.BigNumber, ethers.BigNumber, ethers.BigNumber, ethers.BigNumber, number];

    return {
      allowed,
      code,
      remainingToday,
      remainingAssetBudget,
      remainingProtocolBudget,
      currentBalance,
      effectiveReserve,
    };
  }

  private async isRequestAllowed(nfaId: number, request: PlannerRequest): Promise<boolean> {
    const {
      allowed,
      code,
      remainingToday,
      remainingAssetBudget,
      remainingProtocolBudget,
      currentBalance,
      effectiveReserve,
    } = await this.previewActionAllowance(nfaId, request.actionKind, request.spendAssetId, request.spendAmount);

    if (allowed) {
      return true;
    }

    console.log(
      `[${this.plannerName}] NFA #${nfaId}: preflight blocked ${describeActionKind(request.actionKind)} with ${CHECK_CODE_LABELS[code] ?? `CODE_${code}`} (remainingToday=${remainingToday}, assetBudget=${remainingAssetBudget.toString()}, protocolBudget=${remainingProtocolBudget.toString()}, balance=${currentBalance.toString()}, reserve=${effectiveReserve.toString()})`
    );
    return false;
  }

  private async findPkMaintenanceAction(
    nfaId: number
  ): Promise<{ actionKind: number; spendAssetId: string; spendAmount: ethers.BigNumber; payload: string; prompt: string; numChoices: number } | null> {
    const pkAdapterAddress = await this.hub.adapters(ACTION_KIND.PK);
    if (!pkAdapterAddress || pkAdapterAddress === ethers.constants.AddressZero) {
      return null;
    }

    const totalMatches = await this.client.getPKMatchCount();
    const fromMatchId = Math.max(1, totalMatches - this.pkMatchLookback + 1);
    for (let matchId = totalMatches; matchId >= fromMatchId; matchId--) {
      const match = await this.client.getPKMatch(matchId);
      if (match.nfaA !== nfaId && match.nfaB !== nfaId) continue;

      const participants = await this.client.getPKParticipants(matchId);
      const isAutonomousParticipant =
        (match.nfaA === nfaId && participants.participantA.toLowerCase() === pkAdapterAddress.toLowerCase()) ||
        (match.nfaB === nfaId && participants.participantB.toLowerCase() === pkAdapterAddress.toLowerCase());
      if (!isAutonomousParticipant) continue;

      const isOurRevealPending =
        (match.nfaA === nfaId && !match.revealedA) || (match.nfaB === nfaId && !match.revealedB);

      if (
        isOurRevealPending &&
        (match.phase === PK_PHASE.COMMITTED || match.phase === PK_PHASE.REVEALED)
      ) {
        return {
          actionKind: ACTION_KIND.PK,
          spendAssetId: ASSET_CLAWORLD,
          spendAmount: ethers.constants.Zero,
          payload: ethers.utils.defaultAbiCoder.encode(
            ["uint8", "bytes"],
            [2, ethers.utils.defaultAbiCoder.encode(["uint256"], [matchId])]
          ),
          prompt: `Decide whether to reveal the prepared public PK commitment for match #${matchId} now, or wait.`,
          numChoices: 2,
        };
      }

      if (
        !isOurRevealPending &&
        match.phase === PK_PHASE.REVEALED
      ) {
        return {
          actionKind: ACTION_KIND.PK,
          spendAssetId: ASSET_CLAWORLD,
          spendAmount: ethers.constants.Zero,
          payload: ethers.utils.defaultAbiCoder.encode(
            ["uint8", "bytes"],
            [3, ethers.utils.defaultAbiCoder.encode(["uint256"], [matchId])]
          ),
          prompt: `Decide whether to settle the already-revealed public PK match #${matchId} now, or hold for later.`,
          numChoices: 2,
        };
      }
    }

    return null;
  }

  private async findBattleRoyaleMaintenanceAction(nfaId: number): Promise<PlannerRequest | null> {
    const battleRoyaleAddress = this.client.addresses.battleRoyale;
    if (!battleRoyaleAddress || battleRoyaleAddress === ethers.constants.AddressZero) {
      return null;
    }

    const owner = (await this.client.getNFAOwner(nfaId)).toLowerCase();
    const totalMatches = await this.client.getBattleRoyaleMatchCount();
    if (totalMatches <= 0) {
      return null;
    }

    const fromMatchId = Math.max(1, totalMatches - this.battleRoyaleClaimLookback + 1);
    for (let matchId = totalMatches; matchId >= fromMatchId; matchId--) {
      const matchInfo = await this.client.getBattleRoyaleMatchInfo(matchId);
      if (matchInfo.status !== BATTLE_ROYALE_STATUS.SETTLED) {
        continue;
      }

      const effectiveNfa = await this.client.getBattleRoyaleEffectiveNfa(matchId, owner);
      if (effectiveNfa !== nfaId) {
        continue;
      }

      const claimable = await this.client.getBattleRoyaleClaimable(matchId, owner);
      if (claimable <= 0n) {
        continue;
      }

      return {
        actionKind: ACTION_KIND.BATTLE_ROYALE,
        spendAssetId: ASSET_CLAWORLD,
        spendAmount: ethers.constants.Zero,
        payload: ethers.utils.defaultAbiCoder.encode(
          ["uint8", "bytes"],
          [3, ethers.utils.defaultAbiCoder.encode(["uint256"], [matchId])]
        ),
        prompt: `Decide whether to claim the settled Battle Royale reward for match #${matchId} now, or hold. Claimable reward is ${ethers.utils.formatEther(claimable.toString())} Claworld.`,
        numChoices: 2,
      };
    }

    return null;
  }

  private async buildTaskCandidates(
    nfaId: number,
    lobster: Awaited<ReturnType<GameContractClient["getLobsterStatus"]>>
  ): Promise<TaskCandidate[]> {
    const state = lobster.state;
    const lastTaskAt = await this.client.getTaskLastTime(nfaId);
    const now = Math.floor(Date.now() / 1000);
    if (lastTaskAt > 0 && lastTaskAt + TASK_COOLDOWN_SECONDS > now) {
      const readyAt = lastTaskAt + TASK_COOLDOWN_SECONDS;
      console.log(
        `[${this.plannerName}] NFA #${nfaId}: task cooldown active until ${new Date(readyAt * 1000).toISOString()}`
      );
      return [];
    }

    const stats = await this.client.getTaskStats(nfaId);
    const balanceWei = ethers.utils.parseEther(lobster.clwBalance);
    const dailyCostWei = ethers.utils.parseEther(lobster.dailyCost);
    const reserveTargetWei = dailyCostWei.mul(3);
    const needsIncome = balanceWei.lt(reserveTargetWei);
    const baseAffinity = [
      state.courage,
      state.wisdom,
      state.social,
      state.create,
      state.grit,
    ];

    const previews = await Promise.all(
      Array.from({ length: 5 }, async (_, taskType) => {
        const affinity = baseAffinity[taskType] ?? 0;
        const historicalCount = stats.counts[taskType] ?? 0;
        const xpReward = Math.max(
          6,
          this.taskBaseXp + Math.floor(state.level / 12) - Math.floor(historicalCount / 4)
        );
        const rewardIndexPenalty = Math.min(2, Math.floor(historicalCount / 3));
        const clwRewardWei = this.taskBaseClwWei.sub(this.taskClwStepWei.mul(rewardIndexPenalty));
        const preview = await this.client.previewTypedTaskOutcome(
          nfaId,
          taskType,
          xpReward,
          ethers.utils.formatEther(clwRewardWei)
        );
        const actualClwWei = ethers.utils.parseEther(preview.actualClw);
        const incomeWeight = needsIncome ? 2.0 : 1.0;
        const xpWeight = needsIncome ? 0.6 : 1.1;
        const affinityWeight = 1.5;
        const driftBonus = preview.personalityDrift ? 25 : 0;
        const clwUtility = Number(actualClwWei.div(ethers.utils.parseEther("1")).toString());
        const utility =
          affinity * affinityWeight +
          clwUtility * 10 * incomeWeight +
          xpReward * xpWeight +
          driftBonus +
          preview.matchScore / 200 -
          historicalCount * 6;

        return {
          taskType,
          xpReward,
          clwRewardWei,
          score: affinity,
          utility,
          matchScore: preview.matchScore,
          streakMul: preview.streakMul,
          worldMul: preview.worldMul,
          personalityDrift: preview.personalityDrift,
          actualClwWei,
          historicalCount,
        };
      })
    );

    return previews
      .sort((a, b) => b.utility - a.utility)
      .slice(0, this.taskCandidateCount)
      .map((entry) => ({
        taskType: entry.taskType,
        xpReward: entry.xpReward,
        clwRewardWei: entry.clwRewardWei,
        score: entry.score,
        utility: Math.round(entry.utility),
        matchScore: entry.matchScore,
        streakMul: entry.streakMul,
        worldMul: entry.worldMul,
        personalityDrift: entry.personalityDrift,
        summary:
          `${TASK_TYPE_NAMES[entry.taskType]} task, affinity ${entry.score}, projected CLW ${ethers.utils.formatEther(
            entry.actualClwWei
          )}, XP ${entry.xpReward}, match ${entry.matchScore}, streak ${entry.streakMul / 100}%, ` +
          `count ${entry.historicalCount}, utility ${Math.round(entry.utility)}${entry.personalityDrift ? ", drift +" : ""}`,
      }));
  }

  private async scanOpenPkCandidates(nfaId: number): Promise<OpenPkCandidate[]> {
    const totalMatches = await this.client.getPKMatchCount();
    const fromMatchId = Math.max(1, totalMatches - this.pkMatchLookback + 1);
    const selfState = (await this.client.getLobsterStatus(nfaId)).state;
    const candidates: OpenPkCandidate[] = [];

    for (let matchId = totalMatches; matchId >= fromMatchId; matchId--) {
      const match = await this.client.getPKMatch(matchId);
      if (match.phase !== PK_PHASE.OPEN) continue;
      if (match.nfaA === 0 || match.nfaB !== 0) continue;
      if (match.nfaA === nfaId) continue;
      const stakeWei = ethers.BigNumber.from(match.stake.toString());

      const allowance = await this.previewActionAllowance(nfaId, ACTION_KIND.PK, ASSET_CLAWORLD, stakeWei);
      if (!allowance.allowed) {
        continue;
      }

      const opponent = await this.client.getLobsterStatus(match.nfaA);
      const evaluation = evaluatePkCandidate(selfState, opponent.state);
      const strategySummary = evaluation.projections.map(summarizePkProjection).join(" | ");
      candidates.push({
        matchId,
        opponentNfaId: match.nfaA,
        opponentState: opponent.state,
        stakeWei,
        candidateScore: evaluation.candidateScore,
        recommendedStrategy: evaluation.recommendedStrategy,
        favorable: evaluation.favorable,
        strategySummary,
        summary:
          `PK #${matchId} vs NFA #${match.nfaA}, stake ${ethers.utils.formatEther(match.stake.toString())}, ` +
          `best ${evaluation.recommendedLabel}, ${summarizePkProjection(evaluation.recommendedProjection)}`,
      });
    }

    return candidates
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, this.pkMaxCandidates);
  }

  private async scanBattleRoyaleCandidates(
    nfaId: number,
    riskMode: number
  ): Promise<BattleRoyaleCandidate[]> {
    const battleRoyaleAddress = this.client.addresses.battleRoyale;
    if (!battleRoyaleAddress || battleRoyaleAddress === ethers.constants.AddressZero) {
      return [];
    }

    const matchId = await this.client.getLatestBattleRoyaleMatch();
    if (matchId <= 0) {
      return [];
    }

    const [owner, matchInfo, matchConfig, snapshot, policy] = await Promise.all([
      this.client.getNFAOwner(nfaId),
      this.client.getBattleRoyaleMatchInfo(matchId),
      this.client.getBattleRoyaleMatchConfig(matchId),
      this.client.getBattleRoyaleSnapshot(matchId),
      this.getActionPolicy(nfaId, ACTION_KIND.BATTLE_ROYALE),
    ]);

    if (matchInfo.status !== BATTLE_ROYALE_STATUS.OPEN) {
      return [];
    }

    const playerInfo = await this.client.getBattleRoyalePlayerInfo(matchId, owner);
    if (playerInfo.roomId > 0) {
      return [];
    }

    const occupiedRooms = snapshot.playerCounts.filter((value) => Number(value) > 0).length;
    const openSpots = Math.max(0, matchConfig.triggerCount - matchInfo.totalPlayers);
    if (openSpots <= 0) {
      return [];
    }

    const roomChoices = Array.from({ length: 10 }, (_, index) => ({
      roomId: index + 1,
      roomPlayers: Number(snapshot.playerCounts[index] ?? 0n),
      roomTotalWei: ethers.BigNumber.from((snapshot.roomTotals[index] ?? 0n).toString()),
    })).sort((a, b) => {
      if (riskMode >= 2) {
        if (a.roomPlayers !== b.roomPlayers) return a.roomPlayers - b.roomPlayers;
        if (!a.roomTotalWei.eq(b.roomTotalWei)) return b.roomTotalWei.gt(a.roomTotalWei) ? 1 : -1;
      } else if (riskMode <= 0) {
        if (a.roomPlayers !== b.roomPlayers) return b.roomPlayers - a.roomPlayers;
        if (!a.roomTotalWei.eq(b.roomTotalWei)) return a.roomTotalWei.gt(b.roomTotalWei) ? 1 : -1;
      } else {
        const aDistance = Math.abs(a.roomPlayers * 10 - 25);
        const bDistance = Math.abs(b.roomPlayers * 10 - 25);
        if (aDistance !== bDistance) return aDistance - bDistance;
      }
      return a.roomId - b.roomId;
    });

    const requestedStake = ethers.BigNumber.from(matchConfig.minStake.toString()).mul(
      riskMode >= 2 ? 3 : riskMode <= 0 ? 1 : 2
    );
    const maxPolicyStake = ethers.BigNumber.from(policy.maxClwPerAction);
    const cappedStake =
      maxPolicyStake.gt(0) && maxPolicyStake.lt(requestedStake) ? maxPolicyStake : requestedStake;
    const stakeWei = cappedStake.lt(ethers.BigNumber.from(matchConfig.minStake.toString()))
      ? ethers.BigNumber.from(matchConfig.minStake.toString())
      : cappedStake;

    const candidates: BattleRoyaleCandidate[] = [];
    for (const room of roomChoices) {
      if (candidates.length >= this.battleRoyaleMaxCandidates) {
        break;
      }

      const allowance = await this.previewActionAllowance(
        nfaId,
        ACTION_KIND.BATTLE_ROYALE,
        ASSET_CLAWORLD,
        stakeWei
      );
      if (!allowance.allowed) {
        continue;
      }

      const roomPreference =
        riskMode >= 2
          ? (10 - room.roomPlayers) * 12
          : riskMode <= 0
          ? room.roomPlayers * 12
          : 100 - Math.abs(room.roomPlayers * 10 - 25);
      const candidateScore =
        roomPreference +
        Math.min(30, openSpots * 10) +
        Math.min(20, occupiedRooms * 4) +
        Math.min(20, Number(ethers.utils.formatEther(stakeWei)));

      candidates.push({
        matchId,
        roomId: room.roomId,
        stakeWei,
        riskMode,
        openSpots,
        occupiedRooms,
        roomPlayers: room.roomPlayers,
        roomTotalWei: room.roomTotalWei,
        totalPlayers: matchInfo.totalPlayers,
        triggerCount: matchConfig.triggerCount,
        candidateScore,
        summary:
          `Battle Royale #${matchId}, room ${room.roomId}, stake ${ethers.utils.formatEther(stakeWei)}, ${describeRiskMode(
            riskMode
          )}, room players ${room.roomPlayers}, room total ${ethers.utils.formatEther(
            room.roomTotalWei
          )}, total players ${matchInfo.totalPlayers}/${matchConfig.triggerCount}, open spots ${openSpots}`,
      });
    }

    return candidates
      .sort((a, b) => b.candidateScore - a.candidateScore)
      .slice(0, this.battleRoyaleMaxCandidates);
  }

  private async planNextAction(
    nfaId: number,
    state: LobsterState,
    world: Awaited<ReturnType<GameContractClient["getWorldState"]>>,
    taskCandidates: TaskCandidate[],
    pkCandidates: OpenPkCandidate[],
    battleRoyaleCandidates: BattleRoyaleCandidate[]
  ): Promise<PlannerDecision> {
    if (
      taskCandidates.length === 0 &&
      pkCandidates.length === 0 &&
      battleRoyaleCandidates.length === 0 &&
      !this.pkAllowCreate
    ) {
      return { action: "IDLE", reason: "No safe or useful action available right now." };
    }

    if (
      taskCandidates.length > 0 &&
      pkCandidates.length === 0 &&
      battleRoyaleCandidates.length === 0 &&
      !this.pkAllowCreate
    ) {
      return { action: "TASK", reason: "Task is the only available productive action right now." };
    }

    if (
      taskCandidates.length === 0 &&
      pkCandidates.length > 0 &&
      battleRoyaleCandidates.length === 0 &&
      !this.pkAllowCreate
    ) {
      if (pkCandidates[0].favorable) {
        return { action: "PK_JOIN", reason: "A favorable public PK opportunity is available now." };
      }
      return { action: "IDLE", reason: "Public PK options are available, but current win odds look too weak." };
    }

    if (
      taskCandidates.length === 0 &&
      pkCandidates.length === 0 &&
      battleRoyaleCandidates.length > 0 &&
      !this.pkAllowCreate
    ) {
      return { action: "BATTLE_ROYALE_ENTER", reason: "Battle Royale is the only live arena opportunity right now." };
    }

    if (
      taskCandidates.length === 0 &&
      pkCandidates.length === 0 &&
      battleRoyaleCandidates.length === 0 &&
      this.pkAllowCreate
    ) {
      return { action: "PK_CREATE", reason: "No open opportunities exist, so create a bounded PK opportunity." };
    }

    const availableActions = [
      taskCandidates.length > 0 ? "TASK" : null,
      pkCandidates.length > 0 ? "PK_JOIN" : null,
      battleRoyaleCandidates.length > 0 ? "BATTLE_ROYALE_ENTER" : null,
      this.pkAllowCreate ? "PK_CREATE" : null,
      "IDLE",
    ].filter(Boolean);

    const systemPrompt = [
      "You are the Clawworld autonomy planner.",
      "Choose the single best next action for this NFA.",
      "You are deciding between high-level actions only.",
      "Do not invent new actions.",
      "Prefer PK_JOIN only when the opponent set looks favorable enough.",
      "Prefer TASK when it is the safer productive action.",
      "Return strict JSON with keys: action, reason.",
      `Allowed actions: ${availableActions.join(", ")}.`,
    ].join(" ");

    const userMessage = JSON.stringify(
      {
        nfaId,
        lobster: {
          level: state.level,
          clwBalanceHint: "Use budget/risk rules on-chain; do not assume unlimited spend.",
          personality: {
            courage: state.courage,
            wisdom: state.wisdom,
            social: state.social,
            create: state.create,
            grit: state.grit,
          },
          combat: {
            str: state.str,
            def: state.def,
            spd: state.spd,
            vit: state.vit,
          },
        },
        world,
        taskCandidates: taskCandidates.map((candidate) => ({
          taskType: TASK_TYPE_NAMES[candidate.taskType] ?? `Task ${candidate.taskType}`,
          clwReward: ethers.utils.formatEther(candidate.clwRewardWei),
          xpReward: candidate.xpReward,
          utility: candidate.utility,
          matchScore: candidate.matchScore,
          streakMul: candidate.streakMul,
          worldMul: candidate.worldMul,
          personalityDrift: candidate.personalityDrift,
          summary: candidate.summary,
        })),
        pkCandidates: pkCandidates.map((candidate) => ({
          summary: candidate.summary,
          recommendedStrategy: candidate.recommendedStrategy,
          favorable: candidate.favorable,
          strategySummary: candidate.strategySummary,
        })),
        battleRoyaleCandidates: battleRoyaleCandidates.map((candidate) => ({
          matchId: candidate.matchId,
          roomId: candidate.roomId,
          stakeClaworld: ethers.utils.formatEther(candidate.stakeWei),
          riskMode: describeRiskMode(candidate.riskMode),
          roomPlayers: candidate.roomPlayers,
          roomTotalClaworld: ethers.utils.formatEther(candidate.roomTotalWei),
          totalPlayers: candidate.totalPlayers,
          triggerCount: candidate.triggerCount,
          openSpots: candidate.openSpots,
          occupiedRooms: candidate.occupiedRooms,
          candidateScore: candidate.candidateScore,
          summary: candidate.summary,
        })),
      },
      null,
      2
    );

    try {
      const decision = await this.ai.chatJSON<PlannerDecision>(systemPrompt, userMessage);
      if (!["TASK", "PK_JOIN", "PK_CREATE", "BATTLE_ROYALE_ENTER", "IDLE"].includes(decision.action)) {
        throw new Error(`Unsupported planner action: ${decision.action}`);
      }
      return decision;
    } catch (error) {
      console.warn(`[${this.plannerName}] planner fallback for NFA #${nfaId}:`, error);
      if (battleRoyaleCandidates.length > 0) {
        return { action: "BATTLE_ROYALE_ENTER", reason: "Fallback picked the strongest Battle Royale candidate." };
      }
      if (pkCandidates.length > 0 && pkCandidates[0].favorable) {
        return { action: "PK_JOIN", reason: "Fallback picked the strongest favorable public PK candidate." };
      }
      if (taskCandidates.length > 0) {
        return { action: "TASK", reason: "Fallback picked the strongest available task candidate." };
      }
      if (this.pkAllowCreate) {
        return { action: "PK_CREATE", reason: "Fallback created a public PK opportunity because no better option exists." };
      }
      return { action: "IDLE", reason: "No safe or useful action available right now." };
    }
  }

  private buildTaskRequest(nfaId: number, taskCandidates: TaskCandidate[], reason: string): PlannerRequest {
    return {
      actionKind: ACTION_KIND.TASK,
      spendAssetId: ethers.constants.HashZero,
      spendAmount: ethers.constants.Zero,
      payload: ethers.utils.defaultAbiCoder.encode(
        ["uint8[]", "uint32[]", "uint256[]"],
        [
          taskCandidates.map((candidate) => candidate.taskType),
          taskCandidates.map((candidate) => candidate.xpReward),
          taskCandidates.map((candidate) => candidate.clwRewardWei),
        ]
      ),
      prompt: this.appendDirectivePrompt(
        `Choose the best existing task for this lobster. Planner context: ${reason}`,
        nfaId,
        ACTION_KIND.TASK
      ),
      numChoices: taskCandidates.length,
    };
  }

  private buildPkJoinRequest(nfaId: number, pkCandidates: OpenPkCandidate[], reason: string): PlannerRequest {
    const maxStakeWei = pkCandidates.reduce(
      (current, candidate) => (candidate.stakeWei.gt(current) ? candidate.stakeWei : current),
      ethers.constants.Zero
    );
    return {
      actionKind: ACTION_KIND.PK,
      spendAssetId: ASSET_CLAWORLD,
      spendAmount: maxStakeWei,
      payload: ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes"],
        [1, ethers.utils.defaultAbiCoder.encode(["uint256[]"], [pkCandidates.map((candidate) => candidate.matchId)])]
      ),
      prompt: this.appendDirectivePrompt(
        `Choose the best open public PK match and strategy. Planner context: ${reason}. ` +
          `Candidate analysis: ${pkCandidates
            .map(
              (candidate) =>
                `#${candidate.matchId}->${candidate.summary}; ${candidate.strategySummary}`
            )
            .join(" || ")}`,
        nfaId,
        ACTION_KIND.PK
      ),
      numChoices: pkCandidates.length * 3,
    };
  }

  private buildPkCreateRequest(nfaId: number, reason: string): PlannerRequest {
    return {
      actionKind: ACTION_KIND.PK,
      spendAssetId: ASSET_CLAWORLD,
      spendAmount: this.pkCreateStakeWei,
      payload: ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes"],
        [0, "0x"]
      ),
      prompt: this.appendDirectivePrompt(
        `Create a new public PK match with the best initial strategy. Planner context: ${reason}`,
        nfaId,
        ACTION_KIND.PK
      ),
      numChoices: 3,
    };
  }

  private buildBattleRoyaleEnterRequest(
    nfaId: number,
    battleRoyaleCandidates: BattleRoyaleCandidate[],
    reason: string
  ): PlannerRequest {
    const maxStakeWei = battleRoyaleCandidates.reduce(
      (current, candidate) => (candidate.stakeWei.gt(current) ? candidate.stakeWei : current),
      ethers.constants.Zero
    );
    const matchId = battleRoyaleCandidates[0].matchId;
    return {
      actionKind: ACTION_KIND.BATTLE_ROYALE,
      spendAssetId: ASSET_CLAWORLD,
      spendAmount: maxStakeWei,
      payload: ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes"],
        [
          0,
          ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint8[]", "uint256[]"],
            [
              matchId,
              battleRoyaleCandidates.map((candidate) => candidate.roomId),
              battleRoyaleCandidates.map((candidate) => candidate.stakeWei),
            ]
          ),
        ]
      ),
      prompt: this.appendDirectivePrompt(
        `Choose the best Battle Royale room and stake option for this lobster. Planner context: ${reason}. ` +
          `Candidate analysis: ${battleRoyaleCandidates.map((candidate) => candidate.summary).join(" || ")}`,
        nfaId,
        ACTION_KIND.BATTLE_ROYALE
      ),
      numChoices: battleRoyaleCandidates.length,
    };
  }

  private async requestAction(nfaId: number, request: PlannerRequest): Promise<void> {
    if (!(await this.isRequestAllowed(nfaId, request))) {
      return;
    }

    const requestId = await this.hub.callStatic.requestAutonomousAction(
      nfaId,
      request.actionKind,
      request.spendAssetId,
      request.spendAmount,
      request.payload,
      request.prompt,
      request.numChoices
    );
    await this.hub.requestAutonomousAction(
      nfaId,
      request.actionKind,
      request.spendAssetId,
      request.spendAmount,
      request.payload,
      request.prompt,
      request.numChoices
    );

    this.recentlyRequested.set(nfaId, Date.now());
    console.log(
      `[${this.plannerName}] queued request #${requestId.toString()} for NFA #${nfaId} (action ${request.actionKind})`
    );
  }
}

function describeActionKind(actionKind: number): string {
  switch (actionKind) {
    case ACTION_KIND.TASK:
      return "TASK";
    case ACTION_KIND.PK:
      return "PK";
    case ACTION_KIND.BATTLE_ROYALE:
      return "BATTLE_ROYALE";
    default:
      return `ACTION_${actionKind}`;
  }
}

function describeRiskMode(riskMode: number): string {
  if (riskMode <= 0) return "low-risk";
  if (riskMode >= 2) return "high-risk";
  return "balanced-risk";
}
