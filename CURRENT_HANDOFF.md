# Current Handoff

Last updated: 2026-04-10 20:35 Asia/Singapore

Use this file as the source of truth if Codex account, session, or chat context changes.

## Current state

The `TaskSkill` monthly-cap task issue is already fixed on mainnet.

Verified facts:

- `TaskSkill` proxy: `0xaed370784536e31BE4A5D0Dbb1bF275c98179D10`
- current implementation: `0x545e41065C63d25ceAaF374f77B3628bC1E7CB48`
- proxy owner: `0x4929BD86e8Be70a167cCe03A64AaC692E0c2B3b2`
- `nfa()`: `0xAa2094798B5892191124eae9D77E337544FFAE48`

Mainnet upgrade transactions:

- implementation deploy: `0xad07ac194d4926379d6a3a197851a0f850960f0e37960b2be679d77c11a0e699`
- proxy `upgradeTo`: `0x8185b5f707018455b62ae2f861c8a4bfb2239692abbdb1a3006ad417f762fe5e`

Measured gas:

- implementation deploy: `2019662 gas` at `0.05 gwei` = `0.0001009831 BNB`
- `upgradeTo`: `39221 gas` at `0.05 gwei` = `0.00000196105 BNB`

Direct on-chain verification already done:

- `NFA #112` `ownerCompleteTypedTask(...)` succeeds under `eth_call`
- the old `Monthly cap exceeded` path no longer blocks task completion

## What changed in code

Relevant commits already on `origin/main`:

- `63c4bcb` `fix: keep tasks working at personality cap`
- `d53fa5c` `fix: make taskskill upgrade manifest-free`

Contract behavior:

- if personality evolution hits monthly cap, task completion continues
- personality drift is skipped for that execution
- `TaskPersonalityDriftSkipped` is emitted

Relevant files:

- `contracts/skills/TaskSkill.sol`
- `test/TaskSkill.test.ts`
- `scripts/upgrade-taskskill-mainnet.ts`

## Frontend state

Frontend already contains the diagnostic fix:

- simulate before submit
- show clearer task revert reasons
- include a dedicated `Monthly cap exceeded` message
- stop hardcoding coarse task gas

Relevant files:

- `frontend/src/app/game/page.tsx`
- `frontend/src/game/chain/contracts.ts`

Build status:

- `frontend` `npm run build:mainnet` passes locally

This means:

- if users still see the old vague wallet error, the likely issue is deployed frontend version, cache, or wallet-specific UI behavior
- the chain-side fix is already live

## What is still unfinished

### 1. BattleRoyale autonomy is not fully production-closed

Target remains:

- `enter`
- `reveal`
- `claim`

Do not claim full BattleRoyale closure yet.

### 2. AI proxy frontend still needs cleanup

Known gaps:

- standalone AI proxy page needs final product polish
- holder wallet `Claworld` balance display previously showed `0.00` in some states
- BattleRoyale participant semantics must remain `nfaId`-centric
- holder wallet is only for permission and threshold validation

### 3. CML memory still needs deeper runtime influence

Target:

- CML should affect task / PK / BattleRoyale decisions
- root sync should be queued, not written on every action

## Product rules already decided

- token name is `Claworld`
- do not write `CLW`
- do not write `Clawworld`
- AI proxy eligibility checks the wallet holding the NFA
- current threshold is fixed token amount, not staking
- later it can evolve into dynamic USD-equivalent threshold

## Runner / server context

Vultr runner host:

- host: `139.180.215.3`
- user: `root`

Directory:

```bash
/opt/clawworld-autonomy-runner
```

Useful commands:

```bash
ssh root@139.180.215.3
docker ps --filter name=claw-autonomy-runner
docker logs --tail 200 claw-autonomy-runner
```

## Immediate next steps

1. Deploy the frontend build that already contains the better task error handling.
2. Re-test a real task flow from wallet UI against the already-upgraded mainnet `TaskSkill`.
3. Continue BattleRoyale autonomy production closure.
4. Continue AI proxy page cleanup and `Claworld` balance display fixes.

## Worktree note

The main user worktree at `D:\claworldNfa\clawworld` is very dirty.
Do not use `git add .` there blindly.
Use a clean worktree for production fixes when possible.
