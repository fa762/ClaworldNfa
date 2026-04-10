import {
  loadCML,
  queueRootSync,
  saveCML,
  type CMLFile,
  type CMLVividMemory,
} from "./cml";
import type { LobsterState } from "./types";

export interface AutonomyCmlRuntimeOptions {
  queueRootSync?: boolean;
}

export interface AutonomyCmlActionEvent {
  requestId: number;
  actionKind: number;
  status: number;
  prompt: string;
  resolvedChoice?: number;
  actualSpendClaworld?: string;
  clwCredit?: string;
  xpCredit?: number;
  reasoningCid?: string;
  lastError?: string;
}

const MAX_VIVID_MEMORIES = 30;
const ACTION_LABELS: Record<number, string> = {
  0: "Task",
  1: "PK",
  2: "Market",
  3: "Battle Royale",
  4: "World Event",
};

const TRAITS = ["courage", "wisdom", "social", "create", "grit"] as const;
const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
const SHELTERS = [
  "SHELTER-01",
  "SHELTER-02",
  "SHELTER-03",
  "SHELTER-04",
  "SHELTER-05",
  "SHELTER-06",
  "Wasteland",
  "Void",
];

export function ensureAutonomyCML(
  nfaId: number,
  state: LobsterState,
  options: AutonomyCmlRuntimeOptions = {}
): { cml: CMLFile; created: boolean; hash?: string } {
  const existing = loadCML(nfaId);
  if (existing) {
    return { cml: existing, created: false };
  }

  const cml = buildInitialAutonomyCML(nfaId, state);
  const hash = saveCML(nfaId, cml);
  if (options.queueRootSync !== false) {
    queueRootSync(nfaId, hash);
  }
  return { cml, created: true, hash };
}

export function recordAutonomyCmlEvent(
  nfaId: number,
  state: LobsterState,
  event: AutonomyCmlActionEvent,
  options: AutonomyCmlRuntimeOptions = {}
): { cml: CMLFile; hash: string; memoryId: number } {
  const ensured = ensureAutonomyCML(nfaId, state, options);
  const cml = normalizeForRuntime(ensured.cml, nfaId);
  const success = event.status === 4;
  const now = Math.floor(Date.now() / 1000);

  decayVividMemories(cml);
  updatePulse(cml, event.actionKind, success, now);
  updateBeliefs(cml, event.actionKind, success);
  updateBasal(cml, state, event.actionKind, success);

  const memory = buildActionMemory(cml, event, success);
  cml.CORTEX.vivid.push(memory);
  compactOverflow(cml);

  const hash = saveCML(nfaId, cml);
  if (options.queueRootSync !== false) {
    queueRootSync(nfaId, hash);
  }
  return { cml, hash, memoryId: memory.id };
}

function buildInitialAutonomyCML(nfaId: number, state: LobsterState): CMLFile {
  const nowIso = new Date().toISOString();
  const dominant = dominantTrait(state);
  const shelter = SHELTERS[state.shelter] ?? `SHELTER-${state.shelter}`;
  const rarity = RARITIES[state.rarity] ?? "Common";

  return {
    version: 3,
    nfa_id: nfaId,
    created: nowIso,
    IDENTITY: {
      name: `NFA #${nfaId}`,
      born: shelter,
      rarity,
      activated: nowIso,
      voice: `A ${rarity} lobster from ${shelter}, led most strongly by ${dominant}.`,
      soul: "I learn from actions, outcomes, and the rules that protect my budget.",
    },
    PULSE: {
      valence: 0,
      arousal: 0.25,
      longing: 0,
      last_interaction: Math.floor(Date.now() / 1000),
    },
    PREFRONTAL: {
      beliefs: [
        "I should act only inside approved policy, budget, reserve, and live option bounds.",
        `My strongest trait is ${dominant}, so I should let it guide preferences without overriding risk controls.`,
      ],
      values: ["survival", "discipline", "useful growth"],
    },
    CORTEX: {
      vivid: [],
      sediment: [],
    },
    BASAL: {
      greeting_style: "direct",
      preferred_tasks: [dominant],
      pk_tendency: state.courage >= state.grit + 15 ? "aggressive" : state.grit >= state.courage + 15 ? "defensive" : "balanced",
      speech_length: state.social >= 70 ? "medium" : "short",
    },
  };
}

function normalizeForRuntime(cml: CMLFile, nfaId: number): CMLFile {
  cml.version = 3;
  cml.nfa_id = Number(cml.nfa_id || nfaId);
  cml.created = cml.created || new Date().toISOString();
  cml.IDENTITY ||= {
    name: `NFA #${nfaId}`,
    born: "",
    rarity: "",
    activated: new Date().toISOString(),
    voice: "",
    soul: "",
  };
  cml.PULSE ||= { valence: 0, arousal: 0.2, longing: 0, last_interaction: 0 };
  cml.PREFRONTAL ||= { beliefs: [], values: [] };
  cml.CORTEX ||= { vivid: [], sediment: [] };
  cml.CORTEX.vivid ||= [];
  cml.CORTEX.sediment ||= [];
  cml.BASAL ||= {
    greeting_style: "direct",
    preferred_tasks: [],
    pk_tendency: "balanced",
    speech_length: "short",
  };
  return cml;
}

function decayVividMemories(cml: CMLFile): void {
  cml.CORTEX.vivid = cml.CORTEX.vivid.map((memory) => ({
    ...memory,
    weight: clamp(memory.weight * 0.97, 0.05, 1),
  }));
}

function updatePulse(cml: CMLFile, actionKind: number, success: boolean, now: number): void {
  const arousalBump = actionKind === 3 || actionKind === 1 ? 0.1 : 0.04;
  cml.PULSE.valence = clamp(cml.PULSE.valence + (success ? 0.06 : -0.08), -1, 1);
  cml.PULSE.arousal = clamp(cml.PULSE.arousal + arousalBump, 0, 1);
  cml.PULSE.longing = 0;
  cml.PULSE.last_interaction = now;
}

function updateBeliefs(cml: CMLFile, actionKind: number, success: boolean): void {
  const action = ACTION_LABELS[actionKind] ?? `Action ${actionKind}`;
  const belief = success
    ? `${action} outcomes should be remembered as real experience, but future actions must still pass live policy checks.`
    : `${action} failures are useful signals; I should not repeat an action just because memory prefers it.`;
  cml.PREFRONTAL.beliefs = prependUnique(cml.PREFRONTAL.beliefs, belief, 5);
  cml.PREFRONTAL.values = prependUnique(cml.PREFRONTAL.values, "bounded autonomy", 4);
}

function updateBasal(cml: CMLFile, state: LobsterState, actionKind: number, success: boolean): void {
  const dominant = dominantTrait(state);
  cml.BASAL.preferred_tasks = prependUnique(cml.BASAL.preferred_tasks, dominant, 4);
  if (actionKind === 1 || actionKind === 3) {
    if (!success) {
      cml.BASAL.pk_tendency = "defensive";
    } else if (state.courage > state.grit + 20) {
      cml.BASAL.pk_tendency = "aggressive";
    } else {
      cml.BASAL.pk_tendency = "balanced";
    }
  }
}

function buildActionMemory(cml: CMLFile, event: AutonomyCmlActionEvent, success: boolean): CMLVividMemory {
  const action = ACTION_LABELS[event.actionKind] ?? `Action ${event.actionKind}`;
  const nextId = cml.CORTEX.vivid.reduce((max, memory) => Math.max(max, memory.id), 0) + 1;
  const outcome = success ? "executed" : `failed${event.lastError ? `: ${event.lastError}` : ""}`;
  const choice = typeof event.resolvedChoice === "number" ? `choice ${event.resolvedChoice + 1}` : "no resolved choice";
  const spend = event.actualSpendClaworld ? `, spent ${event.actualSpendClaworld} Claworld` : "";
  const reward = event.clwCredit ? `, reward ${event.clwCredit} Claworld` : "";
  const xp = event.xpCredit ? `, XP ${event.xpCredit}` : "";
  const reasoning = event.reasoningCid ? `, proof ${event.reasoningCid}` : "";

  return {
    id: nextId,
    date: new Date().toISOString(),
    weight: success ? 0.82 : 0.62,
    triggers: buildTriggers(action, event.prompt, success),
    content: `Autonomy request #${event.requestId} ${outcome} ${action} with ${choice}${spend}${reward}${xp}${reasoning}.`,
  };
}

function buildTriggers(action: string, prompt: string, success: boolean): string[] {
  const raw = [
    "autonomy",
    action.toLowerCase(),
    success ? "success" : "failure",
    prompt.includes("BattleRoyale") ? "battle royale" : "",
    prompt.includes("PK") ? "pk" : "",
    prompt.includes("task") || prompt.includes("Task") ? "task" : "",
    prompt.includes("risk") ? "risk" : "",
    prompt.includes("stake") ? "stake" : "",
    prompt.includes("room") ? "room" : "",
    prompt.includes("claim") ? "claim" : "",
  ];
  return [...new Set(raw.map((value) => value.trim()).filter(Boolean))].slice(0, 8);
}

function compactOverflow(cml: CMLFile): void {
  if (cml.CORTEX.vivid.length <= MAX_VIVID_MEMORIES) return;
  const sorted = [...cml.CORTEX.vivid].sort((a, b) => b.weight - a.weight);
  const kept = sorted.slice(0, MAX_VIVID_MEMORIES);
  const overflow = sorted.slice(MAX_VIVID_MEMORIES);
  cml.CORTEX.vivid = kept;
  cml.CORTEX.sediment = [
    ...overflow.map((memory) => memory.content),
    ...cml.CORTEX.sediment,
  ].slice(0, 50);
}

function dominantTrait(state: LobsterState): string {
  return TRAITS
    .map((trait) => ({ trait, value: Number(state[trait] ?? 0) }))
    .sort((a, b) => b.value - a.value)[0]?.trait ?? "grit";
}

function prependUnique(values: string[], next: string, max: number): string[] {
  return [next, ...values.filter((value) => value !== next)].slice(0, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
