---
name: doc-check
description: Audit documentation freshness — find docs that are stale or missing coverage for recent code changes.
disable-model-invocation: true
---

# Documentation Freshness Check

Scan for documentation that may be stale or missing based on current code state.

## Steps

1. **Gather changed files** relative to the doc baseline:
   - If uncommitted changes exist: `git diff --name-only HEAD`
   - If checking recent work: `git diff --name-only HEAD~5..HEAD`
   - User can pass a custom range as argument (e.g., `/doc-check HEAD~10`)

2. **Map changes to docs** using the documentation map in `.claude/rules/09-docs-sync.md`:
   - For each changed file, identify which documentation files should cover it
   - Read both the changed code and the corresponding docs

3. **Check for staleness** in each mapped doc:
   - References to files/paths that no longer exist
   - Hook names, component names, or API routes mentioned in docs but not in code (or vice versa)
   - New shared UI primitives (`components/ui/`) not listed in `apps/web/CLAUDE.md`
   - New hooks (`hooks/use-*.ts`) not listed in hook conventions
   - New API routes not reflected in API route docs
   - New WS message types not in `docs/ai/realtime.md`
   - New daemon endpoints not in daemon CLAUDE.md
   - New `.claude/rules/` or `.claude/skills/` not listed in root CLAUDE.md

4. **Check README.md** for high-level accuracy:
   - Feature list still reflects actual features
   - Tech stack versions are current
   - Setup instructions still work

5. **Report findings:**
   - **Stale**: docs that reference things that no longer exist
   - **Missing**: code additions that should be documented but aren't
   - **OK**: docs that are up to date

6. **Fix** any issues found:
   - Update stale references
   - Add missing documentation entries
   - Keep changes minimal and factual — describe current state, not history
