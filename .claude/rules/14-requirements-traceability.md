---
name: requirements-traceability
scope:
  [
    "apps/**",
    "packages/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "docs/requirements/**",
  ]
enforcement: strict
version: 0.2.0
related:
  - "hooks/pre-commit-requirements-sync.mjs"
  - "agents/requirements-curator.md"
  - "skills/trace/SKILL.md"
applies_when: "Adding, changing, or testing a feature"
---

# Requirements Traceability

Every feature ships with a requirement. Every test links to a requirement. The requirements document never drifts from the code because a hook blocks the commit if it would.

This rule is what makes the phrase "the requirements doc is 100% accurate" structurally true rather than aspirational.

## The requirement ID

Format: `REQ-<SCOPE>-<NUMBER>`.

- `SCOPE` matches the commit scope enum (`WEB`, `DAEMON`, `CF-WORKER`, `TRADING`, `CLAUDE`, `REPO`, etc.)
- `NUMBER` is a zero-padded three-digit integer, allocated sequentially within a scope

Examples:

- `REQ-TRADING-014` — the 14th trading-domain requirement
- `REQ-WEB-POSITIONS-004` — a feature-sub-scoped requirement (hyphenated scope is allowed when useful for organization)
- `REQ-CLAUDE-002` — a requirement about the `.claude/` configuration itself (rare; most `.claude/` changes trace to an ADR)

IDs are allocated by the `requirements-curator` agent (which reads per-scope integer files under `docs/requirements/.reqid-counters/`, one file per scope). They are never reused. Deleted requirements leave their ID vacant forever.

## Where requirements live

```
docs/requirements/
├── README.md              What requirements are, how to add one, traceability rules
├── index.md               The master traceability table
├── _template.md           Per-requirement template
├── .reqid-counters/       One integer file per scope, incremented by requirements-curator
│   ├── trading            → REQ-TRADING-<NNN>
│   ├── web                → REQ-WEB-<NNN>
│   └── ...                (one file per commit-scope enum value)
│
├── trading/
│   ├── 001-risk-based-sizing.md
│   ├── 002-circuit-breaker-consecutive-losses.md
│   └── ...
├── web/
│   ├── positions/
│   │   ├── 001-live-pnl-display.md
│   │   └── ...
│   └── ...
└── claude/
    └── ...
```

One file per requirement. Filename: `<number>-<kebab-slug>.md`.

Phase 1 scaffolds `docs/requirements/README.md`, `index.md`, `_template.md`, and `.reqid-counters/` with one zero-initialized integer file per commit-scope enum value (13 scopes). The feature directories (`trading/`, `web/`, etc.) are created as features land in later phases.

## The per-requirement file

```markdown
---
id: REQ-TRADING-023
title: Position size derived from risk amount and stop distance
status: draft # draft | accepted | implemented | deprecated
scope: trading
owner: maintainer
created: 2026-05-03
implemented: null # ISO date once shipped
tests:
  - packages/shared/src/trading-core/risk-sizing.test.ts
  - apps/daemon/src/__tests__/integration/place-order.test.ts
code:
  - packages/shared/src/trading-core/risk-sizing.ts
related:
  - REQ-TRADING-022
  - decisions/0014-risk-based-sizing-formula.md
---

# Position size derived from risk amount and stop distance

## Rationale

Users size trades by risk, not by units. A "1% risk" trade means losing 1% of
account equity if the stop is hit. Implementing this as a first-class primitive
— instead of scattering `accountBalance * 0.01 / distance` across subsystems —
prevents drift between TV Alerts, Trade Finder, AI Trader, and SmartFlow.

## Acceptance criteria

1. Given riskAmount ∈ ℝ⁺, riskPips ∈ ℝ⁺, pipValuePerUnit ∈ ℝ⁺, the function
   returns `floor(riskAmount / (riskPips × pipValuePerUnit))`
2. Given riskAmount = 0 OR riskPips = 0, the function returns 0
3. Given a JPY-quote instrument (`*_JPY`), pipValuePerUnit correctly reflects
   the 0.01 pip size (two decimal places)
4. Given negative inputs, the function throws `InvalidInputError` (caller bug)
5. The function is used by every subsystem that places an order — no
   subsystem re-implements sizing

## Non-goals

- Does not handle contract-size conversions for indices, commodities, or
  non-forex instruments (out of scope for v3 initial release)
- Does not account for margin requirements (that is a separate check in the
  order-placement path)

## Test plan

- Unit: every branch of the formula, including edge cases
- Integration: place an order through the daemon and verify sizing
- Property-based (optional, later): generated inputs, invariant `sizing
never exceeds risk budget`

## Implementation notes

- Lives in `packages/shared/src/trading-core/risk-sizing.ts`
- Exported factory function (not a class)
- Pure; no side effects; no I/O

## Changelog

- `2026-05-03` — drafted
- `2026-05-15` — accepted after review
- `2026-05-20` — implemented in commit abc1234
```

Frontmatter fields:

| Field         | Required               | Notes                                                      |
| ------------- | ---------------------- | ---------------------------------------------------------- |
| `id`          | yes                    | Must match filename number                                 |
| `title`       | yes                    | One-line summary                                           |
| `status`      | yes                    | `draft` → `accepted` → `implemented` (or `deprecated`)     |
| `scope`       | yes                    | Matches commit scope                                       |
| `owner`       | yes                    | Role (`maintainer`, `contributor`) — never a personal name |
| `created`     | yes                    | ISO date                                                   |
| `implemented` | no                     | ISO date once shipped, `null` before                       |
| `tests`       | yes (when implemented) | Array of test file paths                                   |
| `code`        | yes (when implemented) | Array of implementation file paths                         |
| `related`     | no                     | Array of related requirement IDs or decision ADRs          |

## The `@req` test tag

Every test's `it` block includes a `@req` comment naming the requirement(s) it covers:

```ts
describe("calculatePositionSize", () => {
  it("returns floor of risk / (pips × pipValue)", () => {
    // @req: REQ-TRADING-023
    expect(
      calculatePositionSize({
        riskAmount: 100,
        riskPips: 20,
        pipValuePerUnit: 0.1,
      }),
    ).toBe(50);
  });

  it("rounds down fractional units", () => {
    // @req: REQ-TRADING-023
    expect(
      calculatePositionSize({
        riskAmount: 99,
        riskPips: 20,
        pipValuePerUnit: 0.1,
      }),
    ).toBe(49);
  });

  it("returns 0 when risk is zero", () => {
    // @req: REQ-TRADING-023
    expect(
      calculatePositionSize({
        riskAmount: 0,
        riskPips: 20,
        pipValuePerUnit: 0.1,
      }),
    ).toBe(0);
  });
});
```

Multiple requirements per test are allowed:

```ts
it("respects circuit breaker when placing", () => {
  // @req: REQ-TRADING-023, REQ-TRADING-045
  ...
})
```

The `/trace` skill parses these tags and builds the requirement → test → code map.

## The index

`docs/requirements/index.md` holds the master traceability table:

```markdown
# Requirements Index

Auto-maintained by the `requirements-curator` agent. Do not edit by hand; the
agent will reconcile on every feature commit.

| ID                    | Title                                             | Status      | Scope   | Tests | Code | Last updated |
| --------------------- | ------------------------------------------------- | ----------- | ------- | ----- | ---- | ------------ |
| REQ-TRADING-023       | Position size derived from risk and stop distance | implemented | trading | 2     | 1    | 2026-05-20   |
| REQ-WEB-POSITIONS-004 | Positions render as card list on mobile           | implemented | web     | 3     | 2    | 2026-06-01   |
| REQ-CLAUDE-001        | Agent configuration versioned with SemVer         | accepted    | claude  | 0     | 0    | 2026-04-21   |

...
```

Regenerated on every commit by the `requirements-curator` agent, via a hook that runs after `pre-commit-requirements-sync`.

## The `pre-commit-requirements-sync` hook

Behavior on a staged commit:

1. Read the commit type from the first line of the commit message
2. If type is `feat`, `fix`, or `perf`:
   - Identify staged files under `apps/**` or `packages/**/src/**`
   - For each such file, check that either:
     - (a) a requirement file in `docs/requirements/` is also staged (new requirement); or
     - (b) the file's `@req` tags reference an existing requirement; or
     - (c) the commit message footer contains `@req: REQ-*-*`
   - If none of the above, block the commit with a message instructing the maintainer to either create a requirement or link an existing one
3. If type is `docs`, `test`, `chore`, `refactor`, `ci`, `build`, `style`:
   - No requirement link required (these don't change behavior)

Escape hatches for legitimate cases:

- `feat` commits that _only_ add infrastructure (e.g., a new `CLAUDE.md`): the footer `@req: REQ-CLAUDE-*` handles this
- Reverts (`revert:`): no requirement link needed; the original commit's link suffices

## The `requirements-curator` agent

Responsibilities:

1. **Mint new IDs** on request. When the maintainer or another agent says "I need a requirement for X," this agent allocates the next ID in the relevant scope's counter
2. **Draft new requirement files** from a short description — fills in the template, populates frontmatter, writes an initial rationale
3. **Update status** as a requirement moves through `draft` → `accepted` → `implemented`
4. **Maintain the index** by reading every requirement file and regenerating `index.md`
5. **Detect orphans**: code files under `apps/**` or `packages/**/src/**` with no inbound `@req` link, or requirements with no matching `code` file
6. **Detect staleness**: requirements whose linked test files no longer exist, or whose linked code was deleted

Dispatched automatically by the `pre-commit-requirements-sync` hook, and manually by the maintainer via `/trace` or `/requirements-audit` (the latter is a Phase 10 skill).

## The `/trace` skill

`/trace <REQ-ID>` — shows everything linked to a requirement:

```
REQ-TRADING-023 — Position size derived from risk and stop distance
Status: implemented (2026-05-20)

Tests (2):
  packages/shared/src/trading-core/risk-sizing.test.ts
  apps/daemon/src/__tests__/integration/place-order.test.ts

Code (1):
  packages/shared/src/trading-core/risk-sizing.ts

Related:
  REQ-TRADING-022 (accepted)
  decisions/0014-risk-based-sizing-formula.md
```

`/trace --orphans` — lists code files with no inbound requirement link, and requirements with no matching code.

`/trace --coverage` — reports the percentage of code files with linked requirements, per scope.

## What `code-reviewer` and `requirements-curator` check

- Every new test has at least one `@req` tag
- Every `feat` commit has a requirement link (new file or footer)
- Every requirement ID referenced in a test or commit exists
- Every requirement file has valid frontmatter
- Status transitions are legal (`draft` → `accepted` → `implemented`, or → `deprecated`)
- The index is current
- No orphans above the acceptable threshold (configured per scope; defaults to 0 orphans allowed)

Violations block the commit.
