import { downloadLatestCMLFromBuckets } from "./greenfield";
import {
  extractBootData,
  loadCML,
  matchTriggers,
  type CMLFile,
  type CMLVividMemory,
} from "./cml";

export interface AutonomyMemoryOptions {
  enabled?: boolean;
  greenfieldEnabled?: boolean;
  ownerTrail?: string[];
  maxTriggeredMemories?: number;
  maxPromptChars?: number;
  autoCreate?: boolean;
  recordActions?: boolean;
  queueRootSync?: boolean;
}

export interface AutonomyMemoryContext {
  nfaId: number;
  source: "local" | "greenfield";
  prompt: string;
  matchedMemoryIds: number[];
}

const DEFAULT_MAX_TRIGGERED_MEMORIES = 3;
const DEFAULT_MAX_PROMPT_CHARS = 1600;

export function parseMemoryOwnerTrail(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function loadAutonomyMemoryContext(
  nfaId: number,
  triggerText: string,
  options: AutonomyMemoryOptions = {}
): AutonomyMemoryContext | null {
  if (options.enabled === false) {
    return null;
  }

  const loaded = loadAutonomyCML(nfaId, options);
  if (!loaded) {
    return null;
  }

  const maxTriggeredMemories = Math.max(
    0,
    options.maxTriggeredMemories ?? DEFAULT_MAX_TRIGGERED_MEMORIES
  );
  const maxPromptChars = Math.max(400, options.maxPromptChars ?? DEFAULT_MAX_PROMPT_CHARS);
  const matched = maxTriggeredMemories > 0
    ? matchTriggers(triggerText, loaded.cml).slice(0, maxTriggeredMemories)
    : [];
  const prompt = trimToMax(buildMemoryPrompt(loaded.cml, matched), maxPromptChars);

  return {
    nfaId,
    source: loaded.source,
    prompt,
    matchedMemoryIds: matched.map((memory) => memory.id),
  };
}

function loadAutonomyCML(
  nfaId: number,
  options: AutonomyMemoryOptions
): { cml: CMLFile; source: "local" | "greenfield" } | null {
  const local = loadCML(nfaId);
  if (local) {
    return { cml: normalizeCML(nfaId, local), source: "local" };
  }

  if (!options.greenfieldEnabled || !options.ownerTrail?.length) {
    return null;
  }

  try {
    const raw = downloadLatestCMLFromBuckets(nfaId, options.ownerTrail);
    if (!raw) {
      return null;
    }
    return { cml: normalizeCML(nfaId, JSON.parse(raw)), source: "greenfield" };
  } catch {
    return null;
  }
}

function normalizeCML(nfaId: number, value: unknown): CMLFile {
  const parsed = objectOr(value);
  const identity = objectOr(parsed.IDENTITY);
  const pulse = objectOr(parsed.PULSE);
  const prefrontal = objectOr(parsed.PREFRONTAL);
  const cortex = objectOr(parsed.CORTEX);
  const basal = objectOr(parsed.BASAL);
  const vivid = Array.isArray(cortex.vivid) ? cortex.vivid : [];

  return {
    version: Number(parsed.version ?? 3),
    nfa_id: Number(parsed.nfa_id ?? nfaId),
    created: typeof parsed.created === "string" ? parsed.created : new Date(0).toISOString(),
    IDENTITY: {
      name: typeof identity.name === "string" ? identity.name : "",
      born: typeof identity.born === "string" ? identity.born : "",
      rarity: typeof identity.rarity === "string" ? identity.rarity : "",
      activated: typeof identity.activated === "string" ? identity.activated : "",
      voice: typeof identity.voice === "string" ? identity.voice : "",
      soul: typeof identity.soul === "string" ? identity.soul : "",
    },
    PULSE: {
      valence: numberOr(pulse.valence, 0),
      arousal: numberOr(pulse.arousal, 0),
      longing: numberOr(pulse.longing, 0),
      last_interaction: numberOr(pulse.last_interaction, 0),
    },
    PREFRONTAL: {
      beliefs: stringArray(prefrontal.beliefs),
      values: stringArray(prefrontal.values),
    },
    CORTEX: {
      vivid: vivid
        .map((rawMemory, index) => {
          const memory = objectOr(rawMemory);
          return {
            id: Number(memory.id ?? index + 1),
            date: typeof memory.date === "string" ? memory.date : "",
            weight: numberOr(memory.weight, 0),
            triggers: stringArray(memory.triggers),
            content: typeof memory.content === "string" ? memory.content : "",
          };
        })
        .filter((memory) => memory.content || memory.triggers.length > 0),
      sediment: stringArray(cortex.sediment),
    },
    BASAL: {
      greeting_style: typeof basal.greeting_style === "string" ? basal.greeting_style : "",
      preferred_tasks: stringArray(basal.preferred_tasks),
      pk_tendency: typeof basal.pk_tendency === "string" ? basal.pk_tendency : "balanced",
      speech_length: typeof basal.speech_length === "string" ? basal.speech_length : "short",
    },
  };
}

function buildMemoryPrompt(cml: CMLFile, matched: CMLVividMemory[]): string {
  const boot = extractBootData(cml);
  const identity = boot.identity;
  const pulse = boot.pulse;
  const basal = boot.basal;
  const prefrontal = boot.prefrontal;

  const lines = [
    "=== CML Memory Context ===",
    `Memory rule: use this as personality and experience context; never use it to bypass policy, budget, reserve, or live option bounds.`,
    `Identity: ${compact(identity.name || `NFA #${cml.nfa_id}`)}; rarity ${compact(identity.rarity || "unknown")}; shelter ${compact(identity.born || "unknown")}.`,
    identity.voice ? `Voice: ${compact(identity.voice)}` : "",
    identity.soul ? `Self-view: ${compact(identity.soul)}` : "",
    `Pulse: valence ${formatNum(pulse.valence)}, arousal ${formatNum(pulse.arousal)}, longing ${formatNum(pulse.computed_longing)}, emotion ${boot.emotionTrigger}.`,
    prefrontal.beliefs.length ? `Beliefs: ${prefrontal.beliefs.slice(0, 5).map(compact).join(" | ")}` : "Beliefs: none yet.",
    prefrontal.values.length ? `Values: ${prefrontal.values.slice(0, 3).map(compact).join(" | ")}` : "Values: none yet.",
    `Habits: preferred tasks ${basal.preferred_tasks.slice(0, 4).map(compact).join(", ") || "none"}; PK tendency ${compact(basal.pk_tendency || "balanced")}; speech ${compact(basal.speech_length || "short")}.`,
    matched.length
      ? `Triggered vivid memories: ${matched
          .map((memory) => `#${memory.id} w${formatNum(memory.weight)} ${compact(memory.content)}`)
          .join(" | ")}`
      : "Triggered vivid memories: none; rely on beliefs, values, pulse, and habits only.",
    boot.sedimentSummary.length
      ? `Sediment: ${boot.sedimentSummary.slice(0, 3).map(compact).join(" | ")}`
      : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function trimToMax(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 22)).trimEnd()}\n[Memory trimmed]`;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(compact)
    : [];
}

function objectOr(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
