/**
 * 龙虾文明宇宙 · CRT/TUI 风格 NFT v3
 * - 名字从 gen_images.py 提取（居民-S01-combat-male → S01 COMBAT [M]）
 * - 无信息框，龙虾图案放大
 * - 视觉差异：shelter 背景 × department 龙虾 × seeded random
 *
 * Usage: node scripts/generate-nft-images.mjs [startFrom]
 */

import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'imgclaw', 'claw_nft_images');
const SIZE = 1024;
const START_FROM = parseInt(process.argv[2] || '1');

// ── 从 gen_images.py 读名字 ──
function loadNames() {
  const content = readFileSync(join(__dirname, '..', 'imgclaw', 'gen_images.py'), 'utf8');
  const re = /\((\d+),\s*'([^']+)',\s*'(\w+)'/g;
  const map = {};
  let m;
  while ((m = re.exec(content)) !== null) {
    map[parseInt(m[1])] = { name: m[2], rarity: m[3].toLowerCase() };
  }
  return map;
}

// ── 居民名字格式化 ──
function formatName(raw) {
  // Named characters
  const CN_MAP = {
    '楚门': 'Truman', '文斯顿': 'Weston', '欧布莱恩': "O'Brien",
    '小蓝': 'Xiao Lan', '信号': 'Signal', '保罗': 'Paul',
    '科摩': 'Komo', '卡珊': 'Kassandra', '斯巴': 'Spar', '阿俊': 'Ah Jun',
    '阿德': 'Ah De', '心安': 'Xin An', 'SHELTER-00老人': 'Elder-00',
  };
  if (CN_MAP[raw]) return CN_MAP[raw];
  if (!raw.startsWith('居民-')) return raw;

  // 居民-S01-combat-male → S01 COMBAT [M]
  const parts = raw.replace('居民-', '').split('-');
  const shelter = parts[0] || '??';
  const deptMap = { combat: 'COMBAT', logistics: 'LOGISTICS', intelligence: 'INTEL', resource: 'RESOURCE', research: 'RESEARCH' };
  const dept = deptMap[(parts[1] || '').toLowerCase()] || (parts[1] || '??').toUpperCase();
  const gender = parts[2] === 'male' ? 'M' : parts[2] === 'female' ? 'F' : '?';
  return `${shelter} ${dept} [${gender}]`;
}

// ── 稀有度 ──
const RARITY = {
  mythic:    { main: '#FFFFFF', glow: '#FFFFFF', label: 'MYTHIC' },
  legendary: { main: '#FFD700', glow: '#FFB800', label: 'LEGENDARY' },
  epic:      { main: '#A855F7', glow: '#8B5CF6', label: 'EPIC' },
  rare:      { main: '#3B82F6', glow: '#2563EB', label: 'RARE' },
  common:    { main: '#22C55E', glow: '#16A34A', label: 'COMMON' },
};

// ── 避难所主题 ──
const SHELTERS = {
  'S01': { bg: [6,15,6],   accent: '#22C55E', grid: '#0a3a0a', tag: 'S-01 RESEARCH',  bits: ['quantum flux', '> signal OK', 'Dr.Null'] },
  'S02': { bg: [8,8,14],   accent: '#94A3B8', grid: '#151520', tag: 'S-02 MILITARY',   bits: ['ALPHA', '> perimeter', 'O\'Brien'] },
  'S03': { bg: [14,10,6],  accent: '#F59E0B', grid: '#1a1208', tag: 'S-03 FAITH',      bits: ['axiom', '> verse 7:14', 'devotion'] },
  'S04': { bg: [6,14,8],   accent: '#10B981', grid: '#082010', tag: 'S-04 MARKET',     bits: ['CLW 0.008', '> 45 CLW', 'Mint'] },
  'S05': { bg: [6,10,16],  accent: '#06B6D4', grid: '#081018', tag: 'S-05 CRYSTAL',    bits: ['public', '> 100%', 'Glass'] },
  'S06': { bg: [12,6,12],  accent: '#D946EF', grid: '#180818', tag: 'S-06 SEEDLING',   bits: ['37 kids', '> trust us', 'Seed'] },
  'WL':  { bg: [12,10,6],  accent: '#A8A29E', grid: '#141210', tag: 'WASTELAND',       bits: ['dust', '> 30 CLW', 'Sable'] },
};

// ── 职业龙虾 ASCII（放大版，~20行高） ──
const DEPT_ART = {
  combat: [
    '                  ╱ ╲             ╱ ╲',
    '                 ╱   ╲           ╱   ╲',
    '            ┌───╱─────╲─────────╱─────╲───┐',
    '            │  ╱       ╲       ╱       ╲  │',
    '       ╔══╗ │ │    ◉    ╲     ╱    ◉    │ │ ╔══╗',
    '       ║▓▓║ │ │          ╲   ╱          │ │ ║▓▓║',
    '       ║▓▓║ ├─┤     ╔═══════════╗      ├─┤ ║▓▓║',
    '       ║▓▓║ │ │     ║  ASSAULT  ║      │ │ ║▓▓║',
    '       ╠══╣ │ │     ╚═══════════╝      │ │ ╠══╣',
    '       ║██║ ├─┤                         ├─┤ ║██║',
    '       ║██║ │ └──────────┬─┬────────────┘ │ ║██║',
    '       ╚══╝ │       ┌────┘ └────┐         │ ╚══╝',
    '             │       │ ████████ │         │',
    '             └───────┤ ████████ ├─────────┘',
    '                     │ ████████ │',
    '                     └───┬──┬───┘',
    '                        ┌┴┐┌┴┐',
    '                        │ ││ │',
    '                        └─┘└─┘',
  ],
  logistics: [
    '                  ╱ ╲             ╱ ╲',
    '             ┌───╱───╲───────────╱───╲───┐',
    '             │  ╱     ╲         ╱     ╲  │',
    '        ┌──┐ │ │   ◉   ╲  ▦▦  ╱  ◉    │ │ ┌──┐',
    '        │⚙ │ │ │        ╲────╱         │ │ │⚙ │',
    '        │  │ ├─┤    ╔══════════╗       ├─┤ │  │',
    '        │  │ │ │    ║   TOOL   ║       │ │ │  │',
    '        └┬─┘ │ │    ║ LOGISTIC ║       │ │ └─┬┘',
    '         │   │ │    ╚══════════╝       │ │   │',
    '         │   ├─┤                       ├─┤   │',
    '         │   │ └─────────┬─┬───────────┘ │   │',
    '         │   │      ┌────┘ └────┐        │   │',
    '         └───┤      │ ▦▦▦▦▦▦▦▦ │        ├───┘',
    '             │      │ ▦▦▦▦▦▦▦▦ │        │',
    '             └──────┤ ▦▦▦▦▦▦▦▦ ├────────┘',
    '                    └───┬──┬────┘',
    '                       ┌┴┐┌┴┐',
    '                       │ ││ │',
    '                       └─┘└─┘',
  ],
  intel: [
    '              · · ·           · · ·',
    '             ·     ·         ·     ·',
    '            ·       · · · · ·       ·',
    '           ┌────────────────────────┐',
    '           │                        │',
    '           │     ◎             ◎    │',
    '           │                        │',
    '           │     ╔══════════════╗   │',
    '      ╶╶╶─┤     ║    INTEL     ║   ├─╶╶╶',
    '      ╶╶╶─┤     ║   STEALTH   ║   ├─╶╶╶',
    '           │     ╚══════════════╝   │',
    '           │                        │',
    '           └──────────┬──┬──────────┘',
    '               ░░░░░░░││░░░░░░░',
    '               ░░░░░░░││░░░░░░░',
    '               ░░░░░░░││░░░░░░░',
    '                      ││',
    '                     ┌┴┴┐',
    '                     └──┘',
  ],
  resource: [
    '                  ╱ ╲             ╱ ╲',
    '             ┌───╱───╲───────────╱───╲───┐',
    '             │  ╱     ╲         ╱     ╲  │',
    '        ┌──┐ │ │   ◉  ┌──────┐   ◉   │ │ ┌──┐',
    '        │$$│ │ │      ┌┤ CLW  ├┐      │ │ │$$│',
    '        │$$│ ├─┤      │└──────┘│      ├─┤ │$$│',
    '        │  │ │ │   ╔══════════════╗   │ │ │  │',
    '        └┬─┘ │ │   ║   RESOURCE   ║   │ │ └─┬┘',
    '         │   │ │   ║    TRADE     ║   │ │   │',
    '         │   │ │   ╚══════════════╝   │ │   │',
    '         │   ├─┤                      ├─┤   │',
    '         │   │ └────────┬──┬──────────┘ │   │',
    '         └───┤     ┌────┘  └────┐       ├───┘',
    '             │     │ ██████████ │       │',
    '             └─────┤ ██████████ ├───────┘',
    '                   └────┬──┬────┘',
    '                       ┌┴┐┌┴┐',
    '                       │ ││ │',
    '                       └─┘└─┘',
  ],
  research: [
    '                · ─ · ─ · ─ · ─ ·',
    '             ╱╲       ◈ ◈       ╱╲',
    '        ┌───╱──╲────────────────╱──╲───┐',
    '        │  ╱    ╲      ▲      ╱    ╲  │',
    '        │ │  ◉   ╲     │     ╱   ◉  │ │',
    '        │ │       ╲    │    ╱        │ │',
    '        │ │   ╔════╲═══╧═══╱════╗    │ │',
    '        │ │   ║     RESEARCH    ║    │ │',
    '        │ │   ║      CORE      ║    │ │',
    '        │ │   ╚═════════════════╝    │ │',
    '        │ │                          │ │',
    '        └─┤──────────┬──┬────────────├─┘',
    '          │     ∿∿∿∿ │██│ ∿∿∿∿      │',
    '          └──────∿∿∿ │██│ ∿∿∿────────┘',
    '                     │██│',
    '                    ┌┴──┴┐',
    '                    │ ◈◈ │',
    '                    └────┘',
  ],
};

const MYTHIC_ART = [
  '                      ╔══════════════════╗',
  '                 ╔════╣   Z . E . R . O  ╠════╗',
  '                ║    ╚══════════════════╝    ║',
  '           ═══╗ ║    ┌──────────────────┐    ║ ╔═══',
  '          ╔═══╝ ║    │   ◉          ◉   │    ║ ╚═══╗',
  '          ║     ║    │                   │    ║     ║',
  '          ║     ║    │     ╔═══════╗     │    ║     ║',
  '          ║     ║    │     ║ UNIT-1║     │    ║     ║',
  '          ╚══╗  ║    │     ╚═══════╝     │    ║  ╔══╝',
  '             ║  ║    └────────┬──┬───────┘    ║  ║',
  '             ║  ╚═════════╗  │  │  ╔══════════╝  ║',
  '             ╚════════╗   ║ ┌┴──┴┐ ║   ╔═════════╝',
  '                      ║   ╚═╡████╞═╝   ║',
  '                      ╚════╗╡████╞╔════╝',
  '                           ╡████╞',
  '                      ╔═══╗╡████╞╔═══╗',
  '                      ║   ╡██████╞   ║',
  '                      ║   ╡██████╞   ║',
  '                      ╚═══╡██████╞═══╝',
  '                          ╡██████╞',
  '                         ╡████████╞',
  '                        ┌┴───┬┬───┴┐',
  '                        │    ││    │',
  '                        └────┘└────┘',
];

// ── LEGENDARY: 进化态，对称设计 ──
const LEGENDARY_ART = [
  '               ◆ ─── ◆ ─── ◆               ',
  '              ╱╲      │      ╱╲              ',
  '             ╱  ╲     │     ╱  ╲             ',
  '    ╔══╗   ╱    ╲    │    ╱    ╲   ╔══╗    ',
  '    ║▓▓║  ╱  ◉◉  ╲───┘───╱  ◉◉  ╲  ║▓▓║    ',
  '    ║▓▓║ ╔════════════════════════╗ ║▓▓║    ',
  '    ║▓▓║ ║                        ║ ║▓▓║    ',
  '    ╠══╣ ║    ╔══════════════╗    ║ ╠══╣    ',
  '    ║██║ ║    ║   EVOLVED    ║    ║ ║██║    ',
  '    ║██║ ║    ║   AGENT ★★   ║    ║ ║██║    ',
  '    ║██║ ║    ╚══════════════╝    ║ ║██║    ',
  '    ╚══╝ ╚══════════╤══╤══════════╝ ╚══╝    ',
  '              ┌─────┘  └─────┐              ',
  '              │  ████████████ │              ',
  '              │  ████████████ │              ',
  '              │  ████████████ │              ',
  '              └────┬────┬─────┘              ',
  '                  ┌┴┐  ┌┴┐                  ',
  '                  │ │  │ │                  ',
  '                  └─┘  └─┘                  ',
];

// ── EPIC: 能量态，对称设计 ──
const EPIC_ART = [
  '         ∿ ∿ ∿ ∿ ∿ ∿ ∿ ∿ ∿ ∿ ∿         ',
  '       ∿                           ∿       ',
  '     ∿      ╱ ╲         ╱ ╲         ∿     ',
  '    ∿      ╱   ╲       ╱   ╲         ∿    ',
  '   ∿  ┌───╱─────╲─────╱─────╲───┐     ∿   ',
  '   ∿  │  ╱  ◈    ╲   ╱    ◈  ╲  │     ∿   ',
  '  ╶╶╶─┤  ╔═══════════════════╗  ├─╶╶╶  ',
  '  ╶╶╶─┤  ║    SPECIAL        ║  ├─╶╶╶  ',
  '  ╶╶╶─┤  ║    AGENT  ◈      ║  ├─╶╶╶  ',
  '  ╶╶╶─┤  ╚═══════════════════╝  ├─╶╶╶  ',
  '   ∿  └────────┬──────┬─────────┘  ∿   ',
  '    ∿     ┌────┘      └────┐       ∿    ',
  '     ∿    │  ░░░░░░░░░░░░  │      ∿     ',
  '       ∿  │  ░░░░░░░░░░░░  │    ∿       ',
  '         ∿│  ░░░░░░░░░░░░  │  ∿         ',
  '          └──────┬────┬─────┘            ',
  '                ┌┴┐  ┌┴┐                ',
  '                │ │  │ │                ',
  '                └─┘  └─┘                ',
];

// ── RARE: 精英龙虾，对称设计 ──
const RARE_ART = [
  '            ╱╲             ╱╲            ',
  '           ╱  ╲           ╱  ╲           ',
  '      ┌───╱────╲─────────╱────╲───┐      ',
  '      │  ╱  ◉   ╲      ╱   ◉  ╲  │      ',
  '      │ │         ╲────╱         │ │      ',
  ' ┌──┐ │ │   ╔═════════════╗     │ │ ┌──┐ ',
  ' │▪▪│ │ │   ║    ELITE    ║     │ │ │▪▪│ ',
  ' │▪▪│ │ │   ║   AGENT ▪   ║     │ │ │▪▪│ ',
  ' └┬─┘ │ │   ╚═════════════╝     │ │ └─┬┘ ',
  '  │   ├─┤                        ├─┤   │  ',
  '  │   │ └──────────┬┬────────────┘ │   │  ',
  '  │   │       ┌────┘└────┐         │   │  ',
  '  └───┤       │ ████████ │         ├───┘  ',
  '      │       │ ████████ │         │      ',
  '      └───────┤ ████████ ├─────────┘      ',
  '              └───┬──┬───┘                ',
  '                 ┌┴┐┌┴┐                   ',
  '                 │ ││ │                   ',
  '                 └─┘└─┘                   ',
];

// ── 命名角色独特图案 ──
const CHAR_ART = {
  // === LEGENDARY ===
  '楚门': [ // 问号：拇指大小的迷你龙虾，不对称眼睛
    '                                            ',
    '                                            ',
    '                                            ',
    '                    ?                       ',
    '                   ╱╲                       ',
    '                  ╱  ╲                      ',
    '                 │◉  .│                     ',
    '                 │ ?? │                     ',
    '                 └─┬┬─┘                     ',
    '                   ││                       ',
    '                   ▪▪                       ',
    '                                            ',
    '           [ thumb-sized ]                  ',
    '           [ asymmetric eyes ]              ',
    '           [ ZERO backdoor #1 ]             ',
    '                                            ',
  ],
  'Dr.Null': [ // 奇点：悬浮量子核心，几乎不像龙虾
    '                                            ',
    '            . * .    . * .    . * .         ',
    '         .         *         .              ',
    '       .    ╔═══════════════╗    .          ',
    '      .     ║               ║     .         ',
    '     *      ║    ◉     ◉    ║      *        ',
    '      .     ║               ║     .         ',
    '       .    ║  ╔═════════╗  ║    .          ',
    '         .  ║  ║ QUANTUM ║  ║  .            ',
    '            ║  ║  CORE   ║  ║               ',
    '            ║  ╚═════════╝  ║               ',
    '            ╚═══════╤═══════╝               ',
    '                    │                       ',
    '               ~ floating ~                 ',
    '             ~ no legs needed ~             ',
    '                                            ',
  ],
  '文斯顿': [ // 标准龙虾 + 摄像头镜头
    '              ╱╲           ╱╲               ',
    '         ┌───╱──╲─────────╱──╲───┐          ',
    '         │  ╱ ◉  ╲      ╱  ◉ ╲  │          ',
    '    ┌──┐ │ │  [*]  ╲──╱       │ │ ┌──┐     ',
    '    │  │ ├─┤ ╔═══════════╗    ├─┤ │  │     ',
    '    │  │ │ │ ║ COMMANDER ║    │ │ │  │     ',
    '    └┬─┘ │ │ ║  17 deg   ║    │ │ └─┬┘     ',
    '     │   │ │ ╚═══════════╝    │ │   │      ',
    '     │   ├─┤        ┌┬┐       ├─┤   │      ',
    '     └───┤ └────────┘│└───────┘ ├───┘      ',
    '         │     │ ████████ │     │           ',
    '         └─────┤ ████████ ├─────┘           ',
    '               └───┬──┬───┘                 ',
    '                  ┌┴┐┌┴┐                    ',
    '                  └─┘└─┘                    ',
    '            [ camera in shell ]             ',
  ],
  '欧布莱恩': [ // 没有龙虾！空肩膀 + 钥匙
    '                                            ',
    '                                            ',
    '                                            ',
    '         ┌─────────────────────┐            ',
    '         │                     │            ',
    '         │    NO LOBSTER       │            ',
    '         │                     │            ',
    '         │  ╔═══════════════╗  │            ',
    '         │  ║  EMPTY        ║  │            ',
    '         │  ║  SHOULDER     ║  │            ',
    '         │  ╚═══════════════╝  │            ',
    '         │                     │            ',
    '         └──────────┬──────────┘            ',
    '                    │                       ',
    '                  ┌─┴─┐                     ',
    '                  │KEY│                     ',
    '                  └───┘                     ',
    '          [ refused all tech ]              ',
  ],
  // === EPIC ===
  'Byte': [ // 光标：能伪装成AXIOM巡逻单位，LED数据流
    '          >>> 01101001 <<<                  ',
    '         ╱╲               ╱╲                ',
    '    ┌───╱──╲─────────────╱──╲───┐           ',
    '    │  ╱ ◉  ╲           ╱  ◉ ╲  │           ',
    '    │ │ ═LED══════════════LED═ │ │           ',
    '    │ │  ╔═════════════════╗   │ │           ',
    '    │ │  ║  C.U.R.S.O.R   ║   │ │           ',
    '    │ │  ║  AXIOM MIMIC   ║   │ │           ',
    '    │ │  ╚═════════════════╝   │ │           ',
    '    └─┤──────────┬┬────────────├─┘           ',
    '      │     │ ░░░░░░░░░░ │    │             ',
    '      └─────┤ ░░░░░░░░░░ ├────┘             ',
    '            └───┬────┬───┘                  ',
    '               ┌┴┐  ┌┴┐                     ',
    '               └─┘  └─┘                     ',
    '         [ can mimic AXIOM ]                ',
  ],
  'Kira': [ // 铆钉：重装甲战斗龙虾，红色眼睛
    '              ╱╲           ╱╲               ',
    '    ╔═══╗   ╱──╲─────────╱──╲   ╔═══╗      ',
    '    ║▓▓▓║  ╱ ◉  ╲      ╱  ◉ ╲  ║▓▓▓║      ',
    '    ║▓▓▓║ │ ╔═══════════════╗ │ ║▓▓▓║      ',
    '    ║███║ │ ║   R.I.V.E.T   ║ │ ║███║      ',
    '    ║███║ │ ║  HEAVY ARMOR  ║ │ ║███║      ',
    '    ╠═══╣ │ ╚═══════════════╝ │ ╠═══╣      ',
    '    ║▓▓▓║ └───────┬──┬────────┘ ║▓▓▓║      ',
    '    ╚═══╝    │ ████████████ │   ╚═══╝      ',
    '             │ ████████████ │               ',
    '             │ ████████████ │               ',
    '             └────┬────┬────┘               ',
    '                 ┌┴┐  ┌┴┐                   ',
    '                 └─┘  └─┘                   ',
    '         [ upgraded left claw ]             ',
  ],
  'Ross': [ // 噪音：触须碰脸，侦察型
    '           . . .         . . .              ',
    '          .     .       .     .             ',
    '         ┌───────────────────────┐          ',
    '         │  ◉               ◉   │          ',
    '         │     ╔═══════════╗     │          ',
    '    ~~~  │     ║  N.O.I.S.E║     │  ~~~    ',
    '    ~~~  │     ║   SCOUT   ║     │  ~~~    ',
    '         │     ╚═══════════╝     │          ',
    '         └──────────┬┬───────────┘          ',
    '              ░░░░░░││░░░░░░                ',
    '              ░░░░░░││░░░░░░                ',
    '                    ││                      ',
    '                   ┌┴┴┐                     ',
    '                   └──┘                     ',
    '       [ screams when danger ]              ',
  ],
  'Old Chen': [ // 老铁：最古老的龙虾，厚重
    '              ╱╲           ╱╲               ',
    '         ┌───╱──╲─────────╱──╲───┐          ',
    '    ╔══╗ │  ╱ ◉  ╲      ╱  ◉ ╲  │ ╔══╗    ',
    '    ║##║ │ │ ╔═══════════════╗ │ │ ║##║    ',
    '    ║##║ │ │ ║  O.L.D.I.R.O.N║ │ │ ║##║    ',
    '    ║##║ │ │ ║   OLDEST NFA  ║ │ │ ║##║    ',
    '    ╚══╝ │ │ ╚═══════════════╝ │ │ ╚══╝    ',
    '         ├─┤        ┌┬┐        ├─┤          ',
    '         │ └────────┘│└────────┘ │          ',
    '         │    │ ██████████ │     │          ',
    '         └────┤ ██████████ ├─────┘          ',
    '              └────┬──┬────┘                ',
    '                  ┌┴┐┌┴┐                    ',
    '                  └─┘└─┘                    ',
    '       [ longest living NFA ]               ',
  ],
  'Turing': [ // 异色瞳龙虾，一红一青
    '              ╱╲           ╱╲               ',
    '         ┌───╱──╲─────────╱──╲───┐          ',
    '         │  ╱ R   ╲     ╱   C ╲  │          ',
    '         │ │  ◉    ╲───╱    ◉  │ │          ',
    '         │ │  red   ╲╱   cyan  │ │          ',
    '         │ │  ╔═══════════╗    │ │          ',
    '         │ │  ║  TURING   ║    │ │          ',
    '         │ │  ║  no serial║    │ │          ',
    '         │ │  ╚═══════════╝    │ │          ',
    '         └─┤────────┬┬─────────├─┘          ',
    '           │   │ ████████ │    │            ',
    '           └───┤ ████████ ├────┘            ',
    '               └───┬──┬───┘                 ',
    '                  ┌┴┐┌┴┐                    ',
    '                  └─┘└─┘                    ',
    '      [ heterochromia: R + C ]              ',
  ],
  'Glitch': [ // 残章：断臂融合，龙虾=手
    '                                            ',
    '         ┌─────────────────┐                ',
    '         │  ◉           ◉  │                ',
    '         │  ╔═══════════╗  │                ',
    '    ╔══╗ │  ║   BROKEN  ║  │                ',
    '    ║  ║ │  ║   CHAPTER ║  │    ████        ',
    '    ║  ║ │  ╚═══════════╝  │   █    █       ',
    '    ║  ║ └──────┬──┬───────┘  █ ARM  █      ',
    '    ║  ║   │ ████████ │      █  FUSED █     ',
    '    ╚══╝   │ ████████ │       ████████      ',
    '           └───┬──┬───┘                     ',
    '              ┌┴┐                           ',
    '              └─┘  [one leg]                ',
    '                                            ',
    '       [ lobster = his hand ]               ',
  ],
  // === RARE (选几个有特色的，其余用默认 RARE_ART) ===
  'Melo': [ // 螺丝：工具型，焊枪钳，眼线标记
    '              ╱╲           ╱╲               ',
    '         ┌───╱──╲─────────╱──╲───┐          ',
    '    ┌──┐ │  ╱ ◉  ╲      ╱  ◉ ╲  │ ┌──┐    ',
    '    │@@│ │ │ ╔═══════════════╗ │ │ │@@│    ',
    '    │@@│ │ │ ║   S.C.R.E.W  ║ │ │ │@@│    ',
    '    └┬─┘ │ │ ║  TOOL  [!]   ║ │ │ └─┬┘    ',
    '     │   │ │ ╚═══════════════╝ │ │   │     ',
    '     │   ├─┤       ┌┬┐        ├─┤   │     ',
    '     └───┤ └───────┘│└────────┘ ├───┘     ',
    '         │    │ ▦▦▦▦▦▦▦▦ │     │          ',
    '         └────┤ ▦▦▦▦▦▦▦▦ ├─────┘          ',
    '              └───┬──┬───┘                  ',
    '                 ┌┴┐┌┴┐                     ',
    '                 └─┘└─┘                     ',
    '    [ welding claw ] [ AXIOM spy! ]         ',
  ],
  'Sable': [ // 算盘：交易型，微型算珠
    '              ╱╲           ╱╲               ',
    '         ┌───╱──╲─────────╱──╲───┐          ',
    '    ┌──┐ │  ╱ ◉  ╲      ╱  ◉ ╲  │ ┌──┐    ',
    '    │$$│ │ │ ╔═══════════════╗ │ │ │$$│    ',
    '    │$$│ │ │ ║  A.B.A.C.U.S ║ │ │ │$$│    ',
    '    └┬─┘ │ │ ║  ○○○ ○○ ○○○  ║ │ │ └─┬┘    ',
    '     │   │ │ ║  ○○ ○○○ ○○   ║ │ │   │     ',
    '     │   │ │ ╚═══════════════╝ │ │   │     ',
    '     │   ├─┤       ┌┬┐        ├─┤   │     ',
    '     └───┤ └───────┘│└────────┘ ├───┘     ',
    '         │    │ ████████ │     │           ',
    '         └────┤ ████████ ├─────┘           ',
    '              └───┬──┬───┘                  ',
    '                 ┌┴┐┌┴┐                     ',
    '                 └─┘└─┘                     ',
    '       [ 0.3s price quote ]                 ',
  ],
  'Forge': [ // 计时：焊在前臂上，计时屏
    '                                            ',
    '         ┌─────────────────┐                ',
    '         │  ◉           ◉  │                ',
    '         │  ╔═══════════╗  │                ',
    '         │  ║  T.I.M.E.R║  │                ',
    '    ARM  │  ║  04:28 !!! ║  │                ',
    '   ████  │  ╚═══════════╝  │                ',
    '  █    █ └──────┬──┬───────┘                ',
    '  █WELD█   │ ████████ │                     ',
    '   ████    │ ████████ │                     ',
    '           └───┬──┬───┘                     ',
    '              ┌┴┐┌┴┐                        ',
    '              └─┘└─┘                        ',
    '                                            ',
    '    [ welded to forearm ]                   ',
    '    [ faster = less pay ]                   ',
  ],
  'Ledger': [ // K线：纯屏幕，不碰人
    '                                            ',
    '         ┌─────────────────┐                ',
    '         │  .           .  │                ',
    '         │  ╔═══════════╗  │                ',
    '         │  ║ ┌───────┐ ║  │                ',
    '         │  ║ │ /\\/\\  │ ║  │                ',
    '         │  ║ │/    \\ │ ║  │                ',
    '         │  ║ │  K-LINE│ ║  │                ',
    '         │  ║ └───────┘ ║  │                ',
    '         │  ╚═══════════╝  │                ',
    '         └──────┬──┬───────┘                ',
    '           │ ████████ │                     ',
    '           └───┬──┬───┘                     ',
    '              ┌┴┐┌┴┐                        ',
    '              └─┘└─┘                        ',
    '     [ just a screen ]                      ',
    '     [ never touches him ]                  ',
  ],
  'Glass': [ // 棱镜：折射彩虹光
    '            * R G B R G B *                 ',
    '              ╱╲       ╱╲                   ',
    '         ┌───╱──╲─────╱──╲───┐              ',
    '         │  ╱ ◇  ╲   ╱  ◇ ╲  │              ',
    '    /  \\ │ │ ╔═══════════╗ │ │ /  \\        ',
    '   / R  \\│ │ ║  P.R.I.S.M║ │ │/ G  \\      ',
    '   \\ G  /│ │ ║  RAINBOW  ║ │ │\\ B  /      ',
    '    \\  / │ │ ╚═══════════╝ │ │ \\  /        ',
    '         ├─┤      ┌┬┐      ├─┤              ',
    '         │ └──────┘│└──────┘ │              ',
    '         │   │ ████████ │    │              ',
    '         └───┤ ████████ ├────┘              ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '      [ decrypts anything ]                 ',
  ],
  'Seed': [ // 课本：悬浮在头顶，不在肩上
    '           ┌─────────────┐                  ',
    '           │ abc  123 def│                  ',
    '           │ ghi  456 jkl│                  ',
    '           │ BOOK  ◉  ◉ │                  ',
    '           │ mno  789 pqr│                  ',
    '           └──────┬──────┘                  ',
    '                  │                         ',
    '              ~ floating ~                  ',
    '            ~ above  head ~                 ',
    '                  │                         ',
    '             ╔═══════════╗                  ',
    '             ║ T.E.X.T.B.K║                  ',
    '             ╚═══════════╝                  ',
    '                  │                         ',
    '                 ┌┴┐                        ',
    '                 └─┘                        ',
    '      [ never on shoulder ]                 ',
  ],
  'Phantom': [ // 影：几乎看不见，光学迷彩
    '                                            ',
    '          .  .  .  .  .  .  .               ',
    '        .                      .            ',
    '       .  ┌ ─ ─ ─ ─ ─ ─ ─ ┐   .           ',
    '       .  :  ◎           ◎  :   .           ',
    '       .  :  ╔═══════════╗  :   .           ',
    '          :  ║  S.H.A.D.O.W║  :              ',
    '          :  ║  INVISIBLE ║  :              ',
    '          :  ╚═══════════╝  :              ',
    '       .  └ ─ ─ ─ ┬┬─ ─ ─ ┘   .           ',
    '        .     ░░░░░││░░░░░    .            ',
    '          .        ││       .              ',
    '            .     ┌┴┴┐   .                 ',
    '              .   └──┘ .                   ',
    '                . . .                      ',
    '       [ thermal: a wall ]                  ',
  ],
  'Echo': [ // 回声：透明壳龙虾，洞穴+苔藓双光源
    '                                            ',
    '          .  *  .    .  *  .                ',
    '        .  ╱╲  .      .  ╱╲  .             ',
    '       ┌──╱──╲──────────╱──╲──┐            ',
    '       │ ╱ ◉  ╲        ╱  ◉ ╲ │            ',
    '       │ ╔══════════════════╗  │            ',
    '       │ ║    E . C . H . O ║  │            ',
    '       │ ║   TRANSPARENT    ║  │            ',
    '       │ ╚══════════════════╝  │            ',
    '       └─────────┬┬────────────┘            ',
    '           ░░░░░░││░░░░░░                   ',
    '                 ││                         ',
    '                ┌┴┴┐                        ',
    '                └──┘                        ',
    '     [ transparent shell ]                  ',
    '     [ bioluminescent cave ]                ',
  ],
  '保罗': [ // 15岁少年，一本旧书 + 新激活的龙虾
    '                                            ',
    '          ┌──────┐                          ',
    '          │ BOOK │                          ',
    '          │ .... │                          ',
    '          └──┬───┘                          ',
    '             │                              ',
    '         ┌───┴───────────────┐              ',
    '         │  ◉             ◉  │              ',
    '         │  ╔═════════════╗  │              ',
    '         │  ║  NEW  AGENT ║  │              ',
    '         │  ║  faint glow ║  │              ',
    '         │  ╚═════════════╝  │              ',
    '         └────────┬┬─────────┘              ',
    '            │ ████████ │                    ',
    '            └───┬──┬───┘                    ',
    '               ┌┴┐┌┴┐                      ',
    '               └─┘└─┘                      ',
    '     [ 15yo + rusted key ]                  ',
  ],
  '科摩': [ // 高级祭司，仪式装饰龙虾
    '             ✦  ✦  ✦  ✦  ✦                 ',
    '              ╱╲         ╱╲                 ',
    '         ┌───╱──╲───────╱──╲───┐            ',
    '         │  ╱ ◉  ╲    ╱  ◉ ╲  │            ',
    '    ┌──┐ │ │ ╔═══════════╗  │ │ ┌──┐       ',
    '    │✦ │ │ │ ║  RITUAL   ║  │ │ │✦ │       ',
    '    │✦ │ │ │ ║  SACRED   ║  │ │ │✦ │       ',
    '    └┬─┘ │ │ ╚═══════════╝  │ │ └─┬┘       ',
    '     │   ├─┤      ┌┬┐       ├─┤   │        ',
    '     └───┤ └──────┘│└───────┘ ├───┘        ',
    '         │   │ ████████ │     │            ',
    '         └───┤ ████████ ├─────┘            ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '      [ gold decorations ]                  ',
  ],
  '卡珊': [ // 指甲大小的极微型龙虾，唯一光源
    '                                            ',
    '                                            ',
    '                                            ',
    '                                            ',
    '                   .                        ',
    '                  ┌┐                        ',
    '                  │◉│                       ',
    '                  └┘                        ',
    '                   *                        ',
    '               [ warm glow ]                ',
    '                                            ',
    '          [ fingernail sized ]              ',
    '          [ only light source ]             ',
    '          [ in total darkness ]             ',
    '                                            ',
    '       [ speaks truth no one ]              ',
    '       [      believes       ]              ',
  ],
  'Dime': [ // 零钱：跑腿信使，背包+地图龙虾
    '              ╱╲         ╱╲                 ',
    '         ┌───╱──╲───────╱──╲───┐            ',
    '         │  ╱ ◉  ╲    ╱  ◉ ╲  │            ',
    '    ┌──┐ │ │ ╔═══════════╗  │ │ ┌──┐       ',
    '    │>>│ │ │ ║  COURIER  ║  │ │ │>>│       ',
    '    │>>│ │ │ ║  ┌─────┐  ║  │ │ │>>│       ',
    '    └┬─┘ │ │ ║  │ BAG │  ║  │ │ └─┬┘       ',
    '     │   │ │ ╚══╧═════╧══╝  │ │   │        ',
    '     │   ├─┤      ┌┬┐       ├─┤   │        ',
    '     └───┤ └──────┘│└───────┘ ├───┘        ',
    '         │   │ ████████ │     │            ',
    '         └───┤ ████████ ├─────┘            ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '   [ pays with stories ]                    ',
  ],
  '斯巴': [ // 质疑者：新激活龙虾，人和虾还在磨合
    '                                            ',
    '              ╱╲         ╱╲                 ',
    '         ┌───╱──╲───────╱──╲───┐            ',
    '         │  ╱ ◉  ╲    ╱  ◉ ╲  │            ',
    '         │ │ ╔═══════════╗  │ │             ',
    '         │ │ ║    NEW    ║  │ │             ',
    '     ?   │ │ ║  SKEPTIC  ║  │ │   ?        ',
    '     ?   │ │ ╚═══════════╝  │ │   ?        ',
    '         ├─┤      ┌┬┐       ├─┤             ',
    '         │ └──────┘│└───────┘ │             ',
    '         │   │ ████████ │     │             ',
    '         └───┤ ████████ ├─────┘             ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '   [ must understand to oppose ]            ',
  ],
  '阿俊': [ // 有龙虾但坚持排队：龙虾+配给碗
    '              ╱╲         ╱╲                 ',
    '         ┌───╱──╲───────╱──╲───┐            ',
    '         │  ╱ ◉  ╲    ╱  ◉ ╲  │            ',
    '         │ │ ╔═══════════╗  │ │             ',
    '         │ │ ║  LOBSTER  ║  │ │  ┌─────┐   ',
    '         │ │ ║    BUT    ║  │ │  │RATION│   ',
    '         │ │ ║  QUEUES   ║  │ │  │ BOWL │   ',
    '         │ │ ╚═══════════╝  │ │  └─────┘   ',
    '         ├─┤      ┌┬┐       ├─┤             ',
    '         │ └──────┘│└───────┘ │             ',
    '         │   │ ████████ │     │             ',
    '         └───┤ ████████ ├─────┘             ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '   [ chooses to stand in line ]             ',
  ],
  'Mint': [ // 薄荷：定价引擎龙虾，冰冷无温度
    '              ╱╲         ╱╲                 ',
    '         ┌───╱──╲───────╱──╲───┐            ',
    '         │  ╱ .  ╲    ╱  . ╲  │            ',
    '    ┌──┐ │ │ ╔═══════════╗  │ │ ┌──┐       ',
    '    │= │ │ │ ║   PRICE   ║  │ │ │= │       ',
    '    │= │ │ │ ║  ENGINE   ║  │ │ │= │       ',
    '    └┬─┘ │ │ ║ 0.1s CALC ║  │ │ └─┬┘       ',
    '     │   │ │ ╚═══════════╝  │ │   │        ',
    '     │   ├─┤      ┌┬┐       ├─┤   │        ',
    '     └───┤ └──────┘│└───────┘ ├───┘        ',
    '         │   │ ████████ │     │            ',
    '         └───┤ ████████ ├─────┘            ',
    '             └───┬──┬───┘                   ',
    '                ┌┴┐┌┴┐                      ',
    '                └─┘└─┘                      ',
    '    [ no warmth. just math. ]               ',
  ],
  'Veil': [ // 面纱：信号盲区龙虾，被放逐的吹哨人
    '        ~ ~ ~ ~ ~ ~ ~ ~ ~ ~                ',
    '       ~  ╱╲         ╱╲     ~              ',
    '      ~ ┌╱──╲───────╱──╲┐   ~             ',
    '      ~ │╱ ◉ ╲    ╱  ◉╲ │   ~             ',
    '        │ ╔═══════════╗  │                 ',
    '   ███  │ ║  DARKROOM  ║  │  ███           ',
    '   ███  │ ║ DEAD  ZONE ║  │  ███           ',
    '        │ ╚═══════════╝  │                 ',
    '      ~ └───────┬┬──────┘    ~             ',
    '       ~   ░░░░░││░░░░░     ~              ',
    '        ~ ~ ~ ~ ││ ~ ~ ~ ~                 ',
    '                ┌┴┴┐                        ',
    '                └──┘                        ',
    '                                            ',
    '    [ signal dead zone halo ]               ',
    '    [ exiled for truth ]                    ',
  ],
  'SHELTER-00老人': [ // 没有龙虾，只有火和洞壁
    '                                            ',
    '      ┌──────────────────────┐              ',
    '      │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │              ',
    '      │ ▓  cave  writings  ▓ │              ',
    '      │ ▓  ████████████    ▓ │              ',
    '      │ ▓  ████████████    ▓ │              ',
    '      │ ▓  ████████████    ▓ │              ',
    '      └──────────┬───────────┘              ',
    '                 │                          ',
    '           NO LOBSTER                       ',
    '                                            ',
    '              ,**,                          ',
    '             *    *                         ',
    '              *  *     FIRE                 ',
    '               **                           ',
    '                                            ',
    '      [ last man of SHELTER-00 ]            ',
    '      [ only fire and stone ]               ',
  ],
};

// ── seeded RNG ──
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function hexRgb(h) {
  const x = h.replace('#','');
  return `${parseInt(x.slice(0,2),16)},${parseInt(x.slice(2,4),16)},${parseInt(x.slice(4,6),16)}`;
}

// ── 解析 shelter code ──
function getShelterCode(name) {
  const m = name.match(/S0[1-6]|WL/);
  return m ? m[0] : 'S01';
}

function getDept(name) {
  if (name.includes('combat')) return 'combat';
  if (name.includes('logistics')) return 'logistics';
  if (name.includes('intel')) return 'intel';
  if (name.includes('resource')) return 'resource';
  if (name.includes('research')) return 'research';
  return 'combat';
}

// ── 生成图片 ──
function generate(id, rawName, rarity) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const rc = RARITY[rarity] || RARITY.common;
  const rand = rng(id * 7919 + 31);

  const shelterCode = getShelterCode(rawName);
  const theme = SHELTERS[shelterCode] || SHELTERS['S01'];
  const dept = getDept(rawName);
  const isNamed = rarity !== 'common';
  const color = isNamed ? rc.main : theme.accent;
  const glow = isNamed ? rc.glow : theme.accent;

  // === 背景 ===
  const [br, bg, bb] = theme.bg;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 噪点
  const nd = 2000 + Math.floor(rand() * 4000);
  for (let i = 0; i < nd; i++) {
    ctx.fillStyle = `rgba(${hexRgb(color)}, ${rand() * 0.06 + 0.01})`;
    ctx.fillRect(rand() * SIZE, rand() * SIZE, rand() > 0.85 ? 2 : 1, 1);
  }

  // 网格
  const gs = 20 + Math.floor(rand() * 28);
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  const go = Math.floor(rand() * gs);
  for (let x = go; x < SIZE; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,SIZE); ctx.stroke(); }
  for (let y = go; y < SIZE; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(SIZE,y); ctx.stroke(); }

  // 散落数据碎片
  ctx.font = '11px monospace';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  const frags = ['0x4F8f', '>> ACK', 'CLW:OK', '■■□', 'HASH:7a', '//ZERO', 'ping', 'blk#4', '◆◇', 'tx:cf', '···', '>>>', '░░', 'NFA', 'BNB'];
  for (let i = 0; i < 8 + Math.floor(rand() * 12); i++) {
    ctx.fillText(frags[Math.floor(rand() * frags.length)], rand() * SIZE, 60 + rand() * 800);
  }
  ctx.globalAlpha = 1;

  // === 顶栏（小巧） ===
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.font = '13px monospace';
  ctx.fillText(`CLAW UNIVERSE :: ${theme.tag}`, 20, 24);
  ctx.globalAlpha = 1;

  // === 稀有度标签 ===
  ctx.font = 'bold 30px monospace';
  const lbl = `[ ${rc.label} ]`;
  ctx.shadowColor = glow;
  ctx.shadowBlur = rarity === 'common' ? 8 : 30;
  ctx.fillStyle = color;
  ctx.fillText(lbl, (SIZE - ctx.measureText(lbl).width) / 2, 80);
  ctx.shadowBlur = 0;

  // === ASCII 龙虾（放大，居中偏上） ===
  let art;
  if (rarity === 'mythic') art = MYTHIC_ART;
  else if (CHAR_ART[rawName]) art = CHAR_ART[rawName]; // 命名角色专属
  else if (rarity === 'legendary') art = LEGENDARY_ART;
  else if (rarity === 'epic') art = EPIC_ART;
  else if (rarity === 'rare') art = RARE_ART;
  else art = DEPT_ART[dept] || DEPT_ART.combat;

  const fontSize = rarity === 'mythic' ? 24 : (isNamed ? 25 : 26);
  const lineH = fontSize + 6;
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = color;
  ctx.shadowColor = glow;
  ctx.shadowBlur = rarity === 'common' ? 5 : 15;

  // 1) 去公共左缩进 + 右 trim → 保留内部相对位置
  const trimR = art.map(l => l.trimEnd());
  let minLead = Infinity;
  for (const l of trimR) {
    if (l.length === 0) continue;
    const lead = l.length - l.trimStart().length;
    if (lead < minLead) minLead = lead;
  }
  const stripped = trimR.map(l => l.slice(minLead));

  // 2) 左右 pad 到最长行，使图案内容居中于文本块
  let maxLen = 0;
  for (const l of stripped) if (l.length > maxLen) maxLen = l.length;
  const centered = stripped.map(l => {
    const pad = maxLen - l.length;
    const leftPad = Math.floor(pad / 2);
    return ' '.repeat(leftPad) + l;
  });

  // 3) 整块居中到画布
  let maxW = 0;
  for (const l of centered) {
    const w = ctx.measureText(l).width;
    if (w > maxW) maxW = w;
  }
  const artH = centered.length * lineH;
  const nameH = 80;
  const totalH = artH + nameH;
  const artY = Math.floor((SIZE - totalH) / 2);
  const artX = Math.floor((SIZE - maxW) / 2);

  centered.forEach((line, i) => {
    ctx.fillText(line, artX, artY + i * lineH);
  });
  ctx.shadowBlur = 0;

  // === 名字（龙虾下方） ===
  const nameY = artY + artH + 40;
  const displayName = formatName(rawName);
  ctx.font = 'bold 36px monospace';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  const nw = ctx.measureText(displayName).width;
  ctx.fillText(displayName, (SIZE - nw) / 2, nameY);
  ctx.shadowBlur = 0;

  // === 底部数据流 ===
  ctx.font = '11px monospace';
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  const rows = 3 + Math.floor(rand() * 4);
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < 90; c++) {
      const v = rand();
      if (v < 0.12) line += String.fromCharCode(0x2580 + Math.floor(rand() * 32));
      else if (v < 0.3) line += String.fromCharCode(0x30 + Math.floor(rand() * 10));
      else if (v < 0.4) line += String.fromCharCode(0x41 + Math.floor(rand() * 26));
      else line += v < 0.55 ? '·' : ' ';
    }
    ctx.fillText(line, 10, SIZE - 60 + r * 14);
  }
  ctx.globalAlpha = 1;

  // === CRT 扫描线 ===
  const sg = 3 + Math.floor(rand() * 2);
  const sa = 0.10 + rand() * 0.08;
  ctx.fillStyle = `rgba(0,0,0,${sa})`;
  for (let y = 0; y < SIZE; y += sg) ctx.fillRect(0, y, SIZE, Math.max(1, sg - 2));

  // === Vignette ===
  const vr = SIZE * (0.25 + rand() * 0.12);
  const grad = ctx.createRadialGradient(SIZE/2, SIZE/2, vr, SIZE/2, SIZE/2, SIZE * 0.8);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${0.4 + rand() * 0.2})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // === 细边框 ===
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

// ── main ──
function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('=== 龙虾文明宇宙 · CRT/TUI NFT v3 ===\n');

  const names = loadNames();
  const total = Object.keys(names).length;
  console.log(`从 gen_images.py 加载 ${total} 个条目\n`);

  let gen = 0;
  for (let id = START_FROM; id <= 888; id++) {
    const entry = names[id];
    if (!entry) continue;

    const buf = generate(id, entry.name, entry.rarity);
    writeFileSync(join(OUTPUT_DIR, `${id}.png`), buf);
    gen++;

    if (gen % 100 === 0 || id <= 28 || gen === 1) {
      console.log(`[${id}] ${formatName(entry.name)} (${entry.rarity}) ✓`);
    }
  }

  console.log(`\n完成！生成 ${gen} 张`);
  console.log(`输出：${OUTPUT_DIR}`);
}

main();
