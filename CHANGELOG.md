# Changelog

This file starts tracking notable changes from 2026-04-14 forward.

## [1.0.0] - 2026-09-16

### Added

- first formal public mainnet runtime release
- independently verifiable app, Agent Card, ClawHub, contract, and release entry points
- threat model covering owner, wallet, runtime, oracle, policy, ActionHub, adapter, skill, ledger, and receipt boundaries
- structured bug and feature request forms
- frontend linting and root/frontend typechecking in CI

### Changed

- repositioned the public site around persistent-agent engineering instead of token-first Web3 presentation
- documented the current open-source inventory and maintainer workflow
- formalized branch -> pull request -> review -> merge as the contribution path
- aligned the release version with the existing root package version `1.0.0`

### Security

- documented residual risk for each primary cross-layer threat
- removed the PK relayer's fallback to the generic deployer `PRIVATE_KEY`
- updated Next.js to `16.3.5` to clear the critical production advisory affecting the previous version
- removed the unused `local-cors-proxy` dependency and its unpatched legacy request chain
- retained rules-of-hooks and render-state checks as blocking lint rules while older React compiler migration debt remains tracked

### Migration

- hosted deployments using PK auto-reveal must provide a dedicated `PK_RELAYER_PRIVATE_KEY`
- no contract migration is required by this source release

### Known limitations

- no independent third-party audit is claimed
- reasoning-document availability depends on the configured upload mode
- hosted model, RPC, indexer, memory, and operator availability remain external dependencies
- React compiler-oriented effect, purity, and legacy typing cleanup remains open maintenance work
- WalletConnect/Web3Modal still carries moderate transitive advisories and requires a reviewed Reown AppKit migration rather than a forced in-place downgrade

This release is a versioned baseline of the live architecture. It does not claim that every planned data provider, interface refinement, or external audit is complete.

## 2026-04-14

### Added

- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS`

### Updated

- `README.md` now links to the new project docs
- `PROJECT.md` now points to the supporting architecture, security, and contribution docs
- public and private repo docs are aligned around the same AI/runtime story
