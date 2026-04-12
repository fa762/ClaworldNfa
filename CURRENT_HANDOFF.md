# Current Handoff

Last updated: 2026-04-12 (session 2) Asia/Singapore

This file is the current source of truth for the autonomy / BattleRoyale / TaskSkill workstream.
If Codex account or chat context changes, start from this file instead of relying on old conversations.

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
- frontend production build passed again after the arena-routing and presence pass

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
Priority: P0 = blocks core use, P1 = significant gap, P2 = polish.

### P0 — Critical

**[P0] CompanionStage occupies too much vertical space**

The stage is the persistent header above every page's scrollable content.
Current measured heights on home:

- topbar: ~70px
- stage (home, art 154px + readouts 3×44px stacked + meta): ~370px
- tabs: ~84px
- total chrome: ~524px
- scrollable area on iPhone SE (667px): 143px — nearly nothing

On inner pages (compact art 102px):

- stage (compact, art + readouts): ~280px
- total chrome: ~434px
- scrollable area on iPhone SE: 233px — still very tight

Root causes:

1. `.cw-stage-art` is 154px (home) / 102px (compact) — these are large for a persistent header
2. `.cw-stage-readouts` stacks 3 readout cards vertically at `min-height: 44px` each = 148px — they could be 3-col horizontal (one row ~36px)
3. `.cw-stage-meta` chips have `margin-top: 14px` adding extra height
4. No option to collapse the stage on inner pages

Fix required: reduce art to 120px/80px, make readouts a horizontal 3-col row, reduce readout padding.

**[P0] iOS top safe area not handled**

`env(safe-area-inset-top)` is not applied to `.cw-topbar` padding.
On iPhones with notch or Dynamic Island, the topbar sits partially under the status bar.

Fix: add `padding-top: calc(14px + env(safe-area-inset-top))` to `.cw-topbar`.

### P1 — Significant

**[P1] Page body copy is hardcoded English — i18n toggle has no effect on page content**

The zh/en toggle works for shell chrome (topbar, tabs, stage labels) but all page content remains English:

- Play: "Task mining", "Adventure", "Puzzle", "Crafting", task detail descriptions
- Arena: "Arena hub", "PK Arena", "Battle Royale", all card copy
- Companion: "Presence", "Trait shape", "Action row", all static labels
- Auto: all autonomy copy
- OwnedCompanionRail: title/subtitle props passed as hardcoded English strings at every call site

Fix: either mark pages as non-translatable in scope (acceptable for now) or add page-level translation keys in a follow-up pass.

**[P1] No wallet gate / empty state when wallet not connected**

Most pages require wallet connection to be useful but display blank/zero data without any CTA.
Users landing on Play, Arena, or Auto with no wallet see empty panels with no prompt.

Fix: add a shared `<WalletGate>` component that renders a connect CTA when `!isConnected`. Mount it at the top of action pages.

**[P1] Deposit/upkeep UI not in new navigation**

The single most critical maintenance action — depositing Claworld for upkeep — exists only in the old NFA detail page, which is not part of the new navigation flow.
Users who run out of upkeep have no path to fix it from the new shell.

Fix: add a compact deposit/upkeep section to the Companion page or Settings.

**[P1] OwnedCompanionRail adds ~120px to every page for multi-NFA wallets**

When `ownedCount > 1`, OwnedCompanionRail renders a full section with title, subtitle, and a horizontal roster. This appears at the top of every page (Home, Play, Arena, Auto, Companion).
Combined with the already large stage, this reduces scroll area further.

Fix: make the rail collapsible or move it behind the shell header switcher so it only expands on demand.

### P2 — Polish

**[P2] No loading / skeleton state**

When wallet connects and hooks begin reading, all fields show `0` / `--` with no loading indicator.
This creates a jarring flash before data populates.

Fix: add a `loading` prop to the active companion context; show skeleton shimmer in readouts and cards while loading.

**[P2] CompanionStage art is placeholder only**

The 154px/102px circle renders a gradient glow but no actual lobster NFT image.
Metadata URL reading and image display are not wired into `CompanionStage`.

Fix: wire `useNFAMetadata(tokenId)` into the active companion context and pass `imageUrl` to the stage art element.

**[P2] PWA offline banner consumes extra vertical space**

When `PwaStatusBanner` renders (offline or install prompt), it adds ~60-80px to the non-scrollable chrome, further compressing the scroll area that is already tight on SE-size phones.

Fix: make the banner dismissible with a single tap; persist dismissed state in sessionStorage. Already partially done with dismiss button, but ensure it auto-dismisses after 8 seconds on small screens.

**[P2] `cw-topbar` label "Lobster Companion" too long for 320px screens**

At 1.125rem and 16 chars, the brand name "Lobster Companion" plus the top-actions row may overflow on 320px devices (older iPhones). No overflow protection exists.

Fix: shorten to "Claw" or truncate with CSS overflow on the brand element on small screens.

**[P2] `cw-shell { overflow: hidden }` will clip any overflow children**

Future modals, bottom sheets, or dropdowns that need to overflow the shell will be clipped.

Fix: use `overflow: clip` instead of `overflow: hidden` when modals need z-index escape, or move modal roots to a portal outside `.cw-shell`.

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

## Release note

Current operator decision on 2026-04-12:

- stop local browser-first testing for now
- push the rebuilt frontend directly to `origin/main`
- use Vercel real deployment as the next validation surface
- after deployment, test in the real environment first, then iterate on defects from that surface

## Worktree warning

The current worktree at:

- `D:\claworldNfa\clawworld`

is very dirty and contains many tracked edits plus many autonomy-related untracked files.

Do not run any of these blindly from here:

- `git add .`
- `git commit -a`
- broad revert / reset commands

If you need a clean operational path again, create or reuse a clean worktree for production fixes.
