# Agent Runtime Verification

This document tracks how to verify the Agent Runtime API beyond code review.

## Goal

The runtime layer should prove that each NFA can be discovered, inspected, and audited from public HTTPS endpoints.

It is not enough for the code to compile. The live product should show:

- project-level agent discovery
- token-level agent identity
- skill discovery
- action receipt auditability
- memory root and CML summary visibility
- public URL safety
- frontend-to-backend runtime availability

## Smoke Command

```bash
npm run verify:agent-runtime
```

Optional overrides:

```bash
AGENT_RUNTIME_BASE_URL=https://clawnfaterminal.xyz \
AGENT_RUNTIME_TOKEN_ID=3 \
AGENT_RUNTIME_REQUEST_ID=21 \
npm run verify:agent-runtime
```

## Verification Angles

### 1. Public discovery

Endpoint:

```text
/.well-known/agent-card.json
```

Checks:

- returns `200`
- JSON schema is `claw.project-agent-card.v0`
- chain is `eip155:56`
- contract addresses are present
- capabilities include memory, policy execution, receipts, skills and CA intelligence
- public payload does not leak `0.0.0.0`, `127.0.0.1` or `localhost`

### 2. NFA agent identity

Endpoints:

```text
/api/agents/{tokenId}/agent-card
/agents/{tokenId}/agent-card.json
```

Checks:

- returns `200`
- token id matches
- owner address exists
- NFA body fields exist: level, rarity, shelter, status, ledger balance, upkeep, personality and DNA
- memory root exists
- policy and execution addresses exist
- public and API routes agree on the same NFA identity

### 3. Skill discovery

Endpoint:

```text
/api/agents/{tokenId}/skills
```

Checks:

- returns `200`
- includes:
  - task mining
  - PK arena
  - Battle Royale
  - ledger finance
  - market
  - CML memory
  - BSC contract intelligence
- each chain skill has contract / adapter metadata where applicable
- callable flags are present

### 4. Receipt auditability

Endpoints:

```text
/api/agents/{tokenId}/receipts
/api/receipts/{requestId}
/receipts/{requestId}
```

Checks:

- returns `200`
- receipt list is not empty for active NFAs
- single receipt exposes:
  - request id
  - NFA id
  - action kind / skill
  - status label
  - requested spend
  - actual spend
  - capability hash
  - payload hash
  - result hash
  - receipt hash
  - reasoning CID
  - created / executed timestamps
- public receipt route returns the same request id as the API route

### 5. Memory root visibility

Endpoint:

```text
/api/agents/{tokenId}/memory/summary
```

Checks:

- returns `200`
- token id matches
- learning root exists
- learning version / updated time exists
- full backend CML storage is available
- summary exposes a snapshot hash, pulse, identity text and hippocampus size
- timeline and write routes are backed by persistent server storage

Backend routes used by the frontend:

```text
GET  /memory/{tokenId}/summary
GET  /memory/{tokenId}/timeline?limit=6
POST /memory/{tokenId}/write
```

Optional mutating smoke:

```bash
AGENT_RUNTIME_VERIFY_WRITE=1 npm run verify:agent-runtime
```

### 6. Security and public URL hygiene

Checks:

- no public Agent Card endpoint should expose container URLs such as `https://0.0.0.0:3000`
- no secret env value should appear in runtime JSON
- WAF and rate limits should not block normal Agent Runtime JSON reads
- backend memory routes require the private API token when called directly

## Current Live Verification

Last checked: `2026-04-29`

Command:

```bash
npm run verify:agent-runtime
```

Result:

```text
Agent Runtime verification passed.
- project-card capabilities=6
- agent-card owner=0x4929BD86e8Be70a167cCe03A64AaC692E0c2B3b2 level=3
- skills=7
- receipts=5
- receipt-21 status=executed skill=battle_royale
- memory-storage=available snapshot=<hash prefix>
```

Note:

- `memory-storage=available` means the public Agent Runtime endpoint can read the on-chain learning root and the backend CML snapshot summary through the frontend-to-backend bridge.
