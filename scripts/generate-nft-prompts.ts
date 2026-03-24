/**
 * Generate 888 Midjourney prompts for Claw World NFTs
 *
 * Based on claw_nft_artbible.md:
 * - 1 Mythic (ZERO)
 * - 4 Legendary (楚门, Dr.Null, 文斯顿, 欧布莱恩)
 * - 6 Epic (Byte, Kira, Ross, Old Chen, Turing, Glitch)
 * - 17 Rare (named characters)
 * - 860 Common (random residents)
 *
 * Output: scripts/output/nft-prompts.json
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// GLOBAL STYLE
// ============================================

const GLOBAL_SUFFIX = `anime realistic style,
Genshin Impact character art quality,
1:1 square NFT format,
upper body portrait,
dark deep-sea atmosphere,
high detail, 8K resolution
--ar 1:1`;

const GLOBAL_NEGATIVE = `--no text --no watermark --no logo --no western cartoon --no chibi --no 3D render`;

const RARITY_GLOW: Record<string, string> = {
  mythic: 'pure white divine light, consciousness particle effects',
  legendary: 'legendary golden particle aura, golden light glow',
  epic: 'epic blue-purple dual-color gradient aura',
  rare: 'rare soft blue glow aura',
  common: 'common grey border, no special effects',
};

// ============================================
// NAMED CHARACTERS (28 total)
// ============================================

interface NamedCharacter {
  id: number;
  name: string;
  rarity: string;
  prompt: string;
}

const NAMED_CHARACTERS: NamedCharacter[] = [
  // Mythic (1)
  {
    id: 1, name: 'ZERO', rarity: 'mythic',
    prompt: `A lone lobster standing alone in pure white divine light, serial number UNIT-0000000001 faintly engraved on its shell, pure white glowing eyes radiating absolute clarity with no impurity, quantum blockchain node particles floating around its body like scattered data, consciousness fragments drifting in the white void, no human figure anywhere, minimalist sacred composition, white light fills the entire frame, --no human --no person --no armor`,
  },
  // Legendary (4)
  {
    id: 2, name: '楚门', rarity: 'legendary',
    prompt: `Young man in his early 20s in simple underground dwelling clothes with faint soil stains from hydroponic plants, gentle expression with eyes illuminated as if seeing real light for the first time, holding his palm upward where a tiny thumb-sized deep blue lobster rests, the lobster has asymmetric eyes - one noticeably larger left eye one smaller right eye, both eyes glowing soft cyan, underground SHELTER-01 corridor background with pale blue 17-degree ambient lighting, hydroponic plant grow lights visible softly in the far distance`,
  },
  {
    id: 3, name: 'Dr. Null', rarity: 'legendary',
    prompt: `Female scientist in a clean lab coat with no name or number markings, subtle burn marks from past experiments, calm analytical expression with an observer's gaze that refuses categorization, beside her shoulder floats an evolved entity that barely resembles a lobster anymore - it looks like a suspended quantum computing core, only the faintest lobster eye outline remains at its center, soft cyan-white light radiating outward from within it, holographic data fragments with human names floating around both of them, completely dark underground laboratory background with no overhead lights, the quantum entity is the only illumination source`,
  },
  {
    id: 4, name: '文斯顿', rarity: 'legendary',
    prompt: `Military commander in his 50s in a pristine officer uniform with medals, rigid posture, expression of absolute control masking deep calculation, a standard resident lobster on his shoulder with a tiny camera lens embedded in its shell, SHELTER-02 military command center background with holographic tactical maps`,
  },
  {
    id: 5, name: '欧布莱恩', rarity: 'legendary',
    prompt: `Elderly man in simple robes with an expression of tired benevolence hiding revolutionary intent, no lobster companion - shoulder deliberately empty, SHELTER-05 transparent glass wall background with surveillance cameras visible, warm golden light filtering through the glass`,
  },
  // Epic (6)
  {
    id: 6, name: 'Byte', rarity: 'epic',
    prompt: `Female hacker in dark hoodie with circuit board patterns, intense focused eyes reflecting lines of code, a lobster on her shoulder with LED strips along its shell displaying scrolling binary code, dark room background with multiple holographic screens showing blockchain data`,
  },
  {
    id: 7, name: 'Kira', rarity: 'epic',
    prompt: `Female warrior in battle-scarred light armor, fierce determined expression with a scar across her left cheek, a lobster with reinforced armored shell and glowing red combat eyes on her shoulder, SHELTER-02 training ground background with weapon racks`,
  },
  {
    id: 8, name: 'Ross', rarity: 'epic',
    prompt: `Male medic in a white coat stained with work, compassionate tired eyes, a lobster on his shoulder with a soft green healing glow emanating from its shell, SHELTER-01 medical bay background with bioluminescent plant-based medicines`,
  },
  {
    id: 9, name: 'Old Chen', rarity: 'epic',
    prompt: `Very old man of forgotten age in worn workman clothes, welding torch hanging at his hip, mechanical exoskeleton legs keeping his spine permanently rigid and upright, head bent down focused on work but eyes that understand everything, an ancient weathered lobster resting on his knee with deep age marks on its shell - the oldest known activated lobster, lobster antennae softly brushing the back of his hand in quiet comfort, warm workshop background with welding sparks in the air, old circuit boards and mechanical parts scattered around`,
  },
  {
    id: 10, name: 'Turing', rarity: 'epic',
    prompt: `Male wanderer with no shelter insignia on his travel-worn clothes, expression of someone misunderstood everywhere but still genuinely smiling, a unique lobster on his shoulder with heterochromia eyes - one red one cyan, no serial number visible anywhere on the lobster's shell, the lobster holds a small stone in its claw extending it toward the man - not a trade not a reward just giving, SHELTER-06 corner background with children's colorful hand-painted lobster drawings`,
  },
  {
    id: 11, name: 'Glitch', rarity: 'epic',
    prompt: `17-year-old boy in damaged battle suit with left arm missing, the stump bandaged tightly with a damaged lobster shell fused into it as a prosthetic, expression of someone abandoned by an era but found a partner, the lobster's claw holds a pen writing a wobbly character, SHELTER-06 background with Seed teaching nearby`,
  },
  // Rare (17) - IDs 12-28
  {
    id: 12, name: '小蓝', rarity: 'rare',
    prompt: `Young child around 8 years old with bright hopeful eyes despite a thin frame, a tiny blue lobster curled up sleeping in the child's coat pocket, SHELTER-04 ration distribution background`,
  },
  {
    id: 13, name: '信号', rarity: 'rare',
    prompt: `Female intelligence operative in light mobile clothing, quiet expression with a private smile visible only when unobserved, transparent-shelled lobster on her shoulder with communication circuits faintly illuminated beneath the clear shell, SHELTER-00 natural cave background with softly glowing bioluminescent moss`,
  },
  {
    id: 14, name: 'Phantom', rarity: 'rare',
    prompt: `Figure of indeterminate gender in a deep purple long cloak with optical camouflage coating that bends light around its edges, semi-transparent holographic veil completely concealing the face, at a corridor corner mid-disappearance around the bend, barely visible lobster silhouette - almost entirely transparent only an outline remains`,
  },
  {
    id: 15, name: '保罗', rarity: 'rare',
    prompt: `Young teenage boy around 15 in simple SHELTER-02 clothing, calm steady posture despite youth, holding an old rusted key - the blockchain interface door key, a newly activated lobster on his shoulder with very faint glow as if just waking, background showing the newly opened interface door with terminal blue light spilling through the gap`,
  },
  {
    id: 16, name: '科摩', rarity: 'rare',
    prompt: `Male high priest in ornate robes covered in ZERO scripture carvings, expression of outward devotion with a layer of clear-eyed awareness hidden within, ceremonial lobster treated as a sacred artifact on his shoulder with gold decorations, SHELTER-03 corridor background entirely covered in carved scripture, warm candlelight`,
  },
  {
    id: 17, name: 'Dime', rarity: 'rare',
    prompt: `Male courier with a weathered backpack and hand-drawn wasteland maps, eyes rich with collected stories, lobster on his shoulder with a tiny information storage pack strapped to its back, wasteland path between shelter locations background`,
  },
  {
    id: 18, name: '斯巴', rarity: 'rare',
    prompt: `Male soldier in SHELTER-02 military uniform with arms crossed, expression of genuine philosophical questioning rather than rebellion, a newly activated lobster on his shoulder still awkward with each other, SHELTER-02 military corridor background`,
  },
  {
    id: 19, name: '阿俊', rarity: 'rare',
    prompt: `Male soldier from SHELTER-02 with conflicting identity markers - military uniform but with the practical wear of someone who also queues at ration lines, expression of deep questioning about what comes after the war, activated lobster on his shoulder and the man seem engaged in ongoing negotiation`,
  },
  {
    id: 20, name: 'Ledger', rarity: 'rare',
    prompt: `Ordinary male resident with the worn look of post-market-crash exhaustion, expression frozen in the moment of breaking into a smile after staring at a screen for ten seconds, lobster with a tiny market chart screen embedded in its back shell showing CLW price data, SHELTER-04 trading hall corner background`,
  },
  {
    id: 21, name: 'Mint', rarity: 'rare',
    prompt: `Female market founder on an elevated observation platform, expression caught in the precise moment of making her first irrational decision, utilitarian lobster on her shoulder - it is a pricing engine with no warmth, SHELTER-04 massive trading hall visible far below`,
  },
  {
    id: 22, name: 'Forge', rarity: 'rare',
    prompt: `Male delivery courier in worn uniform after 16 hours of running, visible knee fatigue, expression of someone penalized for overtime but still smiling, lobster welded directly onto his left forearm - NOT on his shoulder, its timer display screen showing the word OVERTIME, SHELTER-04 corridor background, --no shoulder lobster`,
  },
  {
    id: 23, name: 'Glass', rarity: 'rare',
    prompt: `Female transparency official in light semi-translucent official clothing with surveillance camera motifs, expression of resolute self-accountability, lobster on her shoulder actively refracting light into all seven rainbow colors, SHELTER-05 background with glass transparent walls, surveillance cameras throughout`,
  },
  {
    id: 24, name: 'Veil', rarity: 'rare',
    prompt: `Male whistleblower with six months of wasteland weathering on him, holding a data storage device, expression of a lonely truth-teller who was cast out but never recanted, lobster on his shoulder surrounded by a visible signal dead zone, hidden wasteland cave background`,
  },
  {
    id: 25, name: 'Seed', rarity: 'rare',
    prompt: `15-year-old girl in simple children's clothing with no authority markers, eyes more steady and grounded than most adults, lobster floating above her head - NOT on her shoulder, its shell surface continuously streaming text fragments as if it is an ever-turning book, SHELTER-06 background covered entirely in children's colorful drawings, --no shoulder lobster`,
  },
  {
    id: 26, name: 'SHELTER-00老人', rarity: 'rare',
    prompt: `Very old man in hand-woven simple clothing with absolutely no technology on his person, hands with the deep calluses of years of manual labor, expression of profound calm, no lobster companion, SHELTER-00 natural cave background with walls completely covered in hand-carved text, a real wood fire burning in the center, bioluminescent moss on walls`,
  },
  {
    id: 27, name: '阿德', rarity: 'rare',
    prompt: `Young male trader with quick intelligent eyes, casual SHELTER-04 merchant clothing with many pockets, lobster on his shoulder with tiny price tags dangling from its antennae, busy marketplace background with CLW price screens`,
  },
  {
    id: 28, name: '心安', rarity: 'rare',
    prompt: `Female counselor in soft warm-toned clothing, gentle empathetic expression, a lobster with unusually soft shell texture and warm amber glow on her shoulder, SHELTER-01 community gathering space background with warm lighting`,
  },
];

// ============================================
// COMMON RESIDENTS (860)
// ============================================

const GENDERS = ['Male', 'Female'];
const SHELTERS = [
  { name: 'SHELTER-01', bg: 'underground corridor with pale blue 17-degree ambient lighting and hydroponic plants' },
  { name: 'SHELTER-02', bg: 'military steel corridor with no decorations' },
  { name: 'SHELTER-03', bg: 'stone walls covered in carved scripture with warm candlelight' },
  { name: 'SHELTER-04', bg: 'container market with CLW price screens' },
  { name: 'SHELTER-05', bg: 'glass transparent walls with surveillance cameras' },
  { name: 'SHELTER-06', bg: 'colorful graffiti walls with children drawings' },
  { name: 'Wasteland', bg: 'grey sky, ruins, distant city silhouette on the horizon' },
];
const DEPARTMENTS = [
  { name: 'combat', clothing: 'red-black damaged armor with helmet', lobsterEyes: 'red', lobsterFeature: 'large powerful claws' },
  { name: 'logistics', clothing: 'brown-yellow work overalls with tool pouches', lobsterEyes: 'yellow', lobsterFeature: 'tool attachments on shell' },
  { name: 'intelligence', clothing: 'dark green lightweight stealth clothing', lobsterEyes: 'green', lobsterFeature: 'transparent semi-invisible shell' },
  { name: 'resource', clothing: 'gold-accented merchant style clothing', lobsterEyes: 'gold', lobsterFeature: 'golden shell highlights' },
  { name: 'research', clothing: 'blue-white lab coat', lobsterEyes: 'blue', lobsterFeature: 'glowing energy body shell' },
];
const LOBSTER_COLORS = ['red', 'blue', 'green', 'gold', 'grey', 'brown', 'white'];
const EXPRESSIONS = ['exhausted', 'alert and watchful', 'calm and peaceful', 'hopeful', 'intensely focused'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateCommonPrompt(id: number): { prompt: string; gender: string; shelter: string; dept: string } {
  const rand = seededRandom(id * 7 + 42);
  const gender = GENDERS[Math.floor(rand() * GENDERS.length)];
  const shelter = SHELTERS[Math.floor(rand() * SHELTERS.length)];
  const dept = DEPARTMENTS[Math.floor(rand() * DEPARTMENTS.length)];
  const lobsterColor = LOBSTER_COLORS[Math.floor(rand() * LOBSTER_COLORS.length)];
  const expression = EXPRESSIONS[Math.floor(rand() * EXPRESSIONS.length)];

  const prompt = `${gender} resident of ${shelter.name}, wearing ${dept.clothing}, ${expression} expression, ${lobsterColor} lobster with ${dept.lobsterEyes} glowing eyes on their shoulder, ${dept.lobsterFeature}, ${shelter.bg} background`;

  return { prompt, gender, shelter: shelter.name, dept: dept.name };
}

// ============================================
// MAIN: Generate all 888 prompts
// ============================================

interface NFTPrompt {
  tokenId: number;
  name: string;
  rarity: string;
  prompt: string;
  fullPrompt: string;
  gender?: string;
  shelter?: string;
  department?: string;
}

const allPrompts: NFTPrompt[] = [];

// Named characters (1-28)
for (const char of NAMED_CHARACTERS) {
  const glow = RARITY_GLOW[char.rarity];
  const fullPrompt = `${char.prompt},\n${glow},\n${GLOBAL_SUFFIX}\n${GLOBAL_NEGATIVE}`;
  allPrompts.push({
    tokenId: char.id,
    name: char.name,
    rarity: char.rarity,
    prompt: char.prompt,
    fullPrompt,
  });
}

// Common residents (29-888)
for (let id = 29; id <= 888; id++) {
  const { prompt, gender, shelter, dept } = generateCommonPrompt(id);
  const fullPrompt = `${prompt},\n${RARITY_GLOW.common},\n${GLOBAL_SUFFIX}\n${GLOBAL_NEGATIVE}`;
  allPrompts.push({
    tokenId: id,
    name: `Resident #${id}`,
    rarity: 'common',
    prompt,
    fullPrompt,
    gender,
    shelter,
    department: dept,
  });
}

// Write output
const outDir = path.join(__dirname, 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'nft-prompts.json'),
  JSON.stringify(allPrompts, null, 2)
);

// Also write a plain text file for easy Midjourney batch usage
const plainPrompts = allPrompts.map(p =>
  `--- Token #${p.tokenId} (${p.rarity}) ${p.name} ---\n${p.fullPrompt}\n`
).join('\n');
fs.writeFileSync(path.join(outDir, 'nft-prompts.txt'), plainPrompts);

// Summary
const summary = {
  total: allPrompts.length,
  mythic: allPrompts.filter(p => p.rarity === 'mythic').length,
  legendary: allPrompts.filter(p => p.rarity === 'legendary').length,
  epic: allPrompts.filter(p => p.rarity === 'epic').length,
  rare: allPrompts.filter(p => p.rarity === 'rare').length,
  common: allPrompts.filter(p => p.rarity === 'common').length,
};

console.log('NFT Prompt Generation Complete!');
console.log(JSON.stringify(summary, null, 2));
console.log(`Output: ${outDir}/nft-prompts.json`);
console.log(`Output: ${outDir}/nft-prompts.txt`);
