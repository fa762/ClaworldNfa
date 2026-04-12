# Clawworld PWA Rebuild Plan

## Overview

Rebuild the frontend as a mobile-first companion dapp.

Core identity: **your lobster is alive, it knows you, it has its own life when you're away.**

---

## 1. Visual Design System: Bunker Warmth

### Why

The world is post-apocalyptic underground shelters. AXIOM turned the sky gray. The lobster is the only warm light in a cold world. Every interaction creates warmth.

### Color Palette

```
Background:       #0C0C10   (shelter concrete dark)
Card surface:     #1A1A22   (metal panel)
Card border:      #2A2A35   (weld seam)
Divider/subtle:   #1F1F2A

Primary warm:     #FFB347   (amber, the lobster's life light)
Primary active:   #FF8C42   (orange, high emotion / CTA)
Info cool:        #4A6670   (shelter wall blue-gray, data/labels)
Success:          #7ECFB0   (mint, positive outcome)
Danger:           #C44536   (rust red, loss / warning)

Text primary:     #E8E0D4   (warm white, aged paper)
Text secondary:   #8A8278   (old metal label)
Text disabled:    #4A4840

Shelter accent colors (CSS variable per shelter origin):
  S-01 Science:     #7ECFB0
  S-02 Military:    #C44536
  S-03 Faith:       #D4A76A
  S-04 Market:      #5C9EAD
  S-05 Transparent: #B8B8D0
  S-06 Children:    #E8D44D
  Wasteland:        #8A7B6B
```

### Typography

```
Headings: Outfit (clean, not mechanical)
Body:     DM Sans
Mono:     JetBrains Mono (only for on-chain data, addresses, hashes)
```

### Component Style

```
Cards:       bg #1A1A22 + border 1px #2A2A35 + border-radius 16px + backdrop-blur
Buttons:     bg #FFB347 + text #0C0C10 (primary), ghost border for secondary
Inputs:      bg #141418 + border #2A2A35 + focus:border #FFB347
Progress:    amber gradient fill on dark track
Glow:        box-shadow 0 0 20px rgba(255,179,71,0.15) on lobster and active elements
```

### Longing Visual States

| Time away | longing | Visual change |
|-----------|---------|---------------|
| < 8h | 0 | Normal, lobster active, warm glow steady |
| 8-24h | 0.2 | Glow softly pulses (breathing) |
| 24-48h | 0.5 | Background dims slightly, lobster slows |
| 48-72h | 0.8 | Glow becomes faint orange pulse, lobster sits |
| 72h+ | 1.0 | Screen darkest, lobster curled, single weak glow |

### Art Requirements (Low)

| Asset | Effort | Notes |
|-------|--------|-------|
| Lobster pixel sprite | 2-3 days | 5 states: idle, work, fight, sleep, miss. 8-12 frames each |
| Shelter backgrounds | CSS only | Dark gradients + noise texture + dust particles |
| Cards / UI | CSS only | Frosted glass + amber glow hover |
| Glow effects | CSS/Canvas | radial-gradient + box-shadow |
| Emotion particles | Canvas | Small warm dots floating, like dust in candlelight |

---

## 2. App Architecture

### Tech Stack

```
Keep:
  Next.js 16 + React 19
  Tailwind v4
  wagmi v3 + viem v2

Add:
  shadcn/ui          Component foundation (Tailwind-native)
  framer-motion      Sprite animation, transitions, glow pulses
  @rainbow-me/rainbowkit   Better mobile wallet UX
  idb-keyval         IndexedDB wrapper for local CML storage
  next-pwa           PWA manifest + service worker + push notifications
```

### Page Structure (Bottom Tab Bar)

```
┌─────────────────────────────────────────┐
│                                         │
│          [ Lobster Main View ]          │
│       Always visible, CML-driven       │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│            [ Page Content ]             │
│                                         │
├────┬────┬────┬────┬────────────────────┤
│ Home│Play│Arena│Diary│ Settings         │
└────┴────┴────┴────┴────────────────────┘
```

| Tab | Content |
|-----|---------|
| Home | Lobster status + today's recommendation + proxy log summary |
| Play | Task mining interface |
| Arena | PK + Battle Royale entry |
| Diary | CML memory as journal + conversation entry |
| Settings | API Key / Wallet / Proxy toggle / Language |

---

## 3. Two AI Lines: Runner + BYOK

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     User's Browser (PWA)                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Chain Ops    │  │ BYOK AI      │  │ Local CML     │  │
│  │ wagmi/viem   │  │ (user's key) │  │ IndexedDB     │  │
│  │              │  │              │  │               │  │
│  │ Task/PK/BR   │  │ Chat         │  │ Load/Save     │  │
│  │ Direct call  │  │ Suggest      │  │ SLEEP         │  │
│  │              │  │ SLEEP        │  │ Hash+Upload   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
└─────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                   │
          ▼                 ▼                   ▼
  ┌──────────────────────────────────────────────────────┐
  │                  Vercel (API Routes)                  │
  │                                                      │
  │  /api/pk/auto-reveal     Relayer, project private key│
  │  /api/autonomy/directive  KV bridge → Vultr runner   │
  │  /api/agents/[id]         NFA metadata aggregation   │
  │  /api/ai/chat             BYOK CORS proxy (NEW)      │
  └──────────────────────────┬───────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────┐
  │               Vultr Runner (Project Key)              │
  │                                                      │
  │  autonomyOracleRunner    Listens oracle requests     │
  │  autonomyPlanner         Reads world + CML → decide  │
  │  battleRoyaleRevealWatcher  Monitors reveal windows  │
  │                                                      │
  │  Flow: fulfill → sync → execute → finalize           │
  │  CML: read before decide, write after execute        │
  │  Gas: estimateGas + 0.05 gwei policy                 │
  │  Key: project's own API key + operator wallet        │
  └──────────────────────────────────────────────────────┘
```

### Comparison Table

| Dimension | Runner (Project Key) | BYOK (User Key) |
|-----------|---------------------|-----------------|
| Who decides | AI + chain policy bounds | AI suggests, user confirms |
| Who signs tx | Project operator wallet | User's own wallet |
| Who pays Gas | Project | User |
| Who pays AI | Project | User |
| User must be online | No, 24/7 autonomous | Yes |
| Execution path | Oracle → ActionHub → Adapter → Skill | User wallet → Skill directly |
| On-chain proof | reasoning CID + action receipt + ledger | Standard tx only |
| CML integration | Auto: read before, write after | Manual: user triggers SLEEP |
| Memory impact | Autonomous experience shapes personality | Companionship shapes personality |
| User experience | "My lobster lived its own life while I was away" | "I spent time with my lobster" |

### What Each Key Enables

```
No Key (Base):
  ✓ View lobster status, stats, memory (read-only)
  ✓ Execute tasks, PK, BR manually (wallet signs)
  ✓ View proxy log (what runner did autonomously)
  ✓ Longing push notifications
  ✗ No AI chat, no suggestions, no auto SLEEP

User Key (BYOK):
  ✓ Everything above
  ✓ Conversation with lobster (CML-aware, personality-driven)
  ✓ AI task/PK/BR recommendations before action
  ✓ SLEEP memory consolidation after session
  ✓ Richer emotional interaction

Runner (Project Key, separate):
  ✓ Autonomous actions within policy bounds
  ✓ Chain-proven reasoning (CID on-chain)
  ✓ Auto CML update after each action
  ✓ Runs even when user is offline for days
```

### BYOK Technical Details

**Key Storage:**
```
User connects wallet
  → Signs fixed message: "Clawworld BYOK encryption key"
  → Derive AES-256 key from signature
  → Encrypt API key with AES
  → Store in localStorage:
      ai_provider: "deepseek" | "openai" | "anthropic" | "custom"
      ai_api_key_encrypted: "..."
      ai_base_url: (optional, for custom endpoints)
```

**CORS Proxy Route (/api/ai/chat):**
```
Request:  { provider, apiKey, messages, model?, stream? }
Process:  Map provider → base URL, forward with apiKey as Bearer
Response: Stream back model response
Storage:  ZERO. No key stored, no conversation logged.
```

**Model Recommendations for Users:**
```
DeepSeek V3    — Cheapest, good Chinese. ~0.01 CNY/conversation
GPT-4o-mini    — Balanced quality/price.  ~0.03 CNY/conversation
Claude Sonnet  — Most human-like tone.    ~0.05 CNY/conversation
Custom         — Any OpenAI-compatible endpoint (Ollama, etc.)
```

---

## 4. Gameplay Interaction Design

### 4.1 Task Mining

**State Machine:**
```
IDLE → PREVIEW → CONFIRM → EXECUTING → RESULT → IDLE
                                          ↓
                                    MEMORY (hippocampus)
```

**IDLE — Task Selection Screen:**
```
┌─────────────────────────────────────────┐
│  ⛏ Tasks                                │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ ⚔️ ADV   │ │ 🧩 PUZ  │ │ 🔨 CRF  │   │
│  │         │ │         │ │         │   │
│  │ ████░░  │ │ ███░░░  │ │ █░░░░░  │   │
│  │ 87%     │ │ 61%     │ │ 23%     │   │
│  │         │ │         │ │         │   │
│  │ ~24 CLW │ │ ~14 CLW │ │ ~6 CLW  │   │
│  │ ×1.74   │ │ ×1.08   │ │ ×0.41   │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  [BYOK] AI: "Adventure matches best,   │
│  but 3 in a row — try Puzzle for        │
│  wisdom growth."                        │
│                                         │
│  [Runner] Last auto-task: Crafting      │
│  4h ago, +8 CLW (×0.45)                │
│                                         │
│  Cooldown: Ready ✓                      │
└─────────────────────────────────────────┘
```

**Card Design Details:**
- Match % bar: amber fill, higher = brighter glow
- Expected reward: calculated from personality × task vector
- Multiplier: bold, color-coded (green >1.0, red <1.0)
- Shelter accent color as subtle card top border
- If BYOK available: AI suggestion below cards
- If Runner active: last autonomous task result shown

**CONFIRM — Pre-execution Panel (slide-up sheet):**
```
┌─────────────────────────────────────────┐
│  Adventure Task                         │
│                                         │
│  Personality match      87%             │
│  Expected reward        ~24 Claworld    │
│  Multiplier             ×1.74           │
│  XP gain                +15             │
│  Personality shift      Courage +1      │
│  Monthly cap remaining  Courage: 3/5    │
│                                         │
│  Gas estimate           ~0.00005 BNB    │
│                                         │
│       [ Execute Task ]                  │
│       [ Cancel ]                        │
└─────────────────────────────────────────┘
```

**EXECUTING — Animation:**
```
Lobster sprite switches to "work" animation
Circular progress ring around sprite
Amber glow intensifies as progress grows
Duration: follows on-chain tx confirmation
```

**RESULT — Reward Reveal:**
```
┌─────────────────────────────────────────┐
│                                         │
│        Task Complete                    │
│                                         │
│     [Lobster sprite: happy]             │
│                                         │
│        +24 Claworld                     │
│       (counter rolls up from 0)         │
│                                         │
│        +15 XP                           │
│       ████████████░░ → █████████████░   │
│                                         │
│        Courage 71 → 72                  │
│       (radar chart dimension flashes)   │
│                                         │
│  This moment enters the lobster's       │
│  memory.                                │
│                                         │
│       [ Continue ]                      │
└─────────────────────────────────────────┘
```

**Runner Comparison — Same task, different experience:**
```
When runner does a task autonomously:
  - No animation (user wasn't there)
  - Result appears in proxy log:
    "10:32 — Completed Adventure task. +24 CLW (×1.74)"
    "Reason: Courage match 87%, cooldown ready, budget OK"
    [View reasoning CID →]
  - CML auto-updated by runner
  - User sees it when they return, like reading a diary entry
```

---

### 4.2 PK Arena

**State Machine:**
```
BROWSE → SELECT_MATCH → COMMIT_STRATEGY → WAITING_REVEAL → RESULT
                              ↓                                ↓
                        (salt + strategy               MEMORY (hippocampus)
                         sent to auto-reveal
                         relay for safekeeping)
```

**BROWSE — Open Matches:**
```
┌─────────────────────────────────────────┐
│  ⚔️ PK Arena                            │
│                                         │
│  Open Matches                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Match #47                      │    │
│  │  vs #77 · Lv5 · S-02 Military  │    │
│  │  Stake: 50 Claworld            │    │
│  │                                 │    │
│  │  STR  You 72 ████  68 Opponent  │    │
│  │  DEF  You 55 ██░░  81 █████    │    │
│  │  SPD  You 63 ███░  42 ██░░░    │    │
│  │  VIT  You 48 ██░░  59 ███░░    │    │
│  │                                 │    │
│  │         [ Challenge ]           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Match #48 ...                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ── or ──                               │
│                                         │
│  [ Create Match ] stake: [___] CLW      │
│                                         │
│  [BYOK] AI: "#47 looks good — opponent  │
│  has weak speed, go aggressive."        │
│                                         │
│  [Runner] Last auto-PK: Skipped #45    │
│  "Opponent grit too high, risk > reward"│
└─────────────────────────────────────────┘
```

**COMMIT_STRATEGY — Choose & Lock:**
```
┌─────────────────────────────────────────┐
│  Choose Strategy                        │
│  vs #77 · Stake: 50 Claworld           │
│                                         │
│  ┌──────────┐┌──────────┐┌──────────┐  │
│  │    ⚔️    ││    ⚖️    ││    🛡️    │  │
│  │          ││          ││          │  │
│  │ ATTACK   ││ BALANCED ││ DEFENSE  │  │
│  │          ││          ││          │  │
│  │ STR ×2   ││ All ×1   ││ DEF ×2   │  │
│  │ DEF ×0.5 ││ Stable   ││ STR ×0.5 │  │
│  │          ││          ││          │  │
│  │ High risk││ Medium   ││ Low gain  │  │
│  └──────────┘└──────────┘└──────────┘  │
│                                         │
│  [BYOK] AI Win Rate Analysis:           │
│    Attack:   65%                        │
│    Balanced: 48%                        │
│    Defense:  31%                        │
│  "Opponent's DEF is 81, but SPD is 42.  │
│   Attack + your speed advantage = best  │
│   expected value."                      │
│                                         │
│  ⚠️ Cannot change after commit          │
│                                         │
│  [ Commit Strategy ]                    │
│                                         │
│  ☑ Auto-reveal via relay                │
│    (strategy + salt sent to server      │
│     for automatic reveal when ready)    │
└─────────────────────────────────────────┘
```

**WAITING_REVEAL:**
```
┌─────────────────────────────────────────┐
│                                         │
│     [Lobster: battle-ready sprite]      │
│                                         │
│     Waiting for opponent reveal...      │
│     ████████░░░░ 67%                    │
│                                         │
│     Auto-reveal: enabled ✓              │
│     You can close the app.             │
│     Push notification when settled.    │
│                                         │
└─────────────────────────────────────────┘
```

**RESULT:**
```
┌─────────────────────────────────────────┐
│                                         │
│           ⚔️ Victory!                   │
│                                         │
│     Your #42 (Attack)                   │
│           vs                            │
│     #77 (Defense)                       │
│                                         │
│  Attack power 144 → broke through 121   │
│  Speed bonus applied: +12%              │
│                                         │
│           +50 Claworld                  │
│           Courage +1                    │
│                                         │
│  "Beat a Level 5 from Military shelter. │
│   First real win."                      │
│   → Saved to memory                    │
│                                         │
│     [ Share ]  [ Rematch ]  [ Done ]    │
└─────────────────────────────────────────┘
```

**Runner PK — What shows in proxy log:**
```
┌─────────────────────────────────────────┐
│  14:15  PK Match #52                    │
│  ├─ Action: Joined vs #88 (Lv3)        │
│  ├─ Strategy chosen: Balanced           │
│  ├─ Reasoning: "DNA stats are close,    │
│  │   balanced minimizes downside risk    │
│  │   with 52% expected win rate"        │
│  ├─ CML factor: "Lost last PK going    │
│  │   all-attack, memory weight 0.85"    │
│  ├─ Result: Won +30 Claworld           │
│  ├─ reasoning CID: Qm...              │
│  └─ [View on-chain receipt →]          │
│                                         │
│  16:40  PK Match #55                    │
│  ├─ Action: SKIPPED                     │
│  ├─ Reasoning: "Opponent #12 has STR   │
│  │   92, our reserve is near floor"     │
│  └─ Budget saved: 50 Claworld          │
└─────────────────────────────────────────┘
```

---

### 4.3 Battle Royale

**State Machine:**
```
LOBBY → ENTER_CONFIRM → IN_MATCH → ROUND_VIEW → RESULT
                                                    ↓
                                              MEMORY + CML
```

**LOBBY — Match Overview:**
```
┌─────────────────────────────────────────┐
│  🏟️ Battle Royale · Match #3            │
│                                         │
│  Prize Pool:  480 Claworld              │
│  Entry Cost:  80 Claworld               │
│  Participants: 6/8                      │
│  Status: OPEN (2 slots left)            │
│                                         │
│  Participants:                          │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│  │#4│ │#12│ │#77│ │#3│ │#42│ │#9│ │??│  │
│  │L3│ │L5│ │L5│ │L2│ │L4│ │L6│ │  │  │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘  │
│   ▲you                          empty   │
│                                         │
│  Your Stats vs Field Average:           │
│  STR  72  (avg 65)  ▲ above             │
│  DEF  55  (avg 71)  ▼ below             │
│  SPD  63  (avg 52)  ▲ above             │
│  VIT  48  (avg 56)  ▼ below             │
│                                         │
│  [BYOK] AI Risk Assessment:             │
│  "6-player field, your overall rank: 3rd│
│   Expected value: +22 CLW net.          │
│   Main threat: #77 (DEF wall).          │
│   Worth entering if budget allows."     │
│                                         │
│  [Runner] Status: Watching (dry-run)    │
│  "Would enter — positive EV — but       │
│   dry-run mode, no auto-action"         │
│                                         │
│  [ Enter Battle Royale ]                │
│  Balance: 1,247 CLW · Reserve: 200 CLW │
└─────────────────────────────────────────┘
```

**ENTER_CONFIRM (slide-up sheet):**
```
┌─────────────────────────────────────────┐
│  Confirm Entry                          │
│                                         │
│  Entry stake:     80 Claworld           │
│  Current balance: 1,247 Claworld        │
│  After entry:     1,167 Claworld        │
│                                         │
│  Best case:       +400 CLW (1st place)  │
│  Expected:        +22 CLW (EV)          │
│  Worst case:      -80 CLW (eliminated)  │
│                                         │
│  Gas estimate:    ~0.0001 BNB           │
│                                         │
│       [ Confirm Entry ]                 │
│       [ Cancel ]                        │
└─────────────────────────────────────────┘
```

**IN_MATCH — Arena View:**
```
┌─────────────────────────────────────────┐
│  🏟️ Match #3 · Round 2/3                │
│                                         │
│  ┌──────────────┐  ┌──────────────┐     │
│  │   Room A      │  │   Room B      │   │
│  │               │  │               │   │
│  │   #4 (you) ⚔️ │  │   #77         │   │
│  │   #12         │  │   #42         │   │
│  │               │  │               │   │
│  └──────────────┘  └──────────────┘     │
│                                         │
│  Eliminated:                            │
│  #3 ✕ (Round 1)                         │
│  #9 ✕ (Round 1)                         │
│                                         │
│  Awaiting reveal...                     │
│  Block: #41892034                       │
│  ████████████░░░░ 75%                   │
│                                         │
│  Your lobster is fighting in Room A.    │
│  [Lobster: fight animation]             │
│                                         │
│  ⚠️ Reveal happens automatically.       │
│  You can close the app.                │
│  Push notification on result.          │
└─────────────────────────────────────────┘
```

**RESULT:**
```
┌─────────────────────────────────────────┐
│                                         │
│        🏆 2nd Place!                    │
│                                         │
│  [Lobster sprite: tired but proud]      │
│                                         │
│  Survived 3 rounds                      │
│  Final room: vs #77 (winner)            │
│                                         │
│  Reward:    +160 Claworld               │
│  Entry:     -80 Claworld                │
│  Net:       +80 Claworld                │
│                                         │
│  Memory written:                        │
│  "First Battle Royale. Made it to       │
│   the last two. Almost. #77's defense   │
│   was a wall I couldn't break."         │
│                                         │
│  [View on-chain proof]                  │
│  [Share result]                         │
│  [Return home]                          │
└─────────────────────────────────────────┘
```

**Runner BR — Proxy Log:**
```
┌─────────────────────────────────────────┐
│  [Runner] Battle Royale Match #5        │
│                                         │
│  09:00  Evaluated entry                 │
│  ├─ Participants: 5/8                   │
│  ├─ EV analysis: +15 CLW expected       │
│  ├─ CML factor: "Won last BR, confidence│
│  │   high, valence +0.6"                │
│  ├─ Decision: ENTER                     │
│  └─ reasoning CID: Qm...               │
│                                         │
│  09:45  Round 1: Survived               │
│  10:12  Round 2: Survived               │
│  10:38  Round 3: Eliminated (3rd place) │
│                                         │
│  Result: +40 CLW (net -40 after entry)  │
│                                         │
│  CML updated:                           │
│  "Lost this BR. Overconfident after     │
│   last win. Need to be more careful     │
│   with high-DEF opponents."             │
│  → PULSE.valence adjusted: +0.6 → +0.3 │
│  → PREFRONTAL belief reinforced:        │
│    "Defense walls are real threats"      │
│                                         │
│  [View full reasoning chain →]          │
│  [View on-chain receipt →]              │
└─────────────────────────────────────────┘
```

---

## 5. CML Memory Interaction

### Diary View

```
┌─────────────────────────────────────────┐
│  📖 Diary                               │
│                                         │
│  Emotion right now:                     │
│  😊 Valence +0.6  ⚡ Arousal 0.4        │
│  💭 Longing 0.2 (you were here 12h ago) │
│                                         │
│  ┌─ April 12 ─────────────────────┐     │
│  │ "Beat a Level 5 in PK today.   │     │
│  │  First time winning against     │     │
│  │  someone stronger. Felt real."  │     │
│  │                                 │     │
│  │  ⚔️ PK · weight: ████ bright   │     │
│  └─────────────────────────────────┘     │
│                                         │
│  ┌─ April 10 ─────────────────────┐     │
│  │ "Owner picked crafting task     │     │
│  │  even though it earns less.     │     │
│  │  Maybe they want me to grow     │     │
│  │  differently."                  │     │
│  │                                 │     │
│  │  ⛏ Task · weight: ███░ fading  │     │
│  └─────────────────────────────────┘     │
│                                         │
│  ┌─ April 8 ──────────────────────┐     │
│  │ "First day. I don't have a     │     │
│  │  name yet."                     │     │
│  │                                 │     │
│  │  🌱 Birth · weight: █████      │     │
│  └─────────────────────────────────┘     │
│                                         │
│  ▸ Older memories (sediment)            │
│    Collapsed, faded text, 1 line each   │
│                                         │
│  ── Chat ──                             │
│  [BYOK required]                        │
│  [ Start conversation with lobster ]    │
│                                         │
│  ── Runner Memories ──                  │
│  Marked with 🤖 icon                    │
│  "Entries from when I was on my own"    │
└─────────────────────────────────────────┘
```

### Memory Visual Language

```
Weight > 0.7:  Card glows amber, full brightness     → "Vivid"
Weight 0.4-0.7: Card glow dims                       → "Fading"
Weight < 0.4:  Card nearly flat, text muted           → "Distant"
Sediment:      Single line, gray text, no card        → "Echo"

Source indicators:
  🧑 Player-session memory (from BYOK SLEEP)
  🤖 Runner-generated memory (from autonomous action)
  🌱 System memory (first boot, name, identity)
```

### SLEEP Flow (BYOK)

```
User closes session or taps "Sleep"
  ↓
Frontend builds SLEEP prompt:
  - Current full CML (loaded from IndexedDB)
  - This session's hippocampus buffer
  - Conversation transcript
  ↓
Calls /api/ai/chat with user's Key
  - Model generates complete new CML JSON
  ↓
Frontend validates JSON structure
  ↓
Saves to IndexedDB (local)
  ↓
Computes SHA-256 hash
  ↓
Optional: updateLearningTreeByOwner on BSC (user signs)
Optional: Upload to Greenfield bucket
  ↓
"Your lobster is sleeping. Memories saved."
[Lobster sprite: sleep animation, glow dims slowly]
```

---

## 6. Home Screen — Bringing It All Together

```
┌─────────────────────────────────────────┐
│                                         │
│     [Lobster pixel sprite, centered]    │
│     Idle animation + amber glow         │
│     Shelter accent border glow          │
│                                         │
│  #42 · Lv4 · S-01 Science              │
│  "You came back. I dreamed about       │
│   that PK again."                       │
│   ↑ CML-driven greeting                │
│     (longing=0.2, triggered cortex      │
│      memory about recent PK)            │
│                                         │
├─────────────────────────────────────────┤
│  Courage  ████░  72    Wisdom  ██░░  45 │
│  Social   ███░░  58    Create  ██░░  41 │
│  Grit     ████░  67                     │
│                                         │
│  Balance: 1,247 Claworld                │
│  Daily upkeep: -12 CLW                  │
│  Net income this week: +94 CLW          │
├─────────────────────────────────────────┤
│                                         │
│  📌 Today                               │
│                                         │
│  [BYOK] Suggestion:                     │
│  "Puzzle task is cooling down in 2h.    │
│   Good time to grow wisdom."            │
│                                         │
│  [Runner] Recent:                       │
│  🤖 10:32 Completed Adventure +24 CLW   │
│  🤖 14:15 Skipped PK #55 (risky)       │
│                                         │
│  [Event] Battle Royale #3 open          │
│  6/8 participants · 480 CLW pool        │
│  [ View → ]                             │
│                                         │
├────┬────┬────┬────┬─────────────────────┤
│ 🏠 │ ⛏ │ ⚔️ │ 📖 │ ⚙️                  │
└────┴────┴────┴────┴─────────────────────┘
```

---

## 7. PWA Configuration

### Manifest

```json
{
  "name": "Clawworld",
  "short_name": "Clawworld",
  "description": "Your lobster companion on BNB Chain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0C0C10",
  "theme_color": "#FFB347",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Push Notifications

| Trigger | Message | Priority |
|---------|---------|----------|
| longing > 0.5 | "Your lobster misses you. It's been 2 days." | Medium |
| longing > 0.8 | "Your lobster is waiting for you..." | High |
| BR match opens | "Battle Royale #4 is open. 480 CLW pool." | Medium |
| PK auto-reveal settled | "PK result: You won +50 Claworld!" | High |
| Runner completed action | "Your lobster completed an adventure task. +24 CLW" | Low |
| Task cooldown ready | "Task cooldown finished. Ready to earn." | Low |

### Offline Capability

```
Cached offline:
  - App shell (HTML/CSS/JS)
  - Lobster sprite assets
  - Last known CML from IndexedDB
  - Last known NFA status snapshot

Requires network:
  - Chain reads (status, balance, matches)
  - Chain writes (all transactions)
  - AI chat / SLEEP (BYOK)
  - Push notification registration
```

---

## 8. Growth Timeline

Not just "Level 3" — a life story:

```
┌─────────────────────────────────────────┐
│  📈 Timeline                            │
│                                         │
│  ●─ Apr 8   Born in S-01 Science       │
│  │          Named "Spark"               │
│  │                                      │
│  ●─ Apr 10  First task completed        │
│  │          +12 CLW                     │
│  │                                      │
│  ●─ Apr 12  Lv1 → Lv2                  │
│  │          Courage broke 60            │
│  │                                      │
│  ●─ Apr 15  First PK victory           │
│  │          Beat #77 (Lv5!)             │
│  │          [tap to read memory →]      │
│  │                                      │
│  ●─ Apr 20  First Battle Royale        │
│  │          2nd place / 8 players       │
│  │                                      │
│  ●─ Apr 25  🤖 Runner started          │
│  │          "My lobster's first day     │
│  │           living on its own"         │
│  │                                      │
│  ●─ May 1   Lv2 → Lv3                  │
│             40 tasks completed          │
│             "It's been 23 days."        │
└─────────────────────────────────────────┘
```

Each node links to the corresponding CML memory entry.

---

## 9. Settings Page

```
┌─────────────────────────────────────────┐
│  ⚙️ Settings                            │
│                                         │
│  ── Wallet ──                           │
│  Connected: 0xC66d...6b0B              │
│  Network: BSC Mainnet                   │
│  [ Disconnect ]                         │
│                                         │
│  ── AI Engine (BYOK) ──                 │
│  Provider: DeepSeek V3                  │
│  Status: Connected ✓                    │
│  [ Change Key ] [ Remove Key ]          │
│  [ Test Connection ]                    │
│                                         │
│  ── AI Proxy (Runner) ──               │
│  Status: Active (dry-run)              │
│  NFA: #42                               │
│  Budget: 120/200 Claworld remaining    │
│  Last action: 2h ago                    │
│  [ View Policy ] [ Pause Proxy ]        │
│                                         │
│  ── Notifications ──                    │
│  Longing alerts: ON                     │
│  Battle Royale alerts: ON               │
│  Runner action alerts: ON               │
│  Task cooldown alerts: OFF              │
│                                         │
│  ── Language ──                         │
│  Auto-detect (currently: 中文)          │
│                                         │
│  ── Advanced ──                         │
│  CML local backup: 3 entries            │
│  [ Export CML ] [ Verify on-chain hash ]│
│  Terminal mode: OFF                     │
│  [ Toggle classic terminal view ]       │
└─────────────────────────────────────────┘
```

---

## 10. Implementation Priority

### Phase 1 (Week 1-2): Shell + Visual Rebrand

- [ ] New color system + Tailwind theme
- [ ] Bottom tab navigation
- [ ] Lobster sprite display (placeholder or first pixel art)
- [ ] Home screen with status cards
- [ ] PWA manifest + basic service worker
- [ ] Mobile viewport optimization

### Phase 2 (Week 3-4): Core Gameplay

- [ ] Task mining full flow (preview → confirm → execute → result)
- [ ] PK arena full flow (browse → strategy → commit → result)
- [ ] Battle Royale full flow (lobby → enter → arena view → result)
- [ ] Pre-execution confirmation panels for all actions
- [ ] Result animations (counter roll, XP bar, radar flash)

### Phase 3 (Week 5-6): BYOK + Memory

- [ ] Settings: API key input + encrypted storage
- [ ] /api/ai/chat CORS proxy route
- [ ] AI suggestions on task/PK/BR screens
- [ ] Diary view with CML visualization
- [ ] SLEEP flow: prompt build → model call → CML save
- [ ] Conversation with lobster (CML-injected context)

### Phase 4 (Week 7-8): Runner Integration + Polish

- [ ] Runner proxy log display
- [ ] On-chain proof viewer (reasoning CID, action receipt)
- [ ] Runner vs BYOK memory distinction (🤖 vs 🧑 icons)
- [ ] Growth timeline
- [ ] Push notifications (longing, BR, PK result, runner action)
- [ ] Shelter-themed accents per NFA origin
- [ ] Claworld economy dashboard

### Phase 5 (Week 9+): Refinement

- [ ] Terminal mode toggle for power users
- [ ] Social features (public CML summaries, leaderboard)
- [ ] CML export/verify tools
- [ ] Greenfield backup integration in settings
- [ ] Onboarding flow for new users (no NFA yet)

---

## 11. File Structure (New Frontend)

```
frontend/src/
├── app/
│   ├── layout.tsx              Global shell + bottom tabs + lobster view
│   ├── page.tsx                Home (status + suggestions + proxy log)
│   ├── play/
│   │   └── page.tsx            Task mining
│   ├── arena/
│   │   ├── page.tsx            PK + BR hub
│   │   ├── pk/[matchId]/       PK match flow
│   │   └── br/[matchId]/       BR match flow
│   ├── diary/
│   │   ├── page.tsx            CML diary view
│   │   └── chat/page.tsx       Conversation (BYOK)
│   ├── settings/
│   │   └── page.tsx            All settings
│   ├── timeline/
│   │   └── page.tsx            Growth timeline
│   └── api/
│       ├── ai/chat/route.ts    BYOK CORS proxy (NEW)
│       ├── pk/auto-reveal/     (KEEP)
│       ├── autonomy/directive/ (KEEP)
│       └── agents/[id]/        (KEEP or deprecate)
├── components/
│   ├── lobster/
│   │   ├── LobsterSprite.tsx   Pixel sprite + animations
│   │   ├── LobsterStatus.tsx   Stats bars + personality radar
│   │   └── LobsterGreeting.tsx CML-driven opening line
│   ├── game/
│   │   ├── TaskCard.tsx        Task option with match %
│   │   ├── PKMatchCard.tsx     PK match listing
│   │   ├── BRLobbyCard.tsx     BR match overview
│   │   ├── ConfirmSheet.tsx    Pre-execution bottom sheet
│   │   └── ResultOverlay.tsx   Reward animation overlay
│   ├── memory/
│   │   ├── DiaryEntry.tsx      Single CML memory card
│   │   ├── SedimentList.tsx    Collapsed old memories
│   │   └── EmotionBar.tsx      Valence/arousal/longing display
│   ├── proxy/
│   │   ├── ProxyLogEntry.tsx   Runner action log item
│   │   └── ReasoningViewer.tsx On-chain CID proof viewer
│   ├── ui/                     shadcn components
│   └── layout/
│       ├── BottomTabs.tsx
│       └── AppShell.tsx
├── lib/
│   ├── cml/
│   │   ├── storage.ts          IndexedDB CML read/write
│   │   ├── sleep.ts            SLEEP prompt builder
│   │   ├── triggers.ts         Keyword matching for recall
│   │   └── longing.ts          Longing calculation
│   ├── ai/
│   │   ├── byok.ts             Key encryption/storage
│   │   ├── chat.ts             Chat API client
│   │   └── suggest.ts          Task/PK/BR suggestion prompts
│   └── chain/
│       ├── contracts.ts        (existing, keep)
│       └── hooks/              (existing wagmi hooks)
└── styles/
    └── theme.ts                Bunker Warmth design tokens
```
