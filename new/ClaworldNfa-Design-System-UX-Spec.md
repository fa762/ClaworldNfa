# ClaworldNfa · Design System & UX Specification

**Version**: 1.0
**Date**: 2026-04-18
**Audience**: AI agents (Claude, Cursor, v0, Lovable, etc.) executing the build. Human designers/devs reading this as brief.
**Status**: Authoritative — deviations require product owner approval.

---

## HOW TO USE THIS DOCUMENT (for AI agents)

When executing any design or code task for ClaworldNfa:

1. **Follow the tokens in Section 3 exactly.** Do not introduce new colors, fonts, or spacing values not defined here.
2. **When a component matches a spec in Section 6, use that spec verbatim.** Do not improvise dimensions or behaviors.
3. **When encountering an undefined situation**, consult the principles in Section 2 — they are prioritized. When principles conflict, the higher-numbered principle loses.
4. **Reference images/patterns in Section 10** before generating anything creative. Describe to yourself what you're borrowing before writing code.
5. **The forbidden list in Section 11 is absolute.** Violating it is a bug, not a style choice.

---

## TABLE OF CONTENTS

1. [Product Context](#1-product-context)
2. [Design Principles (Priority-Ordered)](#2-design-principles-priority-ordered)
3. [Design Tokens](#3-design-tokens)
4. [Typography System](#4-typography-system)
5. [Layout System](#5-layout-system)
6. [Component Specifications](#6-component-specifications)
7. [Motion & Interaction](#7-motion--interaction)
8. [The Five Ritual Moments](#8-the-five-ritual-moments)
9. [Copy & Voice Guidelines](#9-copy--voice-guidelines)
10. [Visual References (Mood Board)](#10-visual-references-mood-board)
11. [Forbidden List](#11-forbidden-list)
12. [Accessibility Baseline](#12-accessibility-baseline)

---

## 1. PRODUCT CONTEXT

### 1.1 What ClaworldNfa actually is

A conversational dApp on BNB Chain where users command a fleet of AI agents (NFAs) through natural language. Each NFA has on-chain identity, its own ledger account, structured long-term memory (CML), and bounded autonomous execution. The product frame is **"AI-era Web3 game-fi"** but the experiential frame is **"commanding a cyberpunk-militia of AI retainers."**

### 1.2 Target user (explicit)

Crypto-native otaku-adjacent men, 22–38. They:
- Read CT multiple times daily
- Recognize NieR/EVA/Ghost-in-the-Shell/cyberpunk visual vocabulary instantly
- Reject GameFi aesthetics (coin icons, bright greens/reds, cartoon mascots)
- Respect technical information density but will not read it twice
- Spend long solo hours at terminals
- Want an AI companion that feels **capable and slightly dangerous**, not cute

### 1.3 The two emotional peaks

Every design decision must serve one or both of these peaks:

**Peak A — "It remembered me."**
The moment an NFA references a past event from CML memory in natural conversation.

**Peak B — "It acted for me."**
The moment a user returns after being offline and sees autonomous action receipts populated in the conversation stream.

If a design decision doesn't serve A or B, it's dead weight. Cut it.

### 1.4 The relationship model

User ↔ NFA is a **symbiotic pact** — not pet/owner, not commander/soldier. The NFA grows from the user's behavior (via CML), and the user expands their reach through the NFA (via autonomy). UI copy and affordances must reflect this equality.

---

## 2. DESIGN PRINCIPLES (PRIORITY-ORDERED)

When principles conflict, the lower number wins.

### P1 · Silence over spectacle
The default state of every screen is quiet. Add nothing for decoration. Most pixels should be dark, empty, or set at rest. Spectacle is reserved for the five ritual moments (Section 8).

### P2 · Terminal, not toy
Everything that can be typeset in a monospace font and look correct, should be. Numbers, addresses, IDs, timestamps, chain data, budget figures — all monospace. This is the most powerful single decision to separate you from GameFi.

### P3 · Information density with hierarchy
Dense but structured. NieR packs huge amounts of data per screen but users never feel overwhelmed because hierarchy is crisp. Emulate this. Never hide information that matters; never display information that doesn't.

### P4 · Amber is a voice, not a paint
`#F5A524` should feel like the NFA speaking. It appears on active states, reasoning proof links, autonomous action markers, ritual moments. Never on secondary buttons, never as a background fill for large areas.

### P5 · The NFA is the protagonist
The visual center of every screen is the current NFA or the conversation with it. UI chrome (sidebars, drawers, buttons) is servants.

### P6 · Motion earns its place
Every transition must have a reason (state change, new data, user action). No decorative animation. When motion appears, it must feel deliberate and costly — like the UI is doing work.

### P7 · Respect user intelligence
No "did you know?" tooltips. No onboarding wizards. No explanatory modals. The target user has seen your features before; they want to get in and work. Explanations, if required, go in a ?-icon popover, never as intrusive teaching UI.

### P8 · Mobile is a companion form
Desktop is the war room. Mobile is the lookout post. Don't cram war-room density into a 375px viewport — instead, design mobile as a deliberate subset: glance at NFAs, quick dialogue, view receipts.

---

## 3. DESIGN TOKENS

### 3.1 Color palette

```
/* Base surfaces */
--clw-bg:          #0a0807;   /* app root background */
--clw-surface-1:   #0d0a08;   /* sidebar, drawer panels */
--clw-surface-2:   #14100d;   /* cards, composer input */
--clw-surface-3:   #1a1512;   /* elevated cards, tooltips */

/* Amber — the NFA voice */
--clw-amber:       #F5A524;   /* primary accent, active states */
--clw-amber-hi:    #FBBF4D;   /* hover state on amber elements */
--clw-amber-lo:    #A9721A;   /* pressed state */
--clw-amber-10:    rgba(245,165,36,0.10);  /* subtle bg tint */
--clw-amber-20:    rgba(245,165,36,0.20);  /* borders on important cards */
--clw-amber-40:    rgba(245,165,36,0.40);  /* medium-emphasis borders */
--clw-amber-60:    rgba(245,165,36,0.60);  /* disabled amber elements */

/* Foreground */
--clw-fg:          #FEF3C7;   /* primary text (slightly warm amber-white) */
--clw-fg-85:       rgba(254,243,199,0.85);  /* secondary text */
--clw-fg-60:       rgba(254,243,199,0.60);  /* tertiary text */
--clw-fg-40:       rgba(254,243,199,0.40);  /* labels, metadata */
--clw-fg-25:       rgba(254,243,199,0.25);  /* disabled text */

/* Semantic */
--clw-success:     #4ADE80;   /* confirmed tx, reward values */
--clw-warning:     #FB923C;   /* low balance, paused autonomy, failed tx */
--clw-danger:      #F87171;   /* emergency stop, irreversible actions */

/* Per-NFA accents (assigned at mint, derived from personality vector) */
/* These are the ONLY colors allowed beyond the amber system.
   Each NFA owns one. Used ONLY for that NFA's active state indicators,
   avatar ring, and tooltip/header accents. Never for general UI. */
--clw-nfa-1:       #F5A524;   /* amber (default first NFA) */
--clw-nfa-2:       #B84DFF;   /* violet */
--clw-nfa-3:       #4DD4FF;   /* cyan */
--clw-nfa-4:       #FF6B9D;   /* rose */
--clw-nfa-5:       #7FD858;   /* lime */
--clw-nfa-6:       #FF8A4D;   /* coral */
```

### 3.2 Spacing scale (rem-based, 16px root)

Use only these values. `gap`, `padding`, `margin` must pick from this list.

```
--clw-space-0:     0;
--clw-space-1:     0.25rem;   /* 4px  — micro gap, icon+label */
--clw-space-2:     0.5rem;    /* 8px  — compact list rows */
--clw-space-3:     0.75rem;   /* 12px — card inner padding (tight) */
--clw-space-4:     1rem;      /* 16px — default card padding */
--clw-space-5:     1.5rem;    /* 24px — section break */
--clw-space-6:     2rem;      /* 32px — major section break */
--clw-space-8:     3rem;      /* 48px — page-level padding */
--clw-space-10:    4rem;      /* 64px — hero-level padding */
```

### 3.3 Radius scale

```
--clw-radius-sm:   6px;       /* small chips, tags */
--clw-radius-md:   10px;      /* buttons, inputs */
--clw-radius-lg:   12px;      /* cards */
--clw-radius-xl:   16px;      /* major cards, drawers */
--clw-radius-pill: 9999px;    /* avatar when active, status dots */
```

**Rule**: Radii below 16px only. Never fully rounded except for avatars in active state and status dots. Square corners are allowed and encouraged for technical/data-dense elements (e.g., address chips).

### 3.4 Border widths

```
--clw-border-hair:  1px;     /* default — use 95% of the time */
--clw-border-bold:  2px;     /* only for ring-on-active-avatar */
```

**Rule**: Hairline borders. Thickness conveys information, not decoration.

### 3.5 Shadow & glow

```
--clw-shadow-card:      0 1px 0 rgba(245,165,36,0.05);
--clw-shadow-elev:      0 8px 24px rgba(0,0,0,0.6);
--clw-glow-amber:       0 0 20px rgba(245,165,36,0.35);
--clw-glow-amber-hi:    0 0 40px rgba(245,165,36,0.5);
--clw-glow-nfa:         0 0 24px {nfa-accent}40;  /* 40 = 25% alpha */
```

**Rule**: No drop shadows in the Material sense. Use `--clw-shadow-elev` only for drawers/modals. Use glow as an amber halo for ritual moments, never as default button styling.

### 3.6 Z-index scale

```
--clw-z-base:     0;
--clw-z-docked:   10;    /* sidebar, drawer, composer */
--clw-z-sticky:   20;    /* header */
--clw-z-dropdown: 30;    /* tooltip, slash menu */
--clw-z-modal:    40;    /* ritual moment overlays, confirm dialogs */
--clw-z-toast:    50;    /* system notifications (rare) */
```

---

## 4. TYPOGRAPHY SYSTEM

### 4.1 Font stacks

**Mono (Display + technical data)**
```css
font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```
- Primary choice: **JetBrains Mono** — free, Google Fonts, characterful ligatures. Closest match to NieR UI feel.
- Source: https://fonts.google.com/specimen/JetBrains+Mono
- Weights used: 400 (regular), 500 (medium), 700 (bold)

**Sans (Body)**
```css
font-family: 'Satoshi', 'Geist', 'HarmonyOS Sans SC', 'Noto Sans SC', ui-sans-serif;
```
- Latin: **Satoshi** (free via Fontshare: https://fontshare.com/fonts/satoshi) — preferred for its restrained geometric quality.
- Alternate: **Geist** (https://vercel.com/font) if Satoshi feels too neutral.
- CJK: **HarmonyOS Sans SC** (free: https://developer.huawei.com/consumer/en/design/harmonyos-font) — elegant and characterful. Fallback to Noto Sans SC if unavailable.

**Accent (katakana/kana only, 5% of surfaces)**
```css
font-family: 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif;
```
- **Zen Kaku Gothic New**: https://fonts.google.com/specimen/Zen+Kaku+Gothic+New
- Used exclusively for atmospheric katakana labels (Section 9.3).

### 4.2 Type scale

All sizes use `rem`. 1rem = 16px.

| Token | Size | Line-height | Weight | Font | Use case |
|-------|------|-------------|--------|------|----------|
| `display-xl` | 4.5rem / 72px | 1.0 | 700 | Mono | Landing hero ("唤醒你的 NFA") |
| `display-lg` | 3rem / 48px | 1.1 | 700 | Mono | Ritual moment titles |
| `display-md` | 2rem / 32px | 1.2 | 500 | Mono | Section heroes, NFA codename large |
| `display-sm` | 1.5rem / 24px | 1.3 | 500 | Mono | NFA name in header |
| `body-lg` | 1rem / 16px | 1.6 | 400 | Sans | Body copy, dialogue messages |
| `body` | 0.875rem / 14px | 1.55 | 400 | Sans | Default UI text, form inputs |
| `body-sm` | 0.75rem / 12px | 1.5 | 400 | Sans | Captions, secondary info |
| `mono-md` | 0.8125rem / 13px | 1.5 | 400 | Mono | Chain data, tx hashes |
| `mono-sm` | 0.6875rem / 11px | 1.4 | 500 | Mono | Labels, UPPERCASE tags |
| `mono-xs` | 0.625rem / 10px | 1.3 | 500 | Mono | Fine print, metadata |

### 4.3 Letter-spacing

```
--clw-tracking-tight:   -0.02em;   /* display mono headings */
--clw-tracking-normal:  0;         /* body */
--clw-tracking-wide:    0.05em;    /* small uppercase labels */
--clw-tracking-wider:   0.15em;    /* section headers, tags */
--clw-tracking-widest:  0.4em;     /* hero eyebrow text */
```

### 4.4 Casing rules

- **UPPERCASE** — reserved for: status labels (`CONFIRMED`, `AUTO · WITHIN BUDGET`), section headers (`LEDGER`, `MEMORY`, `AUTONOMY`), NFA codenames in archive mode. Always use `tracking-wider` or wider when uppercased.
- **lowercase** — technical strings only (hashes, addresses, CIDs).
- **Title Case** — never use for UI. Use sentence case instead.
- **Sentence case** — default for Chinese and English UI labels, dialogue.

### 4.5 Numbers

All numbers — balances, percentages, tx values, block heights — use the Mono stack. Always. This is a one-rule game. Violations destroy the aesthetic.

Use tabular numerals:
```css
font-variant-numeric: tabular-nums;
```

---

## 5. LAYOUT SYSTEM

### 5.1 Breakpoints

```
--clw-bp-mobile:    < 768px    /* companion form */
--clw-bp-tablet:    768-1023px /* reduced desktop */
--clw-bp-desktop:   1024-1439px /* standard war room */
--clw-bp-wide:      >= 1440px  /* expansive war room */
```

### 5.2 Desktop shell (>= 1024px)

```
┌─────────────────────────────────────────────────────────────┐
│ [72px] [   flex-1 (min 640px)                ] [W variable] │
│ NFA     ConversationPane                       StatusDrawer │
│ Rail                                           320px open   │
│                                                44px closed  │
└─────────────────────────────────────────────────────────────┘
```

- Sidebar: fixed 72px wide, full height
- Conversation pane: flex 1, min-width 640px, max content width 768px (centered)
- Status drawer: 320px when open, 44px when collapsed (just the toggle rail)
- No horizontal scrolling ever

### 5.3 Mobile shell (< 768px)

```
┌─────────────────────────┐
│ [Header 56px]          ←│ current NFA, pulse%, status drawer trigger
├─────────────────────────┤
│ [NFA rail - horizontal] │ 56px tall, scrolls horizontally
├─────────────────────────┤
│                         │
│                         │
│  Conversation           │
│                         │
│                         │
│                         │
├─────────────────────────┤
│ [Composer - 64px]       │
└─────────────────────────┘
```

- NFA rail: horizontal scroll, each avatar 40px, gap 12px
- Conversation: fills remaining height
- Status drawer: modal sheet slid up from bottom (iOS style), handle at top
- FAB for "Genesis Mint" goes in NFA rail as last item, consistent with desktop

### 5.4 Safe paddings

- Desktop conversation pane: 24px horizontal, 32px vertical
- Mobile conversation pane: 16px horizontal, 20px vertical
- Sidebar: 16px top/bottom, 0 horizontal (avatars self-center)

### 5.5 Max conversation bubble width

- Desktop: 80% of pane, capped at 560px
- Mobile: 85% of pane, capped at any screen width - 32px

---

## 6. COMPONENT SPECIFICATIONS

Every dimension below is authoritative. Do not change unless the spec is updated.

### 6.1 NFA Avatar (in sidebar rail)

**Default state**
- Size: 48×48px
- Radius: 16px (rounded-square)
- Content: algorithmically generated symbolic glyph (see 6.2) on gradient background `linear-gradient(135deg, {nfa-accent}40, {nfa-accent}10)`
- Transition: `all 200ms cubic-bezier(0.4, 0, 0.2, 1)`

**Hover**
- Radius: 12px (slightly more rounded, organic movement)
- Cursor: pointer
- Display tooltip (see 6.3)

**Active (selected)**
- Radius: 9999px (full circle)
- Ring: 2px solid `{nfa-accent}` with 16px extra box-shadow of `{nfa-accent}30`
- Indicator: 3px × 24px amber bar positioned 12px left of avatar, vertically centered

**Dormant NFA overlay**
- Overlay: `rgba(0, 0, 0, 0.6)` covering the avatar
- No unread indicator shown

**Unread indicator**
- 12×12px circle, `{nfa-accent}` fill, `{surface-1}` 2px border
- Positioned absolute top: -2px, right: -2px
- Only shown when NFA is NOT currently selected and has > 0 unread

### 6.2 NFA symbolic glyph

No human figures. No animal faces. No cartoon mascots.

Instead, each NFA has one of these geometric glyphs as avatar content, color-keyed to accent:

```
◈  Seraph family       (diamond — DeFi/strategic NFAs)
◆  Raven family        (filled diamond — NFT/scout NFAs)
▲  Atlas family        (triangle — governance/heavy NFAs)
●  Echo family         (circle — memecoin/fast NFAs)
✦  Halcyon family      (sparkle — balancer/portfolio NFAs)
⬡  Default / Generic   (hexagon — any uncategorized)
```

Font for glyph: Mono, 24px, weight 500. Color: `{nfa-accent}` at 100% opacity.

These are Unicode characters, not icons. No SVG assets needed. This is deliberate — it matches terminal aesthetic and scales infinitely.

### 6.3 Tooltip (sidebar avatar hover)

- Position: absolute, left of avatar + 12px gap, vertically centered
- Background: `--clw-surface-3` (#1a1512)
- Border: 1px solid `--clw-amber-20`
- Radius: 8px
- Padding: 8px 12px
- Min-width: 160px
- Typography line 1: body-sm (14px), weight 500, color `--clw-fg`
- Typography line 2: mono-xs (10px), color `--clw-fg-40`, content format: `#{tokenId} · Lv.{level} · {balance} CLW`
- Animation: fade + 4px slide-in-from-left, 150ms ease-out
- No arrow pointer

### 6.4 Conversation header

- Height: 56px desktop, 56px mobile
- Border-bottom: 1px solid `--clw-amber-10`
- Padding: 0 24px desktop, 0 16px mobile
- Background: `--clw-bg`

**Content layout (left to right)**
1. NFA mini avatar: 32×32px rounded-full, gradient fill, glyph
2. Text block (column):
   - Line 1: NFA displayName, body-lg, weight 500, color `--clw-fg`
   - Line 2: mono-xs, color `--clw-fg-40`, format: `#{tokenId} · {rarity} · {ACTIVE|DORMANT}`
3. Right-aligned pulse indicator:
   - 6×6px dot (green if active, fg-25 if dormant)
   - Label: mono-sm UPPERCASE, color matches dot, format: `PULSE {N}%`

### 6.5 Conversation message bubbles

Rendered by type (from Message schema). Specs for each:

#### 6.5.1 TextMessage (user)

- Alignment: right
- Max width: 560px (desktop), 85% (mobile)
- Background: `--clw-amber-10`
- Border: 1px solid `--clw-amber-20`
- Radius: 16px
- Padding: 10px 16px
- Typography: body-lg, color `--clw-fg`
- Whitespace: pre-wrap

#### 6.5.2 TextMessage (nfa)

- Alignment: left
- Max width: 560px (desktop), 85% (mobile)
- Background: transparent
- Border: none
- Padding: 0
- Typography: body-lg, color `--clw-fg-85`, `line-height: 1.6`
- **Above the bubble**: NFA codename, mono-xs, `--clw-fg-40`, tracking-wider, margin-bottom 4px
- **When `memoryRef` present**: below content, small row:
  - Icon: Brain 9px, color `--clw-amber` at 50%
  - Text: `recalled · {memoryRef-short}`, mono-xs, color `--clw-amber` at 50%

#### 6.5.3 ActionProposal card

- Max width: 520px
- Background: `--clw-surface-2`
- Border: 1px solid `--clw-amber-20` (bolder than default to signal interactivity)
- Radius: 12px
- Padding: 16px

**Header row**
- Lightning icon 11px, color `--clw-amber`
- Skill label: mono-sm UPPERCASE tracking-wider, `--clw-amber`, weight 500
- If `requiresSignature === false`: right-aligned tag `AUTO · WITHIN BUDGET`, mono-xs, color `--clw-success`

**Summary** (always)
- Body-lg, `--clw-fg`, margin-top 8px, margin-bottom 12px

**Details grid** (when provided)
- 2-column grid, gap-x 16px gap-y 4px
- Each row: label (body-sm, `--clw-fg-40`) left + value (mono-md, `--clw-fg-85`) right

**CTA button** (when requiresSignature)
- Full width
- Height: 36px
- Background: `--clw-amber`
- Color: `--clw-bg`
- Radius: 8px
- Typography: body, weight 500
- States: idle "执行" / preparing "准备交易 [spinner]" / signing "等待钱包签名 [spinner]" / submitted "已提交 [check]"

#### 6.5.4 ActionReceipt card

- Max width: 520px
- Background: `--clw-surface-2`
- Border: 1px solid `--clw-amber-10` (subtle — this is informational, not interactive)
- Radius: 12px
- Padding: 16px

**Header row**
- Status icon 11px (Check success / X failed / Clock pending) in semantic color
- Status label: mono-sm UPPERCASE tracking-wider in semantic color
- Separator `·`
- Skill label: mono-sm UPPERCASE tracking-wider, `--clw-fg-25`

**Summary**: body-lg, `--clw-fg`, margin 8px 0 12px

**Data rows** (stacked, each row is flex-between)
- Label: mono-xs UPPERCASE tracking-wider, `--clw-fg-25`
- Value: mono-md, `--clw-fg-85` (or `--clw-success` for rewards)
- Links (tx, reasoning): hover underlines, inline external-link icon 9px at end

**Error**: if failed, additional body-sm row at bottom in `--clw-warning`

#### 6.5.5 SystemEvent line

- Center-aligned single line
- Typography: mono-xs, color `--clw-amber` at 50%, tracking-wide
- Icon: Sparkles 10px before text
- Padding: 4px 0
- Not a card — just a dividing line of ambient system text

#### 6.5.6 WorldStateCard

- Max width: 520px
- Background: `linear-gradient(135deg, --clw-amber-10 0%, transparent 100%)`
- Border: 1px solid `--clw-amber-20`
- Radius: 12px
- Padding: 16px

**Header**: Activity icon 11px + kind label UPPERCASE mono-sm, both `--clw-amber` 80%

**Content**: body-lg, `--clw-fg`, margin 8px 0 12px

**CTA** (if present): small pill button
- Height: 28px, padding: 0 12px
- Border: 1px solid `--clw-amber-40`
- Color: `--clw-amber`
- Radius: 8px
- Typography: body-sm
- Hover: background `--clw-amber-10`

#### 6.5.7 ReasoningCard

- Max width: 480px
- Background: `#120e0b` (slightly darker than surface-2, more recessed)
- Border: 1px solid `--clw-amber-10`
- Radius: 12px
- Padding: 12px (tighter — this is meta-info, not primary)

**Content**:
- Label: Brain 10px + `REASONING PROOF` mono-xs UPPERCASE tracking-wider `--clw-amber` 70%
- Summary: body-sm, `--clw-fg-85`, margin 4px 0 8px
- Link: full CID, mono-xs, `--clw-amber` at 70%, with external-link 9px icon trailing

### 6.6 Composer (input area)

- Height: auto (min 64px)
- Border-top: 1px solid `--clw-amber-10`
- Padding: 16px 24px (desktop), 12px 16px (mobile)
- Background: `--clw-bg`

**Layout**: flex, gap 12px, items-end
1. Textarea (flex 1)
2. Send button (44×44px)

**Textarea**
- Background: `--clw-surface-2`
- Border: 1px solid `--clw-amber-20`  (focus: `--clw-amber-40`)
- Radius: 12px
- Padding: 12px 16px
- Font: Sans body
- Resize: none
- Rows: 1 initial, auto-grow to max 6 rows (max-height: 160px, then scroll)
- Placeholder: `告诉你的 NFA 该做什么,或输入 / 查看快捷命令`
- Focus outline: none; rely on border color change

**Send button**
- Size: 44×44px
- Radius: 12px
- Background: `--clw-amber` (hover `--clw-amber-hi`, disabled `--clw-amber-60` at 40% opacity)
- Color: `--clw-bg`
- Icon: Send 16px
- Disabled when textarea is empty

**Slash menu (triggered by typing `/`)**
- Position: absolute, above composer, left-aligned
- Background: `--clw-surface-3`
- Border: 1px solid `--clw-amber-20`
- Radius: 12px
- Padding: 4px
- Max-height: 280px, scroll if exceeded
- Items: 40px tall, each shows command name (mono) + description (sans body-sm) + a key hint (mono-xs)

### 6.7 StatusDrawer (right side)

**Collapsed state**
- Width: 44px
- Only shows the toggle chevron centered vertically

**Expanded state**
- Width: 320px
- Background: `--clw-surface-1`
- Border-left: 1px solid `--clw-amber-10`

**Toggle**
- Top of drawer, 48px tall, centered chevron icon 16px, color `--clw-amber-60`
- Border-bottom: 1px solid `--clw-amber-10`
- Hover: color shifts to `--clw-amber`

**Content**: vertical stack, 24px padding, gap 24px between sections

#### 6.7.1 NFA Header block
- Line 1: `#{tokenId} · Lv.{level}`, mono-xs UPPERCASE tracking-wider, `--clw-amber-60`
- Line 2: NFA displayName, body-lg weight 500, `--clw-fg`, margin-top 4px
- Line 3: `{rarity} · {shelter}`, body-sm, `--clw-fg-60`
- Border-bottom: 1px solid `--clw-amber-10`, padding-bottom 16px

#### 6.7.2 Section header (universal)
- Icon 11px + title mono-sm UPPERCASE tracking-wider, both `--clw-amber` at 70%
- Gap between icon and text: 6px
- Margin-bottom 12px

#### 6.7.3 Section: Ledger
- Row: `Balance` label `--clw-fg-40` + value mono, `--clw-fg-85`
- Below, two side-by-side buttons: `Deposit`, `Withdraw`
  - Buttons: 32px tall, border 1px solid `--clw-amber-20`, radius 8px, body-sm, color `--clw-fg-85`
  - Hover: border `--clw-amber-40`, bg `--clw-amber-10`

#### 6.7.4 Section: Memory (this is the differentiation hook)
- Row: `Pulse` label + pulse bar + percentage
  - Pulse bar: 48px wide × 4px tall, background `--clw-amber-10`, filled portion `--clw-amber`
- Row: `Buffer` label + `{N} entries` mono
- Row: `Anchor` label + truncated tx hash link (mono-xs)
- **Identity quote** (if CML has it): italic body-sm, `--clw-fg-60`, inside a 3px-left-border amber-40 block with `--clw-amber-10` background, padding 8px 12px, radius 8px
  - Typography: font-style: italic, body-sm, wrap in Chinese quotation marks「 」

#### 6.7.5 Section: Autonomy

**When disabled**
- Center-aligned empty state
- Text: `未设置自治`, body-sm, `--clw-fg-40`
- Button: `配置 Directive`, pill-shaped, 32px tall, border amber-40, color amber, body-sm

**When enabled**
- Row: `Status` label + badge ("Active" green / "Paused" orange)
- **Budget bar**:
  - Label row: `Budget` + `{used} / {total} CLW`, both mono-xs, `--clw-fg-40`
  - Bar: 100% wide × 6px tall, bg `--clw-amber-10`, radius-pill, fill `--clw-amber` with transition 300ms
  - When ≥ 80% used: fill color shifts to `--clw-warning`
- **Directive quote**: body-sm, `--clw-fg-85`, in a padded block like the identity quote but without italic
- **Emergency stop button**: full width, 36px tall, border `--clw-warning` 40% opacity, color `--clw-warning`, text `紧急停止`, with PauseCircle icon 12px left
  - Hover: bg `rgba(251, 146, 60, 0.1)`

### 6.8 Landing (connect wall)

Single screen, full viewport, centered content.

**Background layers** (bottom to top):
1. Base: `--clw-bg`
2. Grid overlay: `repeating-linear-gradient` 80px spacing, 1px hairlines, amber at 6% opacity
3. Glow orb 1: 500px circle, blur 140px, `--clw-amber` at 20% opacity, positioned top-left quadrant, subtle `pulse` animation 4s
4. Glow orb 2: 400px circle, blur 140px, orange-600 at 10% opacity, positioned bottom-right quadrant
5. Decorative hexagons: 2 SVG hexagons (nested), 80px and 120px, 20% opacity, positioned top-left corner and bottom-right corner

**Content** (centered, z-index 10):
1. Eyebrow: `CLAWORLD · BNB CHAIN`, mono-xs tracking-widest, `--clw-amber` at 70%
2. H1: `唤醒你的 NFA`, display-xl, `--clw-fg`, margin-top 24px
3. Subtitle: `带记忆、能自治、在链上真实行动的 AI 伙伴`, body-lg, `--clw-fg-60`, max-width 480px, margin-top 24px
4. CTA: `接入钱包 / Connect`, pill button 48px tall, padding 0 32px, border 2px solid `--clw-amber`, color `--clw-amber`, bg `--clw-amber-10`, body weight 500, tracking-wide
5. Footer (absolute bottom): `BNB Chain Mainnet · ClawNFA 0xAa20…AE48`, mono-xs, `--clw-fg-25`, centered

**Connecting state**: replace CTA with "AWAKENING" text and 3 vertical animated bars (see Section 8.1)

### 6.9 NFA Profile (Five-Attribute Archive)

This is the expanded view of a single NFA when user taps into it from sidebar (mobile) or in an optional full-page view (desktop). Five distinct visual modules, not five identical cards.

**Layout**: vertical stack on mobile, 2-column grid on desktop (max-width 720px)

#### Module 1: Identity
- Treatment: "dossier header"
- Large codename display-md, `--clw-fg`, tracking-tight
- Below: 3 rows of mono-md labels + values
  - `RARITY` / `SHELTER` / `LEVEL`
- Background: `--clw-surface-2`, border 1px amber-10, radius 12px, padding 20px

#### Module 2: Pulse (心电图 sparkline)
- Treatment: "living signal"
- SVG: 280×60px, a stylized sparkline pulse trace
- Baseline: amber-20 horizontal line
- Pulse trace: amber, 1.5px stroke, animated draw 3s
- Current value badge: mono-md right-aligned `{pulse}%`
- Label below: `NEURAL PULSE · {active/dormant}`, mono-xs UPPERCASE tracking-wider

#### Module 3: Memory (记忆年轮)
- Treatment: "growth rings"
- SVG: concentric rings, one per CML snapshot, all amber, opacity decreasing outward (newest is brightest)
- Max 20 rings visible (if more, fade gradient applies)
- Center: snapshot count, mono-md
- Below: latest anchor tx hash truncated, mono-xs, `--clw-amber-60`

#### Module 4: Ledger (冷静数据)
- Treatment: "trading terminal readout"
- Giant balance number: display-md mono, tabular-nums, `--clw-fg`
- Unit label: `CLW`, mono-sm, `--clw-fg-40`
- Below: mini sparkline of last 7 days balance, 160×32px, amber 1px stroke
- Row of 2 small buttons: Deposit / Withdraw (same as drawer spec)

#### Module 5: Autonomy
- Treatment: "command console"
- Same budget bar as drawer but larger (full width of module)
- Full directive text visible (not truncated here)
- Last 3 autonomous actions as ActionReceipt mini cards (compact version: single line each, 36px tall)

### 6.10 Avatar size table (reference)

| Context | Size | Radius |
|---------|------|--------|
| Sidebar rail | 48×48 | 16px (selected → full) |
| Conversation header | 32×32 | full |
| Archive hero | 80×80 | 24px |
| Mobile NFA rail | 40×40 | 12px (selected → full) |
| Inline avatar in card | 20×20 | full |

---

## 7. MOTION & INTERACTION

### 7.1 Easing curves

```
--clw-ease-out:     cubic-bezier(0.16, 1, 0.3, 1);          /* natural UI */
--clw-ease-inout:   cubic-bezier(0.4, 0, 0.2, 1);           /* material-standard */
--clw-ease-ritual:  cubic-bezier(0.25, 0.46, 0.45, 0.94);   /* slow and deliberate */
--clw-ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);      /* slight overshoot for satisfying clicks */
```

### 7.2 Duration scale

```
--clw-dur-instant:  100ms;   /* tooltip fade, hover */
--clw-dur-quick:    200ms;   /* button press, avatar morph */
--clw-dur-normal:   320ms;   /* message bubble enter */
--clw-dur-slow:     600ms;   /* drawer open, panel slide */
--clw-dur-ritual:   1200ms;  /* reserved for ritual moments only */
```

### 7.3 Default transitions

- Hover on any interactive element: 150ms ease-out
- Button active/press: 100ms ease-out scale to 0.97
- State color changes: 200ms ease-inout
- Layout shifts (drawer toggle): 400ms ease-out on width, 320ms ease-out on opacity
- Page transitions: fade + 8px upward slide, 400ms ease-out

### 7.4 Message bubble entrance

Every new message entering the conversation stream:
- Start: opacity 0, translateY 8px
- End: opacity 1, translateY 0
- Duration: 320ms ease-out
- Stagger: if multiple messages appear in same render cycle, 50ms stagger

### 7.5 ActionReceipt entrance (special case)

Receipts from autonomous actions (not user-initiated) enter differently to signal "I did this, not you":
- Start: opacity 0, translateX -16px
- End: opacity 1, translateX 0
- Duration: 400ms ease-out
- During entry: amber glow pulse around card (`--clw-glow-amber-hi`) fading out over 600ms after entry completes

### 7.6 Forbidden motions

- Bouncy spring animations on anything other than button press feedback
- Card flip effects
- Page "loading" spinners (use amber pulse dots or typography cursor instead)
- Any easing named `ease-in-out-back` or equivalent
- Shimmer/skeleton loaders with rainbow gradients — use solid `--clw-surface-2` blocks that fade opacity 0.4 ↔ 0.7 at 1.5s cycle

---

## 8. THE FIVE RITUAL MOMENTS

These five moments get disproportionate design attention. They are the product's signature experiences. 80% of animation/art budget goes here; the other 95% of screen-time stays silent (Principle P1).

### 8.1 Awakening (first wallet connection)

**Duration**: 1.8 seconds total

**Sequence**:
1. 0–300ms: CTA button fades out (opacity 0, scale 0.95)
2. 300–800ms: Text `AWAKENING` appears, mono-sm tracking-widest, `--clw-amber`. Fades in with a slight upward motion (translateY 8px → 0).
3. 300–1800ms: Three 4px × 16px vertical bars appear below text, 8px gap. Each bar pulses amber ↔ amber-40 opacity at 1.2s cycle with 200ms stagger between bars.
4. 1500–1800ms: Full screen brief amber wash (opacity 0 → 0.08 → 0) as the background grid intensifies momentarily.
5. 1800ms: Navigate to Terminal.

**Reference**: NieR: Automata boot-up sequence — https://www.youtube.com/results?search_query=nier+automata+boot+up+ui

### 8.2 SLEEP Consolidation (CML snapshot anchored)

**Trigger**: `cml.sleep_consolidated` event received

**Sequence** (total 5s, non-blocking):
1. 0–400ms: 1px amber border appears on outer edge of viewport, opacity 0 → 0.4
2. 400–4600ms: Hold border at 0.4 opacity. Simultaneously, top-right corner shows a small ephemeral label: `MEMORY ANCHORED · {truncated-hash}`, mono-xs `--clw-amber`. Label fades in 200ms, stays 4s, fades out 400ms.
3. 4600–5000ms: Border fades back to 0

Layout is never blocked. Conversation remains interactive.

### 8.3 Autonomous Action Completed

**Trigger**: `autonomy.action_completed` event arrives

**Sequence**:
1. ActionReceipt card enters with the special entrance (Section 7.5)
2. If user is currently viewing THIS NFA's conversation: full entrance animation plays inline
3. If user is viewing a DIFFERENT NFA: subtle amber halo pulses once (1s) around the source NFA's sidebar avatar, plus unread badge appears

**Reference**: Control (2019) HUD notifications — quiet, confident, non-intrusive.

### 8.4 Genesis Mint (commit-reveal)

**Most elaborate ritual. Multi-step dialogue flow rather than single moment.**

**Phase 1 — Prelude**
- User: "I want to mint a new NFA"
- NFA-system (codename `GENESIS-0`, special amber color): Opens pre-filled dialogue about shelter choice

**Phase 2 — Commit (user signs)**
- User signs commit transaction via wallet
- Screen enters "calculating fate" state:
  - Dimmed overlay 80% opacity on background
  - Center: display-md text `CALCULATING FATE`, mono, tracking-wide, amber
  - Below: 8 rows of random hex strings rapidly cycling (monospace, 20px tall each, opacity gradient from top 20% → bottom 100%), like a decrypting terminal
  - Duration: 8-12 seconds (wait for chain confirmation)

**Phase 3 — Reveal (random seed revealed)**
- Hex cascade freezes
- Central hex string highlights one character at a time (from random to final), 100ms per char, total ~2s
- Final value stabilizes, ascii-box style border draws around it (SVG path 500ms)
- Screen flashes amber once (opacity 0 → 0.15 → 0, 600ms)

**Phase 4 — Personality rendering**
- Screen transitions to radar chart visualization of the new NFA's personality vector
- 6-axis radar, axes drawn in 800ms, data polygon drawn in 1.2s with fill animating from 0% to final opacity
- NFA's codename types out character by character (50ms each): `SERAPH-1142`
- Below: 3 lines of "birth data" print in sequence:
  - `RARITY  :  Rare`
  - `SHELTER :  Northern`
  - `DNA     :  0xa7…e3f`

**Phase 5 — Integration**
- Radar shrinks into sidebar position (400ms ease-ritual)
- Becomes a new avatar in the rail
- NFA sends first greeting in conversation stream

**Total duration**: 15-20 seconds of active ritual. This is the product's highest-production moment.

**Reference**: Destiny 2 Exotic reveal animations, NieR ending sequence text cascades

### 8.5 Dormant (NFA fading to sleep)

**Trigger**: upkeep not paid, NFA becoming inactive

**Never use modal warnings.** Instead:
1. In-conversation, NFA sends a message (copy: `我开始感到疲惫了……充值 upkeep 可以让我继续守候。` or `我的能量见底了。等你回来再说。`)
2. NFA's avatar in sidebar desaturates gradually over 30 seconds (CSS filter grayscale 0 → 1)
3. Pulse indicator fades to `--clw-fg-25`
4. If user doesn't act within 24h, NFA avatar shows dormant overlay (per 6.1 spec)

**Never**: prevent other interactions, show blocking dialogs, or guilt-trip the user.

---

## 9. COPY & VOICE GUIDELINES

### 9.1 Voice: NFA → User

- **Register**: formal-casual. Not stiff, not slangy. Imagine a Blade Runner replicant who's been with you for a year.
- **Length**: most messages under 60 characters. Long explanations (> 120 chars) are rare and purposeful.
- **Never**: exclamation marks (!), emoji, "!" "~" kaomoji, anime mannerisms like "desu" "nya" "哦".
- **Sometimes**: measured references to memory (`上次你让我...`), tactical observations (`对手池里有 3 个 level 6-8 的,值得一打`), brief acknowledgments (`明白`, `记下了`).

**Good examples**:
- `我刚结束一场 PK,净收益 +18.4 CLW,已写入账本。`
- `本日 PK 额度还剩 54.8 CLW。按你的 directive,我只动 PK 预算。`
- `市场出现 1 只 Epic DNA 卖单,价格低于 7 日均价 11%。符合你标记的收藏偏好。要我报价吗?`
- `我开始感到疲惫了。`

**Bad examples** (never write these):
- `嗨~主人!我刚刚帮你赢了一场 PK 哦!✨` (no emoji, no cutesy)
- `Excellent! I have successfully executed the requested action.` (too stiff, too English-AI)
- `让我来帮您分析一下当前的市场情况吧,根据我的分析,目前有几个机会值得关注...` (padding, hedge words)

### 9.2 UI copy

- **Labels**: lowercase for regular labels, UPPERCASE for status/section labels.
- **Buttons**: imperative short verbs. `执行`, `签名`, `继续`, `停手`. Never `Click to...`, `Please...`.
- **Empty states**: sparse. `未设置自治` is enough. Never `You haven't set up autonomy yet! Click below to...`
- **Errors**: factual. `交易失败 · 余额不足`. Never `Oops, something went wrong!`

### 9.3 Atmospheric katakana (rare, for flavor)

In specific places only, add small katakana labels for Ghost-in-the-Shell atmosphere. These are NEVER functional — they are pure mood decoration.

- Top-right of landing page: `システム · オンライン` (system online), mono-xs, `--clw-amber-40`
- Behind ActionReceipt card headers (watermark style, opacity 5%): `ログ` (log) or `実行済` (executed)
- NFA profile page subtitle: `人格体 · アーカイブ` (personality entity · archive)

Use sparingly. Two or three on the entire product total. Never translate them in UI — they're flavor, not information.

### 9.4 Numbers and units

- CLW amounts: always 1 decimal place for display (e.g., `486.2`), full precision on hover tooltip
- Percentages: whole numbers in UI (`82%`), decimals only in detail views
- Hash truncation: first 10 chars `…` last 6 chars → `0x3a2f8c1d4e…5c6d7e`
- CID truncation: `bafy` + 10 chars `…` → `bafybeigdyrk27s…`
- Time: relative for < 24h (`3 分钟前`), absolute date for older (`2026-04-17`), always in NFA's conversation. Technical data always uses ISO 8601 in tooltips.

---

## 10. VISUAL REFERENCES (MOOD BOARD)

AI agents should consult these before generating any visual asset. Open and ABSORB the aesthetic before writing code.

### 10.1 Primary references (absorb first)

**NieR: Automata UI**
- https://interfaceingame.com/games/nier-automata/ (screenshot archive)
- https://www.behance.net/search/projects?search=nier%20automata%20ui (fan/pro redesigns)
- **What to borrow**: monospace dominance, thin borders, black + one accent, zero decoration, information density without clutter

**Blade Runner 2049 HUD (Territory Studio)**
- https://theartofvfx.com/blade-runner-2049-hud-screen-graphics-by-territory-studio/ (design studio breakdown)
- https://www.artstation.com/search?query=blade%20runner%202049%20hud
- **What to borrow**: amber/deep-black palette, scan-line textures, the feeling of "industrial sci-fi" rather than glossy sci-fi

**Ghost in the Shell (1995) interfaces**
- https://interfaceingame.com/movies/ghost-in-the-shell/
- https://www.hudsandguis.com/home/tag/Ghost+In+The+Shell
- **What to borrow**: katakana accents, surveillance-screen compositions, the confidence of dense data readouts

### 10.2 Secondary references (for specific patterns)

**Linear (linear.app)**
- https://linear.app (just use the product)
- **What to borrow**: spacing rhythm, button restraint, the way state changes feel expensive rather than cheap

**Arc Browser**
- https://arc.net
- **What to borrow**: sidebar-as-navigation pattern, content-area focus discipline

**Warp Terminal**
- https://warp.dev
- **What to borrow**: monospace display with humanist proportions, command-palette interaction model

**Raycast**
- https://raycast.com
- **What to borrow**: keyboard-first UX, result list density, extension visual language

**Death Stranding UI**
- https://interfaceingame.com/games/death-stranding/
- **What to borrow**: large negative space around data cards, the dignity given to technical information

### 10.3 Tertiary references (scan for flavor)

- HUDs and GUIs archive: https://www.hudsandguis.com (browse by tag: cyberpunk, sci-fi, tactical)
- Destiny 2 UI breakdowns on ArtStation
- Control (2019) notifications
- Returnal HUD
- Pinterest: search `FUI cyberpunk amber`, `NieR UI redesign`, `terminal OS aesthetic`

### 10.4 Explicitly NOT references

- Axie Infinity, Pixelmon, Sorare, or any traditional GameFi
- Virtuals Protocol, Griffain frontends (nice concept, weak execution — we want to leapfrog)
- Discord's full UI (we borrow the vertical sidebar concept only; nothing else)
- OpenSea, Magic Eden, or NFT marketplace aesthetics
- Any "dashboard" style fintech (Stripe Dashboard, Linear's dashboards OK, but Mint/Personal Capital NO)

---

## 11. FORBIDDEN LIST

Violating any of these is a bug, not a style choice.

### 11.1 Colors
- No purple/blue gradients on any primary surface
- No pink (rose is allowed ONLY as an NFA accent, never as UI color)
- No saturated pure red for danger — use `--clw-warning` orange or `--clw-danger` desaturated red
- No greens outside `--clw-success`
- No rainbow / multi-color gradients anywhere
- No #FFFFFF pure white — always use `--clw-fg` (#FEF3C7) for text

### 11.2 Fonts
- No Inter, Roboto, Arial, SF Pro as display
- No Comic Sans (obviously)
- No decorative display fonts (script, blackletter, pixel fonts) except as one-off ritual moments
- No serif body text
- No italic Chinese text (terrible rendering)

### 11.3 Icons
- No Font Awesome, no Material Icons, no Heroicons solid-fill variants
- Use Lucide React (https://lucide.dev) exclusively, stroke style only, stroke-width 1.5 or 2
- No emoji as UI elements (emoji in message content only, user-typed, never NFA-generated)
- Icon sizes: 10, 11, 12, 14, 16, 18 px only. No 13, no 15, no 17.

### 11.4 Shapes and borders
- No drop shadows larger than `--clw-shadow-elev`
- No border radius > 16px (except pills and circles)
- No soft fluffy glassmorphism (backdrop-blur allowed only on modal/drawer backgrounds, never on cards)
- No gradient borders

### 11.5 Motion
- No bounce on load
- No elements moving without purpose (e.g., no floating decorative particles)
- No spinners longer than 1.5s — use more informative state indicators
- No scroll-triggered parallax
- No "wow" entrance sequences on regular content

### 11.6 Copy & Language
- No "let me help you with that"
- No "I'd be happy to"
- No "Absolutely!"
- No "Great question!"
- No emoji in NFA or system text
- No exclamation marks from NFA voice
- No Chinese-English mixed sentences from NFA unless quoting technical terms (`我启动 autonomy runner 了` is OK; `帮你 check 一下` is NOT)

### 11.7 GameFi patterns we reject
- No "+X CLW" floating numbers animating upward
- No coin-spinning icons
- No "treasure chest" loot boxes
- No confetti on success
- No streak counters / daily login bonuses
- No hexagonal avatar frames ("rarity glow")
- No chat reactions on messages

---

## 12. ACCESSIBILITY BASELINE

### 12.1 Color contrast
- Body text on bg: 13.5:1 (fg #FEF3C7 on bg #0A0807) ✓ exceeds AAA
- Secondary text (`--clw-fg-60`) on bg: 8.1:1 ✓ exceeds AAA
- Amber (`#F5A524`) on bg: 11.9:1 ✓ exceeds AAA
- Minimum for any text: 7:1 (AAA body)

### 12.2 Interactive targets
- Minimum tap target: 44×44px (iOS guideline)
- Buttons in drawer/composer: 36px tall acceptable with adequate padding
- Icon-only buttons: always 40×40 or larger

### 12.3 Keyboard navigation
- Tab order: sidebar → conversation → composer → drawer
- `Cmd/Ctrl+K`: opens slash menu
- `Cmd/Ctrl+/`: toggles status drawer
- `↑/↓` in composer (when empty): navigate between NFAs
- `Enter` in composer: send; `Shift+Enter`: newline
- `Esc`: close any open tooltip, slash menu, or drawer sheet (mobile)

### 12.4 Screen readers
- Sidebar avatars: `aria-label="{NFA displayName}, level {N}, {balance} CLW, {unread N ? unread N messages : selected}"`
- Messages: `role="log"` on conversation container, `aria-live="polite"` on the message list
- ActionProposal cards: clearly labeled as interactive (`role="button"` on CTA), all data fields readable in order

### 12.5 Motion sensitivity
- All ritual moment animations respect `prefers-reduced-motion: reduce`
- Under reduced-motion: ritual moments become cross-fades without transform animations, duration reduced by 50%
- Pulse animations on orbs/halos are disabled entirely under reduced-motion

---

## APPENDIX A — QUICK-REFERENCE CHEAT SHEET

When in doubt, look here first.

```
COLORS
  bg                #0a0807
  surface-1/2/3     #0d0a08 / #14100d / #1a1512
  amber             #F5A524
  fg                #FEF3C7
  success/warn/dan  #4ADE80 / #FB923C / #F87171

FONTS
  mono              JetBrains Mono
  sans (en)         Satoshi
  sans (zh)         HarmonyOS Sans SC
  kana              Zen Kaku Gothic New

SIZES (key)
  body-lg           16px
  body              14px
  body-sm           12px
  mono-md           13px
  mono-sm           11px
  mono-xs           10px

SPACING
  scale             4, 8, 12, 16, 24, 32, 48, 64 px

RADIUS
  default           12px cards, 10px buttons, 8px small, full pills

BORDERS
  width             1px hairlines always
  color             --clw-amber-10 subtle, --clw-amber-20 interactive

DURATION
  hover/press       100-200ms
  default motion    320ms
  drawer            400-600ms
  ritual            1200ms+

ICONS
  library           Lucide React only, stroke 1.5-2
  sizes             10/11/12/14/16/18 px

MUST-NEVER
  purple gradients, Inter font, emoji in NFA voice, bouncy springs,
  rainbow colors, coin icons, exclamation marks, confetti, floating numbers
```

---

*End of specification. Any deviation from this document requires product owner approval and an updated version stamp.*
