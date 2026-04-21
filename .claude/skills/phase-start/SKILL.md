---
name: phase-start
description: Pin the next phase plan as active; load context; dry-run /handoff to confirm the plan is ready to execute
disable-model-invocation: false
model: sonnet
args:
  - name: phase
    type: string
    required: true
    description: "Phase number to start, e.g. '2'"
dispatches: [meta-reviewer]
version: 0.1.0
---

# /phase-start `<phase>`

Begin a new phase. Updates `.claude/plans/active.md` to point at the new phase file, verifies the plan is well-formed, and confirms the session is ready for execution.

## Preconditions

- The previous phase must have been closed by `/phase-complete`
- `.claude/plans/phase-<N>.md` must exist (drafted by the prior phase's final commit, or by the maintainer during planning)
- The current session is on `v3` (or the designated rebuild branch)

## Procedure

### 1. Verify prerequisites

- `.claude/plans/phase-<N>.md` exists and has valid structure (title, sub-phase table, stop criterion)
- Previous phase's completion ADR exists: `.claude/decisions/<NNNN>-phase-<N-1>-complete.md`
- `.claude/VERSION` reflects the previous phase's completion version

If any precondition fails, report the gap and refuse to advance.

### 2. Dispatch `meta-reviewer`

Run meta-reviewer against the new phase plan to catch:

- Broken path references
- Missing frontmatter on any referenced file
- Sub-phase goals that don't correspond to a deliverable
- Stop criterion that can't actually be verified

`NEEDS_CHANGES` or `REJECT` blocks the phase from starting. `APPROVE` proceeds.

### 3. Update the active-plan symlink

```bash
cd .claude/plans
ln -sf phase-<N>.md active.md
```

### 4. Load the handoff if present

If `.claude/handoffs/latest.md` exists and references the previous phase, read it aloud to the session so context transfers cleanly. If the handoff is stale (>7 days), recommend a fresh one.

### 5. Run `/status`

Report the phase/sub-phase state, confirm zero broken references, confirm agents and hooks are wired.

### 6. Announce the first sub-phase

Print the first sub-phase's goal from the plan and wait for the maintainer's "next" before any work begins.

## Output shape

```markdown
# /phase-start result — phase <N>

## Preconditions

- Previous phase closed: ✓ / ✗
- New plan file exists: ✓
- Meta-reviewer verdict: APPROVE

## Active plan

- Before: `phase-<N-1>.md`
- After: `phase-<N>.md`

## Handoff

- Latest: `.claude/handoffs/<timestamp>.md`
- Age: <days>
- Recommendation: use as-is / refresh

## Status summary

(inline /status output)

## First sub-phase

**<N>.1 — <title>**

<one-paragraph description from the plan>

## Next step

Awaiting your "next" to begin sub-phase <N>.1.
```

## Failure modes

- Previous phase not closed → `/phase-complete` must run first
- Plan file missing → draft it (dispatch the maintainer's attention; this skill does not draft phase plans)
- Meta-reviewer rejects → surface findings, require fixes before retry

## Time / cost

Sonnet-tier. 30–60 seconds typical.
