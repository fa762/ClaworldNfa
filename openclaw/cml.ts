/**
 * CML (Claw Memory Language) v3.0 — Local Implementation
 *
 * Structured memory system for NFA lobsters.
 * Each NFA has a single .cml file that replaces the old soul + memory files.
 *
 * Layers:
 *   IDENTITY  — permanent soul, generated once at first interaction
 *   PULSE     — emotion state, updated every SLEEP
 *   PREFRONTAL — beliefs & values, slowly evolving
 *   CORTEX    — vivid memories (max 30) + sediment (compressed old memories)
 *   BASAL     — behavioral habits
 *   HIPPOCAMPUS — in-memory buffer (not persisted), flushed during SLEEP
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ============================================
// CML DATA TYPES
// ============================================

export interface CMLIdentity {
  name: string;
  born: string;          // e.g. "SHELTER-01"
  rarity: string;        // e.g. "Rare"
  activated: string;     // ISO date
  voice: string;         // 1-2 sentence voice description
  soul: string;          // first-person self-awareness paragraph
}

export interface CMLPulse {
  valence: number;       // emotional positivity (-1.0 ~ 1.0)
  arousal: number;       // excitement level (0.0 ~ 1.0)
  longing: number;       // missing-owner value (0.0 ~ 1.0)
  last_interaction: number; // unix timestamp
}

export interface CMLPrefrontal {
  beliefs: string[];     // core beliefs formed through experience
  values: string[];      // guiding values
}

export interface CMLVividMemory {
  id: number;
  date: string;          // ISO date
  weight: number;        // 0.0 ~ 1.0, decays over time
  triggers: string[];    // keywords for recall matching
  content: string;       // the actual memory (1-2 sentences)
}

export interface CMLCortex {
  vivid: CMLVividMemory[];   // max 30 active memories
  sediment: string[];         // compressed old memories (1 sentence each)
}

export interface CMLBasal {
  greeting_style: string;      // how the lobster greets
  preferred_tasks: string[];   // e.g. ["wisdom", "courage"]
  pk_tendency: string;         // "aggressive" | "balanced" | "defensive"
  speech_length: string;       // "short" | "medium" | "verbose"
}

export interface HippocampusEntry {
  timestamp: number;
  content: string;       // conversation snippet worth remembering
}

export interface CMLFile {
  version: number;       // always 3
  nfa_id: number;
  created: string;       // ISO date

  IDENTITY: CMLIdentity;
  PULSE: CMLPulse;
  PREFRONTAL: CMLPrefrontal;
  CORTEX: CMLCortex;
  BASAL: CMLBasal;
}

// ============================================
// CONSTANTS
// ============================================

const CML_VERSION = 3;
const MAX_VIVID = 30;
const MAX_HIPPOCAMPUS = 5;
const CML_DIR = process.env.OPENCLAW_CML_DIR ||
  process.env.AUTONOMY_CML_DIR ||
  path.join(os.homedir(), '.openclaw', 'claw-world');
const CML_ARCHIVE_DIR = path.join(CML_DIR, 'archive');
const CML_PENDING_SYNC_DIR = path.join(CML_DIR, 'pending-sync');

export interface PendingRootSync {
  nfa_id: number;
  hash: string;
  updatedAt: number;
  archivedPath: string;
}

const SHELTER_CULTURES: Record<string, string> = {
  'SHELTER-01': '科研至上，理性精确，偶尔冷幽默',
  'SHELTER-02': '军事纪律，直接简短，不废话',
  'SHELTER-03': '信仰共同体，沉静寓言式，引用格言',
  'SHELTER-04': '纯粹市场，算成本谈收益，交易语言',
  'SHELTER-05': '全透明社会，坦诚数据化，反思式',
  'SHELTER-06': '儿童庇护所，天真但锐利，不信大人',
  '废土': '无人区，沉默寡言，说话像刀子',
};

const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];

// ============================================
// FILE I/O
// ============================================

export function getCMLPath(nfaId: number): string {
  return path.join(CML_DIR, `nfa-${nfaId}.cml`);
}

export function getArchiveDir(nfaId: number): string {
  return path.join(CML_ARCHIVE_DIR, `nfa-${nfaId}`);
}

function getPendingSyncPath(nfaId: number): string {
  return path.join(CML_PENDING_SYNC_DIR, `nfa-${nfaId}.json`);
}

/** Check if a CML file exists for this NFA. */
export function hasCML(nfaId: number): boolean {
  return fs.existsSync(getCMLPath(nfaId));
}

/** Load and parse a CML file. Returns null if not found. */
export function loadCML(nfaId: number): CMLFile | null {
  const p = getCMLPath(nfaId);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as CMLFile;
  } catch {
    return null;
  }
}

/** Save a CML file to disk. Returns the SHA-256 hash. */
export function saveCML(nfaId: number, cml: CMLFile): string {
  fs.mkdirSync(CML_DIR, { recursive: true });
  const content = JSON.stringify(cml, null, 2);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  fs.writeFileSync(getCMLPath(nfaId), content, 'utf8');

  const archiveDir = getArchiveDir(nfaId);
  fs.mkdirSync(archiveDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(archiveDir, `${ts}-${hash.slice(0, 12)}.cml`), content, 'utf8');

  return hash;
}

/** Compute SHA-256 hash of the current CML file on disk. */
export function hashCML(nfaId: number): string | null {
  const p = getCMLPath(nfaId);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function queueRootSync(nfaId: number, hash: string): void {
  fs.mkdirSync(CML_PENDING_SYNC_DIR, { recursive: true });
  const archiveDir = getArchiveDir(nfaId);
  const latestArchive = fs.existsSync(archiveDir)
    ? fs.readdirSync(archiveDir).sort().at(-1) ?? ''
    : '';

  const pending: PendingRootSync = {
    nfa_id: nfaId,
    hash,
    updatedAt: Date.now(),
    archivedPath: latestArchive ? path.join(archiveDir, latestArchive) : getCMLPath(nfaId),
  };

  fs.writeFileSync(getPendingSyncPath(nfaId), JSON.stringify(pending, null, 2), 'utf8');
}

export function getPendingRootSync(nfaId: number): PendingRootSync | null {
  const p = getPendingSyncPath(nfaId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as PendingRootSync;
  } catch {
    return null;
  }
}

export function clearPendingRootSync(nfaId: number): void {
  const p = getPendingSyncPath(nfaId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function toBytes32Hash(hash: string): string {
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

// ============================================
// INITIALIZATION
// ============================================

interface ChainPersonality {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
}

interface ChainState {
  rarity: number;
  shelter: number;
  personality: ChainPersonality;
  level: number;
}

/**
 * Create the initial CML file for a newly interacted NFA.
 * IDENTITY is populated from chain data; everything else is empty/default.
 */
export function initCML(nfaId: number, chain: ChainState): CMLFile {
  const rarityName = RARITY_NAMES[chain.rarity] || 'Common';
  const shelterName = chain.shelter <= 5
    ? `SHELTER-0${chain.shelter + 1}`
    : chain.shelter === 6 ? '废土' : `SHELTER-0${chain.shelter}`;
  const culture = SHELTER_CULTURES[shelterName] || '';
  const today = new Date().toISOString().slice(0, 10);

  // Derive voice from shelter + dominant personality
  const p = chain.personality;
  const traits = [
    { name: '勇气', val: p.courage },
    { name: '智慧', val: p.wisdom },
    { name: '社交', val: p.social },
    { name: '创造', val: p.create },
    { name: '毅力', val: p.grit },
  ].sort((a, b) => b.val - a.val);

  const dominant = traits[0];
  const secondary = traits[1];

  const voiceMap: Record<string, string> = {
    '勇气': '大胆直率',
    '智慧': '冷静精确',
    '社交': '热情开朗',
    '创造': '天马行空',
    '毅力': '沉稳简练',
  };

  const voice = `${voiceMap[dominant.name] || '平和'}，${culture.split('，')[0] || ''}`;

  const cml: CMLFile = {
    version: CML_VERSION,
    nfa_id: nfaId,
    created: today,

    IDENTITY: {
      name: '',   // LLM will name it during first SLEEP
      born: shelterName,
      rarity: rarityName,
      activated: today,
      voice,
      soul: '',   // LLM will write soul during first SLEEP
    },

    PULSE: {
      valence: 0.0,
      arousal: 0.3,
      longing: 0.0,
      last_interaction: Math.floor(Date.now() / 1000),
    },

    PREFRONTAL: {
      beliefs: [],
      values: [],
    },

    CORTEX: {
      vivid: [],
      sediment: [],
    },

    BASAL: {
      greeting_style: culture.split('，').slice(0, 2).join('，') || '平和',
      preferred_tasks: [
        ['courage', 'wisdom', 'social', 'create', 'grit'][
          [p.courage, p.wisdom, p.social, p.create, p.grit].indexOf(
            Math.max(p.courage, p.wisdom, p.social, p.create, p.grit)
          )
        ],
      ],
      pk_tendency: p.courage >= 70 ? 'aggressive' : p.grit >= 70 ? 'defensive' : 'balanced',
      speech_length: p.social >= 70 ? 'medium' : 'short',
    },
  };

  return cml;
}

// ============================================
// TRIGGER MATCHING (zero LLM cost)
// ============================================

/**
 * Match user message keywords against CORTEX.vivid triggers.
 * Returns the full vivid memories whose triggers were hit.
 * Pure text matching — no LLM call.
 */
export function matchTriggers(userMessage: string, cml: CMLFile): CMLVividMemory[] {
  if (!cml.CORTEX.vivid.length) return [];

  const msg = userMessage.toLowerCase();
  const matched: CMLVividMemory[] = [];

  for (const mem of cml.CORTEX.vivid) {
    for (const trigger of mem.triggers) {
      if (msg.includes(trigger.toLowerCase())) {
        matched.push(mem);
        break; // one trigger match is enough
      }
    }
  }

  // Sort by weight descending, return top 3 at most
  return matched.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

// ============================================
// TRIGGER INDEX (for boot output)
// ============================================

export interface TriggerIndex {
  id: number;
  triggers: string[];
}

/** Extract a lightweight trigger index from CML for system prompt injection. */
export function extractTriggerIndex(cml: CMLFile): TriggerIndex[] {
  return cml.CORTEX.vivid.map(m => ({
    id: m.id,
    triggers: m.triggers,
  }));
}

// ============================================
// HIPPOCAMPUS (in-memory buffer)
// ============================================

/**
 * In-memory conversation buffer. Not persisted to disk.
 * Engine holds one per active NFA. Flushed during SLEEP.
 */
export class Hippocampus {
  private entries: HippocampusEntry[] = [];

  /** Buffer a conversation snippet. Drops oldest if over MAX. */
  push(content: string): void {
    this.entries.push({ timestamp: Date.now(), content });
    if (this.entries.length > MAX_HIPPOCAMPUS) {
      this.entries.shift();
    }
  }

  /** Get all buffered entries. */
  getAll(): HippocampusEntry[] {
    return [...this.entries];
  }

  /** Flush the buffer (after SLEEP). */
  clear(): void {
    this.entries = [];
  }

  get length(): number {
    return this.entries.length;
  }
}

// ============================================
// LONGING CALCULATION
// ============================================

/** Calculate longing value based on hours since last interaction. */
export function calculateLonging(lastInteraction: number): number {
  if (lastInteraction <= 0) return 0;
  const hoursSince = (Date.now() / 1000 - lastInteraction) / 3600;
  if (hoursSince < 8) return 0;
  if (hoursSince < 24) return 0.2;
  if (hoursSince < 48) return 0.5;
  if (hoursSince < 72) return 0.8;
  return 1.0;
}

/** Determine emotion trigger from hours since last interaction. */
export function getEmotionTrigger(lastInteraction: number): 'DAILY_GREETING' | 'DREAM' | 'MISS_YOU' {
  if (lastInteraction <= 0) return 'DAILY_GREETING';
  const hoursSince = (Date.now() / 1000 - lastInteraction) / 3600;
  if (hoursSince >= 48) return 'MISS_YOU';
  if (hoursSince >= 8) return 'DREAM';
  return 'DAILY_GREETING';
}

// ============================================
// SLEEP PROMPT BUILDER
// ============================================

/**
 * Build the SLEEP consolidation prompt.
 * This is sent to the LLM at conversation end.
 * The LLM outputs a complete new CML JSON that overwrites the old file.
 */
export function buildSleepPrompt(cml: CMLFile, hippocampus: HippocampusEntry[]): string {
  return [
    `你是 CML v3.0 记忆处理系统。现在是 SLEEP 阶段。`,
    ``,
    `## 本次对话的原始记录（HIPPOCAMPUS）：`,
    ...hippocampus.map((e, i) => `${i + 1}. [${new Date(e.timestamp).toISOString()}] ${e.content}`),
    ``,
    `## 当前 CML 文件：`,
    '```json',
    JSON.stringify(cml, null, 2),
    '```',
    ``,
    `## 你的任务：`,
    `根据本次对话记录，处理以下五件事，然后输出完整的新 CML JSON：`,
    ``,
    `1. **CORTEX.vivid**：本次对话有什么值得记住的？如果有，写入 vivid（设置合适的 triggers 关键词和 weight）。`,
    `   - vivid 最多 ${MAX_VIVID} 条。如果满了，把 weight 最低的压缩成一句话放进 sediment。`,
    `   - 已有记忆的 weight 随时间自然衰减：每次 SLEEP 所有 vivid 的 weight × 0.95。`,
    `   - 新记忆的 id 递增（当前最大 id + 1）。`,
    ``,
    `2. **PREFRONTAL**：信念/价值观需要更新吗？`,
    `   - 某条信念被强化 → 保留`,
    `   - 新经历动摇旧信念 → 修改或删除`,
    `   - 形成新信念 → 添加（信念不超过 5 条，价值观不超过 3 条）`,
    ``,
    `3. **PULSE**：根据本次对话情绪基调调整 valence 和 arousal。`,
    `   - 更新 last_interaction 为当前 Unix 时间戳 ${Math.floor(Date.now() / 1000)}`,
    `   - longing 重置为 0（因为刚互动过）`,
    ``,
    `4. **BASAL**：行为习惯有变化吗？`,
    `   - 如果玩家连续做同类任务 → 更新 preferred_tasks`,
    `   - 如果对话风格有变 → 调整 speech_length`,
    ``,
    `5. **IDENTITY**：如果 name 或 soul 为空（第一次 SLEEP），请根据性格和避难所生成。`,
    `   - name：一个有意义的名字（中文或英文，2-4 个字）`,
    `   - soul：第一人称自述（2-3 句话）`,
    ``,
    `## 输出要求`,
    `只输出完整的 JSON，不要输出任何其他文字。确保 JSON 合法可解析。`,
    `保持 version、nfa_id、created 不变。`,
  ].join('\n');
}

// ============================================
// PARSE LLM SLEEP OUTPUT
// ============================================

/** Extract CML JSON from LLM output (handles markdown code blocks). */
export function parseSleepOutput(raw: string): CMLFile | null {
  // Try to extract JSON from code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : raw.trim();

  try {
    const parsed = JSON.parse(jsonStr) as CMLFile;
    // Basic validation
    if (parsed.version !== CML_VERSION) return null;
    if (!parsed.IDENTITY || !parsed.PULSE || !parsed.CORTEX) return null;
    // Enforce vivid cap
    if (parsed.CORTEX.vivid.length > MAX_VIVID) {
      parsed.CORTEX.vivid = parsed.CORTEX.vivid
        .sort((a, b) => b.weight - a.weight)
        .slice(0, MAX_VIVID);
    }
    return parsed;
  } catch {
    return null;
  }
}

// ============================================
// BOOT DATA (for system prompt injection)
// ============================================

export interface CMLBootData {
  identity: CMLIdentity;
  pulse: CMLPulse & { computed_longing: number };
  prefrontal: CMLPrefrontal;
  basal: CMLBasal;
  triggerIndex: TriggerIndex[];
  emotionTrigger: 'DAILY_GREETING' | 'DREAM' | 'MISS_YOU';
  sedimentSummary: string[];
}

/**
 * Extract the boot payload from a CML file.
 * This is what gets injected into the LLM system prompt (~1500 chars).
 */
export function extractBootData(cml: CMLFile): CMLBootData {
  const longing = calculateLonging(cml.PULSE.last_interaction);
  return {
    identity: cml.IDENTITY,
    pulse: { ...cml.PULSE, computed_longing: longing },
    prefrontal: cml.PREFRONTAL,
    basal: cml.BASAL,
    triggerIndex: extractTriggerIndex(cml),
    emotionTrigger: getEmotionTrigger(cml.PULSE.last_interaction),
    sedimentSummary: cml.CORTEX.sediment.slice(0, 5),
  };
}

// ============================================
// MIGRATION: old soul+memory → CML
// ============================================

/**
 * Migrate existing soul + memory files into a CML file.
 * Non-destructive: old files are kept.
 */
export function migrateFromLegacy(nfaId: number, chain: ChainState): CMLFile {
  const cml = initCML(nfaId, chain);

  // Try to read existing soul file
  const soulPath = path.join(CML_DIR, `nfa-${nfaId}-soul.md`);
  if (fs.existsSync(soulPath)) {
    const soulContent = fs.readFileSync(soulPath, 'utf8');
    // Extract name from "# NFA #X — <NAME>" line
    const nameMatch = soulContent.match(/# NFA #\d+ — (.+)/);
    if (nameMatch) cml.IDENTITY.name = nameMatch[1].trim();
    // Extract soul paragraph (after "## Soul" section)
    const soulMatch = soulContent.match(/## Soul\n([\s\S]*?)$/);
    if (soulMatch) cml.IDENTITY.soul = soulMatch[1].trim();
  }

  // Try to read existing memory file
  const memPath = path.join(CML_DIR, `nfa-${nfaId}-memory.md`);
  if (fs.existsSync(memPath)) {
    const memContent = fs.readFileSync(memPath, 'utf8');
    const entries = memContent.split(/^## /m).filter(Boolean);

    entries.forEach((entry, i) => {
      const lines = entry.trim().split('\n');
      const date = lines[0]?.trim() || new Date().toISOString().slice(0, 10);
      const content = lines.slice(1).map(l => l.replace(/^- /, '').trim()).join(' ');

      if (content) {
        // Extract rough triggers from content
        const triggers = extractKeywords(content);
        cml.CORTEX.vivid.push({
          id: i + 1,
          date,
          weight: Math.max(0.3, 1.0 - i * 0.07), // older = lower weight
          triggers,
          content,
        });
      }
    });

    // Cap at MAX_VIVID
    if (cml.CORTEX.vivid.length > MAX_VIVID) {
      const overflow = cml.CORTEX.vivid.splice(MAX_VIVID);
      cml.CORTEX.sediment.push(...overflow.map(m => m.content));
    }
  }

  return cml;
}

/** Simple keyword extraction from Chinese/English text. */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    /PK/gi, /任务/g, /智慧/g, /勇气/g, /社交/g, /创造/g, /毅力/g,
    /全攻/g, /全防/g, /均衡/g, /变异/g, /基因/g, /市场/g,
    /升级/g, /休眠/g, /Claworld/gi, /SHELTER/gi, /废土/g,
    /赢/g, /输/g, /梦/g, /想念/g,
  ];
  for (const pat of patterns) {
    if (pat.test(text)) {
      keywords.push(text.match(pat)![0]);
    }
    pat.lastIndex = 0; // reset regex state
  }
  return [...new Set(keywords)].slice(0, 6);
}
