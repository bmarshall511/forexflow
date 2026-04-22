---
id: LRN-0008
observed_at: 2026-04-22
source: correction
target:
  - .gitignore
  - .claude/skills/bootstrap/SKILL.md
  - .claude/test-harness/fixtures/ (new fixture queued)
status: applied
outcome: pre-Phase-2 cleanup commit (same commit as this learning)
---

# LRN-0008 — Untracked leftover directories masquerade as scaffold state

## Observation

The Phase 2 `/bootstrap --dry-run` session inspected the working tree and reported:

- `apps/` "pre-seeded with 4 directories + empty src/ shells"
- `packages/` "pre-seeded with db/ (empty)"
- `site/` "pre-seeded with empty src/"

All three reports were wrong about what was actually tracked. None of those directories had any files in git:

- `apps/cf-worker/`, `apps/daemons/`, `apps/mcp-server/`, `apps/web/` — all four contained only `.turbo/` build caches left over from main-branch workspaces; zero tracked files
- `packages/db/`, `packages/shared/`, `packages/types/` — same shape: `.turbo/` cache files plus empty migration directories; zero tracked files
- `site/` — did not exist on disk at all; the report was hallucinated

One of the "pre-seeded" names (`apps/daemons/`, plural) also directly contradicted every authoritative source in `.claude/`, which all use singular `apps/daemon/`. That contradiction would have become the fourth FM-0004 sighting in a single session if the bootstrap had executed without intervention — the agent was about to either silently adopt the plural name or silently rename, both wrong.

## Proposed change

Three parts:

1. **Immediate cleanup (done in this session)**: delete `apps/` and `packages/` top-level dirs and root `.turbo/` cache. All untracked. Bootstrap now starts from a clean slate — no naming conflicts, no cache pollution. `site/` was already absent; the report was wrong.

2. **`/bootstrap` SKILL hardening**: the skill's Procedure §1 "Preconditions" already checks for a root `package.json`, but doesn't verify that `apps/` and `packages/` are **either absent or contain no untracked files that would conflict with the scaffold**. Add a precondition step: run `git status --ignored apps/ packages/ site/` and refuse to proceed if any leftover dirs are present. The refusal message should instruct the operator to either `rm -rf` the leftovers or add them to `.gitignore`.

3. **Harness fixture queued for Phase 2**: a new `structure-no-untracked-workspace-dirs.mjs` fixture that fails if `apps/` or `packages/` contains any files not tracked by git (excluding `.turbo/`, `.next/`, `dist/`, `node_modules/`, `.claude/` etc.). Would have caught this class proactively.

## Evidence

- `git ls-files apps/` returned empty (nothing tracked)
- `git ls-files packages/` returned empty
- `find apps/ -type f` returned only `.turbo/turbo-typecheck.log` files
- `ls site/` → "No such file or directory"
- The Phase 2 agent's `/bootstrap --dry-run` output reported pre-seeded content that didn't exist in git

## Rationale

This is the fourth sighting of FM-0004's class (policy / enforcement / reality drift):

- LRN-0006: handoff file policy said tracked, `.gitignore` ignored it (commit `bd11c73`)
- LRN-0007 pattern 1: telemetry files policy said tracked, directory-ignore defeated negation (commit `fa578a2`)
- LRN-0007 pattern 2: rule text named singular `.reqid-counter`, scaffold shipped plural `.reqid-counters/` (commit `fa578a2`)
- LRN-0008 (this): `apps/daemons/` plural directory on disk; every rule + skill + agent + commitlint scope enum said singular `apps/daemon/` — **and the workspace dirs were untracked leftovers masquerading as scaffold state**

The common root is that **the agent trusted filesystem appearance without cross-checking git tracking**. A directory exists on disk is not the same as a directory is part of the current branch's scaffold. Cold-start sessions in particular need to distinguish "this is intentionally tracked scaffold" from "this is cruft from a previous branch's build or from main".

## Impact

- Files deleted: `apps/` (4 subdirs × `.turbo/` caches), `packages/` (3 subdirs × `.turbo/` + empty migrations dirs), root `.turbo/`
- Total files removed: ~10 `.turbo/` cache files + some empty directory husks. Zero tracked files touched
- Risk: low — nothing tracked was deleted; confirmed via `git ls-files` before each `rm -rf`
- `/bootstrap` SKILL update: Phase 2 follow-up (harden preconditions); not changed in this commit
- Harness fixture: Phase 2 follow-up; named `structure-no-untracked-workspace-dirs.mjs`

## Follow-ups

- [x] Immediate cleanup committed
- [x] LRN-0008 minted
- [ ] **Phase 2 mandatory**: `/bootstrap` SKILL precondition check for untracked workspace dirs
- [ ] **Phase 2 mandatory**: `structure-no-untracked-workspace-dirs.mjs` fixture — joins the two Phase 2 fixtures already queued by LRN-0007 (`structure-gitignore-coverage` and `structure-doc-vs-scaffold`)
- [ ] Consider whether iCloud sync restoring `.turbo/` caches from main-branch history was the origin of the leftovers — FM-0005 already notes iCloud's failure modes; if this is iCloud-driven, it's another reason to relocate the repo off iCloud

## Adjacent consideration

The combination of FM-0005 (iCloud sync) and FM-0004 (policy/enforcement drift) is a multiplier. iCloud restores files from main into v3's working tree, the agent reads those files as authoritative state, and the drift propagates. Three Phase 2 fixtures (`structure-gitignore-coverage`, `structure-doc-vs-scaffold`, `structure-no-untracked-workspace-dirs`) catch three different surfaces of this combined pattern. All three should land before `/bootstrap apply` so the Phase 2 monorepo scaffold arrives on a verified-clean slate.
