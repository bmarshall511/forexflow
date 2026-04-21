# `.claude/snapshots/`

Regression-snapshots captured at phase and sub-phase boundaries so future work can detect silent drift.

A **snapshot** is a deterministic capture of project state at a named moment: test pass/fail counts, type-coverage, bundle sizes, LOC per file, benchmark results. Next phase's work runs the same measurements and diffs them; any meaningful regression is surfaced as a `/phase-complete` blocker.

## Directory layout

```
.claude/snapshots/
├── README.md                          Tracked — this file
├── phase-1-sub-phase-12.json          A committed snapshot at a phase/sub-phase boundary
├── phase-2-end.json
├── benchmarks/
│   └── reconcile-loop.json            Per-benchmark historical record
└── ...
```

Named snapshots (phase + sub-phase boundaries) are tracked so diffs across phases are reviewable in git history. Benchmark snapshots under `benchmarks/` are tracked for the same reason — baseline drift is visible in PR diffs.

## Format

One JSON file per snapshot. Expected top-level shape:

```json
{
  "taken_at": "2026-04-21T22:00:00Z",
  "phase": "1",
  "sub_phase": "12",
  "commit": "<sha>",
  "metrics": {
    "harness": { "passed": 25, "failed": 0, "duration_ms": 2300 },
    "loc": {
      "rules": 2921,
      "hooks": 2478,
      "agents": 2916,
      "skills": 4080,
      "largest_files": [
        { "path": ".claude/rules/01-typescript.md", "loc": 240 },
        ...
      ]
    },
    "config_version": "0.1.0",
    "rule_count": 16,
    "hook_count": 18,
    "agent_count": 13,
    "skill_count": 30,
    "adr_count": 6,
    "learning_count": 5,
    "bundle": { "apps/web/initial_kb": null, "apps/web/per_route_kb": {} },
    "typecheck": "pass",
    "lint": "pass",
    "test": "pass"
  }
}
```

Fields are optional where the measurement isn't yet relevant (e.g., `bundle` is `null` until `apps/web/` builds land in Phase 7+).

## Who writes snapshots

- **`/phase-complete`** — captures one snapshot as part of the phase-transition gate; named `phase-<N>-end.json`
- **Sub-phase validation** — optional per sub-phase; names `phase-<N>-sub-phase-<M>.json`. Not all sub-phases warrant one; the `meta-reviewer` agent flags the ones that do
- **Benchmark runs** — `pnpm bench <name>` writes to `benchmarks/<name>.json`, appending a new entry; the writer keeps the last ~30 entries to avoid unbounded file growth

## Who reads snapshots

- **`/phase-complete`** — runs the current-state measurements, diffs against the latest snapshot, refuses to advance on a regression beyond configured tolerance
- **`perf-auditor`** — uses `benchmarks/` as its baseline source (per `rules/05-performance.md`)
- **`/status`** — displays high-level deltas on the health dashboard when the latest snapshot differs from current state
- Maintainer during phase planning — skim history to see how the shape of the codebase evolved

## Tolerance

Default regression tolerances (override-able via ADR for a specific snapshot):

| Metric                | Tolerance                                                                        |
| --------------------- | -------------------------------------------------------------------------------- |
| Harness `passed`      | may not decrease (0%)                                                            |
| Harness `failed`      | may not increase                                                                 |
| LOC per file          | 10% over its size-limit is a soft warning; violating the hard limit is a blocker |
| Bundle (initial JS)   | +5% warning; +20% blocker (matches rule 05)                                      |
| Lighthouse perf score | -3 warning; -5 blocker                                                           |
| Benchmark throughput  | -10% warning; -20% blocker                                                       |

A `/phase-complete` that encounters a blocker-level regression refuses to advance until the regression is either fixed, justified via ADR, or the tolerance itself is updated via ADR.

## What isn't a snapshot

- Full source (that's `git archive`)
- Coverage reports (those live under `coverage/`, gitignored)
- Bundle analysis HTML (lives under `apps/web/.next/analyze/`, gitignored)

Snapshots are aggregate measurements only — numbers, counts, names. Never full artifacts.

## Bootstrap state

Phase 1 hasn't captured any snapshots yet. Sub-phase 12 writes `phase-1-end.json` as part of phase completion. Benchmark snapshots arrive when the first benchmark ships (Phase 3+ trading-core primitives).
