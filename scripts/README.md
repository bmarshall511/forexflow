# `scripts/`

Repository-level scripts. Each is zero-dependency (Node built-ins or bash) so they run cleanly before `pnpm install` has happened.

## Current scripts

| Script                                             | Purpose                                                                                                                                                                               | Run by                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`sync-ide-rules.mjs`](./sync-ide-rules.mjs)       | Generate `.cursor/rules/*.mdc` from `.claude/rules/*.md` and `.cursor/commands/*.md` from `.claude/skills/*/SKILL.md`. Single source of truth is `.claude/` per ADR #0001 and rule 00 | Maintainer after rule/skill changes; `pre-commit-ide-parity` hook in `--check` mode |
| [`test-cursor-parity.sh`](./test-cursor-parity.sh) | Validate that every source in `.claude/rules/` and `.claude/skills/` has a generated mirror and that no orphaned mirrors exist                                                        | CI workflow `agent-config-drift.yml`; `/stale-rules` skill                          |

## Contracts

Every script in this directory:

- Exits 0 on success, non-zero on failure
- Writes progress to stderr, results to stdout (so shell pipelines can consume results while seeing progress)
- Zero external npm dependencies — Node built-ins + bash only
- Is idempotent where possible; re-running produces no unexpected changes when state is clean
- Documents itself in a top-of-file comment block explaining purpose, flags, and exit codes

## Script categories that will arrive later

| Category                               | Expected skills            | Arriving in                        |
| -------------------------------------- | -------------------------- | ---------------------------------- |
| Preflight (CI mirror)                  | `preflight.sh`             | Phase 2                            |
| Backfill scripts (data migrations)     | `backfills/<name>.ts`      | Phase 4+ as schema changes warrant |
| Native-module fixups (pnpm + Electron) | `fix-standalone-native.sh` | Phase 12                           |
| Tunnel / dev helpers                   | `dev.sh`                   | Phase 7                            |

This file is updated as scripts land. The `pre-commit-docs-sync` hook blocks commits that add a script without updating this README.
