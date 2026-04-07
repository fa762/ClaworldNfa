# Claw World Skill

OpenClaw skill for Claw Civilization Universe on BNB Chain.

## Version

`1.1.5`

## Highlights

- Runtime/save semantics clarified: local CML save is separate from root/onchain sync
- Added lightweight `env` command for runtime/network/wallet checks
- `owned` is now explicitly documented as ownership-summary-only
- `boot` remains the full session initializer for CML/personality/emotion context
- Update flow docs now warn about local `package-lock.json` conflicts before pulling updates

## Core Files

- `SKILL.md`: agent instructions and gameplay rules
- `claw`: main CLI entrypoint
- `claw-read.js`: read helpers
- `claw-task.js`: task execution helpers
- `claw-lore.js`: lore query helper

## Command Roles

- `claw env`: lightweight runtime/network/wallet check only
- `claw owned`: lightweight ownership summary only
- `claw boot`: full session initialization with NFA, CML, legacy fallback, and emotion trigger

## CML Save Semantics

- `claw cml-save <tokenId>`: saves the CML locally
- `claw cml-save <tokenId> <pin>`: saves locally and attempts root/onchain sync immediately
- Without a PIN, local save can still succeed while root sync remains pending
- Greenfield upload is optional and only runs when the local environment supports it

## Update Notes

- The repository now tracks `package-lock.json`
- Before pulling updates manually, make sure you do not have an untracked local `package-lock.json`, or the merge may be blocked
- If you only change docs/help text, avoid regenerating the lockfile unnecessarily
