---
id: LRN-0007
observed_at: 2026-04-22
source: correction
target:
  - .gitignore
  - .claude/rules/14-requirements-traceability.md
  - .claude/agents/requirements-curator.md
  - .claude/skills/trace/SKILL.md
status: applied
outcome: (same-session commit as this learning)
---

# LRN-0007 — Two patterns surfaced by the second cold-start session

The first cold-start session (LRN-0006) caught one handoff/gitignore drift. This second cold-start session — after LRN-0006's supposed fix — caught **two more instances of related patterns**. Both are worth cataloging because they generalize.

## Observation

### Pattern 1: `.gitignore` directory ignore (`foo/`) defeats subsequent negation rules

`.gitignore:61` had `.claude/telemetry/` — a directory ignore. Lines 62–63 then said `!.claude/telemetry/.gitkeep` and `!.claude/telemetry/README.md`, intending to re-include those files. Both were silently ineffective because git does not recurse into a directory whose entire path is ignored, so negations below can't run.

The symptom surfaced at `structure-stale-refs.mjs`: the CHANGELOG claimed those files were created, they existed on disk, but `git check-ignore` ignored them and a fresh clone would not have them.

Exact same mechanism as LRN-0006's handoff issue, but LRN-0006 fixed a pattern-ignore (`handoffs/*.md` with negation), not the directory-ignore case. Two distinct sub-patterns of FM-0004.

### Pattern 2: Rule text describes a singular `.reqid-counter` file; scaffold shipped a `.reqid-counters/` directory

Sub-phase 10 scaffolded `docs/requirements/.reqid-counters/` (plural, one counter file per commit-scope). That's the better design — it makes the per-scope minting cheap and avoids a single contention point.

But rule `.claude/rules/14-requirements-traceability.md`, the `requirements-curator` agent prompt, and the `/trace` skill all still referred to a singular `.reqid-counter` file per-directory. The Sub-phase 10 commit updated the scaffold to the plural design but didn't propagate the rename upstream into the rule/agent/skill text.

A cold-start session following the rule would read `.reqid-counter`, not find it, and either fail or create a conflicting singular file alongside the existing plural directory. Either way the agent's documented behavior diverges from what the scaffold actually supports.

## Proposed change

Three fixes:

1. **`.gitignore`**: change `.claude/telemetry/` (line 61) to `.claude/telemetry/*` so the `!` negations below work. Preserve the comment explaining why, citing FM-0004.

2. **Rule 14, `requirements-curator.md`, `trace/SKILL.md`**: rename every reference to the counter from `.reqid-counter` (singular) to `docs/requirements/.reqid-counters/<scope>` (plural directory, per-scope file). Bump rule 14 to `0.2.0` and regenerate Cursor mirror.

3. **Update FM-0004 entry** in `.claude/failure-modes.md` to note the directory-vs-glob sub-pattern as a specific trap.

## Evidence

- `structure-stale-refs.mjs` flagged `.claude/CHANGELOG.md` lines 42–43 (telemetry paths) on second cold-start session. Same fixture passed in the session that produced those lines — because those files existed locally on disk despite being ignored.
- `git check-ignore -v .claude/telemetry/README.md` before fix → matched `.gitignore:61:.claude/telemetry/` (directory ignore winning over negation at line 63)
- After fix → matched `.gitignore:67:!.claude/telemetry/README.md` (negation now effective)
- `grep -rn "\.reqid-counter\b" .claude/` before fix → 5 hits: 2 in rule 14, 2 in requirements-curator.md, 1 in trace/SKILL.md — all singular
- Sub-phase 10 commit (`6cc6fdf`) actually shipped `docs/requirements/.reqid-counters/` (plural)

## Rationale

Two classes of failure, both caught by the harness on cold-start because they depend on state a fresh clone doesn't have:

- **Class A — gitignore ineffective negation**: a directory ignore short-circuits negations below. Git has documented this behavior for years, but it's not obvious from the file reading top-to-bottom
- **Class B — doc-scaffold naming drift**: the scaffold implementation evolved beyond the rule text that documented it. Classic shape of "refactored the code, forgot the docs"

Both deserve proactive catches in the harness. Proposed for Phase 2:

- **Harness fixture `structure-gitignore-coverage.mjs`**: for every `!<path>` negation in `.gitignore`, verify the positive rule above it is a glob (`*`), not a directory ignore (`foo/`). Surface any directory-ignore-above-negation pattern.
- **Harness fixture `structure-doc-vs-scaffold.mjs`**: grep `.claude/rules/**/*.md` and `.claude/agents/**/*.md` for file/path references; verify each resolves on disk OR is explicitly marked as "arrives in Phase N". Surface drift between doc and reality.

Both fixtures would have caught the two issues in this learning proactively.

## Impact

- Files touched: `.gitignore`, `.claude/rules/14-requirements-traceability.md` (version bump 0.1.0 → 0.2.0), `.claude/agents/requirements-curator.md`, `.claude/skills/trace/SKILL.md`, `.cursor/rules/14-requirements-traceability.mdc` + `.cursor/commands/trace.md` (regenerated), `.claude/failure-modes.md` (FM-0004 note appended)
- Risk: low — all text / policy fixes; no behavior change
- Cursor parity regen needed: yes (done — generator wrote 2 files)

## Follow-ups

- [x] `.gitignore` fix (directory ignore → glob with negations)
- [x] Rule 14, requirements-curator, trace skill all reference `.reqid-counters/` plural with per-scope files
- [x] Rule 14 version bumped; Cursor mirror regenerated
- [x] FM-0004 entry notes the directory-vs-glob sub-pattern
- [ ] **Phase 2 mandatory**: ship `structure-gitignore-coverage.mjs` harness fixture
- [ ] **Phase 2 mandatory**: ship `structure-doc-vs-scaffold.mjs` harness fixture
- [ ] Both fixtures should run against this commit as a first pass — they should come up green (all known instances now fixed)

## Adjacent consideration

This is the third sighting of the policy/enforcement drift class (handoffs → LRN-0006, telemetry → LRN-0007 pattern 1, reqid-counter → LRN-0007 pattern 2). Three sightings is enough that **FM-0004 should be promoted to a front-of-mind invariant** — not just catalogued, but explicitly checked by a harness fixture and surfaced in `meta-reviewer` output on every `.claude/` review. The queued Phase 2 fixtures deliver that.
