import { ethers } from "ethers";
import type { GameContractClient } from "./contracts";
import type { AIProvider } from "./types";
import type { IPFSUploader } from "./skills/oracleSkill";
import { evaluatePkCandidate, PK_STRATEGY_LABELS, summarizePkProjection } from "./pkStrategy";
import { loadAutonomyMemoryContext, type AutonomyMemoryOptions } from "./autonomyMemory";
import { ensureAutonomyCML, recordAutonomyCmlEvent } from "./autonomyCmlRuntime";

const ORACLE_ABI = [
  "function requests(uint256) view returns (uint256 nfaId, address consumer, string prompt, uint8 numOfChoices, uint8 choice, string reasoningCid, uint8 status, uint64 timestamp)",
  "function fulfillReasoning(uint256 requestId, uint8 choice, string reasoningCid)",
  "event ReasoningRequested(uint256 indexed requestId, uint256 indexed nfaId, address consumer, string prompt, uint8 numOfChoices)",
];

const AUTONOMY_HUB_ABI = [
  "function syncOracleResult(uint256 requestId)",
  "function executeSyncedAction(uint256 requestId)",
  "function getActionReceipt(uint256 requestId) view returns (uint256 requestId, uint256 nfaId, uint8 actionKind, bytes32 protocolId, bytes32 spendAssetId, uint8 status, address requester, address lastExecutor, uint8 resolvedChoice, bytes32 payloadHash, bytes32 capabilityHash, bytes32 executionRef, bytes32 resultHash, bytes32 receiptHash, uint256 requestedSpend, uint256 actualSpend, uint256 clwCredit, uint32 xpCredit, uint64 createdAt, uint64 executedAt, uint32 retryCount, string reasoningCid, string lastError)",
  "function pendingActions(uint256) view returns (uint256 nfaId, uint8 actionKind, bytes32 protocolId, bytes32 spendAssetId, bytes payload, bytes32 payloadHash, uint256 spendAmount, uint8 numChoices, address requester, uint64 createdAt, uint8 resolvedChoice, string reasoningCid, bytes32 capabilityHash, bytes32 executionRef, bytes32 resultHash, bytes32 receiptHash, uint256 actualSpend, uint256 clwCredit, uint32 xpCredit, address lastExecutor, uint64 executedAt, uint32 retryCount, string lastError, uint8 status)",
  "function adapters(uint8) view returns (address)",
];

const FINALIZATION_HUB_ABI = [
  "function finalizeExecutedAction(uint256 requestId)",
  "function isFinalized(uint256 requestId) view returns (bool)",
];

const TASK_ROUTE_ADAPTER_ABI = [
  "function taskRouteSkill() view returns (address)",
];

const TASK_SKILL_ADAPTER_ABI = [
  "function taskSkill() view returns (address)",
];

const TASK_ROUTE_SKILL_ABI = [
  "function routesById(uint256) view returns (uint256 nfaId, uint8 numChoices, uint8 resolvedChoice, uint64 expiresAt, bool resolved, bool autonomous, string routeCid, string reasoningCid, uint16 resolvedMatchScore, uint256 actualClwReward, uint32 actualXpReward)",
  "function getChoiceConfig(uint256 routeId, uint8 choice) view returns (uint8 taskType, uint32 xpReward, uint256 clwReward)",
];

const PK_ROUTE_ADAPTER_ABI = [
  "function pkRouteSkill() view returns (address)",
];

const PK_SKILL_ADAPTER_ABI = [
  "function pkSkill() view returns (address)",
];

const PK_SKILL_ABI = [
  "function getMatch(uint256 matchId) view returns (tuple(uint256 nfaA,uint256 nfaB,bytes32 commitA,bytes32 commitB,uint8 strategyA,uint8 strategyB,uint256 stake,uint8 phase,uint64 phaseTimestamp,bool revealedA,bool revealedB,bytes32 saltA,bytes32 saltB))",
];

const PK_ROUTE_SKILL_ABI = [
  "function routesById(uint256) view returns (uint256 challengerNfaId, uint256 opponentNfaId, uint8 opponentStrategy, uint8 resolvedChoice, uint64 expiresAt, bool resolved, bool autonomous, bool challengerWon, string routeCid, string reasoningCid, uint256 stakeCost, uint256 actualSpend, uint256 actualClwReward, uint32 actualXpReward, uint256 challengerDamageScore, uint256 opponentDamageScore)",
  "function getChoiceOutcome(uint256 routeId, uint8 choice) view returns (uint256 actualSpend, uint256 actualClwReward, uint32 actualXpReward, bool challengerWon, uint256 challengerDamageScore, uint256 opponentDamageScore)",
];

const WORLD_EVENT_ADAPTER_ABI = [
  "function worldEventSkill() view returns (address)",
];

const WORLD_EVENT_SKILL_ABI = [
  "function eventsById(uint256) view returns (uint256 nfaId, uint8 numChoices, uint8 resolvedChoice, uint64 expiresAt, bool resolved, bool autonomous, string eventCid, string reasoningCid)",
  "function getChoiceOutcome(uint256 eventId, uint8 choice) view returns (uint256 clwReward, uint32 xpReward)",
];

const ACTION_KIND = {
  TASK: 0,
  PK: 1,
  MARKET: 2,
  BATTLE_ROYALE: 3,
  WORLD_EVENT: 4,
} as const;

const ACTION_LABELS: Record<number, string> = {
  [ACTION_KIND.TASK]: "Task",
  [ACTION_KIND.PK]: "PK",
  [ACTION_KIND.MARKET]: "Market",
  [ACTION_KIND.BATTLE_ROYALE]: "Battle Royale",
  [ACTION_KIND.WORLD_EVENT]: "World Event",
};

const TASK_TYPE_LABELS = ["Courage", "Wisdom", "Social", "Create", "Grit"];
enum OracleRequestStatus {
  PENDING = 0,
  FULFILLED = 1,
  EXPIRED = 2,
}

enum PendingStatus {
  NONE = 0,
  REQUESTED = 1,
  FULFILLED = 2,
  EXECUTING = 3,
  EXECUTED = 4,
  FAILED = 5,
  EXPIRED = 6,
  CANCELLED = 7,
}

interface OracleRequestView {
  nfaId: ethers.BigNumber;
  consumer: string;
  prompt: string;
  numOfChoices: number;
  choice: number;
  reasoningCid: string;
  status: number;
  timestamp: number;
}

interface PendingActionView {
  nfaId: ethers.BigNumber;
  actionKind: number;
  protocolId: string;
  spendAssetId: string;
  payload: string;
  payloadHash: string;
  spendAmount: ethers.BigNumber;
  numChoices: number;
  requester: string;
  createdAt: number;
  resolvedChoice: number;
  reasoningCid: string;
  capabilityHash: string;
  executionRef: string;
  resultHash: string;
  receiptHash: string;
  actualSpend: ethers.BigNumber;
  clwCredit: ethers.BigNumber;
  xpCredit: number;
  lastExecutor: string;
  executedAt: number;
  retryCount: number;
  lastError: string;
  status: number;
}

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

export interface EventCursor {
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
  requestId: number;
}

interface ActionChoiceContext {
  title: string;
  summary?: string;
  options: string[];
}

enum PkAutonomyMode {
  CREATE = 0,
  JOIN_CANDIDATES = 1,
  REVEAL_PREPARED = 2,
  SETTLE_EXISTING = 3,
}

enum BattleRoyaleAutonomyMode {
  ENTER_OPTIONS = 0,
  CHANGE_ROOM = 1,
  ADD_STAKE = 2,
  CLAIM_EXISTING = 3,
}

export interface AutonomyOracleRunnerConfig {
  oracleAddress: string;
  autonomyHubAddress: string;
  finalizationHubAddress?: string;
  runnerName?: string;
  maxLogRangeBlocks?: number;
  gasPriceGwei?: string;
  maxGasPriceGwei?: string;
  gasLimitBufferBps?: number;
  gasLimitExtra?: number;
  finalizationEnabled?: boolean;
  memory?: AutonomyMemoryOptions;
  gasLimits?: {
    fulfill?: number;
    sync?: number;
    execute?: number;
    finalize?: number;
  };
  afterRequestProcessed?: (info: ProcessedRequestInfo) => Promise<void> | void;
}

export class DeterministicReasoningUploader implements IPFSUploader {
  async upload(content: string): Promise<string> {
    const digest = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(content)).slice(2, 18);
    return `autonomy://${digest}`;
  }
}

export interface ProcessedRequestInfo {
  requestId: number;
  nfaId: number;
  blockNumber?: number;
  cursor?: EventCursor;
  needsFollowUp: boolean;
  finalStatus: number;
  txHashes: {
    fulfillTxHash?: string;
    syncTxHash?: string;
    executeTxHash?: string;
    finalizeTxHash?: string;
  };
}

export class AutonomyOracleRunner {
  private readonly client: GameContractClient;
  private readonly ai: AIProvider;
  private readonly ipfs: IPFSUploader;
  private readonly oracle: ethers.Contract;
  private readonly hub: ethers.Contract;
  private readonly finalizationHub?: ethers.Contract;
  private readonly runnerName: string;
  private readonly maxLogRangeBlocks: number;
  private readonly minLogRangeBlocks: number;
  private readonly gasLimits: Required<NonNullable<AutonomyOracleRunnerConfig["gasLimits"]>>;
  private readonly gasPriceGwei?: string;
  private readonly maxGasPriceGwei?: string;
  private readonly gasLimitBufferBps: number;
  private readonly gasLimitExtra: number;
  private readonly finalizationEnabled: boolean;
  private readonly memory: AutonomyMemoryOptions;
  private readonly afterRequestProcessed?: (info: ProcessedRequestInfo) => Promise<void> | void;
  private listening = false;
  private eventHandler: ((...args: any[]) => void) | null = null;
  private readonly processedRequests = new Set<number>();
  private readonly inFlightRequests = new Set<number>();

  constructor(
    client: GameContractClient,
    ai: AIProvider,
    ipfs: IPFSUploader,
    config: AutonomyOracleRunnerConfig
  ) {
    const provider = client.getOracleContract().provider;
    const signer = client.getOracleContract().signer;

    this.client = client;
    this.ai = ai;
    this.ipfs = ipfs;
    this.runnerName = config.runnerName ?? "claw-autonomy-runner";
    this.afterRequestProcessed = config.afterRequestProcessed;
    this.oracle = new ethers.Contract(config.oracleAddress, ORACLE_ABI, signer || provider);
    this.hub = new ethers.Contract(config.autonomyHubAddress, AUTONOMY_HUB_ABI, signer || provider);
    this.finalizationHub = config.finalizationHubAddress
      ? new ethers.Contract(config.finalizationHubAddress, FINALIZATION_HUB_ABI, signer || provider)
      : undefined;
    this.maxLogRangeBlocks = Math.max(1, config.maxLogRangeBlocks ?? 40000);
    this.minLogRangeBlocks = Math.min(250, this.maxLogRangeBlocks);
    this.gasPriceGwei = config.gasPriceGwei;
    this.maxGasPriceGwei = config.maxGasPriceGwei;
    this.gasLimitBufferBps = Math.max(10_000, config.gasLimitBufferBps ?? 11_000);
    this.gasLimitExtra = Math.max(0, config.gasLimitExtra ?? 10_000);
    this.finalizationEnabled = config.finalizationEnabled ?? false;
    this.memory = { enabled: true, ...(config.memory ?? {}) };
    this.gasLimits = {
      fulfill: config.gasLimits?.fulfill ?? 400000,
      sync: config.gasLimits?.sync ?? 400000,
      execute: config.gasLimits?.execute ?? 1200000,
      finalize: config.gasLimits?.finalize ?? 800000,
    };
  }

  async startListening(): Promise<void> {
    if (this.listening) throw new Error("AutonomyOracleRunner is already listening");

    this.eventHandler = (
      requestId: ethers.BigNumber,
      nfaId: ethers.BigNumber,
      prompt: string,
      numOfChoices: number,
      event: ethers.Event
    ) => {
      const cursor = this.buildCursor(event, requestId.toNumber());
      void this.processRequest(
        requestId.toNumber(),
        nfaId.toNumber(),
        prompt,
        numOfChoices,
        event.blockNumber,
        cursor
      ).catch((error) => {
        console.error(`[${this.runnerName}] Failed to process autonomy request #${requestId.toString()}:`, error);
      });
    };

    this.oracle.on("ReasoningRequested", this.eventHandler);
    this.listening = true;
  }

  stop(): void {
    if (!this.listening || !this.eventHandler) return;
    this.oracle.off("ReasoningRequested", this.eventHandler);
    this.eventHandler = null;
    this.listening = false;
  }

  async backfillRequests(fromBlock: number, toBlock?: number, cursor?: EventCursor): Promise<number> {
    const latestBlock = toBlock ?? (await this.oracle.provider.getBlockNumber());
    if (fromBlock > latestBlock) {
      return latestBlock;
    }

    const filter = this.oracle.filters.ReasoningRequested();
    for (
      let chunkFrom = fromBlock;
      chunkFrom <= latestBlock;
      chunkFrom += this.maxLogRangeBlocks + 1
    ) {
      const chunkTo = Math.min(latestBlock, chunkFrom + this.maxLogRangeBlocks);
      const events = await this.queryReasoningRequested(filter, chunkFrom, chunkTo);
      for (const event of events) {
        const requestId = Number(event.args?.requestId);
        const eventCursor = this.buildCursor(event, requestId);
        if (cursor && this.shouldSkipCursor(eventCursor, cursor)) {
          continue;
        }
        const nfaId = Number(event.args?.nfaId);
        const prompt = String(event.args?.prompt ?? "");
        const numOfChoices = Number(event.args?.numOfChoices ?? 0);
        try {
          await this.processRequest(requestId, nfaId, prompt, numOfChoices, event.blockNumber, eventCursor);
        } catch (error) {
          console.error(
            `[${this.runnerName}] Failed to backfill request #${requestId} from block ${event.blockNumber}:`,
            error
          );
        }
      }
    }

    return latestBlock;
  }

  private async queryReasoningRequested(
    filter: ethers.EventFilter,
    fromBlock: number,
    toBlock: number,
    attempt = 0
  ): Promise<ethers.Event[]> {
    try {
      return await this.oracle.queryFilter(filter, fromBlock, toBlock);
    } catch (error) {
      const range = toBlock - fromBlock;
      if (range > this.minLogRangeBlocks) {
        const midpoint = Math.floor((fromBlock + toBlock) / 2);
        const [left, right] = await Promise.all([
          this.queryReasoningRequested(filter, fromBlock, midpoint, 0),
          this.queryReasoningRequested(filter, midpoint + 1, toBlock, 0),
        ]);
        return left.concat(right);
      }

      if (attempt < 2) {
        await sleep(750 * (attempt + 1));
        return this.queryReasoningRequested(filter, fromBlock, toBlock, attempt + 1);
      }

      throw error;
    }
  }

  async reconcileRequests(requestIds: number[]): Promise<void> {
    const uniqueIds = [...new Set(requestIds)].filter((value) => value > 0).sort((a, b) => a - b);
    for (const requestId of uniqueIds) {
      try {
        await this.processRequest(requestId);
      } catch (error) {
        console.error(
          `[${this.runnerName}] Failed to reconcile request #${requestId}:`,
          error
        );
      }
    }
  }

  async processRequest(
    requestId: number,
    nfaId?: number,
    promptFromChain?: string,
    numChoicesFromChain?: number,
    blockNumber?: number,
    cursor?: EventCursor
  ): Promise<void> {
    if (this.processedRequests.has(requestId)) return;
    if (this.inFlightRequests.has(requestId)) return;
    this.inFlightRequests.add(requestId);

    const txHashes: ProcessedRequestInfo["txHashes"] = {};
    let resolvedNfaId = typeof nfaId === "number" ? nfaId : 0;
    let finalStatus = PendingStatus.NONE;

    try {
      const request = (await this.oracle.requests(requestId)) as OracleRequestView;
      let action = (await this.hub.pendingActions(requestId)) as PendingActionView;
      resolvedNfaId = typeof nfaId === "number" ? nfaId : Number(request.nfaId ?? 0);
      if (!request.consumer || request.consumer.toLowerCase() !== this.hub.address.toLowerCase()) {
        this.processedRequests.add(requestId);
        await this.afterRequestProcessed?.({
          requestId,
          nfaId: resolvedNfaId,
          blockNumber,
          cursor,
          needsFollowUp: false,
          finalStatus: Number(action.status ?? PendingStatus.NONE),
          txHashes,
        });
        return;
      }

      const prompt = promptFromChain ?? request.prompt;
      const numChoices = numChoicesFromChain ?? Number(request.numOfChoices);
      let requestStatus = Number(request.status);

      if (requestStatus === OracleRequestStatus.PENDING) {
        const { state } = await this.client.getLobsterStatus(resolvedNfaId);
        if (this.memory.enabled !== false && this.memory.autoCreate !== false) {
          ensureAutonomyCML(resolvedNfaId, state, {
            queueRootSync: this.memory.queueRootSync !== false,
          });
        }
        const choiceContext = await this.buildChoiceContext(action, numChoices);
        const memoryContext = loadAutonomyMemoryContext(
          resolvedNfaId,
          buildMemoryTriggerText(prompt, choiceContext),
          this.memory
        );
        const systemPrompt = this.buildDecisionPrompt(
          resolvedNfaId,
          state,
          prompt,
          numChoices,
          choiceContext,
          memoryContext?.prompt
        );
        let aiResponse: string;
        try {
          aiResponse = await this.ai.chat(
            systemPrompt,
            `Decide one bounded option for NFA #${resolvedNfaId}.`,
            []
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("Model returned empty content")) {
            throw error;
          }

          console.warn(
            `[${this.runnerName}] Model returned empty content for request #${requestId}; defaulting to option 1.`
          );
          aiResponse = "choice 1\nreason: model returned empty content; runner applied safe fallback.";
        }
        const choice = parseChoice(aiResponse, numChoices);

        const reasoningDoc = JSON.stringify(
          {
            runner: this.runnerName,
            requestId,
            nfaId: resolvedNfaId,
            actionKind: Number(action.actionKind),
            protocolId: action.protocolId,
            prompt,
            numChoices,
            choice,
            choiceContext,
            memoryContext: memoryContext
              ? {
                  source: memoryContext.source,
                  matchedMemoryIds: memoryContext.matchedMemoryIds,
                  prompt: memoryContext.prompt,
                }
              : null,
            aiResponse,
            lobsterState: state,
            timestamp: Date.now(),
          },
          null,
          2
        );

        const reasoningCid = await this.ipfs.upload(reasoningDoc);
        const fulfillReceipt = await this.sendTx(
          this.oracle,
          "fulfillReasoning",
          [requestId, choice, reasoningCid],
          this.gasLimits.fulfill
        );
        txHashes.fulfillTxHash = fulfillReceipt.transactionHash;
        requestStatus = OracleRequestStatus.FULFILLED;
      }

      action = (await this.hub.pendingActions(requestId)) as PendingActionView;
      if (
        (requestStatus === OracleRequestStatus.FULFILLED || requestStatus === OracleRequestStatus.EXPIRED) &&
        Number(action.status) === PendingStatus.REQUESTED
      ) {
        const syncReceipt = await this.sendTx(
          this.hub,
          "syncOracleResult",
          [requestId],
          this.gasLimits.sync
        );
        txHashes.syncTxHash = syncReceipt.transactionHash;
        action = (await this.hub.pendingActions(requestId)) as PendingActionView;
      }

      if (Number(action.status) === PendingStatus.FULFILLED) {
        const executeReceipt = await this.sendTx(
          this.hub,
          "executeSyncedAction",
          [requestId],
          this.gasLimits.execute,
          true
        );
        txHashes.executeTxHash = executeReceipt.transactionHash;
        action = (await this.hub.pendingActions(requestId)) as PendingActionView;
      }

      let needsFollowUp = this.needsFollowUp(Number(action.status));
      if (this.finalizationEnabled && Number(action.status) === PendingStatus.EXECUTED && this.finalizationHub) {
        const finalized = await this.finalizationHub.isFinalized(requestId);
        if (!finalized) {
          try {
            const finalizeReceipt = await this.sendTx(
              this.finalizationHub,
              "finalizeExecutedAction",
              [requestId],
              this.gasLimits.finalize,
              true
            );
            txHashes.finalizeTxHash = finalizeReceipt.transactionHash;
            needsFollowUp = false;
          } catch (error) {
            console.warn(
              `[${this.runnerName}] Finalization pending for request #${requestId}:`,
              error
            );
            needsFollowUp = true;
          }
        } else {
          needsFollowUp = false;
        }
      }

      if (!needsFollowUp && this.isTerminalStatus(Number(action.status))) {
        this.processedRequests.add(requestId);
      }

      finalStatus = Number(action.status);
      if (this.isTerminalStatus(finalStatus)) {
        await this.recordActionMemory(requestId, resolvedNfaId, prompt, action);
      }
      await this.afterRequestProcessed?.({
        requestId,
        nfaId: resolvedNfaId,
        blockNumber,
        cursor,
        needsFollowUp,
        finalStatus,
        txHashes,
      });
    } catch (error) {
      try {
        const latestAction = (await this.hub.pendingActions(requestId)) as PendingActionView;
        finalStatus = Number(latestAction.status ?? PendingStatus.NONE);
      } catch {
        finalStatus = PendingStatus.NONE;
      }

      const needsFollowUp = !this.isTerminalStatus(finalStatus);
      if (!needsFollowUp && this.isTerminalStatus(finalStatus)) {
        this.processedRequests.add(requestId);
      }

      await this.afterRequestProcessed?.({
        requestId,
        nfaId: resolvedNfaId,
        blockNumber,
        cursor,
        needsFollowUp,
        finalStatus,
        txHashes,
      });
      throw error;
    } finally {
      this.inFlightRequests.delete(requestId);
    }
  }

  private async recordActionMemory(
    requestId: number,
    nfaId: number,
    prompt: string,
    action: PendingActionView
  ): Promise<void> {
    if (this.memory.enabled === false || this.memory.recordActions === false) {
      return;
    }

    try {
      const { state } = await this.client.getLobsterStatus(nfaId);
      const result = recordAutonomyCmlEvent(
        nfaId,
        state,
        {
          requestId,
          actionKind: Number(action.actionKind),
          status: Number(action.status),
          prompt,
          resolvedChoice: Number(action.resolvedChoice),
          actualSpendClaworld: ethers.utils.formatEther(action.actualSpend.toString()),
          clwCredit: ethers.utils.formatEther(action.clwCredit.toString()),
          xpCredit: Number(action.xpCredit),
          reasoningCid: action.reasoningCid,
          lastError: action.lastError,
        },
        {
          queueRootSync: this.memory.queueRootSync !== false,
        }
      );
      console.log(
        `[${this.runnerName}] CML memory updated for NFA #${nfaId}: memory #${result.memoryId}, hash ${result.hash.slice(0, 12)}`
      );
    } catch (error) {
      console.warn(`[${this.runnerName}] CML memory update skipped for request #${requestId}:`, error);
    }
  }

  private async buildChoiceContext(
    action: PendingActionView,
    numChoices: number
  ): Promise<ActionChoiceContext> {
    const adapterAddress = await this.hub.adapters(Number(action.actionKind));
    if (!adapterAddress || adapterAddress === ethers.constants.AddressZero) {
      return {
        title: ACTION_LABELS[Number(action.actionKind)] ?? "Autonomous Action",
        options: Array.from({ length: numChoices }, (_, index) => `Option ${index + 1}`),
      };
    }

    try {
      switch (Number(action.actionKind)) {
        case ACTION_KIND.TASK:
          return await this.buildTaskContext(adapterAddress, action.payload, numChoices);
        case ACTION_KIND.PK:
          return await this.buildPkContext(adapterAddress, action.payload, action.nfaId.toNumber(), numChoices);
        case ACTION_KIND.BATTLE_ROYALE:
          return await this.buildBattleRoyaleContext(action.payload, action.nfaId.toNumber(), numChoices);
        case ACTION_KIND.WORLD_EVENT:
          return await this.buildWorldEventContext(this.oracle.provider, adapterAddress, ethers.utils.defaultAbiCoder.decode(["uint256"], action.payload)[0].toNumber(), numChoices);
        default:
          break;
      }
    } catch (error) {
      console.warn(
        `[${this.runnerName}] Failed to decode action payload for request context:`,
        error
      );
    }

    return {
      title: ACTION_LABELS[Number(action.actionKind)] ?? "Autonomous Action",
      options: Array.from({ length: numChoices }, (_, index) => `Option ${index + 1}`),
    };
  }

  private async buildTaskContext(
    adapterAddress: string,
    payload: string,
    numChoices: number
  ): Promise<ActionChoiceContext> {
    const provider = this.oracle.provider;
    try {
      ethers.utils.defaultAbiCoder.decode(["uint8[]", "uint32[]", "uint256[]"], payload);
      const [taskTypes, xpRewards, clwRewards] = ethers.utils.defaultAbiCoder.decode(
        ["uint8[]", "uint32[]", "uint256[]"],
        payload
      ) as [number[], ethers.BigNumber[], ethers.BigNumber[]];
      return {
        title: "Task",
        summary: "Existing TaskSkill bounded choices",
        options: taskTypes.slice(0, numChoices).map((taskType, index) => {
          const taskLabel = TASK_TYPE_LABELS[Number(taskType)] ?? `TaskType ${taskType}`;
          return `Option ${index + 1}: ${taskLabel}, XP ${xpRewards[index].toString()}, CLW ${ethers.utils.formatEther(
            clwRewards[index]
          )}`;
        }),
      };
    } catch {
      const routeId = ethers.utils.defaultAbiCoder.decode(["uint256"], payload)[0].toNumber();
      const adapter = new ethers.Contract(adapterAddress, TASK_ROUTE_ADAPTER_ABI, provider);
      const skillAddress = await adapter.taskRouteSkill();
      const skill = new ethers.Contract(skillAddress, TASK_ROUTE_SKILL_ABI, provider);
      const route = await skill.routesById(routeId);
      const options: string[] = [];
      for (let index = 0; index < numChoices; index++) {
        const [taskType, xpReward, clwReward] = await skill.getChoiceConfig(routeId, index);
        const taskLabel = TASK_TYPE_LABELS[Number(taskType)] ?? `TaskType ${taskType}`;
        options.push(
          `Option ${index + 1}: route ${routeId}, focus ${taskLabel}, XP ${xpReward.toString()}, CLW ${ethers.utils.formatEther(clwReward)}`
        );
      }
      return {
        title: "Task Route",
        summary: `Route ${routeId}${route.routeCid ? ` (${route.routeCid})` : ""}`,
        options,
      };
    }
  }

  private async buildPkContext(
    adapterAddress: string,
    payload: string,
    nfaId: number,
    numChoices: number
  ): Promise<ActionChoiceContext> {
    const provider = this.oracle.provider;
    try {
      const [mode, data] = ethers.utils.defaultAbiCoder.decode(["uint8", "bytes"], payload) as [number, string];
      if (Number(mode) === PkAutonomyMode.CREATE) {
        return {
          title: "PK",
          summary: `Create public PK match for NFA #${nfaId}`,
          options: Array.from({ length: numChoices }, (_, index) => `Option ${index + 1}: create match using ${
            PK_STRATEGY_LABELS[index] ?? `Strategy ${index}`
          }`),
        };
      }

      if (Number(mode) === PkAutonomyMode.JOIN_CANDIDATES) {
        const [candidateMatchIds] = ethers.utils.defaultAbiCoder.decode(["uint256[]"], data) as [ethers.BigNumber[]];
        const adapter = new ethers.Contract(adapterAddress, PK_SKILL_ADAPTER_ABI, provider);
        const skillAddress = await adapter.pkSkill();
        const skill = new ethers.Contract(skillAddress, PK_SKILL_ABI, provider);
        const options: string[] = [];
        const selfState = (await this.client.getLobsterStatus(nfaId)).state;
        for (let candidateIndex = 0; candidateIndex < candidateMatchIds.length; candidateIndex++) {
          const matchId = candidateMatchIds[candidateIndex].toNumber();
          const match = await skill.getMatch(matchId);
          const opponentNfaId = Number(match.nfaA);
          const opponentState = await this.client.getLobsterStatus(opponentNfaId);
          const evaluation = evaluatePkCandidate(selfState, opponentState.state);
          for (let strategy = 0; strategy < 3; strategy++) {
            const projection = evaluation.projections[strategy];
            options.push(
              `Option ${options.length + 1}: join public PK #${matchId} vs NFA #${opponentNfaId} with ${
                PK_STRATEGY_LABELS[strategy]
              }, stake ${ethers.utils.formatEther(match.stake)}, opponent stats STR ${opponentState.state.str}, DEF ${
                opponentState.state.def
              }, SPD ${opponentState.state.spd}, VIT ${opponentState.state.vit}, opponent hidden strategy unknown, ${
                summarizePkProjection(projection)
              }, planner recommendation ${evaluation.recommendedLabel}`
            );
          }
        }
        return {
          title: "PK",
          summary: `Choose which open public PK to join for NFA #${nfaId}. Strategy advice is based on all 3 hidden opponent strategies.`,
          options: options.slice(0, numChoices),
        };
      }

      if (Number(mode) === PkAutonomyMode.REVEAL_PREPARED) {
        const [matchId] = ethers.utils.defaultAbiCoder.decode(["uint256"], data) as [ethers.BigNumber];
        return {
          title: "PK",
          summary: `Reveal prepared commitment for public PK #${matchId.toString()}`,
          options:
            numChoices >= 2
              ? [
                  `Option 1: reveal the prepared strategy now and settle if both sides are ready`,
                  `Option 2: hold the reveal for a later block`,
                ]
              : [`Option 1: reveal the prepared strategy and settle if both sides are ready`],
        };
      }

      if (Number(mode) === PkAutonomyMode.SETTLE_EXISTING) {
        const [matchId] = ethers.utils.defaultAbiCoder.decode(["uint256"], data) as [ethers.BigNumber];
        return {
          title: "PK",
          summary: `Settle public PK #${matchId.toString()}`,
          options:
            numChoices >= 2
              ? [
                  `Option 1: settle the current public PK match now`,
                  `Option 2: wait and leave the match unsettled for now`,
                ]
              : [`Option 1: settle the current public PK match`],
        };
      }
    } catch {
      // fall through to legacy route context
    }

    const routeId = ethers.utils.defaultAbiCoder.decode(["uint256"], payload)[0].toNumber();
    const adapter = new ethers.Contract(adapterAddress, PK_ROUTE_ADAPTER_ABI, provider);
    const skillAddress = await adapter.pkRouteSkill();
    const skill = new ethers.Contract(skillAddress, PK_ROUTE_SKILL_ABI, provider);
    const route = await skill.routesById(routeId);
    const options: string[] = [];
    for (let index = 0; index < numChoices; index++) {
      const [actualSpend, actualClwReward, actualXpReward, challengerWon, challengerDamage, opponentDamage] =
        await skill.getChoiceOutcome(routeId, index);
      options.push(
        `Option ${index + 1}: strategy ${PK_STRATEGY_LABELS[index] ?? `Strategy ${index}`}, stake ${ethers.utils.formatEther(
          actualSpend
        )}, reward ${ethers.utils.formatEther(actualClwReward)}, XP ${actualXpReward.toString()}, predicted ${
          challengerWon ? "win" : "loss"
        }, damage ${challengerDamage.toString()} vs ${opponentDamage.toString()}`
      );
    }
    return {
      title: "PK Route",
      summary: `Route ${routeId}, opponent NFA #${route.opponentNfaId.toString()}, opponent strategy ${
        PK_STRATEGY_LABELS[Number(route.opponentStrategy)] ?? route.opponentStrategy.toString()
      }, route cid ${route.routeCid}`,
      options,
    };
  }

  private async buildWorldEventContext(
    provider: ethers.providers.Provider,
    adapterAddress: string,
    eventId: number,
    numChoices: number
  ): Promise<ActionChoiceContext> {
    const adapter = new ethers.Contract(adapterAddress, WORLD_EVENT_ADAPTER_ABI, provider);
    const skillAddress = await adapter.worldEventSkill();
    const skill = new ethers.Contract(skillAddress, WORLD_EVENT_SKILL_ABI, provider);
    const worldEvent = await skill.eventsById(eventId);
    const options: string[] = [];
    for (let index = 0; index < numChoices; index++) {
      const [clwReward, xpReward] = await skill.getChoiceOutcome(eventId, index);
      options.push(
        `Option ${index + 1}: event ${eventId}, CLW ${ethers.utils.formatEther(clwReward)}, XP ${xpReward.toString()}`
      );
    }
    return {
      title: "World Event",
      summary: `Event ${eventId}${worldEvent.eventCid ? ` (${worldEvent.eventCid})` : ""}`,
      options,
    };
  }

  private async buildBattleRoyaleContext(
    payload: string,
    nfaId: number,
    numChoices: number
  ): Promise<ActionChoiceContext> {
    const [mode, data] = ethers.utils.defaultAbiCoder.decode(["uint8", "bytes"], payload) as [number, string];

    if (Number(mode) === BattleRoyaleAutonomyMode.CLAIM_EXISTING) {
      const [matchId] = ethers.utils.defaultAbiCoder.decode(["uint256"], data) as [ethers.BigNumber];
      const participantContext = await this.client.resolveBattleRoyaleParticipantContext(matchId.toNumber(), nfaId);
      const claimable = participantContext.claimable;
      return {
        title: "Battle Royale",
        summary: `Claim settled Battle Royale reward for match #${matchId.toString()} using participant ${participantContext.participant}${participantContext.isLegacyOwnerParticipant ? " (legacy owner participant)" : ""}`,
        options:
          numChoices >= 2
            ? [
                `Option 1: claim ${ethers.utils.formatEther(claimable.toString())} Claworld for NFA #${nfaId} now`,
                `Option 2: keep the reward unclaimed for now`,
              ]
            : [`Option 1: claim ${ethers.utils.formatEther(claimable.toString())} Claworld for NFA #${nfaId}`],
      };
    }

    if (Number(mode) === BattleRoyaleAutonomyMode.ENTER_OPTIONS) {
      const [matchId, roomIds, stakeAmounts] = ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint8[]", "uint256[]"],
        data
      ) as [ethers.BigNumber, number[], ethers.BigNumber[]];
      const [info, config, snapshot] = await Promise.all([
        this.client.getBattleRoyaleMatchInfo(matchId.toNumber()),
        this.client.getBattleRoyaleMatchConfig(matchId.toNumber()),
        this.client.getBattleRoyaleSnapshot(matchId.toNumber()),
      ]);
      return {
        title: "Battle Royale",
        summary:
          `Open match #${matchId.toString()}, players ${info.totalPlayers}/${config.triggerCount}, ` +
          `reveal delay ${config.revealDelay}, min stake ${ethers.utils.formatEther(config.minStake.toString())}`,
        options: roomIds.slice(0, numChoices).map((roomId, index) => {
          const roomPlayers = Number(snapshot.playerCounts[roomId - 1] ?? 0n);
          const roomTotal = snapshot.roomTotals[roomId - 1] ?? 0n;
          return (
            `Option ${index + 1}: enter room ${roomId}, stake ${ethers.utils.formatEther(stakeAmounts[index])}, ` +
            `room players ${roomPlayers}, room total ${ethers.utils.formatEther(roomTotal.toString())}, ` +
            `open seats ${Math.max(0, config.triggerCount - info.totalPlayers)}`
          );
        }),
      };
    }

    if (Number(mode) === BattleRoyaleAutonomyMode.CHANGE_ROOM) {
      const [matchId, roomIds] = ethers.utils.defaultAbiCoder.decode(["uint256", "uint8[]"], data) as [
        ethers.BigNumber,
        number[]
      ];
      const snapshot = await this.client.getBattleRoyaleSnapshot(matchId.toNumber());
      return {
        title: "Battle Royale",
        summary: `Change room within live Battle Royale match #${matchId.toString()}`,
        options: roomIds.slice(0, numChoices).map((roomId, index) => {
          const roomPlayers = Number(snapshot.playerCounts[roomId - 1] ?? 0n);
          const roomTotal = snapshot.roomTotals[roomId - 1] ?? 0n;
          return `Option ${index + 1}: move to room ${roomId}, room players ${roomPlayers}, room total ${ethers.utils.formatEther(roomTotal.toString())}`;
        }),
      };
    }

    if (Number(mode) === BattleRoyaleAutonomyMode.ADD_STAKE) {
      const [matchId, addAmounts] = ethers.utils.defaultAbiCoder.decode(["uint256", "uint256[]"], data) as [
        ethers.BigNumber,
        ethers.BigNumber[]
      ];
      return {
        title: "Battle Royale",
        summary: `Add more stake to current Battle Royale position in match #${matchId.toString()}`,
        options: addAmounts.slice(0, numChoices).map(
          (amount, index) => `Option ${index + 1}: add ${ethers.utils.formatEther(amount)} Claworld`
        ),
      };
    }

    return {
      title: "Battle Royale",
      options: Array.from({ length: numChoices }, (_, index) => `Option ${index + 1}`),
    };
  }

  private buildDecisionPrompt(
    nfaId: number,
    state: Awaited<ReturnType<GameContractClient["getLobsterStatus"]>>["state"],
    requestPrompt: string,
    numChoices: number,
    choiceContext: ActionChoiceContext,
    memoryPrompt?: string
  ): string {
    return [
      `You are ClawOracle for Clawworld autonomy.`,
      `Your job is to choose exactly one bounded on-chain action for NFA #${nfaId}.`,
      ``,
      `=== NFA State ===`,
      `Level: ${state.level}`,
      `Rarity: ${state.rarity}, Shelter: ${state.shelter}`,
      `Personality: courage ${state.courage}, wisdom ${state.wisdom}, social ${state.social}, create ${state.create}, grit ${state.grit}`,
      `Combat DNA: STR ${state.str}, DEF ${state.def}, SPD ${state.spd}, VIT ${state.vit}`,
      ``,
      ...(memoryPrompt ? [memoryPrompt, ``] : []),
      `=== Action Context ===`,
      choiceContext.title,
      choiceContext.summary ?? "",
      requestPrompt,
      ``,
      `=== Concrete Options ===`,
      ...choiceContext.options,
      ``,
      `Choose the single best option for the NFA based on its state and the actual option details above.`,
      `Keep the reasoning short and practical.`,
      `The final line must be exactly: Choice: X`,
      `X must be a number from 1 to ${numChoices}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildCursor(event: ethers.Event, requestId: number): EventCursor {
    return {
      blockNumber: event.blockNumber ?? 0,
      transactionIndex: event.transactionIndex ?? 0,
      logIndex: event.logIndex ?? 0,
      requestId,
    };
  }

  private shouldSkipCursor(eventCursor: EventCursor, cursor: EventCursor): boolean {
    if (eventCursor.blockNumber !== cursor.blockNumber) {
      return eventCursor.blockNumber < cursor.blockNumber;
    }
    if (eventCursor.transactionIndex !== cursor.transactionIndex) {
      return eventCursor.transactionIndex < cursor.transactionIndex;
    }
    if (eventCursor.logIndex !== cursor.logIndex) {
      return eventCursor.logIndex <= cursor.logIndex;
    }
    return eventCursor.requestId <= cursor.requestId;
  }

  private needsFollowUp(status: number): boolean {
    return [PendingStatus.REQUESTED, PendingStatus.FULFILLED, PendingStatus.EXECUTING].includes(
      status
    );
  }

  private isTerminalStatus(status: number): boolean {
    return [PendingStatus.EXECUTED, PendingStatus.FAILED, PendingStatus.EXPIRED, PendingStatus.CANCELLED].includes(status);
  }

  private async sendTx(
    contract: ethers.Contract,
    method: string,
    args: any[],
    gasLimit?: number,
    preflightStatic = false
  ) {
    if (preflightStatic) {
      await contract.callStatic[method](...args);
    }

    let resolvedGasLimit: ethers.BigNumber | undefined;

    if (contract.estimateGas?.[method]) {
      try {
        const estimated = await contract.estimateGas[method](...args);
        resolvedGasLimit = estimated.mul(this.gasLimitBufferBps).div(10_000).add(this.gasLimitExtra);
      } catch {
        // Fall back to configured gas limit if estimateGas is unavailable or unstable.
      }
    }

    if (!resolvedGasLimit && typeof gasLimit === "number" && gasLimit > 0) {
      resolvedGasLimit = ethers.BigNumber.from(gasLimit);
    }

    const gasOverrides = await this.buildGasOverrides(contract);
    const overrides = resolvedGasLimit
      ? { ...gasOverrides, gasLimit: resolvedGasLimit }
      : gasOverrides;
    const tx = resolvedGasLimit
      ? await contract[method](...args, overrides)
      : await contract[method](...args, overrides);

    return tx.wait();
  }

  private async buildGasOverrides(contract: ethers.Contract) {
    let gasPrice = this.gasPriceGwei
      ? ethers.utils.parseUnits(this.gasPriceGwei, "gwei")
      : await contract.provider.getGasPrice();

    if (this.maxGasPriceGwei) {
      const maxGasPrice = ethers.utils.parseUnits(this.maxGasPriceGwei, "gwei");
      if (gasPrice.gt(maxGasPrice)) {
        gasPrice = maxGasPrice;
      }
    }

    return { gasPrice };
  }
}

function buildMemoryTriggerText(requestPrompt: string, choiceContext: ActionChoiceContext): string {
  return [
    requestPrompt,
    choiceContext.title,
    choiceContext.summary ?? "",
    ...choiceContext.options,
  ]
    .filter(Boolean)
    .join("\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseChoice(response: string, numChoices: number): number {
  const patterns = [
    /choice[\s:-]*(\d+)/i,
    /option[\s:-]*(\d+)/i,
    /选择[\s:：-]*(\d+)/,
    /选项[\s:：-]*(\d+)/,
    /\b(\d+)\b/,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= 1 && value <= numChoices) {
      return value - 1;
    }
  }

  return 0;
}
