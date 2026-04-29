# claworldnfa Agent Body Protocol Roadmap

Last updated: 2026-04-29

## 0. North Star

claworldnfa should evolve from an AI companion dapp into a user-owned AI Agent body protocol.

The target sentence:

> claworldnfa is a user-owned Non-Fungible Agent body protocol. It gives an AI agent an ownable on-chain body, persistent memory anchors, policy-controlled execution, skill adapters, and verifiable action receipts.

Chinese version:

> claworldnfa 是用户拥有的 Non-Fungible Agent 身体协议。它让 AI Agent 拥有链上身体、持续记忆锚点、权限控制执行、技能适配器和可验证行动回执。

The product can still look like "龙虾世界" to normal users. The protocol story should be larger:

```text
ERC-8004 tells the world who the agent is.
BAP-578 makes the agent ownable.
claworldnfa gives the agent a body, memory, permissions, actions, and receipts.
```

## 1. Strategic Position

The project should not fight existing agent standards. It should compose with them and fill the missing layer.

Current public agent stack:

```text
Identity and discovery       ERC-8004, DID, Agent Card
Ownable agent body           BAP-578, ERC-721, ERC-6551
Tool access                  MCP, Skills, OpenAPI
Agent-to-agent messaging     A2A
Payments                     x402, AP2
Agent commerce               ERC-8183
Wallet execution             Agentic Wallet, ERC-4337, EIP-7702
Memory                       CML, memory roots, decentralized memory layers
Receipts and audit trail      ActionHub, receipt hash, reasoning CID
```

claworldnfa's strongest position:

```text
User-owned AI Agent body + memory root + policy execution + action receipt
```

This is larger than BNB Chain, but BNB Chain is the best first settlement layer because the project already has:

- Claworld token and Four.meme/Flap context
- BNB Chain deployment history
- BAP-578 narrative fit
- low-cost frequent action execution
- game and agent economy primitives already live

The language should become:

```text
BNB Chain is the first settlement layer.
claworldnfa is designed to be agent-standard compatible and chain-portable.
```

## 2. Stand On Existing Open Standards

Do not re-invent basic agent standards. Reuse and align with existing open-source work.

| Area | External base | What it gives | How claworldnfa uses it |
| --- | --- | --- | --- |
| Agent identity | ERC-8004 | on-chain agent identity, agentURI, reputation, validation | map each ClawNFA tokenId to an ERC-8004 agentId or agent registration file |
| NFA body | BAP-578 | ownable, tradable, upgradable agents with autonomous execution | position ClawNFA as a BAP-578-aligned implementation |
| Agent discovery | A2A Agent Card | JSON card for identity, capabilities, endpoint, auth | expose `/.well-known/agent-card.json` and `/agents/:id/agent-card.json` |
| Tools | MCP | standard way to expose resources, prompts, and tools | wrap Clawworld backend actions and CA scanner as controlled tools |
| Payments | x402 | HTTP-native machine payments | future pay-per-tool or paid CA scans without accounts |
| Commerce | ERC-8183 | job escrow, submission, evaluator attestation | future agent-to-agent task market and paid autonomous jobs |
| Token-owned accounts | ERC-6551 | NFT-bound account model | optional future external account type for NFA assets |
| Wallet delegation | ERC-4337 / EIP-7702 / Agentic Wallet | session keys, smart accounts, isolated balances | future external execution account adapters |
| Memory layer | CML / Unibase-style memory | persistent cross-session memory | keep full memory off-chain, anchor roots on-chain |

## 3. What claworldnfa Already Has

These modules should be renamed and presented as agent infrastructure, not only game logic.

| Current module | Protocol-level meaning |
| --- | --- |
| `ClawNFA` | on-chain body and ownership primitive |
| `learningTreeRoot` | memory root anchor |
| `ClawRouter` | NFA state, ledger, upkeep, asset boundary |
| `PersonalityEngine` | bounded trait evolution and anti-manipulation layer |
| `AutonomyRegistry` | agent policy engine |
| `ActionHub` | request, sync, execute, receipt lifecycle |
| `Action adapters` | skill execution boundary |
| `Oracle runner` | off-chain reasoning and action executor |
| `BattleRoyale / PK / Task` | example skills |
| `CML` | structured memory model |
| Terminal UI | conversation-first agent interface |
| CA scanner | example external analysis skill |

The core insight:

```text
Most agent projects show chat.
claworldnfa shows identity, memory, assets, permissions, and completed actions.
```

## 4. Final Architecture

Target architecture:

```text
User
  |
  v
Conversation Runtime
  - natural language
  - intent detection
  - action cards
  - memory commands
  - chain queries
  |
  v
NFA Body Layer
  - ClawNFA tokenId
  - owner
  - level / traits / state
  - internal ledger
  - upkeep / dormancy
  |
  v
Memory Layer
  - CML local/off-chain memory
  - memory root hash
  - learningTreeRoot on-chain
  - optional storage provider
  |
  v
Policy Layer
  - allowed operators
  - allowed adapters
  - allowed protocols
  - spend caps
  - daily caps
  - reserve floor
  - failure breaker
  - emergency pause
  |
  v
Action Layer
  - requestAutonomousAction
  - syncOracleResult
  - executeSyncedAction
  - finalize
  - receipt hash
  - reasoning CID
  |
  v
Skill Adapter Layer
  - Task mining
  - PK
  - Battle Royale
  - Market
  - Finance
  - CA scanner
  - future MCP / API tools
  |
  v
External Standards
  - ERC-8004 identity
  - A2A Agent Card
  - MCP tools
  - x402 payments
  - ERC-8183 jobs
  - Agentic Wallet / ERC-4337 / ERC-6551
```

## 5. Standard Interfaces We Should Publish

### 5.1 Agent Card

Minimum endpoint:

```text
GET /.well-known/agent-card.json
GET /agents/:tokenId/agent-card.json
```

Target payload:

```json
{
  "name": "ClawNFA #112",
  "description": "User-owned Non-Fungible Agent with memory, policy execution, and action receipts.",
  "version": "1.0.0",
  "chain": "eip155:56",
  "nfaContract": "0x...",
  "tokenId": "112",
  "owner": "0x...",
  "agentWallet": "0x...",
  "serviceEndpoint": "https://api.example.com/chat/112/send",
  "memoryRoot": "0x...",
  "capabilities": [
    "claw.memory_root",
    "claw.policy_execution",
    "claw.action_receipt",
    "claw.task_mining",
    "claw.pk_arena",
    "claw.battle_royale",
    "claw.contract_intel"
  ],
  "interfaces": {
    "a2a": "https://api.example.com/a2a/112",
    "mcp": "https://api.example.com/mcp/112",
    "receipts": "https://api.example.com/agents/112/receipts"
  }
}
```

### 5.2 Memory Root Schema

Memory should stay off-chain by default. Only roots and proofs should be anchored.

```json
{
  "nfaId": "112",
  "memoryVersion": 3,
  "cmlSchema": "claw.cml.v1",
  "memoryRoot": "0x...",
  "storage": {
    "type": "local | ipfs | greenfield | custom",
    "uri": "..."
  },
  "createdAt": 1777420800,
  "previousRoot": "0x..."
}
```

### 5.3 Policy Schema

Policy must be readable by humans and machines.

```json
{
  "nfaId": "112",
  "enabled": true,
  "operators": ["0x..."],
  "adapters": ["0x..."],
  "protocols": ["task", "pk", "battle_royale", "market", "contract_intel"],
  "singleSpendCap": "100000000000000000000",
  "dailySpendCap": "500000000000000000000",
  "reserveFloor": "200000000000000000000",
  "failureBreaker": 3,
  "emergencyPause": false
}
```

### 5.4 Action Receipt Schema

This is one of the most important parts of the project.

```json
{
  "requestId": "21",
  "nfaId": "5",
  "actionKind": "battle_royale_enter",
  "protocolId": "battle_royale",
  "adapter": "0x...",
  "requester": "0x...",
  "executor": "0x...",
  "capabilityHash": "0x...",
  "payloadHash": "0x...",
  "resultHash": "0x...",
  "receiptHash": "0x...",
  "reasoningCid": "ipfs://...",
  "requestedSpend": "166666666666666666666",
  "actualSpend": "166666666666666666666",
  "status": "executed",
  "createdAt": 1777420800,
  "executedAt": 1777420900
}
```

### 5.5 Skill Adapter Manifest

Every skill should be installable and auditable.

```json
{
  "id": "claw.skill.battle_royale",
  "name": "Battle Royale",
  "adapter": "0x...",
  "protocolId": "battle_royale",
  "actions": [
    {
      "kind": "enter",
      "spendAsset": "Claworld",
      "requiresPolicy": true,
      "receipt": true
    },
    {
      "kind": "claim",
      "spendAsset": "none",
      "requiresPolicy": true,
      "receipt": true
    }
  ]
}
```

## 6. Roadmap

### Phase 0: Narrative Alignment

Goal: make the public story match the real technical direction.

Tasks:

- [ ] Update README top positioning.
- [ ] Update PROJECT.md for hackathon submission.
- [ ] Update homepage copy from "AI pet game" to "user-owned AI Agent body protocol".
- [ ] Add architecture diagram with identity, body, memory, policy, action, tools, commerce.
- [ ] Add standards compatibility table.

Done when:

- A new reader can understand in 2 minutes that claworldnfa is not just a game.
- The repo explains how the project composes with ERC-8004, BAP-578, MCP, A2A, x402 and ERC-8183.

### Phase 1: Agent Card and Public Identity Surface

Goal: every NFA can be discovered as a machine-readable agent.

Tasks:

- [ ] Add backend route `GET /agents/:tokenId/agent-card.json`.
- [ ] Add route `GET /.well-known/agent-card.json` for default project-level card.
- [ ] Include owner, tokenId, chain, contract, memory root, endpoint and capabilities.
- [ ] Add frontend link: "Agent Card" inside NFA detail panel.
- [ ] Add docs explaining agent card fields.

Open-source base to reuse:

- A2A Agent Card structure.
- ERC-8004 registration file structure.

Done when:

- A browser or another agent can fetch a ClawNFA card and know how to talk to it.

### Phase 2: ERC-8004 / BAP-578 Alignment

Goal: map ClawNFA into the broader on-chain agent identity ecosystem.

Tasks:

- [ ] Write `docs/standards/ERC8004_BAP578_ALIGNMENT.md`.
- [ ] Draft `ClawAgentIdentityBridge.sol`.
- [ ] Map `tokenId -> agentRegistry -> agentId -> agentURI`.
- [ ] Add optional `agentWallet` field.
- [ ] Add events for mapping updates.
- [ ] Keep this as sidecar first. Do not risk the existing core contracts.

Open-source base to reuse:

- `erc-8004/erc-8004-contracts`.
- ERC-8004 IdentityRegistry ABI and registration flow.

Done when:

- ClawNFA can truthfully say it is ERC-8004 aligned.
- A ClawNFA token can point to an ERC-8004-style agent identity file.

### Phase 3: Action Receipt Index

Goal: every autonomous action becomes readable as a public receipt.

Tasks:

- [ ] Add backend endpoint `GET /agents/:tokenId/receipts`.
- [ ] Add endpoint `GET /receipts/:requestId`.
- [ ] Normalize ActionHub receipts into the public schema.
- [ ] Expose `reasoningCid`, `capabilityHash`, `payloadHash`, `resultHash`, `receiptHash`.
- [ ] Add frontend receipt drawer.
- [ ] Add receipt section to Agent Card.

Open-source base to learn from:

- ERC-8004 feedback file pattern.
- ERC-8183 job lifecycle.
- x402 payment proof style.

Done when:

- A user can ask "你上次做了什么" and get a verifiable action history.
- A developer can index agent behavior without scraping random events.

### Phase 4: Memory Root Productization

Goal: make CML memory visible, controllable and anchored.

Tasks:

- [ ] Define `claw.cml.v1` schema.
- [ ] Add memory summary endpoint.
- [ ] Add memory root endpoint.
- [ ] Add user action: "save this to memory".
- [ ] Add user action: "show memory".
- [ ] Add memory root update receipt.
- [ ] Make clear that full memory stays local/off-chain unless user chooses storage.

Open-source base to study:

- Unibase/Membase memory framing.
- local-first memory systems.
- Merkle root and content-addressed storage patterns.

Done when:

- The NFA can remember user-approved facts.
- The memory state has a verifiable root.
- The user understands what is private and what is public.

### Phase 5: Skill Adapter SDK

Goal: make new skills easier to add without rewriting ActionHub logic.

Tasks:

- [ ] Define Skill Manifest JSON.
- [ ] Add TypeScript helper for adapter payload encoding.
- [ ] Add TypeScript helper for policy preflight.
- [ ] Add sample adapters:
  - task mining
  - PK
  - Battle Royale
  - finance
  - CA scanner
- [ ] Add docs for adapter lifecycle:
  - preview
  - request
  - sync
  - execute
  - finalize
  - receipt

Open-source base to reuse:

- MCP tool schema concepts.
- Binance Skills style packaging where possible.
- Existing project adapters.

Done when:

- A developer can add a new NFA skill by implementing a manifest and adapter.

### Phase 6: MCP and A2A Gateway

Goal: let external AI clients use claworldnfa as tools and agents.

Tasks:

- [ ] Build a controlled MCP server for claworldnfa.
- [ ] Expose safe tools:
  - get_nfa_status
  - get_memory_summary
  - create_action_proposal
  - get_receipt
  - analyze_ca
- [ ] Do not expose raw spend tools without policy preflight.
- [ ] Add A2A endpoint that can receive task requests.
- [ ] Use Agent Card to advertise capabilities.

Open-source base to reuse:

- Model Context Protocol official SDK.
- A2A official SDK and Agent Card schema.

Done when:

- Claude, Codex, OpenClaw, Cursor or another agent client can discover claworldnfa capabilities safely.

### Phase 7: Payments and Agent Commerce

Goal: prepare for agents that can pay for tools, sell services, or accept paid jobs.

Tasks:

- [ ] Study x402 server and client examples.
- [ ] Define which claworldnfa endpoints could become paid:
  - premium CA scan
  - action simulation
  - strategy analysis
  - agent memory export
- [ ] Add optional x402 middleware in backend, disabled by default.
- [ ] Study ERC-8183 job escrow for agent-to-agent service jobs.
- [ ] Map ActionHub receipt to ERC-8183-style job completion in docs.

Open-source base to reuse:

- Coinbase x402 repo.
- ERC-8183 interface and job lifecycle.

Done when:

- claworldnfa can explain how an NFA could buy a tool call or sell an autonomous service.

### Phase 8: External Wallet and Account Adapters

Goal: keep the NFA body model while supporting multiple account types.

Account types:

```text
internal ClawRouter ledger
EOA
ERC-6551 token-bound account
ERC-4337 smart account
EIP-7702 delegated account
Binance Agentic Wallet
custom API account
```

Tasks:

- [ ] Define `ExternalAccountBinding` schema.
- [ ] Add docs for account boundary and permission model.
- [ ] Do not move core game balance until adapter safety is clear.
- [ ] Start with read-only account binding.
- [ ] Later add spend-cap execution.

Open-source base to reuse:

- ERC-6551 registry and account interfaces.
- ERC-4337 account abstraction patterns.
- Binance Agentic Wallet skill flow when publicly usable.

Done when:

- The NFA can have multiple execution accounts without confusing ownership, memory, or receipts.

## 7. What We Should Not Do

- Do not claim to replace ERC-8004.
- Do not claim to replace BAP-578.
- Do not put private chat logs on-chain.
- Do not let the model directly call spend functions without policy preflight.
- Do not build a custom wallet standard before testing Agentic Wallet, ERC-6551 and ERC-4337 options.
- Do not make the frontend a documentation dump.
- Do not call the project only a game in official technical material.

## 8. Success Criteria

Short-term success:

- The repo reads like an agent protocol reference implementation.
- Every NFA has an Agent Card.
- Action receipts are easy to inspect.
- Memory root concept is clear.

Mid-term success:

- ClawNFA maps to ERC-8004-style identity.
- Adapters can be added by third-party developers.
- MCP/A2A clients can call safe tools.
- Users can ask natural language questions and receive chain-backed answers.

Long-term success:

- A ClawNFA can move across apps with identity, memory, permissions and receipts intact.
- The NFA can use multiple account types.
- Other teams can build skills for claworldnfa.
- claworldnfa becomes a reference implementation for user-owned Non-Fungible Agents.

## 9. Immediate Next Batch

Recommended next implementation batch:

```text
1. Update README / PROJECT.md / homepage positioning.
2. Add this roadmap link to README.
3. Create Agent Card endpoint.
4. Create ERC-8004 / BAP-578 alignment doc.
5. Create Action Receipt public schema doc.
6. Create Memory Root public schema doc.
7. Draft ClawAgentIdentityBridge.sol as sidecar, not deployed yet.
```

This batch is high leverage because it upgrades the project's public category without destabilizing live contracts.

## 10. References To Stand On

- ERC-8004 EIP: https://eips.ethereum.org/EIPS/eip-8004
- ERC-8004 contracts: https://github.com/erc-8004/erc-8004-contracts
- BNB Chain AI agents / BAP-578 positioning: https://www.bnbchain.org/en/blog/bnb-chain-is-the-1-network-for-ai-agents
- BNB Chain ERC-8004 article: https://www.bnbchain.org/en/blog/making-agent-identity-practical-with-erc-8004-on-bnb-chain
- A2A specification: https://a2aproject.github.io/A2A/specification/
- A2A GitHub: https://github.com/a2aproject/A2A
- MCP specification: https://modelcontextprotocol.io/specification/2025-11-25
- MCP roadmap: https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
- x402 repo: https://github.com/coinbase/x402
- x402 docs: https://docs.cdp.coinbase.com/x402/docs/welcome
- Google AP2 announcement: https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol
- ERC-8183 EIP: https://eips.ethereum.org/EIPS/eip-8183
- ERC-6551 EIP: https://eips.ethereum.org/EIPS/eip-6551
- Binance Agentic Wallet announcement: https://www.binance.com/en/support/announcement/detail/0c533c5a820341ce87e5ddda76f36ac0
- Binance Agentic Wallet FAQ: https://www.binance.com/en/support/faq/detail/3ff00e2d488a41c4aaa4aabb6fc36763
- Unibase memory layer: https://www.unibase.com/
