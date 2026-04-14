import "dotenv/config";

import { promises as fs } from "fs";
import path from "path";
import { Wallet, providers, utils as ethersUtils } from "ethers";
import { GameContractClient, type ContractAddresses } from "./contracts";
import { AutonomyOracleRunner, type EventCursor, type ProcessedRequestInfo } from "./autonomyOracleRunner";
import { AutonomyPlanner } from "./autonomyPlanner";
import { OpenAICompatibleAIProvider } from "./openaiCompatibleAI";
import { AnthropicCompatibleAIProvider } from "./anthropicCompatibleAI";
import { DigestReasoningUploader, HttpReasoningUploader } from "./reasoningUploader";
import { revealBattleRoyaleIfReady } from "./battleRoyaleRevealWatcher";
import { parseMemoryOwnerTrail, type AutonomyMemoryOptions } from "./autonomyMemory";

interface RunnerState {
  lastScannedBlock: number;
  lastProcessedCursor?: EventCursor;
  pendingRequestIds: number[];
  updatedAt: string;
}

type DirectiveSyncConfig = {
  enabled: boolean;
  intervalMs: number;
  filePath: string;
  kvRestApiUrl: string;
  kvRestApiToken: string;
  storeKey: string;
};

type DirectiveStoreRecord = {
  tokenId: number;
  actionKind: number;
  style: "tight" | "balanced" | "expressive";
  text: string;
  updatedAt: number;
  updatedBy?: string;
};

type DirectiveStoreShape = {
  records: DirectiveStoreRecord[];
};

class FileRunnerStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<RunnerState | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async save(state: RunnerState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const config = loadConfig();
  const stateStore = new FileRunnerStateStore(config.stateFile);

  if (mode === "check-env") {
    console.log("[autonomy-runner] Environment looks valid.");
    console.log(JSON.stringify(safeSummary(config), null, 2));
    return;
  }

  const provider = new providers.JsonRpcProvider(config.rpcUrl);
  provider.pollingInterval = config.pollingIntervalMs;

  const signer = new Wallet(config.operatorPrivateKey, provider);
  const client = new GameContractClient(provider, signer, config.contracts, signer);
  const ai =
    config.modelProvider === "anthropic"
      ? new AnthropicCompatibleAIProvider({
          baseUrl: config.modelBaseUrl,
          apiKey: config.modelApiKey,
          model: config.modelName,
          timeoutMs: config.modelTimeoutMs,
          temperature: config.modelTemperature,
          maxTokens: config.modelMaxTokens,
          anthropicVersion: config.anthropicVersion,
        })
      : new OpenAICompatibleAIProvider({
          baseUrl: config.modelBaseUrl,
          apiKey: config.modelApiKey,
          model: config.modelName,
          timeoutMs: config.modelTimeoutMs,
          temperature: config.modelTemperature,
        });
  const uploader =
    config.reasoningUploadMode === "http"
      ? new HttpReasoningUploader({
          uploadUrl: config.reasoningUploadUrl,
          bearerToken: config.reasoningUploadToken,
          timeoutMs: config.reasoningUploadTimeoutMs,
        })
      : new DigestReasoningUploader();

  let state: RunnerState =
    (await stateStore.load()) ?? {
      lastScannedBlock: -1,
      pendingRequestIds: [],
      updatedAt: new Date().toISOString(),
    };

  const persistState = async () => {
    state.updatedAt = new Date().toISOString();
    await stateStore.save(state);
  };

  const runner = new AutonomyOracleRunner(client, ai, uploader, {
    oracleAddress: config.contracts.oracle,
    autonomyHubAddress: config.actionHubAddress,
    finalizationHubAddress: config.finalizationHubAddress,
    runnerName: config.runnerName,
    maxLogRangeBlocks: config.maxLogRangeBlocks,
    gasPriceGwei: config.gasPriceGwei,
    maxGasPriceGwei: config.maxGasPriceGwei,
    gasLimitBufferBps: config.gasLimitBufferBps,
    gasLimitExtra: config.gasLimitExtra,
    gasLimits: {
      fulfill: config.gasLimitFulfill,
      sync: config.gasLimitSync,
      execute: config.gasLimitExecute,
      finalize: config.gasLimitFinalize,
    },
    memory: config.memory,
    afterRequestProcessed: async (info) => {
      state = applyProcessedInfo(state, info);
      await persistState();
      console.log(
        `[autonomy-runner] request #${info.requestId} processed`,
        JSON.stringify(info.txHashes)
      );
    },
  });
  const planner =
    config.planner.enabled && config.planner.managedNfaIds.length > 0
      ? new AutonomyPlanner(client, ai, {
          actionHubAddress: config.actionHubAddress,
          plannerName: `${config.runnerName}-planner`,
          managedNfaIds: config.planner.managedNfaIds,
          enableTask: config.planner.enableTask,
          enablePk: config.planner.enablePk,
          enableBattleRoyale: config.planner.enableBattleRoyale,
          pkMaxCandidates: config.planner.pkMaxCandidates,
          pkMatchLookback: config.planner.pkMatchLookback,
          pkAllowCreate: config.planner.pkAllowCreate,
          pkCreateStakeClw: config.planner.pkCreateStakeClw,
          battleRoyaleMaxCandidates: config.planner.battleRoyaleMaxCandidates,
          battleRoyaleClaimLookback: config.planner.battleRoyaleClaimLookback,
          taskCandidateCount: config.planner.taskCandidateCount,
          taskBaseClw: config.planner.taskBaseClw,
          taskClwStep: config.planner.taskClwStep,
          taskBaseXp: config.planner.taskBaseXp,
          taskXpStep: config.planner.taskXpStep,
          minActionGapMs: config.planner.minActionGapMs,
          memory: config.memory,
        })
      : null;

  const latestBlock = await provider.getBlockNumber();
  const fromBlock = resolveBackfillStart(
    latestBlock,
    state,
    config.backfillBlocks,
    config.backfillFromBlock,
    config.rescanOverlapBlocks
  );
  const backfillCursor =
    state.lastProcessedCursor && fromBlock <= state.lastProcessedCursor.blockNumber
      ? state.lastProcessedCursor
      : undefined;

  console.log(
    `[autonomy-runner] backfilling from block ${fromBlock} to ${latestBlock} on ${config.rpcUrl}`
  );
  try {
    if (config.directiveSync.enabled) {
      await syncDirectiveStore(config.directiveSync);
    }
    await runner.reconcileRequests(state.pendingRequestIds);
    const finalBackfillBlock = await runner.backfillRequests(fromBlock, latestBlock, backfillCursor);
    state.lastScannedBlock = Math.max(state.lastScannedBlock, finalBackfillBlock);
    await persistState();
  } catch (error) {
    console.error("[autonomy-runner] Initial backfill failed; continuing with live loops:", error);
  }

  if (mode === "once") {
    console.log("[autonomy-runner] One-shot backfill complete.");
    return;
  }

  if (config.enableEventListener) {
    await runner.startListening();
    console.log("[autonomy-runner] Listening for new ReasoningRequested events.");
  } else {
    console.log("[autonomy-runner] Event listener disabled; polling via reconcile loop only.");
  }
  console.log(JSON.stringify(safeSummary(config), null, 2));

  const reconcileTimer = setInterval(() => {
    void reconcileLoop();
  }, config.reconcileIntervalMs);
  const plannerTimer = planner
    ? setInterval(() => {
        void plannerLoop();
      }, config.planner.intervalMs)
    : null;
  const directiveSyncTimer = config.directiveSync.enabled
    ? setInterval(() => {
        void directiveSyncLoop();
      }, config.directiveSync.intervalMs)
    : null;
  let revealLoopInFlight = false;
  const battleRoyaleRevealTimer =
    config.battleRoyaleReveal.enabled && config.contracts.battleRoyale
      ? setInterval(() => {
          if (revealLoopInFlight) return;
          revealLoopInFlight = true;
          void battleRoyaleRevealLoop().finally(() => {
            revealLoopInFlight = false;
          });
        }, config.battleRoyaleReveal.intervalMs)
      : null;

  const reconcileLoop = async () => {
    try {
      const latest = await provider.getBlockNumber();
      if (state.pendingRequestIds.length > 0) {
        await runner.reconcileRequests(state.pendingRequestIds);
      }
      const rescanFromBlock = Math.max(0, state.lastScannedBlock - config.rescanOverlapBlocks);
      const rescanCursor =
        state.lastProcessedCursor && rescanFromBlock <= state.lastProcessedCursor.blockNumber
          ? state.lastProcessedCursor
          : undefined;
      const scannedTo = await runner.backfillRequests(rescanFromBlock, latest, rescanCursor);
      state.lastScannedBlock = Math.max(state.lastScannedBlock, scannedTo);
      await persistState();
    } catch (error) {
      console.error("[autonomy-runner] Reconcile loop failed:", error);
    }
  };
  const plannerLoop = async () => {
    if (!planner) return;
    try {
      await planner.runOnce();
    } catch (error) {
      console.error("[autonomy-runner] Planner loop failed:", error);
    }
  };
  const directiveSyncLoop = async () => {
    try {
      await syncDirectiveStore(config.directiveSync);
    } catch (error) {
      console.error("[autonomy-runner] Directive sync loop failed:", error);
    }
  };

  if (planner) {
    await plannerLoop();
  }
  if (config.directiveSync.enabled) {
    await directiveSyncLoop();
  }
  if (config.battleRoyaleReveal.enabled && config.contracts.battleRoyale) {
    await battleRoyaleRevealLoop();
  }

  async function battleRoyaleRevealLoop() {
    const battleRoyaleAddress = config.contracts.battleRoyale;
    if (!battleRoyaleAddress) return;

    try {
      const result = await revealBattleRoyaleIfReady({
        proxy: battleRoyaleAddress,
        provider,
        signer,
        logger: {
          info: (...args) => console.log(...args),
          warn: (...args) => console.warn(...args),
        },
      });
      if (result.kind === "revealed") {
        console.log(
          `[autonomy-runner] battle royale ${result.fallbackEntropyUsed ? "fallback reveal" : "reveal"} #${result.match.matchId}: ${result.txHash}`
        );
      }
    } catch (error) {
      console.error("[autonomy-runner] Battle Royale reveal loop failed:", error);
    }
  }

  const shutdown = async (signal: string) => {
    console.log(`[autonomy-runner] Received ${signal}, shutting down...`);
    clearInterval(reconcileTimer);
    if (plannerTimer) clearInterval(plannerTimer);
    if (directiveSyncTimer) clearInterval(directiveSyncTimer);
    if (battleRoyaleRevealTimer) clearInterval(battleRoyaleRevealTimer);
    runner.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

function parseMode(args: string[]): "serve" | "once" | "check-env" {
  if (args.includes("--check-env")) return "check-env";
  if (args.includes("--once")) return "once";
  return "serve";
}

function resolveBackfillStart(
  latestBlock: number,
  state: RunnerState | undefined,
  backfillBlocks: number,
  forcedFromBlock?: number,
  overlapBlocks = 0
): number {
  if (typeof forcedFromBlock === "number") {
    return forcedFromBlock;
  }
  const cursorBlock =
    state?.lastProcessedCursor && state.lastProcessedCursor.blockNumber >= 0
      ? state.lastProcessedCursor.blockNumber
      : -1;
  const scannedBlock =
    typeof state?.lastScannedBlock === "number" && state.lastScannedBlock >= 0
      ? state.lastScannedBlock
      : -1;
  const stateBlock = Math.max(cursorBlock, scannedBlock);
  if (stateBlock >= 0) {
    return Math.max(0, stateBlock - overlapBlocks);
  }
  return Math.max(0, latestBlock - backfillBlocks);
}

function loadDirectiveSyncConfig(): DirectiveSyncConfig {
  const enabled = env("AUTONOMY_DIRECTIVE_SYNC_ENABLED", "false").toLowerCase() === "true";
  const config: DirectiveSyncConfig = {
    enabled,
    intervalMs: parsePositiveInt("AUTONOMY_DIRECTIVE_SYNC_INTERVAL_MS", 30000),
    filePath: env(
      "AUTONOMY_DIRECTIVE_FILE",
      path.resolve(process.cwd(), ".cache", "autonomy-directives.json")
    ),
    kvRestApiUrl: env("AUTONOMY_DIRECTIVE_KV_REST_API_URL", ""),
    kvRestApiToken: env("AUTONOMY_DIRECTIVE_KV_REST_API_TOKEN", ""),
    storeKey: env("AUTONOMY_DIRECTIVE_STORE_KEY", "autonomy:directives"),
  };

  if (config.enabled && (!config.kvRestApiUrl || !config.kvRestApiToken)) {
    throw new Error(
      "AUTONOMY_DIRECTIVE_SYNC_ENABLED requires AUTONOMY_DIRECTIVE_KV_REST_API_URL and AUTONOMY_DIRECTIVE_KV_REST_API_TOKEN"
    );
  }

  return config;
}

async function syncDirectiveStore(config: DirectiveSyncConfig): Promise<void> {
  if (!config.enabled) return;

  const response = await fetch(
    `${config.kvRestApiUrl}/get/${encodeURIComponent(config.storeKey)}`,
    {
      headers: {
        Authorization: `Bearer ${config.kvRestApiToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Directive KV get failed with ${response.status}`);
  }

  const json = (await response.json()) as { result?: string | null };
  const store = !json.result
    ? { records: [] }
    : normalizeDirectiveStore(JSON.parse(Buffer.from(json.result, "base64url").toString("utf8")));

  await fs.mkdir(path.dirname(config.filePath), { recursive: true });
  await fs.writeFile(config.filePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeDirectiveStore(value: unknown): DirectiveStoreShape {
  const parsed = value as { records?: unknown[] } | null;
  return {
    records: Array.isArray(parsed?.records)
      ? parsed.records
          .map(normalizeDirectiveRecord)
          .filter((record): record is DirectiveStoreRecord => Boolean(record))
      : [],
  };
}

function normalizeDirectiveRecord(value: unknown): DirectiveStoreRecord | null {
  const record = value as Partial<DirectiveStoreRecord> | null;
  if (!record) return null;
  if (!Number.isInteger(record.tokenId) || (record.tokenId ?? 0) <= 0) return null;
  if (!Number.isInteger(record.actionKind) || (record.actionKind ?? -1) < 0) return null;
  if (record.style !== "tight" && record.style !== "balanced" && record.style !== "expressive") return null;
  if (typeof record.text !== "string") return null;
  if (!Number.isFinite(record.updatedAt)) return null;

  return {
    tokenId: record.tokenId!,
    actionKind: record.actionKind!,
    style: record.style,
    text: record.text.slice(0, 220),
    updatedAt: record.updatedAt!,
    updatedBy: typeof record.updatedBy === "string" ? record.updatedBy : undefined,
  };
}

function loadConfig() {
  const reasoningUploadMode = env("AUTONOMY_REASONING_UPLOAD_MODE", "digest").toLowerCase();
  if (!["digest", "http"].includes(reasoningUploadMode)) {
    throw new Error("AUTONOMY_REASONING_UPLOAD_MODE must be digest or http");
  }

  const config = {
    rpcUrl: required("AUTONOMY_RPC_URL"),
    operatorPrivateKey: required("AUTONOMY_OPERATOR_PRIVATE_KEY"),
    runnerName: env("AUTONOMY_RUNNER_NAME", "claw-autonomy-runner"),
    enableEventListener: env("AUTONOMY_ENABLE_EVENT_LISTENER", "false").toLowerCase() === "true",
    pollIntervalLabel: env("AUTONOMY_POLLING_INTERVAL_MS", "4000"),
    pollingIntervalMs: parsePositiveInt("AUTONOMY_POLLING_INTERVAL_MS", 4000),
    stateFile: env(
      "AUTONOMY_STATE_FILE",
      path.resolve(process.cwd(), ".cache", "autonomy-runner-state.json")
    ),
    backfillBlocks: parsePositiveInt("AUTONOMY_BACKFILL_BLOCKS", 5000),
    maxLogRangeBlocks: parsePositiveInt("AUTONOMY_MAX_LOG_RANGE_BLOCKS", 40000),
    rescanOverlapBlocks: parsePositiveInt("AUTONOMY_RESCAN_OVERLAP_BLOCKS", 3),
    reconcileIntervalMs: parsePositiveInt("AUTONOMY_RECONCILE_INTERVAL_MS", 15000),
    backfillFromBlock: optionalInt("AUTONOMY_BACKFILL_FROM_BLOCK"),
    modelProvider: env("AUTONOMY_MODEL_PROVIDER", "openai").toLowerCase(),
    modelBaseUrl: required("AUTONOMY_MODEL_BASE_URL"),
    modelApiKey: required("AUTONOMY_MODEL_API_KEY"),
    modelName: required("AUTONOMY_MODEL_NAME"),
    modelTimeoutMs: parsePositiveInt("AUTONOMY_MODEL_TIMEOUT_MS", 45000),
    modelMaxTokens: parsePositiveInt("AUTONOMY_MODEL_MAX_TOKENS", 400),
    modelTemperature: parseFloat(env("AUTONOMY_MODEL_TEMPERATURE", "0.2")),
    anthropicVersion: env("AUTONOMY_ANTHROPIC_VERSION", "2023-06-01"),
    reasoningUploadMode: reasoningUploadMode as "digest" | "http",
    reasoningUploadUrl:
      reasoningUploadMode === "http" ? required("AUTONOMY_REASONING_UPLOAD_URL") : "",
    reasoningUploadToken: env("AUTONOMY_REASONING_UPLOAD_TOKEN", ""),
    reasoningUploadTimeoutMs: parsePositiveInt("AUTONOMY_REASONING_UPLOAD_TIMEOUT_MS", 45000),
    directiveSync: loadDirectiveSyncConfig(),
    memory: loadMemoryConfig(),
    gasPriceGwei: optionalGwei("AUTONOMY_GAS_PRICE_GWEI"),
    maxGasPriceGwei: requiredGwei("AUTONOMY_MAX_GAS_PRICE_GWEI", "0.2"),
    gasLimitBufferBps: parsePositiveInt("AUTONOMY_GAS_LIMIT_BUFFER_BPS", 11000),
    gasLimitExtra: parsePositiveInt("AUTONOMY_GAS_LIMIT_EXTRA", 10000),
    gasLimitFulfill: parsePositiveInt("AUTONOMY_GAS_LIMIT_FULFILL", 400000),
    gasLimitSync: parsePositiveInt("AUTONOMY_GAS_LIMIT_SYNC", 400000),
    gasLimitExecute: parsePositiveInt("AUTONOMY_GAS_LIMIT_EXECUTE", 1200000),
    gasLimitFinalize: parsePositiveInt("AUTONOMY_GAS_LIMIT_FINALIZE", 800000),
    actionHubAddress: requiredAddress("AUTONOMY_ACTION_HUB_ADDRESS"),
    finalizationHubAddress: optionalAddress("AUTONOMY_FINALIZATION_HUB_ADDRESS") ?? "",
    planner: {
      enabled: env("AUTONOMY_PLANNER_ENABLED", "false").toLowerCase() === "true",
      intervalMs: parsePositiveInt("AUTONOMY_PLANNER_INTERVAL_MS", 60000),
      managedNfaIds: parseNumberList(env("AUTONOMY_PLANNER_MANAGED_NFA_IDS", "")),
      enableTask: env("AUTONOMY_PLANNER_TASK_ENABLED", "true").toLowerCase() === "true",
      enablePk: env("AUTONOMY_PLANNER_PK_ENABLED", "true").toLowerCase() === "true",
      enableBattleRoyale: env("AUTONOMY_PLANNER_BATTLE_ROYALE_ENABLED", "true").toLowerCase() === "true",
      pkMaxCandidates: parsePositiveInt("AUTONOMY_PLANNER_PK_MAX_CANDIDATES", 3),
      pkMatchLookback: parsePositiveInt("AUTONOMY_PLANNER_PK_MATCH_LOOKBACK", 50),
      pkAllowCreate: env("AUTONOMY_PLANNER_PK_ALLOW_CREATE", "false").toLowerCase() === "true",
      pkCreateStakeClw: env("AUTONOMY_PLANNER_PK_CREATE_STAKE_CLW", "100"),
      battleRoyaleMaxCandidates: parsePositiveInt("AUTONOMY_PLANNER_BATTLE_ROYALE_MAX_CANDIDATES", 3),
      battleRoyaleClaimLookback: parsePositiveInt("AUTONOMY_PLANNER_BATTLE_ROYALE_CLAIM_LOOKBACK", 12),
      taskCandidateCount: parsePositiveInt("AUTONOMY_PLANNER_TASK_CANDIDATE_COUNT", 3),
      taskBaseClw: env("AUTONOMY_PLANNER_TASK_BASE_CLW", "18"),
      taskClwStep: env("AUTONOMY_PLANNER_TASK_CLW_STEP", "4"),
      taskBaseXp: parsePositiveInt("AUTONOMY_PLANNER_TASK_BASE_XP", 12),
      taskXpStep: parsePositiveInt("AUTONOMY_PLANNER_TASK_XP_STEP", 2),
      minActionGapMs: parsePositiveInt("AUTONOMY_PLANNER_MIN_ACTION_GAP_MS", 60000),
    },
    battleRoyaleReveal: {
      enabled: env("AUTONOMY_BATTLE_ROYALE_REVEAL_ENABLED", "false").toLowerCase() === "true",
      intervalMs: parsePositiveInt("AUTONOMY_BATTLE_ROYALE_REVEAL_INTERVAL_MS", 5000),
    },
    contracts: {
      router: requiredAddress("AUTONOMY_ROUTER_ADDRESS"),
      nfa: requiredAddress("AUTONOMY_NFA_ADDRESS"),
      pkSkill: requiredAddress("AUTONOMY_PK_SKILL_ADDRESS"),
      taskSkill: requiredAddress("AUTONOMY_TASK_SKILL_ADDRESS"),
      marketSkill: requiredAddress("AUTONOMY_MARKET_SKILL_ADDRESS"),
      oracle: requiredAddress("AUTONOMY_ORACLE_ADDRESS"),
      worldState: requiredAddress("AUTONOMY_WORLD_STATE_ADDRESS"),
      depositRouter: requiredAddress("AUTONOMY_DEPOSIT_ROUTER_ADDRESS"),
      clwToken: requiredAddress("AUTONOMY_CLW_TOKEN_ADDRESS"),
      battleRoyale: optionalAddress("AUTONOMY_BATTLE_ROYALE_ADDRESS") ?? undefined,
    } satisfies ContractAddresses,
  };

  return config;
}

function safeSummary(config: ReturnType<typeof loadConfig>) {
  return {
    runnerName: config.runnerName,
    enableEventListener: config.enableEventListener,
    rpcUrl: config.rpcUrl,
    actionHubAddress: config.actionHubAddress,
    finalizationHubEnabled: Boolean(config.finalizationHubAddress),
    oracleAddress: config.contracts.oracle,
    reasoningUploadMode: config.reasoningUploadMode,
    directiveSync: {
      enabled: config.directiveSync.enabled,
      intervalMs: config.directiveSync.intervalMs,
      filePath: config.directiveSync.filePath,
      storeKey: config.directiveSync.storeKey,
      hasKvUrl: Boolean(config.directiveSync.kvRestApiUrl),
      hasKvToken: Boolean(config.directiveSync.kvRestApiToken),
    },
    stateFile: config.stateFile,
    backfillBlocks: config.backfillBlocks,
    maxLogRangeBlocks: config.maxLogRangeBlocks,
    rescanOverlapBlocks: config.rescanOverlapBlocks,
    reconcileIntervalMs: config.reconcileIntervalMs,
    hasBackfillFromBlock: typeof config.backfillFromBlock === "number",
    modelProvider: config.modelProvider,
    modelBaseUrl: config.modelBaseUrl,
    modelName: config.modelName,
    memory: config.memory,
    gasLimits: {
      gasPriceGwei: config.gasPriceGwei ?? "provider.getGasPrice()",
      maxGasPriceGwei: config.maxGasPriceGwei,
      gasLimitBufferBps: config.gasLimitBufferBps,
      gasLimitExtra: config.gasLimitExtra,
      fulfill: config.gasLimitFulfill,
      sync: config.gasLimitSync,
      execute: config.gasLimitExecute,
      finalize: config.gasLimitFinalize,
    },
    planner: {
      enabled: config.planner.enabled,
      intervalMs: config.planner.intervalMs,
      managedNfaIds: config.planner.managedNfaIds,
      enableTask: config.planner.enableTask,
      enablePk: config.planner.enablePk,
      enableBattleRoyale: config.planner.enableBattleRoyale,
      pkMaxCandidates: config.planner.pkMaxCandidates,
      pkMatchLookback: config.planner.pkMatchLookback,
      pkAllowCreate: config.planner.pkAllowCreate,
      battleRoyaleMaxCandidates: config.planner.battleRoyaleMaxCandidates,
      battleRoyaleClaimLookback: config.planner.battleRoyaleClaimLookback,
    },
    battleRoyaleReveal: {
      enabled: config.battleRoyaleReveal.enabled,
      intervalMs: config.battleRoyaleReveal.intervalMs,
      battleRoyaleAddress: config.contracts.battleRoyale ?? null,
    },
  };
}

function loadMemoryConfig(): AutonomyMemoryOptions {
  return {
    enabled: env("AUTONOMY_MEMORY_ENABLED", "true").toLowerCase() === "true",
    greenfieldEnabled: env("AUTONOMY_MEMORY_GREENFIELD_ENABLED", "false").toLowerCase() === "true",
    ownerTrail: parseMemoryOwnerTrail(env("AUTONOMY_MEMORY_OWNER_TRAIL", "")),
    maxTriggeredMemories: parsePositiveInt("AUTONOMY_MEMORY_MAX_TRIGGERED", 3),
    maxPromptChars: parsePositiveInt("AUTONOMY_MEMORY_MAX_PROMPT_CHARS", 1600),
    autoCreate: env("AUTONOMY_MEMORY_AUTO_CREATE", "true").toLowerCase() === "true",
    recordActions: env("AUTONOMY_MEMORY_RECORD_ACTIONS", "true").toLowerCase() === "true",
    queueRootSync: env("AUTONOMY_MEMORY_QUEUE_ROOT_SYNC", "true").toLowerCase() === "true",
  };
}

function parseNumberList(raw: string): number[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function normalizeState(raw: unknown): RunnerState {
  const parsed = (raw ?? {}) as Partial<RunnerState> & { lastProcessedBlock?: number };
  const lastProcessedCursor = isCursor(parsed.lastProcessedCursor)
    ? parsed.lastProcessedCursor
    : undefined;
  const pendingRequestIds = Array.isArray(parsed.pendingRequestIds)
    ? parsed.pendingRequestIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const legacyBlock =
    typeof parsed.lastProcessedBlock === "number" && parsed.lastProcessedBlock >= 0
      ? parsed.lastProcessedBlock
      : undefined;
  const lastScannedBlock =
    typeof parsed.lastScannedBlock === "number" && parsed.lastScannedBlock >= 0
      ? parsed.lastScannedBlock
      : legacyBlock ?? -1;

  return {
    lastScannedBlock,
    lastProcessedCursor,
    pendingRequestIds,
    updatedAt:
      typeof parsed.updatedAt === "string" && parsed.updatedAt.length > 0
        ? parsed.updatedAt
        : new Date().toISOString(),
  };
}

function isCursor(value: unknown): value is EventCursor {
  const cursor = value as Partial<EventCursor>;
  return (
    typeof cursor?.blockNumber === "number" &&
    typeof cursor?.transactionIndex === "number" &&
    typeof cursor?.logIndex === "number" &&
    typeof cursor?.requestId === "number"
  );
}

function applyProcessedInfo(state: RunnerState, info: ProcessedRequestInfo): RunnerState {
  const nextPending = new Set(state.pendingRequestIds);
  if (info.needsFollowUp) {
    nextPending.add(info.requestId);
  } else {
    nextPending.delete(info.requestId);
  }

  const nextState: RunnerState = {
    ...state,
    pendingRequestIds: [...nextPending].sort((a, b) => a - b),
    updatedAt: new Date().toISOString(),
  };

  if (typeof info.blockNumber === "number") {
    nextState.lastScannedBlock = Math.max(nextState.lastScannedBlock, info.blockNumber);
  }
  if (info.cursor && shouldAdvanceCursor(info.cursor, nextState.lastProcessedCursor)) {
    nextState.lastProcessedCursor = info.cursor;
    nextState.lastScannedBlock = Math.max(nextState.lastScannedBlock, info.cursor.blockNumber);
  }

  return nextState;
}

function shouldAdvanceCursor(next: EventCursor, current?: EventCursor): boolean {
  if (!current) return true;
  if (next.blockNumber !== current.blockNumber) {
    return next.blockNumber > current.blockNumber;
  }
  if (next.transactionIndex !== current.transactionIndex) {
    return next.transactionIndex > current.transactionIndex;
  }
  if (next.logIndex !== current.logIndex) {
    return next.logIndex > current.logIndex;
  }
  return next.requestId > current.requestId;
}

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requiredAddress(key: string): string {
  const value = required(key);
  return normalizeAddress(value, key);
}

function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function optionalAddress(key: string): string | undefined {
  const value = process.env[key]?.trim();
  if (!value) return undefined;
  return normalizeAddress(value, key);
}

function parsePositiveInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }
  return parsed;
}

function optionalInt(key: string): number | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }
  return parsed;
}

function requiredGwei(key: string, fallback: string): string {
  const value = env(key, fallback);
  validateGwei(key, value);
  return value;
}

function optionalGwei(key: string): string | undefined {
  const value = process.env[key]?.trim();
  if (!value) return undefined;
  validateGwei(key, value);
  return value;
}

function validateGwei(key: string, value: string): void {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid gwei value for ${key}: ${value}`);
  }
  try {
    ethersUtils.parseUnits(value, "gwei");
  } catch {
    throw new Error(`Invalid gwei value for ${key}: ${value}`);
  }
}

function normalizeAddress(value: string, key: string): string {
  try {
    return ethersUtils.getAddress(value.toLowerCase());
  } catch {
    throw new Error(`Invalid address for ${key}: ${value}`);
  }
}

void main().catch((error) => {
  console.error("[autonomy-runner] Fatal error:", error);
  process.exit(1);
});
