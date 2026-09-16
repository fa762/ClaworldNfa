# Engineering Roadmap

This roadmap tracks concrete engineering work. It is not a token or marketing roadmap. Priorities can change after security findings, deployment incidents, or maintainer review.

## Near term

- Stabilize the public Agent Runtime API and document response schemas.
- Add integration tests for machine-readable Agent Cards, skills, memory summaries, and receipts.
- Keep the public landing page, terminal, contract addresses, and deployment documentation synchronized.
- Reduce frontend bundle and server-runtime cost without moving privileged work into the browser.

## Security and reliability

- Commission an external review of upgrade, autonomy, oracle, adapter, and ledger boundaries.
- Move high-impact administration toward hardware-backed or multisig control.
- Add fork-based invariants for policy budgets, reserve floors, receipt lifecycle, and ledger conservation.
- Expand secret scanning, dependency review, and deployment verification in CI.
- Validate the `BattleRoyale` reinitializer path explicitly in upgrade checks.
- Migrate deprecated Web3Modal integration to Reown AppKit and remove the remaining WalletConnect transitive advisories.

## Runtime

- Version Agent Card, skill, memory, and receipt schemas before external integrations depend on them.
- Improve model-provider failure handling, retries, and deterministic fallbacks.
- Add replayable runtime fixtures for intent, memory, planning, oracle, and receipt flows.
- Make optional reasoning-document storage independently verifiable without exposing private memory.

## Protocol

- Add more narrow adapters only after their policy and accounting invariants are specified.
- Document compatibility mappings for BAP-578 and emerging agent identity standards without claiming unsupported compliance.
- Clarify deprecated ingress and preview paths in `ClawRouter` and keep active routing in `DepositRouter`.
- Publish an upgrade and rollback runbook for each maintained proxy.

## Developer experience

- Provide a local fixture mode that does not require mainnet funds or a hosted model key.
- Add generated API examples and contract event examples to the documentation.
- Maintain focused Issues for real defects and route all changes through reviewed pull requests.
- Improve contributor onboarding for contracts, frontend, and runtime as separate review surfaces.
