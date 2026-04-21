---
name: learn
description: Capture observations as learning files; propose concrete config changes; apply or reject them with review; the pipeline that turns corrections into durable improvements to rules, hooks, skills, agents
disable-model-invocation: false
model: sonnet
args:
  - name: mode
    type: string
    required: false
    description: '"<observation>" to mint · --list · --apply <id> · --reject <id> "<reason>" · --weekly'
dispatches: [meta-reviewer, docs-syncer]
version: 0.1.0
---

# /learn

The continuous-learning pipeline. Captures observations — corrections, false-positives, repeated manual fix-ups — as learning files under `.claude/learnings/`, proposes concrete config edits, and routes them through review before they land.

Full rationale: [ADR 0006](../../decisions/0006-continuous-learning-loop.md). Scaffolding and format: [.claude/learnings/README.md](../../learnings/README.md).

## When to run

Five triggers (per ADR 0006):

1. **Maintainer correction in chat** — "don't do X, do Y"
2. **Hook false-positive** — the hook blocked a legitimate change
3. **Hook false-negative** — the hook let through something it should have caught
4. **Harness fixture failure** on code believed correct — the rule may need relaxing, or the code may be wrong
5. **Recurring manual fix-up** — the same correction surfaces 3+ times

The main interactive agent is instructed (via `.claude/CLAUDE.md`) to surface a learning candidate when any of these appear. The maintainer decides whether to mint via `/learn`.

## Modes

### `/learn "<observation>"` — mint a new learning

1. **Read `.counter`** in `.claude/learnings/`; increment; zero-pad to 4 digits
2. **Identify the source** from the observation (heuristic: mention of "hook" + "block" suggests false-positive, "harness" suggests harness-fail, etc.). If ambiguous, prompt once
3. **Identify the target file(s)** the change would touch — always concrete paths under `.claude/`
4. **Draft the learning file** from `_template.md` at `.claude/learnings/<id>-<slug>.md`:
   - Frontmatter with `status: observed`, `outcome: null`
   - Body: Observation, Proposed change, Evidence, Rationale, Impact, Follow-ups
5. **Update `.counter`** with the new value
6. **Print the draft** for maintainer review; do not apply yet

### `/learn --list [--status <status>]` — list all learnings

```
LRN-0001  applied   hook-regex false-negative on `: any`
LRN-0002  applied   `-m` commit-message regex
LRN-0003  applied   stale-refs strip-dot bug
LRN-0004  applied   _comment keys invalid in Claude settings
LRN-0005  observed  docs-sync blocks when CLAUDE.md edited separately
```

Filterable by status (`observed`, `applied`, `rejected`, `superseded`).

### `/learn --apply <id>` — land an approved learning

1. **Read** `.claude/learnings/<id>-*.md`
2. **Dispatch `meta-reviewer`** against the proposed change
3. If `APPROVE`:
   - Apply the edit described in the "Proposed change" section
   - Run the `/stale-rules` check and `/doc-check` if applicable
   - Regenerate `.cursor/` if `.claude/rules/` was touched
   - Update the learning's frontmatter: `status: applied`, `outcome: <commit-sha-when-known>`
   - Bump the target's version (rule / agent / skill file) if user-visible
4. If `NEEDS_CHANGES` / `REJECT`:
   - Surface the findings; do not apply
   - Learning stays `observed`

### `/learn --reject <id> "<reason>"` — decline an observation

1. **Validate** that the learning exists and is `observed`
2. Set frontmatter: `status: rejected`, `outcome: <reason>`
3. **Move** the file from `.claude/learnings/` to `.claude/learnings/rejected/`
4. Preserve the ID number — never reused

### `/learn --weekly` — stale learning roll-up

1. Find `observed` learnings older than 30 days
2. Group related proposals (same target file; overlapping diffs)
3. Propose batch edits where sensible
4. Report stalled items the maintainer should decide on

## Output shape

For `/learn "<observation>"`:

```markdown
# Learning drafted — LRN-NNNN

**File:** `.claude/learnings/NNNN-<slug>.md`
**Source:** <correction | hook-fp | hook-fn | harness-fail | review-override | recurring>
**Target:** <files the proposal would touch>
**Status:** observed

## Draft body

<the template-filled content>

## Next step

- Review the draft
- If you want to apply now: `/learn --apply LRN-NNNN`
- If you want to decline: `/learn --reject LRN-NNNN "<reason>"`
- Otherwise it stays `observed` until you decide
```

For `/learn --apply <id>`:

```markdown
# Learning applied — LRN-NNNN

**Meta-reviewer verdict:** APPROVE / NEEDS_CHANGES / REJECT

## Files changed

- `<path>` — <summary of edit>

## Verifications

- /stale-rules: ✓
- /doc-check: ✓ / N/A
- .cursor/ regen: ✓ / N/A
- target version bumped: <rule>.md 0.1.0 → 0.2.0 / N/A

## Outcome

- Status: applied
- Commit-ready message:
  `<type>(<scope>): <subject> (@learning: LRN-NNNN)`
```

## What /learn does NOT do

- **Silently apply**: every application goes through `meta-reviewer` first
- **Invent observations**: mint only from concrete, reproducible signals
- **Duplicate existing learnings**: search `.claude/learnings/` for near-matches before minting; if found, append to the existing one instead of creating a new ID
- **Replace `debug-investigator`**: bugs in _application code_ go through `/debug`; learnings are about the _agent config_ (rules, hooks, skills, agents)
- **Replace ADRs**: architectural decisions still use `.claude/decisions/`. A learning can propose an ADR, but is not one itself
- **Replace `failure-modes.md`**: catastrophic pattern catalogs belong there; learnings are smaller, more proposal-shaped

## Dogfooding

Sub-phase 8 seeded `LRN-0001` through `LRN-0004` retroactively from the three hook-regex bugs the harness surfaced plus the `_comment`-key incident from Sub-phase 4. The skill's ability to list + filter those validates the pipeline's read path from day one.

## Time / cost

Sonnet-tier. Minting: under a minute. Applying (with meta-reviewer dispatch): 1–3 minutes depending on proposal complexity.
