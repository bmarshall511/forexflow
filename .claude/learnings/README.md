# `.claude/learnings/`

The continuous-learning log. Every observation worth capturing — from a
maintainer correction, a false-positive hook firing, a reviewer miss, a
repeated manual fix-up — becomes a small file here. Each proposes a
concrete change to a rule / hook / skill / agent, gets reviewed by
`meta-reviewer`, and if accepted, is applied to the config.

Over time, `.claude/learnings/` becomes the project's memory of what
didn't quite work yet — and the paper trail of how the rails improved
in response.

Full rationale: [ADR 0006](../decisions/0006-continuous-learning-loop.md).

## Structure

```
.claude/learnings/
├── README.md           This file
├── _template.md        Template for new learning files
├── .counter            Sequential ID counter (LRN-NNNN)
├── 0001-<slug>.md      One file per learning
├── 0002-<slug>.md
├── ...
└── rejected/           Proposals considered and explicitly declined
    └── NNNN-<slug>.md
```

## How a learning is captured

The five triggers (per ADR 0006):

1. **Maintainer correction** in chat — "don't do X, do Y"
2. **Hook false positive or false negative** — the rails fired wrong
3. **Harness fixture failure** on code believed correct — may indicate
   rule needs relaxing or code needs fixing
4. **Reviewer agent verdict overridden via ADR appeal** — rule may
   need nuance
5. **Recurring manual fix-up** — same correction appearing 3+ times
   across commits

When a signal appears, the main agent surfaces a learning candidate. The
maintainer decides whether to mint via `/learn "<observation>"` or
discard.

## Lifecycle

```
observed  →  applied       (proposal merged; rails updated)
observed  →  rejected      (proposal declined; filed under rejected/)
observed  →  superseded    (rolled into a later learning)
```

## Per-learning format

Frontmatter fields:

| Field         | Required              | Meaning                                     |
| ------------- | --------------------- | ------------------------------------------- | --------- | ---------- | -------------- | ----------------- | ----------- |
| `id`          | yes                   | `LRN-NNNN` format; zero-padded, sequential  |
| `observed_at` | yes                   | ISO date of the observation                 |
| `source`      | yes                   | `correction`                                | `hook-fp` | `hook-fn`  | `harness-fail` | `review-override` | `recurring` |
| `target`      | yes                   | The file(s) the proposed change would touch |
| `status`      | yes                   | `observed`                                  | `applied` | `rejected` | `superseded`   |
| `outcome`     | when applied/rejected | Commit SHA or rejection reason              |

Body sections (see `_template.md`):

1. **Observation** — what happened, with enough specifics to reproduce
2. **Proposed change** — the concrete edit (not speculation)
3. **Evidence** — diffs, logs, commit SHAs, fixture output
4. **Rationale** — why this edit, over the alternatives
5. **Impact** — what this affects; any risks

## Dogfooding (Sub-phase 8 retro)

Sub-phase 8's harness surfaced three hook bugs that were fixed inline.
Per ADR 0006's follow-up list, these are backfilled as
`LRN-0001` through `LRN-0004` with `status: applied` — the pattern of
"harness reveals bug → fix + learning" is preserved from day one.

## Relationship to other artifacts

| Artifact           | Purpose                            | When to use                            |
| ------------------ | ---------------------------------- | -------------------------------------- |
| `decisions/` (ADR) | Durable architectural choices      | "We will use Hono."                    |
| `learnings/`       | Small corrections + proposals      | "Regex X missed case Y."               |
| `failure-modes.md` | Catastrophic patterns + guardrails | "Mock-DB tests pass but prod fails."   |
| `journal/`         | Session narrative                  | "This session we shipped Sub-phase 5." |
| `CHANGELOG.md`     | What changed                       | "Added 13 agents."                     |

A learning can reference any of the above; the others rarely reference
learnings directly.

## Running `/learn`

- `/learn "<observation>"` — mint a new learning from a one-line
  description; agent drafts the file for maintainer review
- `/learn --list` — list all learnings by status
- `/learn --apply <id>` — once a proposal is approved, dispatch an
  implementer to land the edit + mark the learning `applied`
- `/learn --reject <id> "<reason>"` — move to `rejected/`, record reason
- `/learn --weekly` — roll up stale `observed` learnings; group related
  proposals; propose batch edits

See `.claude/skills/learn/SKILL.md`.
