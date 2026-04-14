# Frontend Refactor Plan

Last updated: 2026-04-14 Asia/Singapore

This file is the source of truth for the frontend product rewrite.
If agent or chat context changes, continue from this file together with `CURRENT_HANDOFF.md`.

## Arena detail checkpoint - 2026-04-14 session 25

This checkpoint tightens the Arena page around one product rule:

- history should not be a dead log
- history should let the user review and act

### 1. Battle Royale history is now an action surface

Accepted model now implemented:

- open BR history detail
- review:
  - room
  - stake
  - pot
  - status
  - claimable reward
- if reward is still claimable:
  - claim from the same detail sheet
  - reserve-route rewards point back to Home maintenance withdraw

### 2. PK history detail now behaves like a duel review

Accepted model now implemented:

- open PK history detail
- review:
  - win / loss
  - role
  - opponent
  - my strategy
  - opponent strategy
  - reward
  - winner

This is much closer to the intended game UX than the previous “match id + result + stake” shell.

### 3. Battle Royale path display now follows the selected lobster

Accepted model now implemented:

- owner-wallet path is no longer shown just because the wallet participated somewhere
- the BR room sheet only prefers paths whose effective NFA matches the currently selected lobster
- claim-window scanning now follows the same relevance rule

### Updated execution order after session 25

1. validate hosted Arena history detail against live BR claim cases
2. validate NFA switching inside BR room sheet on real data
3. keep removing leftover dashboard-style copy from Arena sheets
4. after live verification, continue the same action-first cleanup on Auto and Settings

## Execution checkpoint - 2026-04-14 session 24

This checkpoint locks in a cleaner game-product rule for the rebuilt mobile shell:

- rewards that belong to the lobster should go back to the lobster ledger account
- the user must have a visible withdraw path back to the main wallet
- arena landing should show recent record, not just entry buttons
- tapping the fixed companion strip should reveal a short stats/details sheet

### 1. Home maintenance is now the official ledger-withdraw surface

Accepted model now implemented:

- reserve / upkeep / wallet balances remain visible
- withdraw flow is now part of the same maintenance surface:
  - request
  - cooldown
  - claim
  - cancel

This means Battle Royale reward copy can now truthfully point the user back to Home maintenance instead of leaving reward flow half-finished.

### 2. The fixed companion strip is now actionable

Accepted model now implemented:

- tap the fixed companion strip
- open a short details sheet
- see:
  - task traits
  - PK stats
  - level / status / shelter
  - wallet / ledger / upkeep / runway

This replaces the earlier dead shell behavior where the fixed strip only displayed state but did not open deeper context.

### 3. Arena landing now includes history, not just entry

Accepted model now implemented:

- `PK` card still opens the PK action sheet
- `大逃杀` card still opens the BR action sheet
- below them, both loops now show recent participation history
- tapping a history row opens a short detail sheet

This aligns the page more closely with game UX:

- entry
- status
- recent record
- detail on tap

instead of entry buttons with no memory of what just happened.

### 4. Battle Royale product model is now explicit

Accepted local model in code:

- NFA can enter through its own ledger-account path
- reward returns to the NFA ledger account
- user can withdraw from Home maintenance

Live state after session 24:

- Battle Royale mainnet proxy has now been upgraded to the implementation that includes:
  - `participantForNfa(...)`
  - `enterRoomForNfa(...)`
  - `claimForNfa(...)`
- post-upgrade direct reads confirm the proxy is serving the new reserve-account logic
- hosted frontend can now use the NFA-ledger Battle Royale path without pretending against an old implementation

### Updated execution order after session 24

1. validate hosted frontend against the upgraded Battle Royale implementation
2. live-test reserve-account BR entry / claim / withdraw path end to end
3. keep cutting non-essential copy from action sheets
4. continue motion/art polish only after live action paths are healthy

## Execution checkpoint - 2026-04-13 session 23

This checkpoint tightens the rebuilt shell around a clearer game-mobile rule:

- shell chrome should read correctly in Chinese mode
- PK and Battle Royale should open as short decision flows, not stacked system pages
- win/loss, claim, and refresh state should be visible without reading debug copy

### 1. Chinese shell chrome is now corrected

Accepted model now implemented:

- shell overline in Chinese mode:
  - `移动端 DApp`
- brand remains:
  - `龙虾世界`
- mint eyebrow in Chinese mode no longer stays English-only
- arena status formatting is now:
  - `X胜 / Y败`

### 2. PK modal now follows a more game-like structure

Accepted model now implemented:

- top strip:
  - current status
  - reserve
  - `X胜 / Y败`
  - short rule/highlight copy
- main idle surface:
  - compact multi-row match list
  - refresh
  - open-create button
- tap a match row:
  - leave the list state
  - enter a dedicated join confirm state
- create-match now also has its own confirm state

This replaces the earlier pager-like flow that still felt too much like a stacked dashboard.

### 3. Battle Royale flow is now clearer at the top of the sheet

Accepted model now implemented:

- short rules strip at the top
- explicit highlight that settlement auto-opens the next round
- earlier reward-claim entry
- visible refresh feedback

### 4. Current honest product limitation

This remains true after session 23:

- manual BR join still spends owner-wallet `Claworld`
- NFA-reserve BR entry is not a front-end-only switch
- the current contract split is still:
  - owner wallet path: `enterRoom(...)`
  - autonomy/resolver path: `autonomousEnterRoomFor(...)`

So the rebuilt UI can explain and route better, but it cannot truthfully pretend owner manual entry already spends NFA reserve.

### Updated execution order after session 23

1. validate the hosted build for:
  - Chinese shell copy
  - PK live stats
  - PK list -> confirm flow
  - BR claim entry / refresh state
2. keep stripping leftover mixed-language copy from nested sheets
3. continue reducing any remaining vertical waste in persistent shell chrome
4. if product requires BR manual join from NFA reserve, handle it as a contract-path change, not a copy tweak

## Execution checkpoint - 2026-04-13 session 22

This checkpoint moves the rebuilt shell closer to the intended game UX rule:

- default screen shows action, reward, condition, result
- long explanation stays out of the default path
- arena and mint are now action surfaces, not document pages

### 1. Arena interaction model is now aligned with the product direction

Accepted model now implemented:

- Arena landing:
  - `PK`
  - `大逃杀`
- each opens its own bottom sheet
- no default long page that mixes:
  - PK
  - Battle Royale
  - claim
  - room data
  - internal state

`PK` sheet now focuses on:

- current status
- reserve
- `胜败`
- open-match pager
- strategy choice
- create / join / reveal / settle / cancel

`大逃杀` sheet now focuses on:

- current match
- room grid
- stake
- join / change room / claim

### 2. Mint is now part of the same product language

Accepted model now implemented:

- one compact page
- rarity choice first
- commit / wait / reveal / refund as the only default actions
- sold counts come from live rarity reads
- admin mint UI stays removed

### 3. Shell compactness was improved again

This pass tightened:

- topbar padding
- switcher width
- stage spacing
- panel padding
- card height
- modal height

Selected-state feedback is now stronger on:

- tabs
- action cards
- strategy cards
- Battle Royale room tiles

### 4. Current product truth about task mining

Task mining is currently:

- three fixed categories on the frontend
  - exploration
  - puzzle / decoding
  - crafting / modding
- not random-generated tasks
- but each card's reward / score / tone is derived from:
  - active lobster traits
  - level
  - upkeep pressure

So the categories are fixed, while the value and recommendation layer is dynamic.

### Updated execution order after session 22

1. use the hosted build to live-test PK / BR / mint
2. simplify `/auto` further into strategy + prompt + result
3. continue removing leftover mixed-language or operator-facing copy
4. only then resume higher-order visual polish and motion

## Execution checkpoint - 2026-04-13 session 21

This checkpoint corrects two assumptions from the previous pass.

### 1. Manual mining is not categorically dead on mainnet

Canonical proxy re-check:

- `ownerCompleteTypedTask(...)` preflight succeeds on the canonical mainnet `TaskSkill`
- `previewTypedTaskOutcome(...)` still reverts

So the correct frontend product stance is now:

- keep local preview fallback
- keep short error handling for preview reads
- do not describe the whole mining execute path as dead if the app is wired to the canonical proxy

### 2. Deployed frontend address drift is now treated as a real production risk

The rebuilt frontend now treats canonical mainnet addresses as the default source of truth.

Reason:

- stale hosted env vars can silently point the shell at outdated core contracts
- this creates fake UX bugs that are actually address-selection bugs

Current rule:

- on mainnet, canonical addresses win by default
- env overrides only win if `NEXT_PUBLIC_ALLOW_MAINNET_ADDRESS_OVERRIDE=1`

### 3. Single treasury is now a supported contract direction

To align with the product requirement of one shared treasury:

- `ClawRouter` now supports `payoutCLW(...)` for authorized skills
- `BattleRoyale.claim(...)` can combine:
  - local BR balance
  - Router treasury shortfall

That means the frontend can continue to describe Battle Royale as one economy, but only after the upgraded contract is deployed live.

### Updated product priority after session 21

1. deploy the BattleRoyale treasury-path fix if owner wallet claims must work live
2. validate the hosted frontend is now reading canonical mainnet addresses
3. keep default screens minimal and Chinese-first
4. keep preview / claim / arena interactions in modal-first flows
5. only after the live chain paths are healthy: resume art / motion / companion polish

## Execution checkpoint - 2026-04-13 session 20

This checkpoint resets the frontend plan around what was just proven on-chain, not around what merely renders.

### Newly verified truths

1. Wallet `Clawworld` balances are real and can be very large
- direct chain read for the current owner wallet returned about `7.7M`
- token display must never silently collapse this to `0`

2. PK create/join can pass preflight when the commit hash is correct
- the rebuilt frontend bug was estimation with a zero hash
- this is now a solved frontend bug

3. Battle Royale owner claim currently depends on `BattleRoyale` contract balance, not the project's shared treasury
- the live contract balance is `0`
- owner `claim(...)` reverts with `ERC20: transfer amount exceeds balance`
- until the contract settlement path changes, the frontend must block direct owner claim when contract funding is insufficient

4. Manual owner mining is currently not healthy on mainnet
- both preview and execute preflight revert
- the frontend can only:
  - stop dumping raw errors
  - stop pretending the action is available
  - fall back to local preview for UX continuity
- restoring real manual mining requires contract-path investigation or upgrade, not more page polish

### Product consequences

The rebuild must now separate three categories of work:

1. solved frontend defects
- false-zero or misleading balance display
- overlong stacked arena flow
- PK create/join zero-commit estimate bug
- shell and stage vertical waste
- long raw revert output in mining preview

2. frontend containment for live contract defects
- BR claim path must visibly block when contract balance is insufficient
- mining must show a short mainnet blocker instead of a fake-ready confirm path

3. true backend/contract work that the frontend cannot fake away
- BR settlement liquidity should come from the intended treasury model
- TaskSkill owner mining path must pass preflight on mainnet if manual mining is a product requirement

### Updated execution order after session 20

1. keep the default paths short and Chinese-first
2. keep replacing raw errors with player-facing blockers
3. keep collapsing operator/proof detail behind advanced sections
4. do not spend more time on art until:
  - mining path is either truly restored or clearly blocked
  - BR claim path is either contract-funded or explicitly redirected to the supported path

### Current accepted UI model

- Home: next action + upkeep only
- Mining: cards -> modal preview -> confirm/result
- Arena: PK vs 大逃杀 entry cards -> modal flow
- Auto: strategy + prompt + submit + latest result
- Mint: same mobile card language as the rebuilt shell

### Current rejected UI model

- long stacked dashboard pages
- verbose explanatory copy on the default path
- raw viem/contract errors in main user surfaces
- fake-ready CTAs for actions that fail live preflight

## Reset baseline after real testing

The rebuild plan is now reset around production usability, not around route coverage.

The previous checkpoints remain historically true as implementation notes, but they are no longer sufficient progress signals.

From this point the frontend must be judged by:

- can the user understand the page in seconds
- can the user complete the action without scrolling through multiple stacked modules
- does failed data loading stay visibly different from a real zero/empty state
- does Chinese mode read as Chinese-first instead of mixed bilingual filler
- does the shell preserve vertical space on real mobile / PWA screens

This creates a new execution order:

1. Data correctness and non-zero-state recovery
2. Shell compression and topbar overflow fixes
3. IA simplification:
   - remove duplicate roster switching
   - merge Home and Companion
4. Interaction model rewrite:
   - Play -> preview/confirm/result in modal or sheet
   - Arena -> PK / BR entry split into selectable surfaces, not one long page
   - Auto -> strategy + prompt + action + result, no operator-dashboard essay
5. Chinese-first cleanup
6. Settings into real controls
7. Only then: stronger art, motion, and companion emotional layer

## UX hard rules

These rules override the earlier tendency to explain too much.

### 1. Default view: only four information types

The default surface should only present:

1. action name
2. reward / yield
3. condition / blocker
4. current status / result

Anything else is secondary.

### 2. No long explanation on the default path

Do not use the main view to explain:

- principles
- system design
- implementation details
- which reads or hooks are being used

If something needs explanation, move it behind an advanced affordance.

### 3. One screen, one primary job

- Home: asset state and next action
- Mining: choose task -> preview -> confirm
- Arena: choose PK or Battle Royale
- Auto: choose strategy / write prompt / submit
- Settings: real settings only

### 4. Long text moves backward

- advanced explanation goes into collapses, drawers, or secondary routes
- proof / ledger / operator detail must stay behind `Advanced`
- the default screen must not read like a dashboard essay or protocol walkthrough

### 5. Interaction beats copy

- if the action can live in a modal or bottom sheet, do not stack it into the page body
- if cards and labels can drive the decision, do not replace them with paragraphs
- if a state color, number, and chip are enough, do not add filler sentences

### 6. Current negative examples to remove

- Home has too much filler copy
- Companion has too much filler copy
- Arena stacks multiple systems into one long page
- Auto reads like an operator console
- the persistent companion stage still includes explanatory text that should not be default-visible

These are not polish notes. They are active structural defects.

## Progress checkpoint - 2026-04-13 session 16

This pass executed the first five reset tasks as one closure batch.

### Completed in this pass

1. Stop false zero states
- wallet CLW reads now surface loading / failed / real-value states instead of silently degrading to `0`
- upkeep/deposit flow also reflects wallet CLW read failure instead of pretending the user has `0`

2. Compress shell chrome
- top-right extra CTA was removed from the shell
- long NFA names no longer own the topbar width
- the switcher is now compact and token-centric
- the persistent stage was reduced to:
  - title
  - status
  - compact readouts

3. Remove duplicated structure
- `OwnedCompanionRail` was removed from page bodies
- shell remains the only lobster-switch surface

4. Merge Home and Companion
- `/companion` now redirects to `/`
- Home is the single ownership / next-action surface
- redundant identity/presence duplication was removed from the main flow

5. Rewrite Play interaction model
- task cards now open one modal/sheet flow
- preview / retry / confirm / execute are now in the same container
- preview failure no longer appears lower on the page

### Additional structural cleanup landed in the same pass

- Arena now opens from a mode split:
  - PK
  - Battle Royale
- Auto now leans toward:
  - strategy
  - prompt
  - claim request
  - result
  with advanced detail pushed behind a secondary toggle

### Verification

- `npm --prefix frontend run build`
- passed

### Next priority after session 16

1. real-wallet validation
2. real-device / PWA validation
3. keep stripping filler copy from nested panels
4. finish Chinese-first cleanup on secondary components

## Progress checkpoint - 2026-04-13 session 17

This pass handled the latest real-device defects before any further art work.

### Completed in this pass

1. Wallet `Claworld` read path hardened
- the rebuilt shell and upkeep panel now read token balance through ERC20 `balanceOf(...)`
- this is intended to eliminate the misleading token-balance helper path on the main surfaces

2. Token naming tightened
- active rebuilt-shell surfaces now use `Claworld` instead of `CLW`
- compact value formatting now follows the expected readability pattern:
  - `1k`
  - `500k`
  - `1M`

3. Persistent stage compressed again
- the image slot was removed from the fixed stage
- the stage now behaves as a compact status strip instead of a half-screen hero
- no blank right-side art gutter remains

4. Home duplicate middle section removed
- the page no longer repeats the same companion summary below the fixed stage
- Home now starts directly from action and maintenance surfaces

5. Mining preview failure reduced to a compact modal state
- raw viem revert blobs are no longer allowed to dominate the preview sheet
- preview failure now resolves to:
  - short error
  - retry
  - close
- modal height was reduced to behave more like a bounded action sheet on mobile

### Verification

- `npm --prefix frontend run build`
- passed

### Updated next priority after session 17

1. verify live deployed wallet `Claworld` balance on the rebuilt shell
2. continue stripping filler copy from nested panels
3. continue turning Arena / Auto inner flows into shorter decision surfaces
4. keep art/motion blocked until these live interaction defects are cleared

## Progress checkpoint - 2026-04-13 session 18

This pass continued the reset plan in the correct order: fix live blockers before touching art.

### Completed in this pass

1. Harden wallet `Claworld` balance reads
- the shell active-companion layer now uses:
  - contract read query
  - direct-chain fallback read
- the displayed wallet amount now prefers the successful non-zero read instead of trusting a single stale source

2. Add a local mining preview fallback
- on-chain `previewTypedTaskOutcome(...)` was confirmed unreliable on the deployed contract path
- `/play` now keeps the UX alive by switching to a local estimate when needed
- this keeps the Mining loop usable:
  - choose task
  - preview
  - confirm
  - execute

3. Compress shell + panel geometry further
- Home stage now uses the compact shell strip too
- topbar, stage, card, panel, detail-row, and modal dimensions were reduced
- `/play` and `/arena` no longer spend a whole intro band above the actual actions

4. Strip more filler copy from default surfaces
- upkeep panel removed explanatory/debug lines from the main happy path
- PK panel removed several long paragraphs from:
  - top intro
  - recovery block
  - live match summary
  - join/create sections
  - confirm flow

5. Move PK wording toward game actions
- strategy labels are now shorter and more legible:
  - 强攻
  - 均衡
  - 防守
- main action verbs are now:
  - 开擂
  - 应战
  - 亮招
  - 结算
  - 清局

### Verification

- `npm --prefix frontend run build`
- passed

### Updated next priority after session 18

1. verify live wallet `Claworld` balance on the deployed shell using the real owner wallet
2. verify Mining fallback preview on the deployed shell
3. continue reducing text density on Arena / Auto default surfaces
4. only after the live interaction path is stable: resume art/motion and companion personality work

## Progress checkpoint - 2026-04-13 session 19

This pass focused on the next real product need: make the shell and Auto page readable without explanation.

### Completed in this pass

1. Topbar simplified further
- Chinese brand now reads `龙虾世界`
- Home topbar now exposes `铸造` as a direct action
- lobster switcher width/padding were reduced again

2. Auto page simplified into the intended interaction model
- removed the large intro band
- default path now prioritizes:
  - current state
  - strategy
  - one-line prompt
  - claim request
  - latest result
- permission detail remains available only behind `高级`

3. Auto copy became Chinese-first and shorter
- directive panel now behaves like a simple player control:
  - 保守 / 平衡 / 进取
  - 一句提示词
  - 保存策略
- claim-request panel now behaves like an action surface instead of an operator document
- default view no longer leads with protocol terms and English-heavy explanation

4. Live blockers were re-verified
- the real owner wallet balance for `Clawworld` was rechecked on-chain and is still ~`7.7M`
- deployed `previewTypedTaskOutcome(...)` still reverts on-chain
- therefore:
  - wallet read hardening stays required
  - local Mining preview fallback stays required

### Verification

- `npm --prefix frontend run build`
- passed

### Updated next priority after session 19

1. deploy and verify the latest shell in the real environment
2. continue stripping verbose copy from remaining Arena / Settings surfaces
3. check every top-level route against the hard rule:
   - action
   - reward
   - blocker
   - result
4. keep art/motion behind live interaction stability

## Long task plan

### Phase 1 — Stop false zero states

Goal:

- make read failures impossible to confuse with true zero balances / zero reserve / zero upkeep

Tasks:

- refactor active-companion data layer so failed reads do not default silently to `0`
- distinguish:
  - loading
  - read error
  - real zero
- surface per-source failures for:
  - wallet Claworld
  - router reserve
  - daily upkeep
  - active state
  - trait reads
- block action CTAs only from real conditions, not from fallback-zero pollution

Acceptance:

- disconnected wallet, failed RPC read, and real zero balance each render differently
- user can tell whether the wallet truly has `0` or the read failed

### Phase 2 — Compress shell chrome

Goal:

- reclaim vertical budget and stop topbar overflow on real phones / PWA

Tasks:

- redesign topbar to tolerate long NFA names
- reduce or remove top-right CTA clutter
- ensure language toggle never gets pushed off-screen
- shrink persistent companion stage to a compact status header:
  - remove subtitle
  - remove explanatory chips
  - keep only key status and numbers
- reduce art footprint to support a later animated GIF without taking half the screen

Acceptance:

- topbar never overflows on long names
- stage consumes clearly less than current height on mobile
- language toggle and selector remain tappable on narrow devices

### Phase 3 — Remove duplicated structure

Goal:

- remove redundant navigation and duplicate information surfaces

Tasks:

- delete `OwnedCompanionRail` from page bodies
- keep lobster switching only in the shell
- merge Home and Companion into one real homepage
- redefine the single homepage as:
  - current lobster
  - reserve / upkeep / wallet
  - next actions
  - minimal recent result/output

Acceptance:

- no page below the shell repeats lobster switching
- user no longer has to decide between two near-duplicate “home/companion” pages

### Phase 4 — Rewrite Play interaction model

Goal:

- make task mining feel like one compact action, not a long scroll page

Tasks:

- make task cards the primary surface
- move preview into modal/bottom-sheet
- move confirm into the same flow
- keep errors and retry inside the modal, not lower on the page
- result should return as a compact success/result surface

Acceptance:

- from tap to result, the user stays in one interaction container
- preview failure appears where the action was initiated

### Phase 5 — Rewrite Arena interaction model

Goal:

- separate PK and Battle Royale instead of stacking them down one long page

Tasks:

- first screen: choose PK or Battle Royale
- each mode opens its own focused surface
- PK flow:
  - browse/create/join
  - commit
  - reveal
  - settle/cancel
  inside modal/sheet or route-scoped overlay
- BR flow:
  - lobby
  - enter
  - claim
  - result
  inside its own focused surface

Acceptance:

- user no longer scrolls through both PK and BR to act in one of them
- mode separation is visually and structurally obvious

### Phase 6 — Rewrite Auto interaction model

Goal:

- turn Auto from operator dashboard into user action surface

Tasks:

- reduce the page to:
  - choose strategy
  - write prompt
  - choose action scope
  - submit
  - see result / latest decision output
- move proof/ledger/operator detail behind expandable advanced section
- remove large explanatory text blocks from default view

Acceptance:

- a normal user can understand what to do on Auto without reading long paragraphs
- the default screen reads like a control panel, not an internal operations page

### Phase 7 — Chinese-first cleanup

Goal:

- make Chinese mode actually read as Chinese-first

Tasks:

- clean mixed bilingual copy on active pages
- reduce English to badges, labels, or controlled ornament only
- remove hardcoded English defaults from shared components
- normalize shell brand copy and action labels

Acceptance:

- Chinese mode does not show major English paragraphs or mixed default props on the main path

### Phase 8 — Settings into real settings

Goal:

- replace placeholder cards with real controls

Tasks:

- keep wallet connect/disconnect
- add real language control
- add real PWA/install/offline controls if available
- hide future features that are not yet operable

Acceptance:

- settings page contains real settings, not roadmap cards disguised as controls

### Phase 9 — Only after that: art and motion

Goal:

- strengthen companion identity after the app is structurally correct

Tasks:

- integrate final GIF/animated companion art
- improve result feedback
- add stateful character reactions
- tighten visual warmth without reintroducing clutter

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

## Progress checkpoint - 2026-04-13 session 6

This pass stayed on mobile stability rather than visual expansion:

- bottom-tab layout now derives from shared shell-height and safe-area variables
- standalone PWA no longer relies on a raw unbounded `env(safe-area-inset-bottom)` bump inside the tab bar
- main content bottom spacing now tracks the actual tab-shell footprint, so browser mode and standalone mode stay aligned

Execution rule remains unchanged for the next passes:

- functional correctness and mobile/PWA stability first
- visual/art upgrades only after the live owner-path flows are stable

## Progress checkpoint - 2026-04-13 session 7

This pass continued the function-first cleanup on the rebuilt shell:

- Arena now has an in-page Battle Royale refresh path instead of forcing a full reload when match reads fail
- Battle Royale overview state now exposes refresh / refetching / read-error signals to the page layer
- Auto now lists the exact autonomy permission gates instead of hiding readiness behind a single aggregate meter
- the Battle Royale autonomy claim-request surface now names the missing boundaries directly before the user signs anything

This keeps the current priority intact:

- resolve functional ambiguity first
- only push visual/art upgrades after the main owner-path and autonomy-path control surfaces are unambiguous

## Progress checkpoint - 2026-04-13 session 8

This pass stayed on the same function-first track and reduced user-facing protocol leakage:

- `PKArenaPanel` no longer surfaces raw action enums like `create / join / reveal / settle / cancel` in the main confirm/result cards
- the recent PK tape now uses player-facing summaries instead of mixed technical fragments like `stake / winner / reward / cancelled`
- confirm and result copy now describes:
  - locking a move
  - submitting reveal
  - settling
  - clearing stale matches
  instead of leaning on raw protocol terminology
- owner-path blocker messages now read in wallet/asset language instead of `owner`/`stake` shorthand

Execution priority remains unchanged:

- keep removing functional ambiguity and terminology leakage first
- do not spend time on larger art direction or animation passes until the live transaction surfaces read clearly in production

## Progress checkpoint - 2026-04-13 session 9

This pass addressed the "flash of empty" problem on the rebuilt shell:

- active-companion loading now renders as skeleton state instead of temporarily showing fake `0 / -- / empty` values
- the top companion stage now has a dedicated loading skeleton for:
  - title block
  - status chip
  - signal chips
  - readout cards
- the shell-level multi-NFA switcher now reflects loading and stops cycling while the live snapshot is still syncing
- Home and Companion now render route-level loading skeletons on their main summary surfaces instead of exposing dead intermediate values

Priority remains the same:

- keep fixing functional clarity and state communication first
- only move deeper into art/animation once live loading, signing, result, and maintenance states are all legible

## Progress checkpoint - 2026-04-13 session 10

This pass extended the same state-communication rule into the action pages:

- `Play` now shows a preview skeleton while TaskSkill preview and cooldown reads are resolving
- `Arena` now treats Battle Royale as its own loading surface instead of collapsing into a fake "waiting" state while reads are still pending
- `Auto` now shows route-level skeletons while autonomy setup, proof, and claim-path reads are still syncing

The practical rule is now clearer across the rewrite:

- do not show dead `-- / 0 / waiting` placeholders when the data is simply not loaded yet
- prefer explicit loading skeletons until the first trustworthy state is ready

## Progress checkpoint - 2026-04-13 session 11

This pass tightened transaction-state communication instead of adding more screens:

- `Play`, `PKArenaPanel`, and autonomy claim request now explicitly separate:
  - wallet signature step
  - on-chain confirmation step
- each surface now tells the user what to do next:
  - go to the wallet
  - keep the page open
  - wait for receipt / request-id decode

This is still the same execution rule:

- make the live transaction surfaces readable and testable first
- treat visual polish as secondary until a user can reliably tell whether they need to sign, wait, or retry

## Progress checkpoint - 2026-04-13 session 12

This pass stayed on functional recovery instead of visual expansion:

- `useAutonomyActionSetup()` and `useAutonomyProofs()` now expose explicit read recovery primitives:
  - `error`
  - `isRefreshing`
  - `refresh()`
- `/auto` now surfaces failed autonomy reads in-page instead of quietly collapsing into partial empty state
  - setup read failures
  - proof/ledger read failures
  - Battle Royale overview read failures
  - settled-claim scan failures
- `/auto` now gives the user a direct `重新读取` action instead of implying that a full page refresh is the only recovery path
- the settled-claim scan hook now supports manual refresh so Auto recovery re-runs claim-window reads too
- `/play` now exposes an explicit `重新读取预览` path when any of the pre-execution reads fail:
  - task preview
  - cooldown timestamp
  - gas estimate

Why this matters:

- production UX cannot treat RPC/read failures as if they were legitimate empty states
- before real-wallet validation, the user needs a page-level recovery path that keeps context and selected companion intact
- this continues the same rule as the signing-feedback pass: tell the user whether to sign, wait, or retry

## Progress checkpoint - 2026-04-13 session 13

This pass extended the same recovery rule into PK:

- `PKArenaPanel` no longer leaves read/action failures as low-visibility footer text
- Arena now exposes a dedicated PK recovery surface when:
  - recent match reads fail
  - PK action submission fails
- the user now gets an in-page `重新读取对局` action instead of having to reload the entire app
- fallback PK action labels also no longer leak raw internal enum strings on unknown branches

Why this matters:

- PK is one of the longest owner-path loops in the rebuilt shell, so it cannot hide failures at the edge of the page
- recovery must stay local to the Arena flow; otherwise users lose match context, selected strategy, and the current lobster frame

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
- page-level retry/read-recovery gaps that still appear under real RPC conditions

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
