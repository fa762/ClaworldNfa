# Frontend Refactor Plan

Last updated: 2026-04-12 Asia/Singapore

This file is the source of truth for the frontend product rewrite.
If agent or chat context changes, continue from this file together with `CURRENT_HANDOFF.md`.

## Decision

The old frontend direction is no longer the target shape.

We are intentionally moving away from:

- heavy terminal flavor
- text-first landing flow
- explanation-heavy screens
- "read before play" UX

We are intentionally moving toward:

- mobile-first companion-raising dapp
- PWA-ready shell
- asset and action first
- low-text, high-feedback interaction
- game-like presentation with finance-like stability

## Product goal

Clawworld frontend should feel like:

- a pet-raising app
- with autonomous behavior controls
- and lightweight competitive entry points

The first screen should start from the player's assets and available actions, not from lore or documentation.

## Experience principles

1. Mobile first

- primary viewport is phone
- thumb-reachable actions matter more than desktop density
- bottom navigation is preferred over deep top-nav structures

2. Raise before explain

- show the lobster, state, cooldowns, energy, rewards, readiness
- keep explanation behind expandable details
- do not lead with documentation blocks

3. Fewer words, stronger signals

- use status chips, progress bars, timers, readiness states, and previews
- every major action should have immediate visual feedback
- default copy should be short and operational

4. Game feel, financial discipline

- game-like motion and emotional feedback are good
- transaction boundaries, balances, and risk states must stay explicit and stable
- no chaotic layout shifts or decorative noise

5. One primary job per screen

- home: what can I do now
- lobster detail: how is this one progressing
- play: task mining, not a generic action bucket
- battle royale: enter / reveal / claim
- autonomy: bounded control, not protocol essay

## Naming rule

As of 2026-04-12:

- `/play` is the mining surface
- use `挖矿 / Mining / Task Mining` for the task path
- do not describe the task path as generic `行动 / action`
- keep PK, Battle Royale, and Autonomy as separate named loops

## Progress checkpoint - 2026-04-12 session 4

The rebuilt shell has now crossed the minimum product-closure threshold for the main action surfaces:

- `WalletGate` now blocks dead action pages and routes disconnected users into connect-first UX
- Companion now includes an in-shell upkeep/reserve module
- the top stage now reads active companion art from metadata and supports GIF-style assets
- the bottom nav, shell switcher, and roster height were tightened for real phone use
- Home now exposes a real no-NFA empty state
- directive editing now exposes visible remaining-character feedback

This means the rebuild is no longer only a visual shell. The new navigation now contains the minimum owner-path maintenance controls needed to keep a lobster alive and usable without falling back to the old NFA detail screen.

## Progress checkpoint - 2026-04-12 session 5

This pass moved the rewrite from "usable shell" toward "testable product surface":

- core rebuilt pages are now Chinese-first instead of relying on shell chrome only
- wallet-gated pages now expose proper loading and signature states instead of leaving users guessing
- the main transaction surfaces now distinguish:
  - waiting for wallet signature
  - waiting for on-chain confirmation
  - queued / confirmed result
- result panels are now more reward-forward and less clinical
- compact roster and tighter tabs further reduced wasted vertical space on phones
- settings placeholders are now clearly labeled as future controls instead of looking finished

This pass deliberately did not try to normalize the whole legacy `i18n.tsx` file. That file still needs a dedicated cleanup because it carries historical encoding noise. New user-facing copy was stabilized locally on the live product surfaces first.

## Primary app structure

### 1. Home

Purpose:

- immediate overview of the active lobster
- strongest next actions
- current rewards, cooldown, and pending claims

Core modules:

- companion summary band
- actionable cards:
  - claim
  - task ready
  - arena event
  - autonomy attention
- portfolio summary:
  - Claworld balance
  - pending rewards
  - upkeep / net trend

### 2. Companion

Purpose:

- make one lobster feel alive and manageable

Core modules:

- identity block with level, origin, warmth, and stance
- trait meters
- wallet and in-game balances
- core loop row:
  - task mining
  - PK
  - battle royale
  - autonomy

### 3. Arena

Purpose:

- enter quickly
- understand match state quickly
- reveal / claim without hunting through logs

Core modules:

- current match state
- PK and Battle Royale action cards
- field readout
- result / claim entry points

### 4. Autonomy

Purpose:

- control behavior with confidence

Core modules:

- enable / disable state
- policy summary
- budget and limits
- directive editor
- recent autonomous actions

### 5. Settings

Purpose:

- keep utility controls calm and separate from the main loop

Core modules:

- wallet
- BYOK
- notifications
- advanced settings later

## Visual direction

The new visual direction should not inherit the current terminal-heavy identity as the main product shell.

Target tone:

- clean
- tactile
- character-centered
- warm but controlled

Avoid:

- long green-on-black reading surfaces as the default
- oversized lore blocks on core paths
- dashboard clutter
- decorative CRT treatment on every screen
- card-inside-card layering
- oversized soft corners that make the app feel mushy

Use instead:

- strong character panels
- compact status surfaces
- persistent bottom nav
- stable cards with short labels
- restrained motion for feedback
- clearer ready / waiting / safe / risky states

## PWA requirements

This rewrite should assume PWA support as a first-class target.

Minimum expectations:

- installable shell
- stable mobile viewport behavior
- touch-friendly action sizes
- fast return to last-used screen
- no critical flow blocked by desktop-only interaction patterns

## Rewrite constraints

Do not change:

- on-chain semantics
- contract interfaces
- autonomy flow boundaries
- existing backend/runtime behavior unless separately tracked

Do change:

- navigation model
- page information hierarchy
- visual language
- component priorities
- copy density

## Delivery phases

### Phase 0: product definition

Output:

- experience principles
- screen map
- component priority order

Status:

- complete

### Phase A: shell and navigation

Deliver:

- visual system
- app shell
- bottom tabs
- home page
- compact lobster presence model

Status:

- in progress

### Phase B: companion-centered management

Deliver:

- companion detail
- growth/status surfaces
- balances and readiness

Status:

- in progress

### Phase C: action UX

Deliver:

- task execution flow
- arena hub
- BattleRoyale entry / claim / result flow
- PK browse / commit / result flow

Status:

- in progress

Current Phase C notes:

- owner-path task mining flow now has a clearer Chinese-first preview -> confirm -> execute -> result loop
- Battle Royale owner claim and autonomy request surfaces now expose clearer intermediate tx states
- PK has meaningful Chinese-first action and result coverage, but still needs a smaller cleanup pass for residual English in deep detail text

### Phase D: autonomy UX

Deliver:

- directive editor
- budget/limit surfaces
- recent autonomous action log
- proof and receipt entry points

Status:

- in progress

Current Phase D notes:

- directive editor and autonomy claim request are now usable in Chinese-first mode
- autonomy UX now better explains bounded control without dumping users into raw receipts first
- the next highest-value step is real mainnet wallet validation on deployed preview/prod, not more speculative UI expansion

## Next execution order

1. Real wallet validation on deployed frontend

- `/play` task mining end-to-end
- `/arena` PK create/join/reveal/settle flows
- `/auto` autonomy claim request and directive save

2. Fix issues discovered from live wallet testing

- gas estimation edge cases
- wallet rejection messaging
- stale refetch / receipt timing issues
- remaining English leaks in PK subflows

3. PWA real-device validation

- install prompt
- standalone launch
- offline fallback
- mobile safe-area behavior

### Phase E: companion layer

Deliver:

- diary UI
- BYOK setup
- optional chat entry
- memory presentation system

Status:

- not started

## MVP scope lock

The first buildable version should include only the parts needed to prove the new product shape.

### MVP includes

- mobile-first shell
- bottom tab navigation
- new home page
- companion detail page
- task flow rewrite
- arena hub rewrite
- BattleRoyale action surface
- autonomy status and directive panel
- PWA manifest and installable shell

### MVP excludes for now

- full BYOK chat
- SLEEP pipeline
- deep diary sediment system
- remote push notification system
- full growth timeline
- terminal mode toggle
- Greenfield backup settings
- social features

## Immediate design rules for implementation

1. The first screen must be playable

- no marketing hero
- no lore-first landing page
- no explanation wall

2. Every major action needs a visible pre-check

- expected reward
- cooldown
- affordability
- gas estimate when relevant

3. Every action result needs an emotional state change

- not just a toast
- use counters, status change, or character reaction

4. Long text goes behind expansion

- details drawer
- advanced mode
- proof viewer

5. The UI should feel calm, not noisy

- no overloaded gradients
- no decorative clutter
- no dashboard wallpaper energy

## Visual priority lock

Visual reboot is not secondary polish.

It is a first-class acceptance criterion.

The rewrite must be judged on:

- instant recognizability
- emotional warmth
- interaction clarity
- strong action affordance
- visible feedback after every important action
- calm, stable composition on mobile

It must not feel like:

- an old terminal with nicer cards
- a dashboard with game labels pasted onto it
- a lore site that also happens to have transactions

The default impression should be:

- "this is my lobster"
- "I know what to do next"
- "the app reacts to me"
- "the state is understandable in seconds"

## Phase A checkpoint

What is already landed in code:

- root shell no longer defaults to the old CRT terminal frame
- new mobile shell and bottom navigation exist
- new primary routes exist:
  - `/`
  - `/play`
  - `/arena`
  - `/auto`
  - `/settings`
  - `/companion`
- the new shell builds successfully

What this checkpoint is for:

- lock the new product skeleton
- prove the app can stop looking like the old product
- create the base surface for the full visual rewrite

## 2026-04-12 visual pass checkpoint

This pass has landed locally and built successfully.

What changed:

- global styling was tightened into a stricter system:
  - darker graphite base
  - restrained amber for primary heat
  - cool-teal reserved for data and bounded states
- interaction geometry was normalized to tighter radii so the app reads more like a product and less like a soft concept mockup
- route surfaces were rebuilt around one hierarchy:
  - summary band first
  - action cards second
  - meter or list feedback third
- old first-pass route classes were removed from the active shell routes

Routes realigned in this pass:

- `/`
- `/play`
- `/arena`
- `/auto`
- `/settings`
- `/companion`

What this pass was intended to solve:

- reduce dashboard clutter
- remove card-inside-card feel
- improve scan speed on mobile
- make the next action more obvious
- make the companion feel central without filling every screen with oversized art

What still needs work:

- the companion is structurally central, but not yet iconic
- action results still need richer feedback states
- Arena and Auto still need stronger mode-specific identity
- page transitions and motion language are still minimal

## 2026-04-12 state-language checkpoint

This follow-up pass also landed locally and built successfully.

What changed:

- route-level shell variants were added so Home / Play / Arena / Auto / Settings / Companion no longer share the exact same top-stage behavior
- the companion stage now takes explicit:
  - variant
  - status label
  - status tone
  - signal chips
- card surfaces now begin to encode product state directly:
  - `ready`
  - `watch`
  - `safe`
  - `warning`

Why this matters:

- the product needs to communicate mood and urgency before the user reads paragraphs
- later real data integration should plug into an existing state system, not invent one from scratch
- route switching should feel like moving between modes, not scrolling through the same dashboard with renamed headings

What is still missing after this pass:

- stronger companion silhouette / hero treatment
- true result-state feedback after action completion
- real on-chain / API-backed modules replacing placeholder values
- richer motion language for success, waiting, and risk

## 2026-04-12 live-data checkpoint

This next pass has also landed locally and built successfully.

What changed:

- a shared active companion snapshot hook was added for the new shell layer
- the shell, Home, and Companion pages now read live frontend contract data when a wallet is connected
- current live reads include:
  - `tokensOfOwner`
  - `getAgentState`
  - `getLobsterState`
  - router Claworld balance
  - daily upkeep
  - task stats
  - PK stats
  - wallet Claworld balance
- if no wallet or no owned lobster is available, the UI now degrades to a controlled demo state instead of showing broken or empty shells

Why this matters:

- the new product shell is no longer only a visual mock
- route headers can now reflect the actual active lobster
- Home and Companion now start to feel like ownership surfaces instead of concept screens

What is still missing after this pass:

- Home still uses some placeholder activity/event copy
- Arena / Auto surfaces still need live event and proof data
- the active lobster selection is still simple first-owned-token logic
- companion hero art still needs a stronger visual identity layer

## 2026-04-12 Arena/Auto live-state checkpoint

This next pass has also landed locally and built successfully.

What changed:

- Arena now reads live Battle Royale contract state:
  - latest open match
  - fallback last match id
  - match info
  - match config
  - match snapshot
- Arena also uses the active lobster's live PK stats instead of fixed example numbers
- Auto now reads live autonomy state for the Battle Royale path:
  - policy state
  - permission readiness
  - action hub ledger totals
  - recent receipts by protocol

Why this matters:

- the main tabs are no longer just conceptual containers
- competition and autonomy now begin to reflect actual chain state
- the app is moving from visual rewrite into productized state surfaces

What is still missing after this pass:

- Arena still needs claimability and participant-specific state
- Auto still needs directive text and last-action detail surfaced more clearly
- Home still needs live pending-claim and recent-receipt modules
- the active lobster selector is still too naive for multi-NFA owners

## 2026-04-12 homepage live-summary checkpoint

This pass has also landed locally and built successfully.

What changed:

- Home now reads live Battle Royale overview data
- Home now reads recent Battle Royale autonomy receipts
- Home summary cards and recent-motion rows now use live shell inputs where available instead of only placeholder copy

Why this matters:

- the first screen now starts to summarize real game and autonomy state
- the product is moving away from static mood boards and toward actionable ownership surfaces

What is still deliberately not done:

- Battle Royale claimability is not shown on Home yet
- the current reason is protocol semantics: participant identity differs between owner and autonomy paths, so a naive claim badge could be wrong
- that view should be added only after participant resolution is surfaced safely in the frontend

## 2026-04-12 selector and participant-resolution checkpoint

This pass has also landed locally and built successfully.

What changed:

- the active companion shell state now lives in a shared provider instead of isolated route-local hook instances
- multi-NFA owners can now cycle the active lobster from the top shell switcher
- the selected lobster is now persisted per wallet in local storage
- Battle Royale participant state is now resolved against both:
  - owner wallet path
  - autonomy participant path
- Home and Arena now only surface Battle Royale entered / claimable state after that dual-path resolution runs

Why this matters:

- multi-NFA ownership is now a real product surface instead of an implicit first-token assumption
- shell, Home, Companion, Arena, and Auto now stay aligned on the same active lobster
- Battle Royale claim surfaces can now avoid false positives caused by mixing owner-path and autonomy-path semantics

What is still missing after this pass:

- the active lobster selector is still a compact shell control, not a full management drawer
- Arena still needs a stronger dedicated claim action surface, not only summary readouts
- Home still needs broader live action modules beyond the Battle Royale summary and autonomy receipt rows

## 2026-04-12 ownership and action-surface checkpoint

This pass has also landed locally and built successfully.

What changed:

- a reusable owned-companion roster now exists and is wired into:
  - `/`
  - `/play`
  - `/arena`
  - `/auto`
  - `/companion`
- multi-NFA switching is now a visible product surface, not only a topbar utility
- roster cards now show per-owned companion summary:
  - token id
  - companion name
  - shelter
  - level
  - reserve
  - active/watch state
- the shell switcher itself now shows companion identity rather than only a bare token number
- Battle Royale now has a dedicated action panel:
  - owner-wallet claim path can submit a direct `claim(matchId)` transaction
  - autonomy-path claims route the user into the autonomy surface instead of pretending the owner wallet can claim them
  - conflict states stay blocked from blind CTA rendering
- Play is no longer fixed mock copy:
  - task cards now derive from the active lobster's live trait mix, level, reserve pressure, and activity state
- Auto now exposes autonomy-side Battle Royale claim readiness directly

Why this matters:

- ownership now feels intentional, especially for wallets with several lobsters
- Battle Royale is no longer just a readout surface; it now starts to expose action boundaries correctly
- task selection now feels tied to the current companion instead of static design filler

What is still missing after this pass:

- owner-path Battle Royale claim now exists, but autonomy claim still needs a first-class operator/request flow in the UI
- Play still needs the final preview / confirm / execute / result transaction loop
- result feedback and motion language are still lighter than the target product standard

## 2026-04-12 autonomy and task-loop checkpoint

This pass has also landed locally and built successfully.

What changed:

- `/auto` now contains a real directive editor inside the rebuilt shell language
- directive editing is no longer trapped inside the old autonomy panel
- `/auto` now also contains a real Battle Royale autonomy-claim request surface:
  - scans recent settled matches instead of only looking at the latest open match
  - resolves claim path across owner wallet and autonomy participant semantics
  - only enables `requestAutonomousAction(...)` when the reward is on the autonomy path and operator boundaries are actually ready
  - decodes the emitted `requestId` after submission
- `/play` now contains the real owner-path task loop:
  - recommendation cards derived from live companion state
  - on-chain preview via `previewTypedTaskOutcome(...)`
  - explicit confirm surface before signing
  - direct `ownerCompleteTypedTask(...)` execution
  - result surface driven by receipt decoding
- task results now distinguish:
  - drift applied
  - drift skipped
  - no drift
- the shared visual system now includes the missing interaction primitives for this loop:
  - input fields
  - state cards
  - detail rows
  - flow tracker
  - confirm sheet
  - result panel

Why this matters:

- the product is no longer only reorganizing information; it now completes real action loops inside the new UX
- autonomy claim handling is now represented as an operator request surface instead of a placeholder redirect
- task execution now feels like a deliberate game action, not a raw contract button

What is still missing after this pass:

- Arena still needs to surface settled-claim routing more explicitly instead of leaving that mostly to Home and Auto
- PK still lacks the same level of transaction polish that Task now has
- the companion still needs a stronger visual identity layer so success and waiting states feel more character-driven

## 2026-04-12 arena-routing and presence checkpoint

This pass has also landed locally and built successfully.

What changed:

- Arena now has a dedicated settled-claim panel instead of relying on summary copy alone
- that panel now:
  - distinguishes direct owner claim from autonomy-path request routing
  - blocks conflicted owner/autonomy path cases
  - gives the user the correct next action from the Arena surface itself
- the global companion stage now carries more identity information:
  - mood label
  - route-aware readouts
  - stronger visual overlays around the companion figure
- Home and Companion now also include explicit presence summaries:
  - mood
  - runway
  - focus or momentum

Why this matters:

- the user should not need to infer settled-claim behavior from secondary text
- the lobster should feel like the primary character across routes, not a static icon pinned beside page copy
- presence, readiness, and motion are starting to read as one language instead of separate widgets

What is still missing after this pass:

- PK still needs the same explicit transaction UX that Task now has
- the companion still needs richer art/state variation beyond one icon-driven silhouette
- action-complete feedback is stronger now, but long-running autonomous outcomes still need a clearer success/waiting language

## 2026-04-12 PK loop and autonomy-feedback checkpoint

This pass has also landed locally and built successfully.

What changed:

- Arena now contains the first full owner-path PK transaction loop inside the rebuilt shell
- `/arena` now includes:
  - open PK match browsing
  - join review and commit flow
  - create review and commit flow
  - local reveal bundle persistence
  - reveal review
  - settle review
  - timeout-cancel review
  - receipt-driven result state
  - recent PK tape with cached settled/cancelled resolution
- PK result handling now also pushes the local reveal bundle through the existing auto-reveal relay path when that route is available
- the global companion stage now varies more clearly by state:
  - warm
  - growth
  - cool
  - alert
- Arena shell mood is no longer static:
  - it now reflects real PK record when the active lobster has settled PK history
- `/auto` now gives long-running autonomy outcomes a clearer operating language:
  - a new "Autonomy pulse" panel summarizes the latest request
  - success / waiting / failed state is visible before reading raw receipt rows
  - latest spend, credit, proof, and failure reason are surfaced in one place

Why this matters:

- PK is no longer the last major competitive action still trapped in placeholder-grade UX
- the user can now stay inside Arena for the whole owner-path PK loop instead of bouncing between summary text and raw contract controls
- autonomy now reads more like a live operating surface and less like a ledger dump
- the companion stage is starting to feel stateful instead of being one repeated silhouette with changing copy

What is still missing after this pass:

- the PK loop still needs live-wallet verification on a real owner path, not only build/runtime correctness
- the companion still needs richer visual state changes than CSS-only mood treatment
- Home and Companion still need more live modules that feel like lived progress rather than summary chrome
- action completion is now clearer for PK and autonomy receipts, but Task and Battle Royale can still gain stronger celebratory/result treatment

## 2026-04-12 PWA shell and action-status checkpoint

This pass has also landed locally and built successfully.

What changed:

- the frontend now has a real PWA baseline instead of only mobile-first layout intent
- new PWA pieces now in code:
  - `manifest.webmanifest`
  - service worker registration from the shared shell
  - `public/sw.js` shell caching
  - `/offline` fallback route
  - live install/offline banner in the app shell
- this means the rebuilt app can now:
  - expose a browser install prompt when supported
  - launch as a standalone shell
  - reopen cached shell routes when the network drops
- Settings copy now treats installability and offline behavior as active shell work, not future placeholder text
- owner-path task execution now exposes an explicit intermediate status panel:
  - sign
  - confirming
  - failed
- autonomy claim request now exposes an explicit intermediate status panel:
  - sign
  - confirming
  - submitted
  - queued
  - failed

Why this matters:

- PWA support is now an implemented shell concern, not just a line item in the plan
- the app can now behave more like a persistent companion surface on mobile instead of a browser tab with nicer styling
- action UX is stronger because the user no longer falls straight from confirm sheets into either silence or a distant result panel

What is still missing after this pass:

- PWA behavior still needs real-device validation for install prompt, standalone launch, and offline reopen
- push notifications are still out of scope for the current MVP
- the companion still needs richer visual state changes than CSS-only stage treatment
- Task and Battle Royale can still use stronger completion feedback after the transaction lands

## Next frontend priority

1. Strengthen companion recognizability

- make the companion the clearest visual anchor on Home and Companion
- build a more distinct warm / cold state language

2. Make Home and Companion feel more emotionally distinct

- Home should feel operational and ready
- Companion should feel personal and alive

3. Introduce clearer feedback states

- ready
- waiting
- success
- warning

4. Start replacing placeholder copy with real action data modules

- real balances
- real readiness
- real event state
- real autonomous action summaries

5. Strengthen the companion as the unmistakable product anchor

- better stage silhouette
- warmer / colder emotional states
- more distinct Home vs Companion identity treatment

6. Expand live data beyond the shell

- Arena event state
- autonomy budget and last action
- pending claims / receipts

7. Replace remaining homepage placeholders with live summaries

- pending claim count
- recent action receipts
- live Battle Royale event summary

8. Extend explicit action UX from Battle Royale into the rest of the app

- real-wallet validation for the new PK preview / commit / result loop
- clearer action completion feedback for long-running autonomy outcomes
- stronger multi-surface consistency between Home / Arena / Auto / Companion

9. Validate the PWA shell on real mobile hardware

- install prompt exposure
- standalone launch behavior
- offline fallback behavior
- shell banner behavior across supported browsers

10. Land language accessibility before deeper polish

- Chinese/English switch must exist in the rebuilt shell
- the default experience for Chinese users should no longer depend on browser translation
- prioritize:
  - shell header
  - bottom tabs
  - Home / Play / Arena / Auto / Settings
  - key action panels

## Deployment note

Current release decision on 2026-04-12:

- ship the rebuilt frontend to `origin/main`
- let Vercel real deployment become the next validation surface
- validate there before starting another large UI pass

## Review-aligned implementation order - 2026-04-12

The next implementation sequence is now explicitly aligned to the reviewed UX backlog.

### P0 status

1. Wallet gates
- complete
- shared `WalletGate` is now mounted on:
  - `/play`
  - `/arena`
  - `/auto`

2. Deposit/upkeep back into the new shell
- complete
- Companion now carries a compact upkeep/reserve panel

### P1 next

3. Finish page-body i18n
- shell-level language switching is not enough
- next pass must cover:
  - Home
  - Play
  - Arena
  - Auto
  - Companion
  - Settings
  - OwnedCompanionRail
  - key action panels

4. Add loading and signature states
- skeletons for companion/live reads
- explicit wallet-signature waiting state before chain confirmation

5. Upgrade completion feedback
- task completion
- claim success
- reward prominence
- short celebratory motion

6. Add accessibility basics
- global `:focus-visible`
- clearer hit targets
- less ambiguous interactive affordance

### P2 after that

8. Stronger companion art/state layer
- actual NFA image
- mood transitions
- stronger living-state feedback

9. Shell polish and consistency
- banner auto-dismiss on small screens
- brand overflow protection
- modal/sheet overflow strategy
- button/verb consistency
- card tone consistency

10. Better empty/loading/retry cases
- no-NFA empty state
- roster loading skeletons
- Arena retry affordance
- directive character counter
- explicit autonomy gate list

### Backup rule

- preserve the old frontend as a fallback path during the rewrite
- do not delete the old product surface until the new one has passed real-environment validation

9. Make the active lobster selector feel intentional

- upgrade the shell switcher into a more legible ownership control
- expose token identity without bloating the header
- keep multi-NFA switching mobile-safe

10. Raise visual feedback quality

- result states that feel earned
- stronger ready / warning / success reactions
- less static page mood after an action is available
- more character-driven companion state changes instead of one fixed silhouette

## 2026-04-12 i18n and mobile-fix checkpoint (session 3)

All commits cherry-picked onto `origin/main`.

What changed:

- shell AppShell now calls `useI18n()` and passes `t` to all copy helpers
- 16 new `mood.*` translation keys added
- EN/中 toggle button added to shell header
- BottomTabs labels are now fully reactive to language changes
- bottom tabs now permanently fixed: shell constrained to `height: 100dvh`, screen to `height: 100%`, `.cw-main` scrolls internally
- global `button { cursor: pointer }` added
- topbar padding tightened for small phones
- switcher label width reduced 120→80px
- ConnectButton ported to `cw-button` classes
- Settings now has a live wallet connect/disconnect panel

What is still missing:

- page body content (task names, descriptions, arena copy, auto copy) remains hardcoded English
- bottom tabs may still scroll on real devices due to `body { overflow: auto }` body scroll fallback
- iOS top safe area not handled
- stage height still large
- companion card layout still squished on small viewports

---

## Known issues — mobile review 2026-04-12 session 3

This section is the canonical issue tracker for frontend mobile problems.
Priority: P0 = blocks core use, P1 = significant gap, P2 = polish.

### P0 — Blocks core UX

**[P0] CompanionStage occupies too much vertical space**

The persistent stage is the largest non-scrollable item above every page.

Measured pixel budget on home (iPhone SE 375×667):
- topbar: ~70px
- stage home (art 154px + readouts 3×44px stacked + meta): ~370px
- tabs: ~84px
- chrome total: ~524px
- scrollable area remaining: ~143px — almost nothing

On inner pages (compact):
- stage compact (art 102px + readouts): ~280px
- chrome total: ~434px
- scrollable area on SE: ~233px — still very tight

Root causes and fix targets:
1. `.cw-stage-art` 154px (home) / 102px (compact) — reduce to 120px / 80px
2. `.cw-stage-readouts` stacks 3 × 44px cards vertically = 148px — change to 3-col horizontal row, ~36px tall
3. `.cw-stage-meta` chips add 50px with margin — reduce margin or collapse on compact mode
4. No collapse option on inner pages — consider hiding readouts entirely on compact stages

**[P0] iOS top safe area not handled**

`env(safe-area-inset-top)` is not applied to `.cw-topbar`.
On iPhones with notch or Dynamic Island, the topbar is partially obscured by the status bar.
Viewport meta has `viewportFit: "cover"` which extends under the notch, making this worse.

Fix target: `.cw-topbar { padding-top: calc(14px + env(safe-area-inset-top)) }`

**[P0] Bottom tabs still follow page scroll**

Root cause: `body { overflow: auto }` is not prevented. If anything causes the body to expand beyond `100dvh`, the entire shell scrolls and tabs leave the screen. The `position: sticky; bottom: 0` on `.cw-tabs` only works within a scroll container — but `.cw-screen { overflow: hidden }` disables sticky. Tabs are just a flex item at the bottom; sticky does nothing useful here.

Fix target:
- remove `position: sticky; bottom: 0` from `.cw-tabs` (redundant in constrained flex column)
- add `overflow: hidden` to `html` and `body` to prevent any fallback body scroll

**[P0] Companion card layout not responsive — content squished to right**

The stage uses `grid-template-columns: 1fr auto` (copy left, art right). Media query at 560px switches to single column. But:
- `.cw-stage-visual` inside the `auto` column uses `grid-template-columns: auto minmax(108px, 132px)` — this can cause the art container to take too much width on small devices
- If the 560px breakpoint does not fire (e.g. browser zoom or viewport calculation issue), the stage art pushes all copy text to the left in a narrow column

Fix target: change `.cw-stage-visual` to `grid-template-columns: auto` or clamp the art width. Add a fallback `max-width: 100%` on `.cw-stage-art`.

### P1 — Significant

**[P1] Page body content is hardcoded English — i18n toggle has no effect on pages**

Language toggle works for shell chrome only. All page content is hardcoded English:
- Play: task titles ("Adventure", "Puzzle", "Crafting"), all detail strings
- Arena: card copy, status labels
- Companion: all static labels
- Auto: all directive/autonomy copy
- OwnedCompanionRail: `title` and `subtitle` props passed as literal English strings at every call site

Fix target: either mark page content as intentionally English for now and document it, or add page-level zh translation keys in next language pass.

**[P1] No wallet gate / connect CTA on action pages**

Play, Arena, Auto show blank/zero data when wallet is not connected. No in-page prompt appears.

Fix target: add a shared `<WalletGate>` wrapper that renders a "connect wallet" CTA panel when `!isConnected`.

**[P1] Deposit/upkeep UI not accessible from new navigation**

Depositing Claworld for upkeep is the most critical maintenance action. It exists only in the old NFA detail page which is outside the new navigation flow. Users with low upkeep runway cannot fix it from the new shell.

Fix target: add a compact deposit/upkeep module to the Companion page or Settings.

**[P1] OwnedCompanionRail adds ~120px to every page for multi-NFA wallets**

When `ownedCount > 1`, the rail renders a full section (title + subtitle + roster) at the top of every page. Combined with the already large stage, scroll area shrinks further.

Fix target: collapse the rail to a single compact row, or move it behind the shell header switcher as an expandable drawer.

### P2 — Polish

**[P2] No skeleton/loading states**

When wallet connects and hooks read, all values show `0` / `--` with no loading indicator.

Fix target: add `isLoading` state to active companion context; show skeleton shimmer in readouts and cards.

**[P2] CompanionStage art is placeholder only**

The 154/102px circle shows a gradient glow but no actual NFT image. Metadata URL reading is not wired.

Fix target: wire `useNFAMetadata(tokenId)` into active companion context, pass `imageUrl` to stage art.

**[P2] PWA offline banner compresses scroll area further**

`PwaStatusBanner` adds ~60-80px to chrome when visible. Combined with stage, scroll area on SE becomes near-zero.

Fix target: auto-dismiss after 8 seconds; add sessionStorage persistence for dismissed state.

**[P2] Brand label too long for 320px screens**

"Lobster Companion" at 1.125rem may overflow on 320px devices. No truncation or overflow protection.

Fix target: add `overflow: hidden; text-overflow: ellipsis` to `.cw-brand` or shorten the label.

**[P2] `cw-shell { overflow: hidden }` will clip future modal/sheet overlays**

Fix target: switch to `overflow: clip` or use a portal root outside `.cw-shell` for modals.

---

## Handoff rule

For this rewrite, every meaningful decision or completed step should be written to:

- `CURRENT_HANDOFF.md` for current state
- `FRONTEND_REFACTOR_PLAN.md` for frontend-specific direction and progress

`AGENT.md` and `CLAUDE.md` remain background context files, not the primary progress log for this rewrite.
