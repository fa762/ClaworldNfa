# Current Handoff

Last updated: 2026-04-13 (session 16) Asia/Singapore

This file is the current source of truth for the autonomy / BattleRoyale / TaskSkill workstream.
If Codex account or chat context changes, start from this file instead of relying on old conversations.

## Frontend reset note

Real-device / real-user testing has invalidated the previous optimistic frontend checkpoints.

## Frontend UX hard rules

These are now hard product rules, not design suggestions.

Default surfaces may only show four classes of information:

1. action name
2. reward / yield
3. condition / blocker
4. current status / result

Default surfaces must not lead with long explanation:

- do not explain principles
- do not explain system design
- do not explain implementation details
- do not explain which reads/hooks the page is performing

One screen should do one primary job:

- Home: asset state and next action
- Mining: choose task -> preview -> confirm
- Arena: choose PK or Battle Royale
- Auto: choose strategy / write prompt / submit
- Settings: real settings only

Long text must move behind secondary affordances:

- advanced notes belong in collapses or drawers
- proof / ledger / operator details belong in advanced sections
- the default view must not read like product documentation

Interaction has priority over copy:

- if it can be a modal or sheet, do not stack it into a long page
- if a card can drive the decision, do not replace it with paragraphs
- if status color, number, and tag are enough, do not add explanatory sentences

Current confirmed UX judgement:

- Home still has too much filler copy
- Companion still has too much filler copy
- Arena still behaves like a long system page
- Auto still behaves like an internal control panel
- the persistent companion stage still carries too much explanatory text

This is not a polish issue. It is the current frontend design baseline.

## Frontend closure checkpoint - 2026-04-13 session 16

This pass was executed against the new UX hard rules and treated the first five frontend reset tasks as one batch.

What is now done:

1. False-zero wallet CLW state is no longer silent
- wallet CLW now distinguishes:
  - loading
  - read failed
  - real balance
- the shell header and Home summary no longer blindly print `0` while the read is unresolved
- upkeep/deposit UI also stops treating a failed wallet CLW read as spendable `0`

2. Shell chrome is compressed
- topbar CTA clutter was removed
- long NFA names no longer drive the topbar width
- the shell switcher now shows compact token-relative identity instead of a long name block
- the persistent companion stage was reduced to:
  - name/title
  - status chip
  - three compact readouts
- explanatory subtitle/signal clutter was removed from the default stage

3. Duplicate roster switching is removed from page bodies
- `OwnedCompanionRail` was removed from:
  - Home
  - Play
  - Arena
  - Auto
- lobster switching is now shell-only

4. Home and Companion are merged
- `/companion` now redirects to `/`
- Home is now the single asset/next-action surface
- the new Home keeps only:
  - wallet / reserve / upkeep / status
  - next actions
  - upkeep panel
  - current result summary

5. Play is rewritten into one action container
- task cards are now the primary surface
- tapping a task opens one modal/sheet flow
- preview, retry, confirm, and execute all stay in the same container
- preview failures no longer fall into a lower page section

Additional simplification completed in the same pass:

- Arena now starts with a mode split:
  - PK
  - Battle Royale
- Auto was reduced toward:
  - strategy / prompt
  - claim request
  - latest result
  - optional advanced details

Verification:

- `npm --prefix frontend run build` passed after this pass

Current remaining focus after session 16:

- real wallet / real device validation on:
  - `/play`
  - `/arena`
  - `/auto`
- continue removing verbose copy inside nested panels/components
- continue converting user-critical screens to pure Chinese-first wording

The current rebuild must now be treated as:

- structurally promising
- partially integrated
- not yet production-usable

The new rule from this point:

- stop counting route presence and build-green status as product completion
- prioritize real usability blockers before any further art or feature expansion
- treat silent zero reads, overcrowded screens, duplicate navigation, and wrong interaction model as P0/P1 product defects

The frontend is now re-baselined around the following blocking problems:

1. wallet / reserve / upkeep / Claworld reads can silently degrade to `0`
2. topbar overflows when the active NFA name is long
3. the persistent companion stage is still too tall and too verbose
4. Home and Companion are partially duplicate surfaces
5. top switcher and roster switcher are duplicated; roster must be removed
6. Play / Arena / Auto still use scroll-heavy page composition where modal/sheet-driven interaction is required
7. Chinese mode is still not pure Chinese-first; too much mixed English remains
8. Settings is still mostly placeholder, not a real control surface

Immediate execution order after this reset:

1. fix false zero reads
2. compress shell chrome
3. remove duplicate roster switching
4. merge Home + Companion
5. rewrite Play to modal/sheet flow
6. split Arena into PK / Battle Royale focused surfaces
7. simplify Auto into strategy/prompt/action/result
8. finish Chinese-first cleanup
9. replace placeholder Settings with real controls
10. only then deepen art/motion

## Current product direction

The next major workstream is a frontend product rewrite.

Decision taken:

- stop treating the frontend as a text-heavy terminal-first shell
- rebuild the product as a mobile-first养成 dapp
- prioritize asset management, action readiness, and interaction feel over explanatory copy
- keep protocol and backend semantics stable while replacing the frontend structure

The dedicated frontend source-of-truth file is:

- `FRONTEND_REFACTOR_PLAN.md`

Use both files together:

- `CURRENT_HANDOFF.md` for latest status and cross-workstream state
- `FRONTEND_REFACTOR_PLAN.md` for frontend product direction, IA, and phased rollout

Important documentation rule for future turns:

- do not use `AGENT.md` or `CLAUDE.md` as the primary progress log for the rewrite
- keep new frontend progress written into the two files above

Frontend plan review on 2026-04-12:

- the larger PWA rebuild proposal is accepted as product vision
- implementation should not attempt full BYOK + diary + push + runner-memory sync in the first pass
- MVP should start from:
  - shell
  - bottom tabs
  - home
  - lobster detail
  - task / arena / autonomy action surfaces
- companion depth features should land only after the new core UX is stable

Frontend checkpoint on 2026-04-12:

- local Phase A shell scaffold is now in code
- root frontend no longer defaults to the old terminal frame
- new local routes now exist for:
  - home
  - play
  - arena
  - auto
  - settings
  - companion
- frontend production build passed after the shell rewrite

Frontend naming checkpoint on 2026-04-12:

- the `/play` route should now be described as `挖矿 / Mining`, not as a generic action surface
- the shell tab label is now `挖矿 / Mining`
- the shell route label is now `任务挖矿 / Task Mining`
- Companion no longer uses the misleading `Action row` wording for the multi-loop section
- use `挖矿 / Mining` only for the task path; keep PK / Battle Royale / Autonomy named separately

Frontend shell-closure checkpoint on 2026-04-12:

- action pages now have a shared wallet gate
  - `/play`
  - `/arena`
  - `/auto`
- disconnected users no longer fall into blank zero-state action panels
- wallets with no NFA now get an explicit mint-first path instead of dead surfaces
- Companion now includes a real upkeep / reserve panel inside the rebuilt shell
  - direct CLW deposit
  - quick buy+deposit
  - on-shell `processUpkeep`
- the top companion stage now reads metadata-backed art instead of a fixed placeholder only
- stage art is now GIF-ready because the shell stage uses a regular image tag instead of a static-only image path
- mobile shell chrome was tightened again:
  - bottom tabs reduced in height
  - shell switcher tap targets enlarged
  - stage no longer biases visual content to the right on narrow screens
  - owned-companion rail is now compact by default
- Home now has a true no-NFA empty state instead of silently staying in demo posture
- Autonomy directive editing now shows a visible character counter
- frontend production build passed again after this shell-closure pass

Frontend function-first checkpoint on 2026-04-13:

- Arena now has an in-page Battle Royale refresh path instead of forcing a full page reload when reads fail
- `useBattleRoyaleOverview` now exposes:
  - `refresh`
  - `isRefreshing`
  - `hasError`
  - `errorText`
- Auto now lists the exact autonomy permission gates instead of hiding readiness behind a single aggregate meter:
  - protocol approval
  - adapter approval
  - operator approval
  - delegation lease
- the Battle Royale autonomy claim-request panel now names missing permission gates directly before signing
- `PKArenaPanel` has been cleaned from the biggest remaining user-facing technical wording leaks:
  - raw action enums no longer surface directly in confirm/result cards
  - recent tape lines no longer mix English nouns like `stake / winner / reward / cancelled`
  - `commit / reveal / salt / relay / timeout` copy has been rewritten into user-facing Chinese-first wording on the key PK surfaces
  - confirm/result CTAs now read as steps in the flow rather than raw protocol verbs
- frontend production build passed again after the Arena/Auto/PK wording cleanup

Frontend loading-state checkpoint on 2026-04-13:

- the active-companion loading state is now surfaced through the rebuilt shell instead of showing zero-like placeholder values first
- `CompanionStage` now supports a real loading skeleton:
  - stage copy
  - status chip
  - signal chips
  - readout blocks
- the shell switcher now reflects loading state and blocks roster cycling while the active companion snapshot is still syncing
- Home now uses skeleton sections for:
  - summary band
  - next-move cards
  - companion state panel
  - Battle Royale action surface
  - recent motion list
- Companion now uses skeleton sections for:
  - headline band
  - identity panel
  - presence panel
  - trait panel
  - upkeep panel
  - core-loop cards
- frontend production build passed again after the shell/home/companion loading pass

Frontend action-page loading checkpoint on 2026-04-13:

- Play no longer drops straight to `-- / no preview yet` while task preview reads are still in flight
  - the preview panel now renders as a skeleton while TaskSkill preview + cooldown reads are loading
- Arena now separates PK and Battle Royale loading surfaces
  - the PK surface stays available
  - Battle Royale summary, refresh helper, action surface, and field-read modules now skeleton while BR reads are still loading
- Auto now exposes route-level skeletons while autonomy setup / proof / BR-claim state is still syncing
  - top summary cards
  - permission gates
  - pulse/ledger blocks
  no longer flash partial empty values first
- frontend production build passed again after the Play/Arena/Auto loading pass

Frontend signing-feedback checkpoint on 2026-04-13:

- Play confirm sheet now gives an explicit wallet-step hint while waiting for signature
  - tells the user to go to the wallet and keep the page open
  - distinguishes that from the later on-chain receipt wait
- PK confirm sheet now gives the same explicit wallet-step vs receipt-step guidance
- Battle Royale autonomy claim request now gives the same explicit guidance:
  - confirm in wallet first
  - then wait for the request-id receipt decode on-chain
- several remaining user-facing wording leaks were cleaned in the same pass:
  - `owner` -> `持有人`
  - prompt preview chip no longer shows raw English only
  - Play bottom gas summary is now Chinese-first
- frontend production build passed again after the signing-feedback pass

Frontend read-recovery checkpoint on 2026-04-13:

- `useAutonomyActionSetup()` now exposes:
  - `error`
  - `isRefreshing`
  - `refresh()`
- `useAutonomyProofs()` now exposes:
  - `error`
  - `isRefreshing`
  - `refresh()`
- Auto no longer lets failed autonomy reads silently degrade into fake empty state
  - autonomy setup / proof / Battle Royale overview / settled-claim scan errors are now surfaced in-page
  - the page now provides a direct `重新读取` recovery action instead of forcing a full reload
- the settled-claim scan hook now also supports manual refresh, so Auto recovery can re-run the claim-window read instead of only re-reading the summary hooks
- Play preview now exposes an explicit retry path when preview/cooldown/gas-estimate reads fail
  - preview failure
  - cooldown-read failure
  - gas-estimate failure
  now keep the page on the same surface and offer `重新读取预览`
- frontend production build passed again after the read-recovery pass:
  - `npm --prefix frontend run build`

Frontend PK recovery checkpoint on 2026-04-13:

- `PKArenaPanel` no longer hides read/action failures as tiny footer text only
- Arena now gives PK its own in-page recovery panel when:
  - recent match reads fail
  - local PK action submission fails
- the recovery panel now includes:
  - visible error list
  - direct `重新读取对局` action
- raw fallback action labels are also no longer allowed to fall back to internal enum strings
- frontend production build passed again after the PK recovery pass:
  - `npm --prefix frontend run build`

Frontend visual checkpoint on 2026-04-12:

- second-pass visual alignment is now in code
- global shell styling was tightened to a calmer graphite / amber / cool-teal system
- oversized first-pass radii were removed in favor of tighter 8px interaction geometry
- Home, Play, Arena, Auto, Settings, and Companion now share one route-level grammar:
  - top summary band
  - single-layer action cards
  - explicit scores / readiness labels
  - meter-based state feedback
- this pass was about scan order and action clarity, not feature count
- frontend production build passed again after the route-level visual pass

Frontend state-language checkpoint on 2026-04-12:

- shell now carries route-specific visual variants for:
  - home
  - play
  - arena
  - auto
  - settings
  - companion
- the top companion stage now exposes explicit status tone and signal chips instead of repeating the same neutral header on every route
- route accents now shift by mode so the app no longer feels like one static skin with different text
- card states now start to encode:
  - ready
  - watch
  - safe
  - warning
- the goal of this pass was to make the next action and route mood legible before real data modules replace placeholders
- frontend production build passed again after the route-variant and state-language pass

Frontend live-data checkpoint on 2026-04-12:

- a new active companion snapshot hook now exists in the frontend shell layer
- the shell, Home, and Companion pages now read from existing frontend contract hooks instead of staying fully placeholder-driven
- current live reads now include:
  - owned token list for the connected wallet
  - active lobster token id
  - lobster state
  - agent state
  - router Claworld balance
  - daily upkeep
  - task stats
  - PK stats
  - wallet Claworld balance
- if no wallet or no owned lobster is present, the shell now falls back gracefully to a demo companion state instead of breaking the UI
- this means the product shell now starts from live ownership and live state where available, rather than only visual mock values
- frontend production build passed again after the live-data pass

Frontend Arena/Auto live-state checkpoint on 2026-04-12:

- Arena now reads live Battle Royale contract state instead of only fixed placeholder copy
- the new Arena live read currently pulls:
  - `latestOpenMatch`
  - `matchCount`
  - `getMatchInfo`
  - `getMatchConfig`
  - `getMatchSnapshot`
- Arena also now reflects the active lobster's live PK history from the existing frontend stats hook
- Auto now reads live autonomy state for the Battle Royale path instead of only static placeholder cards
- the new Auto live read currently pulls:
  - autonomy policy state
  - protocol / adapter / operator / lease readiness
  - action-hub ledger totals
  - recent receipts by protocol
- this means the main navigation tabs now start to expose real competition and autonomy state, not only design-shell structure
- frontend production build passed again after the Arena/Auto live-state pass

Frontend homepage live-summary checkpoint on 2026-04-12:

- the homepage no longer relies only on placeholder activity copy
- Home now pulls live summary inputs from:
  - active companion snapshot
  - Battle Royale overview
  - recent Battle Royale autonomy receipts
- this means the homepage now exposes:
  - live Battle Royale match summary when available
  - latest autonomy receipt summary when available
  - live reserve / upkeep / wallet balance context
- claimability was intentionally not forced into Home yet because Battle Royale participant semantics still differ across owner and autonomy paths, and the UI should not guess wrong
- frontend production build passed again after the homepage live-summary pass

Frontend selector/claim-resolution checkpoint on 2026-04-12:

- active companion state is no longer locked to the first owned token
- `ActiveCompanionProvider` now wraps the app shell, so shell and route surfaces read one shared selected NFA
- active companion selection now:
  - cycles across all owned NFAs
  - persists per wallet in local storage
  - falls back safely when the wallet owns none
- Battle Royale participant state is now resolved across both:
  - owner wallet path
  - autonomy participant path
- Home and Arena now use that resolution before surfacing:
  - entered state
  - claimable amount
  - conflict warning if both paths look populated
- this removes the previous single-path assumption that could misstate Battle Royale claimability
- frontend production build passed again after the selector and participant-resolution pass

Frontend ownership/action-surface checkpoint on 2026-04-12:

- owned companion management is no longer only a tiny shell switcher
- a reusable owned-companion roster now exists and is wired into:
  - Home
  - Play
  - Arena
  - Auto
  - Companion
- roster cards now expose per-owned-NFA:
  - token id
  - name
  - shelter
  - level
  - reserve
  - active/watch state
- the shell switcher itself now shows companion name and wallet-relative position instead of only a bare token number
- Battle Royale now has a dedicated action surface instead of only summary text
- that action surface now distinguishes:
  - owner-wallet claim path with direct on-chain `claim(matchId)` submission
  - autonomy participant claim path with redirect to the autonomy surface
  - conflict states where no blind claim CTA should be shown
- Play is no longer fixed mock copy only:
  - task recommendations now derive from the active lobster's traits, level, reserve pressure, and activity state
- Auto now surfaces autonomy-side Battle Royale claim readiness directly
- frontend production build passed again after the ownership and action-surface pass

Frontend autonomy/task-loop checkpoint on 2026-04-12:

- Auto is no longer only a live-read status page
- the rebuilt Auto surface now includes:
  - signed directive editing inside the new shell language
  - settled Battle Royale claim scanning across recent matches instead of only the latest open match
  - a real owner-submitted `requestAutonomousAction(...)` UI for Battle Royale autonomy claims
  - request tx hash and decoded `requestId` feedback after submission
- Play is no longer only a recommendation page
- the rebuilt Play surface now includes a real owner-path task loop:
  - live task recommendation cards
  - on-chain `previewTypedTaskOutcome(...)`
  - confirm surface before signing
  - `ownerCompleteTypedTask(...)` submission
  - result state driven by receipt decoding
- task result handling now also distinguishes:
  - drift applied
  - drift skipped
  - no drift
- global frontend styling now includes the support surfaces needed for this loop:
  - field/input styling
  - state grids
  - detail rows
  - flow progress strip
- confirm sheet
- result panel
- frontend production build passed again after this autonomy/task-loop pass

Frontend arena-routing/presence checkpoint on 2026-04-12:

- Arena no longer stops at showing claimability in summary text
- the rebuilt Arena surface now includes a dedicated settled-claim panel that:
  - distinguishes owner-wallet claim vs autonomy request path
  - blocks conflicted dual-path cases
  - allows direct owner claim from Arena when the settled reward is on the owner path
  - routes autonomy-path settled rewards toward the operator/request surface
- Companion presence is now stronger in the global shell:
  - the top stage now carries mood, route-aware readouts, and more character-centered visual overlays
  - shell state is no longer only title + subtitle + icon
- Home and Companion now also expose explicit presence summaries:
  - mood
  - runway
  - immediate focus / momentum
- this pass was about making the lobster feel more like the product anchor while keeping action routing legible

Frontend UX pass 2 checkpoint on 2026-04-12:

- the rebuilt frontend is now Chinese-first across the main live surfaces instead of remaining shell-only localized
- the following pages/components were rewritten or heavily reworked in this pass:
  - `Home`
  - `Arena`
  - `Auto`
  - `Companion`
  - `Settings`
  - `WalletGate`
  - `BattleRoyaleActionPanel`
  - `BattleRoyaleClaimPanel`
  - `AutonomyClaimRequestPanel`
  - `AutonomyDirectivePanel`
  - `PKArenaPanel`
  - `OwnedCompanionRail`
- wallet-dependent pages now expose clearer intermediate states:
  - loading skeleton gate while ownership / reserve reads resolve
  - explicit wallet-signature waiting state before tx hash exists
  - explicit chain-confirming state after submission
- result feedback is now stronger on the rebuilt owner-path loops:
  - task result panel promotes reward amount visually
  - Battle Royale owner claim success is no longer phrased as a cold technical log line
  - autonomy request and directive save paths now expose success / queued language more clearly
- roster and shell density were tightened again:
  - compact owned roster toolbar
  - narrower roster cards
  - lower bottom-tab height
  - slightly smaller bottom safe area consumption
- Settings no longer presents roadmap cards as if they were finished controls:
  - BYOK and notification surfaces are now clearly marked as coming soon
- frontend production build passed after this UX pass:
  - `npm --prefix frontend run build`

Remaining high-value frontend gaps after this checkpoint:

- real wallet verification still needs to be run on:
  - `/play`
  - `/arena`
  - `/auto`
- `PKArenaPanel` still has some secondary English fallback copy in deep detail rows and recent-tape lines
- the global translation layer (`frontend/src/lib/i18n.tsx`) still contains legacy encoding noise and should be normalized in a dedicated cleanup pass instead of being touched opportunistically
- PWA install / standalone / offline behavior still needs real-device validation on a deployed HTTPS environment
- frontend production build passed again after the arena-routing and presence pass

Frontend PWA bottom-tab checkpoint on 2026-04-13:

- the rebuilt shell bottom navigation now uses one shared set of tab-height and safe-area variables instead of mixing a fixed content height with an unbounded `env(safe-area-inset-bottom)` add-on
- the main content area bottom padding is now derived from the same tab-shell height variable, so page content and bottom nav no longer drift apart between browser mode and standalone PWA mode
- on narrow/mobile viewports the bottom safe-area allowance is now capped tighter, which should stop the standalone PWA build from showing an oversized bottom slab while still keeping the nav clear of the system gesture area
- this pass is a mobile-stability fix, not an art pass

Frontend function-first checkpoint on 2026-04-13:

- Arena now exposes an in-page Battle Royale refresh surface instead of leaving the user at a dead "waiting for match data" state
- `useBattleRoyaleOverview()` now exposes:
  - refresh
  - refetching state
  - read-error visibility
- Auto no longer hides autonomy readiness behind a single percentage bar
- the Battle Royale autonomy path now lists the four concrete gates directly:
  - protocol approval
  - adapter approval
  - operator approval
  - delegation lease
- the autonomy claim-request panel now surfaces missing permissions by name instead of only saying `x/4 ready`
- frontend production build passed again after this function-first pass:
  - `npm --prefix frontend run build`

Frontend PK/autonomy-feedback checkpoint on 2026-04-12:

- Arena now contains a first-class owner-path PK transaction surface instead of only PK summary text
- the new PK surface in `/arena` now includes:
  - open match browsing
  - create match flow
  - join match flow
  - local commit/salt handling
  - reveal review
  - settle review
  - timeout cancel review
  - receipt-driven result state
  - recent PK tape with cached settled/cancelled resolution
- PK result handling now also forwards local reveal material into the existing auto-reveal relay path when available
- the global companion stage now varies more clearly by mood and route state:
  - warm
  - growth
  - cool
  - alert
- Arena route state is no longer hardcoded to a fixed header mood:
  - it now reflects real PK record when recent wins/losses exist
- Auto now has a stronger autonomy outcome surface:
  - a new "Autonomy pulse" panel makes the latest request readable as success / waiting / failed state
  - latest spend, credit, proof, and failure reason are now surfaced before the user has to read raw receipt rows
- frontend production build passed again after the PK and autonomy-feedback pass

Frontend PWA/action-feedback checkpoint on 2026-04-12:

- the frontend now has a real PWA shell baseline instead of only mobile styling
- new PWA pieces now in code:
  - `manifest.webmanifest`
  - production service worker registration
  - shell caching via `public/sw.js`
  - offline fallback route at `/offline`
  - live install/offline banner in the shared app shell
- this means the rebuilt frontend now supports:
  - install prompt when the browser exposes it
  - standalone shell metadata
  - cached reopen path when the network drops
- Settings copy now reflects that installability/offline shell control has started, instead of still treating it as future work
- owner-path task execution now has a clearer "Task pulse" state:
  - sign
  - confirming
  - failed
- autonomy claim request now has a matching "Request pulse" state:
  - sign
  - confirming
  - submitted
  - queued
  - failed
- frontend production build passed again after the PWA and action-feedback pass

New priority locked after product discussion:

- visual overhaul is now a first-class requirement
- UX, recognizability, emotional response, and action clarity take priority over feature breadth
- future frontend iterations should be judged by user feel first, not by how many panels were moved over

Frontend i18n checkpoint on 2026-04-12 (session 2):

- `frontend/src/lib/i18n.tsx` has been substantially expanded
- zh/en coverage now includes:
  - all new shell/bottom-nav routes (Play, Arena, Auto, Settings, Companion)
  - companion stage labels and selector controls
  - PWA install/offline banner copy
  - status chips and state labels used across the shell
  - reserve, runway, upkeep, wallet, PK, loop, and readiness labels
- auto-detect browser language on first load, localStorage persistence on change
- in-app language toggle is now wired (shell.switchToEnglish / shell.switchToChinese keys)
- committed as: feat: expand i18n for rebuilt shell routes

Frontend i18n + mobile-fix checkpoint on 2026-04-12 (session 3):

- AppShell now calls `useI18n()`, passes `t` into `getShellCopy()` and `getCompanionMood()`
- 16 new `mood.*` translation keys added (dormant / searching / hungry / firedUp / bounded / etc.)
- EN/中 toggle button added to shell header with aria-label
- BottomTabs tabs array moved inside component so labels react to language changes
- Bottom tabs now permanently visible: `.cw-shell` changed to `height: 100dvh; overflow: hidden`, `.cw-screen` to `height: 100%` — this constrains the screen to viewport height so `.cw-main` scrolls internally and tabs do not get pushed off screen
- Global `button { cursor: pointer }` added
- Topbar gap/padding tightened to reduce overflow on 375px phones
- `cw-switcher-label` min-width reduced 120→80px
- `ConnectButton` ported from old `term-btn` classes to `cw-button` classes
- Settings page now has a live wallet connect/disconnect panel instead of 3 static info cards
- All 4 commits cherry-picked onto `origin/main` and pushed (fast-forward from `04ef1ea`)

## Mobile frontend review — open issues as of 2026-04-12 session 3

This section captures all issues discovered during the mobile review pass.
Reviewed every page component, layout component, game component, and the global stylesheet.
Priority: P0 = blocks core use, P1 = significant gap, P2 = polish.
Status: FIXED means committed to origin/main. OPEN means still needs work.

### P0 — Blocks core UX

**[P0] CompanionStage occupies too much vertical space — FIXED (86b0af5)**

Art 154→120px, 102→80px. Readouts changed from stacked column to 3-col horizontal grid. Meta margin reduced.

**[P0] iOS top safe area not handled — FIXED (86b0af5)**

`env(safe-area-inset-top)` added to `.cw-topbar`.

**[P0] Bottom tabs follow page scroll — FIXED (86b0af5)**

`html/body { overflow: hidden }`, sticky removed from tabs.

**[P0] Companion card layout squished to right on small screens — FIXED (86b0af5)**

`.cw-stage-visual` changed from rigid 2-col grid to column flex.

**[P0-OPEN] No wallet gate on action pages**

Play, Arena, Auto all show blank/zero panels when wallet not connected. No in-page "connect wallet" CTA appears. Users who land on these pages see dead data with no explanation.

Fix: add a shared `<WalletGate>` component that wraps action pages and renders a connect prompt when `!isConnected`.

**[P0-OPEN] Deposit/upkeep UI missing from new navigation**

The single most critical maintenance action (depositing Claworld for upkeep) only exists in the old NFA detail page, which is outside the new 5-tab navigation. Users whose lobster runs out of upkeep have no way to fix it.

Fix: add a compact deposit/upkeep module to Companion page or as a new section in Settings.

### P1 — Significant UX gaps

**[P1] i18n coverage — shell done, page body content still hardcoded English**

The language toggle works for shell chrome (topbar, stage, tabs, mood labels) but all page content is hardcoded English. Full inventory:

- `page.tsx` (Home): `receiptStatusText()`, `matchStatusText()`, card titles/subtitles/details, presence card labels, trait labels, "Recent motion" items
- `play/page.tsx`: error messages (6 hardcoded), task template titles ("Adventure", "Puzzle", "Crafting"), all detail/description strings, flow step labels, section headers, button labels ("Review before execute", "Execute task", "Continue")
- `arena/page.tsx`: `getMatchStatusText()`, card titles, section headers, field-read labels, meter labels
- `auto/page.tsx`: `receiptStatusText()`, `receiptSummary()`, all panel headers, permission readiness labels, ledger labels
- `companion/page.tsx`: presence card labels ("Mood", "Runway", "Momentum"), trait labels ("Courage", "Wisdom", etc.), action row labels, readout panel text
- `settings/page.tsx`: BYOK card copy, Notifications card copy
- `OwnedCompanionRail.tsx`: default title/subtitle props hardcoded English at every call site
- `PKArenaPanel.tsx`: all match labels, status strings, button text
- `BattleRoyaleActionPanel.tsx`: `matchStatusText()`, all headline and detail logic
- `BattleRoyaleClaimPanel.tsx`: all labels and status strings
- `AutonomyDirectivePanel.tsx`: heading, form labels, select options
- `AutonomyClaimRequestPanel.tsx`: all labels, blocker messages, prompt text
- `PwaStatusBanner.tsx`: banner titles use `t()` keys but not all detail text
- `useActiveCompanion.tsx`: `describeStance()` generates hardcoded English prose; `getSource()` returns hardcoded English labels

Fix: add page-level translation keys in a dedicated i18n pass.

**[P1] OwnedCompanionRail consumes ~120px on every page for multi-NFA wallets**

When `ownedCount > 1`, the rail renders a full section (title + subtitle + horizontal roster) at the top of every page. Combined with stage, scroll area shrinks further.

Fix: collapse the rail to a single compact row or move it behind the shell switcher as an expandable drawer.

**[P1] No loading / skeleton state anywhere**

When wallet connects and hooks begin reading, all values show `0` / `--` / blank with no loading indicator. Creates a jarring flash-of-empty before data populates. Affects: CompanionStage, all pages, all action panels, roster cards.

Fix: add `isLoading` to active companion context; show skeleton shimmer in stage readouts, page cards, and action panels while loading.

**[P1] Transaction signing gives no wallet-state feedback**

When user clicks "Execute task" or "Claim", the wallet app opens in the background. The UI shows "Sign" or "Confirming" chip, but:
- No indication that MetaMask/TrustWallet is waiting for user signature
- No timer or progress indicator during confirmation
- User cannot distinguish "wallet not opened yet" from "waiting for chain confirmation"

Fix: add a dedicated "Waiting for wallet signature..." state between button press and `isPending` resolution, with a hint to check the wallet app.

**[P1] Task/claim completion doesn't feel rewarding**

Result panels are purely informational. After completing a task:
- `play/page.tsx`: result panel shows numbers (reward, XP, match score) in muted grey. "Continue" button dismisses it. No animation, no celebration, no emotional payoff.
- `BattleRoyaleClaimPanel.tsx`: success message says "Owner claim confirmed. The settled-match summary will catch up..." — confusing and clinical.

Fix: add a brief success animation (scale-up, glow pulse, or confetti particle). Make the reward number prominent and colored. Replace "Continue" with something warmer. Make claim success celebrate the win.

**[P1] No focus/active styles for keyboard and screen reader users**

Global CSS has no `:focus-visible` rules. Interactive elements (buttons, links, cards) have no visible focus ring. Affects all pages.

Fix: add a global `:focus-visible` outline style to globals.css.

### P2 — Polish and interaction quality

**[P2] CompanionStage art is placeholder only**

The 120px/80px circle (post-fix) renders a gradient glow but no actual lobster NFT image. Metadata URL reading is not wired.

Fix: wire `useNFAMetadata(tokenId)` into active companion context and pass `imageUrl` to stage art.

**[P2] Companion mood badge is static**

The mood badge on CompanionStage doesn't animate or transition when mood changes. Feels dead. A subtle pulse or fade-transition would make the companion feel alive.

**[P2] PWA offline banner compresses scroll area further**

PwaStatusBanner adds ~60-80px when visible. On SE-size phones scroll area can drop near zero.

Fix: auto-dismiss after 8 seconds on small screens; persist dismissed state in sessionStorage.

**[P2] Brand label "Lobster Companion" too long for 320px screens**

At 1.125rem the label may overflow. No CSS overflow protection exists.

Fix: add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to `.cw-brand`, or shorten label.

**[P2] `cw-shell { overflow: hidden }` will clip future modals/sheets**

Fix: use portal roots outside `.cw-shell` for modals, or switch to `overflow: clip`.

**[P2] Settings page shows roadmap items as if they're controls**

BYOK and Notifications cards look like interactive settings but are actually future-work placeholders. Users may tap expecting controls and find nothing.

Fix: either hide placeholder cards or add a "Coming soon" badge and dim tone.

**[P2] Confirm sheet in Play has no back affordance**

The play confirm→execute→result flow feels like a one-way funnel. No breadcrumb or "go back to task list" affordance. Users might feel trapped.

Fix: add a visible "Back to tasks" or "Cancel" link that is always reachable, including during sign/confirm states.

**[P2] Arena cards are static but look tappable**

Arena page `cw-card-stack` renders `<article>` elements with hover effects but no `onClick` or link — users see the pointer cursor (from global button rule) on card hover but nothing happens.

Fix: either make cards navigate to relevant detail sections, or remove hover effect and add `cursor: default`.

**[P2] Signal chips can render unstyled**

`CompanionStage.tsx` calls `toneClass(tone)` where `tone` can be `undefined`. Returns empty string, creating a chip with no color treatment — appears as grey ghost chip without semantic meaning.

Fix: default to `'cool'` when tone is undefined.

**[P2] Switcher arrows (ChevronLeft/ChevronRight) are 26×26px — below WCAG 44×44px minimum**

On real phones these are hard to tap accurately.

Fix: increase `.cw-switcher-btn` to at least 36×36px or add larger touch padding.

**[P2] Language toggle button (EN/中) is small and unclear**

The 2-char text button in the header has no icon, no border context, and could be mistaken for a label. Users who don't expect a language toggle may never find it.

Fix: add a Globe icon from lucide next to the text, or use a slightly larger pill shape with border.

**[P2] Roster fallback shows "Loading..." as interactive buttons**

`OwnedCompanionRail.tsx` renders fallback cards with "Loading..." text, but they are `<button>` elements. Users might tap a loading card thinking it works.

Fix: disable the button or replace with a non-interactive skeleton card during loading.

**[P2] AutonomyDirectivePanel textarea has no visible character counter**

The directive prompt is sliced to 220 chars in code but the user never sees how many characters remain. They discover the limit only when typing stops having effect.

Fix: show a "42/220" character counter below the textarea.

**[P2] Autonomy permission readiness meter shows percentage but not which permission is missing**

The meter shows 25%/50%/75%/100% filled but doesn't indicate which specific gate (operator / adapter / protocol / lease) is blocking progress.

Fix: list the individual permission gates with checkmark/cross icons instead of a single aggregate bar.

**[P2] Home page internal documentation is visible to users**

Several `cw-muted` / `cw-presence-note` paragraphs contain developer-facing copy:
- "Reserve, upkeep runway, and recent action history now all push the companion mood..."
- "This page is now anchored to wallet ownership and on-chain lobster state..."
- "The next step is replacing the remaining event placeholders with live modules."

These should be removed or replaced with user-facing copy.

**[P2] Consistency — button labels vary across pages**

- Play: "Review before execute"
- Arena: no primary CTA on summary cards
- Companion: action rows use `<Link>` with `<ArrowRight>` (navigation, not action)
- Auto: "Save directive" / "Submit autonomy request"

User mental model: is this "review → execute", "navigate → act", or "submit"? Should normalize to a consistent action verb pattern.

**[P2] Consistency — card tone assignment varies for similar states**

Same "ready" state uses `cw-card--ready` on some pages and `cw-card--watch` on others. Same "needs attention" state uses `cw-card--warning` in some places and `cw-card--safe` in others. Makes color coding unreliable as a UX signal.

**[P2] No empty state for "no NFA owned"**

Home falls back to a demo companion state when wallet has no NFA, but doesn't tell the user "you don't own a lobster yet — mint one here" with a link to `/mint`.

Fix: add a clear "No NFA found" empty state on Home with a CTA to the mint page.

**[P2] Arena "Waiting for match data" has no retry/refresh affordance**

When Battle Royale data fails to load, user sees "Waiting for match data" but has no way to retry. Only option is to reload the entire page.

Fix: add a refresh button or auto-retry with a visible countdown.

## Product architecture decisions locked in session 2

### BYOK (Bring Your Own Key) architecture decision

Decided and documented. Two AI lines:

1. User BYOK — for in-browser companion experience:
   - user provides their own API key (DeepSeek / OpenAI / Anthropic / custom)
   - key is AES-encrypted in localStorage, derived from wallet signature
   - Vercel adds one new `/api/ai/chat` route as a CORS proxy (10 lines, no key storage)
   - enables: conversation with lobster, task/PK/BR suggestions, SLEEP memory consolidation
   - user pays their own AI cost

2. Project runner key — for autonomous on-chain execution:
   - stored in Vultr `.env.autonomy-runner` (not in repo)
   - runner acts independently even when user is offline
   - produces on-chain reasoning CID + action receipt
   - user has zero cost here

No conflict between the two. BYOK is Phase E (not in MVP scope). Runner is already live.

### Existing Vercel API Routes — what to keep

Routes to keep as-is:
- `/api/pk/auto-reveal` — holds relayer private key, cannot go client-side
- `/api/autonomy/directive` — KV bridge for Vultr runner directive sync

Route to evolve:
- `/api/agents/[id]` — can be deprecated in favor of direct viem reads, but keep for now

Route to add (Phase E only):
- `/api/ai/chat` — thin BYOK CORS proxy

Route to retire:
- `/api/game-assets/[asset]` — replace with static files in `public/sprites/`

### Full product plan reference

The full visual design system, gameplay interaction specs, and phased roadmap have been written to:

- `FRONTEND_REBUILD_PLAN.md` — complete product vision document (new file in root)
- `FRONTEND_REFACTOR_PLAN.md` — ongoing implementation progress log

## What is next (frontend)

MVP completion gaps remaining:

1. Companion visual identity — CSS-only mood states are functional but the lobster needs
   a stronger visual silhouette. No pixel art exists yet. This is the single biggest
   gap between current state and product feel.

2. Home/Companion emotional distinction — Home should feel operational, Companion personal.
   Currently both feel like the same information density.

3. Real-device PWA validation — install prompt, standalone launch, and offline fallback
   have not been tested on a real mobile device.

4. Phase E (BYOK + diary) — not started. Excluded from MVP. Start only after Phase A-D
   are validated on real devices.

5. Push notifications — excluded from MVP. Requires a service like Firebase or web-push.
   Highest-impact future feature for retention (longing alerts, BR notifications).

## Deployment status

- current branch: `release-1.1.6` (working branch)
- `origin/main`: up to date — all session 3 commits cherry-picked and pushed as of 2026-04-12
  - `1cf4bf5 feat: expand i18n for rebuilt shell routes`
  - `df437f0 docs: sync handoff and add frontend rebuild plan`
  - `7436fd3 feat: wire i18n zh/en switching across AppShell and BottomTabs`
  - `7319142 fix: mobile layout and wallet connect for new shell`
- public repo `public/main` (ClaworldNfa): up to date (README synced)
- Vercel: deploying from `origin/main` — validate on real device after next deploy
- next step: validate on real mobile device, then tackle P0 stage-height fix

## Current objective

The active workstream is the frontend rebuild.

Current frontend objective:

- replace the old terminal-first product shell
- make the app feel like a mobile-first养成 dapp
- put asset state, action readiness, and feedback ahead of explanation
- keep protocol/runtime semantics unchanged while the product surface is rebuilt

Backend/autonomy objective remains as a guarded baseline:

- keep mainnet autonomy and BattleRoyale fixes stable
- do not reopen gas-heavy experimentation while frontend is being rebuilt
- preserve low-gas operational discipline

## What is already real on mainnet

### Autonomy core

- `ClawOracle`: `0x652c192B6A3b13e0e90F145727DE6484AdA8442a`
- `ClawAutonomyRegistry`: `0xD18BaF2670fFcb4CC92260719AbFc9d637dB7044`
- `ClawAutonomyDelegationRegistry`: `0x1C3A69fC7715563D9dDF9847BB5ffF3B6e09aAEa`
- `ClawOracleActionHub`: `0xEdd04D821ab9E8eCD5723189A615333c3509f1D5`
- `ClawAutonomyFinalizationHub`: `0x65F850536bE1B844c407418d8FbaE795045061bd`

### Gameplay contracts used by autonomy

- `ClawNFA`: `0xAa2094798B5892191124eae9D77E337544FFAE48`
- `ClawRouter`: `0x60C0D5276c007Fd151f2A615c315cb364EF81BD5`
- `TaskSkill` proxy: `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`
- `PKSkill`: `0xA58e9E0D5f3970d46c9779a9A127DdAc60508dfF`
- `BattleRoyale` proxy: `0x2B2182326Fd659156B2B119034A72D1C2cC9758D`
- `WorldState`: `0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA`
- `Claworld token`: `0x3b486c191c74c9945fa944a3ddde24acdd63ffff`

### Adapters

- `TaskSkillAdapter`: `0xe7a7E66F9F05eC14925B155C4261F32603857E8E`
- `PKSkillAdapter`: `0x1ef409114BAD145e5289a5e906E9Ea38B7d05A0c`
- `BattleRoyaleAdapter`: `0xCD71fD0429DC82EfD6Ef019a7e1F7f93a5A1AEcc`
- `BattleRoyaleSettlementAdapter`: `0x5c24e17C436856B8e1Ee59c6887ba91694776FF7`

## What was fixed today

### 1. Task failure root cause is confirmed

The user-reported task failure on `NFA #112` was not a generic wallet problem.
The actual on-chain revert reason was:

- `Monthly cap exceeded`

Observed state before the fix:

- NFA owner: `0xC66d036d86477A5B9B62e9D4092D881dd6676b0B`
- cooldown remaining: `0`
- `previewTypedTaskOutcome(112, 0, 10, 10e18)` succeeded
- monthly personality drift counters for `#112` already hit the cap path

This is why wallets like Bitget surfaced a vague error such as:

- `第三方合约执行失败`
- `合约不可读取`

The real problem was inside `TaskSkill` personality drift handling.

### 2. Mainnet TaskSkill is upgraded and verified

The fix is already in code, pushed, and the mainnet `TaskSkill` proxy is already upgraded.

What is true now:

- task completion still goes through
- if personality monthly cap is reached, the task does not revert
- personality drift is skipped for that run
- task reward / XP flow still completes

Verified on-chain facts:

- `TaskSkill` proxy: `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`
- current implementation: `0x545e41065C63d25ceAaF374f77B3628bC1E7CB48`
- `owner()`: `0x4929BD86e8Be70a167cCe03A64AaC692E0c2B3b2`
- `nfa()`: `0xAa2094798B5892191124eae9D77E337544FFAE48`
- `NFA #112` direct `eth_call ownerCompleteTypedTask(...)` now succeeds on mainnet

Mainnet upgrade transactions:

- implementation deploy tx: `0xad07ac194d4926379d6a3a197851a0f850960f0e37960b2be679d77c11a0e699`
- proxy upgrade tx: `0x8185b5f707018455b62ae2f861c8a4bfb2239692abbdb1a3006ad417f762fe5e`

Measured gas cost:

- implementation deploy: `2019662 gas` at `0.05 gwei` = `0.0001009831 BNB`
- `upgradeTo`: `39221 gas` at `0.05 gwei` = `0.00000196105 BNB`

### 3. Upgrade script was repaired before upgrade

The original upgrade script depended on local OpenZeppelin manifest state and could fail in a clean worktree.

It was changed to:

- validate UUPS implementation
- deploy implementation directly
- call `upgradeTo` on the proxy

This avoids manifest registration mismatch in clean environments.

Relevant script:

- `scripts/upgrade-taskskill-mainnet.ts`

### 4. Frontend already has the diagnostic side of the fix

Frontend support change is already in code:

- simulate contract before submit
- surface actual revert reasons earlier
- stop hardcoding a coarse task gas value

This means:

- after frontend deployment, task failure UI should show the real reason more accurately
- the contract-side fix is already live
- if users still see the old vague error, the next thing to check is frontend deployment / cache / wallet display behavior

### 5. Directive runtime is now production-closed

The autonomy directive path is no longer just local-only code.

What is already verified:

- frontend/server-side directive store can read KV using both `KV_REST_*` and `AUTONOMY_DIRECTIVE_KV_REST_*`
- runner can sync Upstash KV into local file
- planner can inject directive text from the local file into prompts
- local BOM / encoding edge cases were fixed

What was added in code:

- shared runtime helper: `openclaw/autonomyDirectiveRuntime.ts`
- runtime check script: `scripts/check-directive-runtime.ts`
- runner sync now logs record count and target file

Real production verification that was performed:

- wrote a harmless smoke directive into the real Upstash KV
- waited for runner sync
- verified `/opt/clawworld-autonomy-runner/.cache/autonomy-directives.json` updated on Vultr
- removed the smoke directive and verified the local mirror returned to empty

This means:

- `KV -> Vultr local mirror -> planner prompt injection` is technically closed
- the remaining question is only whether planner is enabled in the live runner

### 6. Planner runtime now has production safety rails

The live autonomy planner no longer has to be either fully off or dangerously on.

Added bottom-layer controls:

- unified tx policy in `openclaw/autonomyTxPolicy.ts`
- planner `dry-run` mode
- planner request-kind allowlist
- planner max requests per loop
- reveal watcher now uses the same tx policy

Relevant envs now supported:

- `AUTONOMY_GAS_PRICE_GWEI`
- `AUTONOMY_MAX_GAS_PRICE_GWEI`
- `AUTONOMY_GAS_LIMIT_BUFFER_BPS`
- `AUTONOMY_GAS_LIMIT_EXTRA`
- `AUTONOMY_PLANNER_DRY_RUN`
- `AUTONOMY_PLANNER_ALLOWED_REQUEST_KINDS`
- `AUTONOMY_PLANNER_MAX_REQUESTS_PER_RUN`

This is the key operational change that makes it safe to turn planner on in production in a bounded way.

### 7. BattleRoyale readiness script was corrected

Earlier readiness output was misleading.

The old script:

- used the wrong autonomy participant salt
- did not resolve legacy owner-participant fallback like the runtime does
- could wrongly report an NFA as "ready to enter" when it was already in a match

It is now corrected to match runtime participant resolution.

## Live runner status right now

The Vultr autonomy runner has already been updated and restarted with the new runtime image.

Current live runner mode:

- planner is enabled
- planner is `dry-run`
- managed NFA list is only `#4`
- task planner is off
- PK planner is off
- BattleRoyale planner is on
- allowed request kinds are only:
  - `BATTLE_ROYALE_ENTER`
  - `BATTLE_ROYALE_CLAIM`
- max requests per loop is `1`

Meaning:

- the live runner is now observing and planning BattleRoyale in production
- it will not submit on-chain autonomy requests yet
- it is safe for validation and log inspection

## BattleRoyale ground truth right now

This was re-verified after fixing the participant derivation:

- `NFA #4` is already in BattleRoyale match `#1`
- participant address: `0x71E930448a0aF7C0f2eaA845Ebe8A50113AE392b`
- current room: `2`
- current stake: `166.666666666666666666 Claworld`
- effective NFA: `4`

This is why the live planner currently logs:

- `NFA #4: idle (No safe or useful action available right now.)`

That idle is currently correct behavior.

Also re-verified:

- `NFA #3` is still not ready for autonomous BattleRoyale enter
- the remaining blocker is `ADAPTER_NOT_APPROVED`

## Runner stability fix that was applied

There was a real runtime bug in `resolveBackfillStart(...)`:

- it preferred an old `lastProcessedCursor` block even when `lastScannedBlock` was much newer
- on public BSC RPCs this caused startup backfill to hit pruned history and emit noisy errors

This has now been fixed to:

- prefer the newer of `lastScannedBlock` and `lastProcessedCursor.blockNumber`
- clamp resume start to the recent backfill window

After the fix, the live runner restarted cleanly from recent blocks instead of deep historical blocks.

## Code / repo status

### Clean worktree used for the fix

Do not assume this dirty worktree is the authoritative source for the upgrade.
The fix was prepared and pushed from a clean worktree:

- `D:\claworldNfa\.codex-task-fix-main`

Relevant pushed commits to private `origin/main`:

- `63c4bcb` `fix: keep tasks working at personality cap`
- `d53fa5c` `fix: make taskskill upgrade manifest-free`

### What changed in the fix

Contract logic change:

- `contracts/skills/TaskSkill.sol`

Behavioral change:

- catch only `Error("Monthly cap exceeded")`
- skip personality drift
- emit `TaskPersonalityDriftSkipped`
- keep the task action itself successful

Frontend support change:

- `frontend/src/app/game/page.tsx`
- `frontend/src/game/chain/contracts.ts`

Tests:

- `test/TaskSkill.test.ts`

## What is still not finished

### 1. BattleRoyale full loop is not done

The real target remains:

- `enter`
- `reveal`
- `claim`

Current state:

- BattleRoyale autonomy is partially wired
- reveal watcher exists
- public scripts exist
- runtime now has safe dry-run / allowlist / tx policy controls
- readiness script now reflects the real participant state
- live runner is already observing BattleRoyale in dry-run mode for `NFA #4`

Do not claim BattleRoyale production closure yet.

### 2. Frontend AI proxy page still needs cleanup

Known product/frontend gaps:

- AI proxy should remain a standalone page replacing old lore/worldview content
- holder wallet `Claworld` balance display had earlier shown `0.00` incorrectly in some states
- AI proxy flow still needs clearer visual sequencing
- BattleRoyale participant semantics should stay `nfaId`-centric
- holder wallet only handles permission and token-threshold validation

### 3. CML memory is conceptually aligned but still needs deeper runtime integration

Target direction is already agreed:

- CML memory should affect planner decisions
- user prompt / style preference should also affect proxy behavior
- autonomy should read long-term memory before choosing tasks / PK / BattleRoyale behavior
- root sync should be queued, not blindly written on every action

## Product rules that are already decided

- token name is `Claworld`
- do not write `CLW`
- do not write `Clawworld`
- AI proxy eligibility checks the wallet holding the NFA
- current threshold is fixed token amount, not staking
- later this can evolve into dynamic USD-equivalent threshold
- every important interaction should re-check holder wallet balance in real time

## Gas strategy

Production rule is strict:

- BSC gas must stay low
- no blind replay
- no oversized fixed gas
- no repeated request creation just to “test”

Current runtime strategy that should remain:

- estimate gas first
- add only a small buffer
- use low gas price policy
- keep failed requests terminal

Known configured values from the current workstream:

- `AUTONOMY_GAS_PRICE_GWEI=0.05`
- `AUTONOMY_MAX_GAS_PRICE_GWEI=0.08`
- `AUTONOMY_GAS_LIMIT_BUFFER_BPS=10750`
- `AUTONOMY_GAS_LIMIT_EXTRA=8000`

## Server / runner context

Vultr runner host:

- host: `139.180.215.3`
- user: `root`

Runner directory:

```bash
/opt/clawworld-autonomy-runner
```

Typical commands:

```bash
ssh root@139.180.215.3
docker ps --filter name=claw-autonomy-runner
docker logs --tail 200 claw-autonomy-runner
```

Current live mode on that server:

- `AUTONOMY_PLANNER_ENABLED=true`
- `AUTONOMY_PLANNER_DRY_RUN=true`
- `AUTONOMY_PLANNER_MANAGED_NFA_IDS=4`
- `AUTONOMY_PLANNER_TASK_ENABLED=false`
- `AUTONOMY_PLANNER_PK_ENABLED=false`
- `AUTONOMY_PLANNER_BATTLE_ROYALE_ENABLED=true`
- `AUTONOMY_PLANNER_ALLOWED_REQUEST_KINDS=BATTLE_ROYALE_ENTER,BATTLE_ROYALE_CLAIM`
- `AUTONOMY_PLANNER_MAX_REQUESTS_PER_RUN=1`

Model runtime:

- external API, not local model
- OpenAI-compatible endpoint
- server env file holds operator key + model key + addresses

Critical file on server:

```bash
/opt/clawworld-autonomy-runner/.env.autonomy-runner
```

Do not overwrite it blindly.

## High-value local files for the next agent

### Contract / mainnet scripts

- `contracts/skills/TaskSkill.sol`
- `contracts/skills/BattleRoyale.sol`
- `contracts/world/adapters/TaskSkillAdapter.sol`
- `contracts/world/adapters/BattleRoyaleAdapter.sol`
- `scripts/upgrade-taskskill-mainnet.ts`
- `scripts/watch-battle-royale-reveal.ts`
- `scripts/smoke-battle-royale-autonomy-mainnet.ts`
- `scripts/upgrade-battle-royale.ts`
- `scripts/verify-battle-royale-config.ts`

### Runner / planner

- `openclaw/autonomyOracleRunner.ts`
- `openclaw/autonomyPlanner.ts`
- `openclaw/battleRoyaleRevealWatcher.ts`
- `openclaw/contracts.ts`
- `openclaw/openaiCompatibleAI.ts`
- `openclaw/reasoningUploader.ts`

### Frontend AI proxy

- `frontend/src/components/nfa/AutonomyPanel.tsx`
- `frontend/src/contracts/hooks/useAutonomy.ts`
- `frontend/src/app/lore/page.tsx`
- `frontend/src/app/lore/LoreContent.tsx`
- `frontend/src/app/game/page.tsx`

## Immediate next steps

1. Re-verify task UX with a real user path against the already-upgraded mainnet `TaskSkill`.
2. Verify the rebuilt frontend `Play` loop against a real owner wallet path:
   - preview
   - confirm
   - execute
   - receipt/result
3. Verify the rebuilt frontend PK loop against a real owner wallet path:
   - create or join
   - local commit persistence
   - reveal
   - settle or timeout cancel
   - result/readback
4. Verify the rebuilt frontend `Auto` claim-request surface against a real settled autonomy-side BR reward.
5. Verify the new PWA shell on a real mobile browser:
   - install prompt exposure
   - standalone launch
   - offline fallback
6. Keep strengthening companion identity with more character-driven live modules, not only shell chrome.
7. Land Chinese/English switching across the rebuilt shell first:
   - shell header
   - bottom tabs
   - Home / Play / Arena / Auto / Settings
   - key action panels
8. Clean the AI proxy frontend page and ensure holder `Claworld` balance reads correctly.
9. Continue wiring CML memory into planner/runtime without forcing per-action root writes.
10. Use the new read-recovery surfaces during real-wallet validation instead of refreshing the whole app when a page read fails.

## Release note

Current operator decision on 2026-04-12:

- stop local browser-first testing for now
- push the rebuilt frontend directly to `origin/main`
- use Vercel real deployment as the next validation surface
- after deployment, test in the real environment first, then iterate on defects from that surface

## Frontend review status - 2026-04-12

This section is the current reviewed status for the rebuilt frontend.
Priority meanings:

- `P0`: blocks core use
- `P1`: significant UX gap
- `P2`: polish / interaction quality

### Fixed on `origin/main`

- `[P0]` CompanionStage vertical budget reduced
  - reviewed as fixed in commit `86b0af5`
  - stage art reduced
  - readouts collapsed horizontally
  - meta spacing reduced
- `[P0]` iOS top safe area handled
  - reviewed as fixed in commit `86b0af5`
  - `env(safe-area-inset-top)` added to the top chrome
- `[P0]` bottom tabs no longer move with page scroll
  - reviewed as fixed in commit `86b0af5`
  - body scroll lock and tab positioning corrected
- `[P0]` compact companion layout no longer crushes content to the right
  - reviewed as fixed in commit `86b0af5`
  - stage visual layout changed to stack cleanly on small screens

### Fixed after session 4

- `[P0]` Wallet gates now block dead action pages
  - shared `WalletGate` added to:
    - `/play`
    - `/arena`
    - `/auto`
- `[P0]` Deposit/upkeep is now back inside the rebuilt navigation
  - new compact upkeep/reserve panel landed on Companion
- `[P1]` OwnedCompanionRail is now compact by default
  - subtitle is suppressed in compact mode
  - roster cards are tighter
- `[P2]` CompanionStage no longer depends on fixed placeholder art only
  - active companion metadata now feeds stage image resolution
  - stage is GIF-ready
- `[P2]` Switcher arrows are now larger tap targets
- `[P2]` Language toggle discoverability improved
  - globe icon added
  - language pill styling tightened
- `[P2]` Roster loading fallback no longer renders as interactive buttons
- `[P2]` Directive textarea now exposes a visible character counter
- `[P2]` Home now has an explicit no-NFA empty state

### Open P0

- none on the rebuilt shell path as of session 4

### Open P1

- `[P1]` i18n coverage is incomplete
  - shell chrome is partially wired
  - page body copy and key action panels are still mostly hardcoded English
- `[P1]` OwnedCompanionRail is too tall for multi-NFA wallets
  - the extra section consumes too much vertical budget on every page
- `[P1]` No loading/skeleton state
  - current live hooks flash `0`, `--`, or blank before data resolves
- `[P1]` No clear wallet-signature waiting state
  - current transaction UX does not distinguish:
    - waiting for wallet approval
    - waiting for chain confirmation
- `[P1]` Task / claim completion still lacks emotional payoff
  - results are informative but not rewarding enough
- `[P1]` No global keyboard/screen-reader focus styling
  - `:focus-visible` still needs a real visual rule in the rebuilt shell

### Open P2

- `[P2]` CompanionStage still uses placeholder art
- `[P2]` Mood badge still feels static
- `[P2]` PWA offline banner still compresses the viewport too much on small phones
- `[P2]` Brand label can still overflow on 320px screens
- `[P2]` `cw-shell { overflow: hidden }` will clip future modal/sheet work
- `[P2]` Settings still shows roadmap cards that look interactive
- `[P2]` Play confirm sheet still needs a clearer back affordance
- `[P2]` Arena summary cards still read as tappable without a consistent click target
- `[P2]` Companion stage signal chips can still render with no semantic tone
- `[P2]` Shell switcher arrows are below ideal mobile tap size
- `[P2]` Language toggle discoverability is weak
- `[P2]` Roster loading fallback still looks interactive
- `[P2]` Directive textarea still needs a visible character counter
- `[P2]` Autonomy readiness meter still hides which gate is actually missing
- `[P2]` Some Home page paragraphs still read like internal product notes
- `[P2]` Action verbs and card-tone semantics are not consistent across pages
- `[P2]` No explicit empty state for wallets with no NFA
- `[P2]` Arena "waiting for match data" state still needs retry / refresh affordance

### Backup rule

- the old frontend must remain preserved as backup while the new shell is iterated
- old routes/components are not to be deleted during this rewrite pass
- new shell work should replace the primary entry experience without destroying the fallback path

## Worktree warning

The current worktree at:

- `D:\claworldNfa\clawworld`

is very dirty and contains many tracked edits plus many autonomy-related untracked files.

Do not run any of these blindly from here:

- `git add .`
- `git commit -a`
- broad revert / reset commands

If you need a clean operational path again, create or reuse a clean worktree for production fixes.
