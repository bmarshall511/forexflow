# ForexFlow Requirements

The living source of truth for what ForexFlow is supposed to do. Every feature, constraint, and acceptance criterion that the product promises lives here as a numbered requirement. Code and tests link back via `@req:` tags.

Full policy: [`.claude/rules/14-requirements-traceability.md`](../../.claude/rules/14-requirements-traceability.md). Rationale and lifecycle: [ADR-0001](../../.claude/decisions/0001-v3-greenfield-rebuild.md) and the requirements-curator agent at [`.claude/agents/requirements-curator.md`](../../.claude/agents/requirements-curator.md).

## Structure

```
docs/requirements/
├── README.md              This file
├── _template.md           Per-requirement template
├── index.md               Master traceability table (agent-maintained)
│
├── .reqid-counters/
│   ├── trading             Integer counter for REQ-TRADING-###
│   ├── web                 Integer counter for REQ-WEB-###
│   └── ...                 One file per scope
│
├── trading/
│   ├── 001-<slug>.md
│   └── ...
├── web/
│   └── positions/
│       ├── 001-<slug>.md
│       └── ...
├── claude/
│   └── 001-<slug>.md
└── ...
```

One file per requirement. Filename: `<number>-<kebab-slug>.md`. Requirements are organized by scope (`trading`, `web`, `daemon`, `cf-worker`, `mcp-server`, `desktop`, `db`, `shared`, `claude`, `repo`) mirroring the commit-scope enum in `commitlint.config.mjs`. Sub-scopes (`web/positions/`, `daemon/oanda/`) are allowed when a scope's volume warrants grouping — the `requirements-curator` agent decides when to promote.

## Requirement ID format

`REQ-<SCOPE>-<NUMBER>` where:

- `SCOPE` is SCREAMING-KEBAB (matches commit-scope enum; sub-scopes hyphenated, e.g. `WEB-POSITIONS`)
- `NUMBER` is a zero-padded three-digit integer, allocated sequentially within its scope
- Examples: `REQ-TRADING-014`, `REQ-WEB-POSITIONS-004`, `REQ-CLAUDE-002`

IDs are allocated by the `requirements-curator` agent, which reads the corresponding `.reqid-counters/<scope>` file and increments it. **IDs are never reused**. A deprecated or rejected requirement keeps its ID forever; the next mint in that scope allocates the next integer.

## Per-requirement format

Use [`_template.md`](./_template.md) as the base. Every requirement file starts with YAML frontmatter:

```yaml
---
id: REQ-TRADING-023
title: Position size derived from risk amount and stop distance
status: draft # draft | accepted | implemented | deprecated | rejected
scope: trading
owner: maintainer
created: 2026-05-03
implemented: null # ISO date once shipped
tests: [] # array of test file paths
code: [] # array of implementation file paths
related: [] # other REQ IDs + ADR references
---
```

Body sections (in order):

1. **Rationale** — why this exists, what user problem it addresses (1–2 paragraphs)
2. **Acceptance criteria** — numbered, testable, unambiguous
3. **Non-goals** — what's explicitly out of scope
4. **Test plan** — what kinds of tests will cover this
5. **Implementation notes** — hints, not constraints; where it likely lives
6. **Changelog** — date-stamped status transitions

## Status transitions

Legal transitions:

```
draft  →  accepted    (after maintainer review)
accepted  →  implemented    (when code + tests ship)
implemented  →  deprecated    (when superseded by another requirement)
any  →  rejected    (kept in tree; ID stays reserved)
```

Illegal transitions (the `requirements-curator` agent refuses):

- `implemented` → `draft` (rework is a new requirement)
- `deprecated` → anything (terminal)
- `rejected` → anything (terminal)

## The index

`index.md` is the master traceability table — auto-maintained by the `requirements-curator` agent. Never hand-edited; the agent reconciles it on every feature commit. Columns: ID, Title, Status, Scope, Tests, Code, Last-updated.

## `@req:` tags in code and tests

Every test `it` block tags the requirement it covers:

```ts
it("rounds down fractional units", () => {
  // @req: REQ-TRADING-023
  expect(
    calculatePositionSize({
      /* ... */
    }),
  ).toBe(49);
});
```

Source files under `apps/**/src` or `packages/**/src` carry a `@req:` comment near the primary export. The `pre-edit-requirement-link` hook blocks new source files without one. The `pre-commit-requirements-sync` hook blocks `feat()` commits whose changes don't link to a requirement (either via `@req:` tags in staged source, via a commit-footer `@req: REQ-*-*`, or by staging a new requirement file alongside).

## Minting a new requirement

The skill that handles every lifecycle operation is [`/trace`](../../.claude/skills/trace/SKILL.md):

- `/trace --mint "<one-line description>"` — agent mints a new ID, drafts the file from the template, returns the draft for maintainer review. The counter increments automatically.
- `/trace <REQ-ID>` — look up everything linked to a requirement (tests, code, related IDs)
- `/trace --orphans` — detect code without `@req:` links and requirements with broken test/code paths
- `/trace --coverage` — per-scope coverage report

Do not hand-edit `.reqid-counters/*` files. The counter is the skill's source of truth; desync is a bug.

## What goes in requirements vs. what goes elsewhere

| Artifact                    | Captures                                                                   |
| --------------------------- | -------------------------------------------------------------------------- |
| **`docs/requirements/`**    | What ForexFlow promises to do — features, constraints, acceptance criteria |
| `.claude/decisions/` (ADRs) | Why we chose a technology or approach — architectural decisions            |
| `.claude/learnings/`        | Corrections to the agent config with proposed edits                        |
| `.claude/failure-modes.md`  | Patterns that warranted permanent guards                                   |
| `.claude/journal/`          | Session narrative and direction                                            |

A requirement says _"the app does X."_ An ADR says _"we chose technology Y to implement it."_ A test says _"when given input Z, the app does X."_ All three exist; they don't overlap.

## Rejected requirements

Requirements can be `rejected` — explicitly decided against. They stay in the tree (ID reserved forever) with a non-null `rationale` pointing at the rejection reason. This is how the project records "we considered this and decided no" for features as well as for tools.

## Bootstrap state

Phase 1 ships this scaffolding (README, template, index, counter directory) with zero requirements filed. Requirements start being minted as features land in Phase 2+.

The `pre-edit-requirement-link` and `pre-commit-requirements-sync` hooks flip from fail-open (per ADR-0002) to enforcing the moment this directory exists — which is now. Feature commits landing from this point forward must link a requirement.

Since Phase 1–9's commits were all `chore`/`feat(claude)`/`docs`/`feat(rules)` etc. — infrastructure, not product features — none retroactively need a `REQ-*` link. The first commits that will require one are in Sub-phase 10+ when `feat()` at the product-scope level lands.
