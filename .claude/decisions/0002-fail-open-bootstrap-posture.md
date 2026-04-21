---
id: 0002
title: Hooks fail open during bootstrap; activate automatically as infrastructure arrives
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [hooks, bootstrap, enforcement]
---

# 0002 — Hooks fail open during bootstrap; activate automatically as infrastructure arrives

## Context

Phase 1 lays down strict guardrails (`.claude/hooks/`) before the
application code those guardrails protect exists. Several hooks depend
on infrastructure that will not exist until later sub-phases or phases:

- `pre-commit-continuous-green` needs `package.json` scripts
  (`typecheck`, `lint`, `test`) — arriving in Phase 2
- `pre-commit-docs-sync` needs a `.claude/config/doc-map.json` with
  meaningful entries — currently only covers `.claude/` itself, expands
  as each app/package lands
- `pre-commit-requirements-sync` needs `docs/requirements/` — arriving
  in Sub-phase 10
- `pre-commit-ide-parity` needs `scripts/sync-ide-rules.mjs` — arriving
  in Sub-phase 7
- `pre-edit-plan-required` needs `.claude/.session-state/plans/` — see
  ADR #0003
- `pre-edit-requirement-link` needs `docs/requirements/` — same as above

Options for handling the pre-existence gap:

- Hard-code the hooks off during Phase 1 and turn them on with manual
  edits later. Risky: easy to forget; adds future work.
- Delay shipping the hooks until their dependencies exist. Defeats the
  "rails before code" principle of Phase 1.
- Have each hook detect missing infrastructure and fail open, activating
  automatically when the infrastructure lands.

## Decision

Every hook whose enforcement depends on not-yet-existent infrastructure
detects the missing dependency and fails open. As soon as the dependency
appears in the repo tree, the hook activates — no configuration flip,
no rewiring.

Specifically:

| Hook                           | Fail-open condition                                                               | Activates when                               |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------- |
| `pre-commit-continuous-green`  | `package.json` lacks `typecheck`/`lint`/`test` scripts, or `pnpm --version` fails | scripts are added and `pnpm install` has run |
| `pre-commit-docs-sync`         | `.claude/config/doc-map.json` missing or empty `entries`                          | map populated with real code → doc entries   |
| `pre-commit-requirements-sync` | `docs/requirements/` directory missing                                            | Sub-phase 10 scaffolds the directory         |
| `pre-commit-ide-parity`        | `scripts/sync-ide-rules.mjs` missing                                              | Sub-phase 7 ships the generator              |
| `pre-edit-plan-required`       | `.claude/.session-state/plans/` missing                                           | ADR #0003 wiring                             |
| `pre-edit-requirement-link`    | `docs/requirements/` missing                                                      | Sub-phase 10 scaffolds the directory         |

Fail-open is implemented via `return allow()` immediately after the
missing-infrastructure check, with a comment in the hook's header
referencing this ADR.

## Consequences

### Positive

- Strict rails ship in Phase 1 without requiring the infrastructure
  they protect to ship simultaneously.
- Hooks activate transparently — no human "switch-on" step to forget.
- Every hook's activation trigger is a concrete, observable repo
  condition, auditable by grep.

### Negative

- A hook could silently stay off if its activation dependency is
  subtly wrong (e.g., `docs/requirements/` exists but is empty).
  Mitigated by the `/stale-rules` skill (Sub-phase 6) which checks
  each hook's activation signal.
- Contributors reading a hook in Phase 1 see "fail open" paths they
  don't fully understand without this ADR. The hook headers reference
  the ADR.

### Neutral

- The test harness in Sub-phase 8 verifies both activation states of
  every hook (fail-open and enforcing) using synthetic fixtures.

## Alternatives considered

- **Feature flag in settings.json** — rejected. Adds a second source
  of truth that drifts from reality. The repo tree itself is the truth.
- **Single "bootstrap mode" environment variable** — rejected. Binary
  mode misses the fact that different hooks activate at different
  times.

## Follow-ups

- [ ] Every fail-open code path references "ADR #0002" in the hook
      header comment. (Several currently say "fails open" without
      citing the ADR; backfill during Sub-phase 8 when the harness
      runs over every hook.)
- [ ] `/stale-rules` skill verifies activation signals: `grep` each
      hook for its dependency check, confirm the dependency would
      activate it correctly given the current repo state.
- [ ] Test-harness fixtures in Sub-phase 8 cover both
      infrastructure-absent (fail-open) and infrastructure-present
      (enforcing) states for each of the six hooks above.
- [ ] When Phase 2 adds the missing scripts/dirs, the first commit of
      that phase that activates a given hook includes a smoke test in
      the PR body showing the hook now enforces.

## References

- `.claude/hooks/pre-commit-continuous-green.mjs`
- `.claude/hooks/pre-commit-docs-sync.mjs`
- `.claude/hooks/pre-commit-requirements-sync.mjs`
- `.claude/hooks/pre-commit-ide-parity.mjs`
- `.claude/hooks/pre-edit-plan-required.mjs`
- `.claude/hooks/pre-edit-requirement-link.mjs`
- ADR #0003
