# `.claude/journal/`

Monthly session journals — the project's narrative layer. Each month gets one file (`YYYY-MM.md`) that accumulates entries across sessions. Unlike ADRs (which record decisions) or learnings (which propose corrections), the journal records **what happened** and **what was noticed**.

Reading the journal for the previous few months is how a cold-start session gets a feel for current direction and recent pain.

## When to write a journal entry

- At the end of a sub-phase or phase (required; the entry goes in with the sub-phase's commit)
- When a non-trivial session ends even mid-sub-phase (optional; recommended when the session had meaningful corrections, surprises, or direction changes)
- When a noteworthy incident happens (hook misbehavior, model cost spike, external tool break)
- Never auto-generated — the value is in the narrative judgment, which requires the author to pick what's interesting

## Entry format

```markdown
## YYYY-MM-DD — <short title>

**Author:** maintainer
**Phase / sub-phase:** <if applicable>
**Session result:** <1 sentence>

<2–5 paragraphs of narrative. What was worked on, what surprised,
what we learned, what's next. Links to any commits, ADRs, learnings,
or failure modes the session produced.>
```

Multiple entries per day are fine; order them chronologically within the monthly file.

## What doesn't belong here

- Full commit messages (the git log has those)
- Full ADR text (the decisions/ directory has those)
- Status dashboards (`/status` generates those on demand)
- Lists of files changed (the diff has that)

The journal is for the **"why did that session feel the way it did"** layer — the signal that only the session participant knows and future sessions would benefit from reading.

## Retention

Monthly files accumulate indefinitely. Never deleted. If a month's file grows past `.claude/rules/07-file-size.md` context-file limit (500 LOC), consider splitting into weekly files for that month — document the split at the top.

## Relationship to other artifacts

| Artifact            | What it captures                                                          |
| ------------------- | ------------------------------------------------------------------------- |
| `CHANGELOG.md`      | What changed                                                              |
| `decisions/` (ADRs) | Why a choice was made                                                     |
| `learnings/`        | A correction plus a proposed config change                                |
| `failure-modes.md`  | Patterns that warranted a permanent guard                                 |
| **`journal/`**      | **What the session actually felt like — narrative, surprises, direction** |

A journal entry may reference any of the others; they rarely reference the journal directly.
