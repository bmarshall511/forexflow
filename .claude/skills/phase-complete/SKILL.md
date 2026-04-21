---
name: phase-complete
description: Gate the transition from phase N → N+1 — run every reviewer, every audit, write completion ADR, bump VERSION, update CHANGELOG, update active.md
disable-model-invocation: false
model: opus
args:
  - name: phase
    type: string
    required: false
    description: "Phase number to close; default: whatever active.md points at"
dispatches: [meta-reviewer, docs-syncer, requirements-curator]
version: 0.1.0
---

# /phase-complete

The one-way door between phases. Ensures every deliverable shipped, every deferred follow-up was either completed or explicitly moved, every reviewer agent returns APPROVE on the phase's output. Only then does the active plan advance.

## Why this gate exists

Phases are cheap to start and expensive to inherit. If a phase closes with incomplete follow-ups, the next phase absorbs them silently. This skill makes the absorption explicit: every item in the plan's "Deferred follow-ups" section is checked off or migrated before the phase is declared done.

## Procedure

### 1. Resolve phase

- `phase` arg, or
- Resolve `.claude/plans/active.md` symlink target and extract the phase number

### 2. Checklist: sub-phase completion

- Every sub-phase row in the plan has a status other than "Pending"
- Any "Pending" rows must be explicitly skipped via an ADR (rare; usually indicates the phase shouldn't close yet)

### 3. Dispatch the full reviewer sweep

In parallel:

- `meta-reviewer` against the entire `.claude/` tree — expect `APPROVE`
- `docs-syncer` for phase-wide drift — expect `SYNCED` or explicit `STALE_FLAGGED` items that have been scheduled
- `requirements-curator` for coverage + orphans — expect coverage above threshold per scope

### 4. Run validation skills

- `/stale-rules` — zero blocking issues
- `/doc-check` — SYNCED or acknowledged
- `/trace --coverage` — threshold met
- `/verify` — full preflight PASS (will be N/A-heavy during early phases; acceptable)

### 5. Deferred follow-ups audit

For each checkbox in the plan's "Deferred follow-ups from earlier sub-phases" section:

- Completed? Check the box, cite the commit
- Moved to a later phase? Confirm the later phase's plan has the checkbox
- Silently dropped? REJECT — surface and require resolution

### 6. Write the completion ADR

Draft `.claude/decisions/<next-id>-phase-<N>-complete.md` using the template, covering:

- What shipped (commits, file counts)
- What was verified (reviewer verdicts, test results, size audits)
- Deferred items and their new homes
- Stop-criterion evidence (each bullet ticked with citation)
- Next phase pointer

### 7. Promote CHANGELOG [Unreleased] → versioned release

- Read `[Unreleased]` section
- Create new section `## [<next-version>] — Phase <N> — YYYY-MM-DD`
- Move entries under the new section
- Leave `[Unreleased]` empty with the seed "(pending — next sub-phase)" line

### 8. Bump `.claude/VERSION`

Per SemVer:

- Major phase change: minor bump (`0.1.0` → `0.2.0`)
- Exceptional: major bump (`0.x` → `1.0`) reserved for the cutover to `main`

### 9. Update the active plan

- The current phase's plan stays in `.claude/plans/phase-<N>.md` as historical record (never edited after this point)
- `active.md` symlink updates to `phase-<N+1>.md` (which must already exist per the `/phase-start` precondition)

### 10. Commit the phase close

Conventional-commits message:

```
chore(claude): close phase <N> — <title>

Deliverables: <summary>
Reviewers: all APPROVE
Stop-criterion: all met

Next: phase <N+1> — <title>
```

## Output shape

```markdown
# /phase-complete result — phase <N>

## Sub-phases

| #   | Status   | Commit  |
| --- | -------- | ------- |
| 1   | ✓ closed | abc1234 |
| ... | ...      | ...     |

## Reviewer sweep

- meta-reviewer: APPROVE
- docs-syncer: SYNCED
- requirements-curator: UPDATED (coverage <scope>: <%>)

## Validations

- /stale-rules: 0 blocking
- /doc-check: SYNCED
- /trace --coverage: <scope-by-scope %>
- /verify: PASS / N/A

## Deferred follow-ups

| Item        | Status                       | Evidence              |
| ----------- | ---------------------------- | --------------------- |
| <follow-up> | completed / moved to phase M | <commit or plan cite> |
| ...         | ...                          | ...                   |

## Stop-criterion

- ✓ Every hook has a synthetic violation fixture... (cited: test-harness/fixtures/\*)
- ✓ Every agent loads and returns a valid verdict... (cited: harness output)
- ...

## Artifacts produced

- ADR: `.claude/decisions/<id>-phase-<N>-complete.md`
- VERSION bumped: <before> → <after>
- CHANGELOG: [Unreleased] promoted to [<version>]
- active.md: → `phase-<N+1>.md`

## Commit-ready message

<subject + body>
```

## Failure modes

- Any reviewer returns non-APPROVE verdict → surface, block phase close
- Deferred follow-up silently dropped → refuse; either complete or explicitly migrate via ADR
- Plan file `phase-<N+1>.md` missing → block; must exist before active.md can point there
- Uncommitted changes in working tree → refuse until clean

## Time / cost

Opus-tier. Phase close is expensive on purpose — the quality gate warrants the model. Typical 5–15 minutes including the parallel reviewer sweep.
