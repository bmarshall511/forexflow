---
id: 0006
title: Continuous-learning loop — corrections and observations feed back into rules, hooks, and skills
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [meta, learning, process]
---

# 0006 — Continuous-learning loop — corrections and observations feed back into rules, hooks, and skills

## Context

Rules, hooks, agents, and skills are only as good as the situations
they anticipate. In practice, the most valuable signals for improving
them arrive _during real work_:

- A maintainer corrects a formatting choice
- A hook regex produces a false positive or false negative
- A reviewer agent misses a class of bug that the test harness later
  reveals
- A skill's procedure has a step that keeps tripping contributors
- A recurring kind of mistake shows up across unrelated commits

Without a structured way to capture these signals, they evaporate.
The next session makes the same mistake; the next contributor hits
the same rough edge; the rails never tighten.

Five artifacts already exist that each capture _one_ kind of signal:

- `.claude/CHANGELOG.md` — what's been built
- `.claude/decisions/` — how we decided (and rejected)
- `.claude/failure-modes.md` — catastrophic-pattern catalog
- `.claude/journal/` — session notes
- `.claude/test-harness/` — deterministic regression coverage

What's missing is a **pipeline** that turns individual learnings into
durable edits to the config itself.

## Decision

Introduce a first-class **learnings pipeline** comprising:

1. **A directory**: `.claude/learnings/` — one markdown file per
   learning, structured with frontmatter (`id`, `observed_at`,
   `source`, `target`, `status`, `outcome`) and a body describing the
   observation, proposed change, and evidence.

2. **A skill**: `/learn <observation>` — dispatches the
   `requirements-curator`-style minting (but for learnings instead of
   requirements). Mints a sequential ID, drafts a learning file,
   proposes a concrete change to a rule / hook / skill / agent.

3. **A lifecycle**:
   - `observed` — the signal has been captured as a learning file
   - `applied` — the proposed change landed in `.claude/`
   - `rejected` — the proposal was considered and declined (with a
     reason; file moves to `.claude/learnings/rejected/`)
   - `superseded` — a later learning rolled this one up

4. **Triggers**: learnings get captured from five concrete signals:
   - Maintainer correction in chat ("don't do X, do Y")
   - Hook firing on a diff the maintainer expected to pass (false
     positive) or NOT firing on a diff that was bad (false negative)
   - Test harness fixture failure on code the maintainer believed was
     correct (indicates the rule should be relaxed, or the code
     should change)
   - Reviewer-agent verdict overridden via appeal ADR (the rule may
     need nuance)
   - Repeated manual fix-up across commits (same formatting / pattern
     correction appearing 3+ times)

5. **Agent-side capture**: the main agent is instructed (via
   `CLAUDE.md`) to surface a learning candidate whenever it notices
   one of the five signals — the maintainer decides whether to mint
   via `/learn` or discard.

6. **Review + apply**: once a learning is minted, the `meta-reviewer`
   agent evaluates the proposed change. On `APPROVE`, an implementer
   agent applies the edit, regenerates `.cursor/` if affected, bumps
   the relevant rule's `version`, and marks the learning `applied`.

7. **Traceability**: every config change that originated from a
   learning cites the learning ID in its commit message, e.g.
   `refactor(claude): tighten pre-edit-no-any regex (@learning: LRN-0003)`.
   The `post-edit-meta-log` hook already records `.claude/` edits to
   CHANGELOG; learning-driven edits stand out via the `@learning:`
   tag.

## Consequences

### Positive

- **The config improves over time without episodic sprints.** Every
  correction is one file away from becoming a rule update.
- **Mistake patterns are visible**, not folklore. A reviewer can read
  `.claude/learnings/` as the project's evolution log.
- **Cheap to capture**, reviewed before applying. Avoids thrashing
  the config on every minor nit.
- **Dogfoods the review pipeline** — meta-reviewer on every learning
  change keeps the rails self-consistent.
- **Sub-phase 8 already delivered three hook fixes the harness
  surfaced** (any-regex, -m-space-regex, stale-refs cleanup). Those
  fixes should themselves be captured as learnings retroactively, so
  the pattern of "harness reveals bug → fix + learning" is present
  from day one.

### Negative

- **Another directory to maintain.** Balanced by the fact that most
  entries are small (~50 LOC each).
- **Bar-raising tempts overreach**: every minor stylistic preference
  looks like a candidate. Explicit guidance in the `/learn` skill
  discourages trivial captures.
- **Stale learnings** accumulate (observations that apply to code
  that's since been rewritten). Mitigated by the
  `requirements-curator`-style auto-supersede the skill performs
  weekly.

### Neutral

- Learnings that remain `observed` for >30 days auto-notify on
  `/status`, but do not auto-expire.
- Learnings mirror the ADR numbering convention (`LRN-NNNN`) but live
  in their own sequence so they don't compete for ADR IDs.

## Alternatives considered

- **Shove all corrections into `failure-modes.md`** — rejected.
  Failure modes are catastrophic patterns; learnings are broader
  (stylistic, ergonomic, ambiguous). Different audience, different
  shape.
- **Only log via `CHANGELOG.md`** — rejected. The changelog records
  what changed; it doesn't explain _why a correction was needed_
  or propose a change to the config that would prevent the same
  correction next time.
- **Rely on the maintainer's memory** — explicitly rejected. The
  whole rebuild premise (ADRs, traceability, checklists) is "memory
  doesn't survive context resets." Learnings are no exception.

## Follow-ups

- [x] Sub-phase 8: ship `.claude/learnings/README.md`, `_template.md`,
      `.counter`, `rejected/`, and the `/learn` skill
- [x] Sub-phase 8: `CLAUDE.md` calls out the five triggers so the
      main agent self-captures
- [ ] Sub-phase 8 follow-up: backfill `.claude/learnings/` with the
      three hook bugs Sub-phase 8's harness surfaced:
      LRN-0001 (any regex), LRN-0002 (-m regex), LRN-0003 (stale-ref
      cleanup). Plus the settings `_comment` incident from Sub-phase 4
      as LRN-0004. All `status: applied` retroactively.
- [ ] Sub-phase 12: `/status` surfaces open learnings count; stale
      learning (>30 days `observed`) is flagged
- [ ] Phase 2+: `/learn --weekly` reviews unresolved learnings and
      rolls related ones into single edits to avoid thrash

## References

- `.claude/CLAUDE.md` §"Continuous-learning loop"
- `.claude/skills/learn/SKILL.md`
- `.claude/learnings/README.md`
- `.claude/failure-modes.md`
- `.claude/journal/`
