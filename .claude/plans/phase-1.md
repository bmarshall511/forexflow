# Phase 1 — AI Agent Configuration

**Status:** in progress
**Started:** 2026-04-21
**Target completion:** all 12 sub-phases committed, synthetic test harness green, `/bootstrap --dry-run` produces a valid Phase 2 scaffold plan.

## Why this phase exists

Before any application code is written for `v3`, the AI agent rails that will produce that code must exist. Every hook, rule, agent, and skill in `.claude/` is a control on the quality of the code that arrives in Phase 2+. Getting these right is 10× cheaper than retrofitting them later.

## Scope

`.claude/` directory plus the minimum repository hygiene (LICENSE, README, CI scaffolds) needed to make the agent configuration testable. Zero application code.

## Guardrail decisions locked before this phase began

See `.claude/decisions/` for ADRs documenting each:

- License: **MIT**, copyright "ForexFlow Contributors"
- Enforcement: **strict** across the board
- Tests: **TDD-concurrent** (B) — implementation and tests in the same commit
- JSDoc: always on exported symbols
- Agent self-modification: free edits, auto-logged, meta-reviewed
- Model routing: Opus 4.7 for reviewers + main; Sonnet 4.6 for implementers; Haiku 4.5 for exploration subagents
- Test stack: Vitest + Playwright + contract tests + visual regression
- Stack: Next.js 15, Hono (not Express), Prisma, T3 Env, Pino, Electron
- Requirements: K3 structure (one file per feature/domain), L3 enforcement (agent curates + hook blocks)
- Cursor parity: generator script from `.claude/rules/` → `.cursor/rules/`; single source of truth
- Public-repo posture: GitHub Discussions enabled, private vulnerability reporting, CodeQL, gitleaks
- Handoff: skill + hook-based context-warn at ~80% + event triggers
- Execution: one commit per sub-phase, maintainer verifies between each, no auto-advance

## Sub-phases

| #   | Goal                                                                                                                                                       | Status                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | Clear slate + repo hygiene (LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, .github/, mise, .editorconfig, .gitignore, docs/dev/GETTING_STARTED) | ✅ committed `96d4c0e`        |
| 2   | `.claude/` foundation (CLAUDE.md, README, VERSION, CHANGELOG, settings.json, settings.local.example.json, context/_, plans/_)                              | ✅ committed `0e1a901`        |
| 3   | Rules — 16 path-scoped rules with machine-readable frontmatter                                                                                             | ✅ committed `83a05f2`        |
| 4   | Hooks — 17 executable guardrails, wired into settings.json                                                                                                 | ✅ committed `6e44113`        |
| 5   | Agents — 13 specialist sub-agents (reviewers, implementers, explorers)                                                                                     | ✅ committed `6bbb57f`        |
| 6   | Skills — 30 slash-command workflows (29 + `/learn` added in SP8)                                                                                           | ✅ committed `fd549ea`        |
| 7   | Cursor-parity generator + activation of `pre-commit-ide-parity`                                                                                            | ✅ committed `c4e56db`        |
| 8   | Agent test harness + continuous-learning loop (ADR 0006 + LRN-0001..0005)                                                                                  | ✅ committed `ad0f125`        |
| 9   | LRN-0005 guardrails + meta directories (rejected ADRs, failure-modes, journal, telemetry, handoffs, snapshots)                                             | ✅ committed `bc03d94`        |
| 10  | Requirements scaffolding + activation of requirements hooks                                                                                                | ✅ committed `6cc6fdf`        |
| 11  | CI workflows + commitlint + Renovate + semantic-release + docs/dev/CI.md                                                                                   | ✅ committed `3c78e75`        |
| 12  | Validation + snapshot + completion ADR + version bump + Phase 2 handoff                                                                                    | ✅ committed (this sub-phase) |

Full decision rationale for each sub-phase lives in the conversation record that produced this plan. During execution, the maintainer may steer any sub-phase; the plan is a guide, not a contract.

## Execution model

Between sub-phases:

- Maintainer verifies the committed sub-phase before the next starts
- Agent waits for explicit "next" before advancing
- No auto-advance under any circumstance

Within a sub-phase:

- Agent plans via `TodoWrite` at the start
- Agent implements all files for the sub-phase
- Agent stages and commits with a conventional-commits message
- Agent reports a verification checklist and hands back to maintainer

## Stop criterion for Phase 1

Phase 1 completes when all of:

- ✅ Every hook has a synthetic violation fixture in the test harness and the harness runs green
- ✅ Every agent loads and returns a valid verdict when given a test input
- ✅ Every skill is invocable and exits 0 on dry-run
- ✅ `/bootstrap --dry-run` produces a valid Phase 2 scaffold plan (no actual writes)
- ✅ `/handoff` output is sufficient to cold-start a fresh chat session for Phase 2 (dogfooded by the maintainer)
- ✅ `meta-reviewer` agent returns APPROVE on the entire `.claude/` directory
- ✅ `/stale-rules` reports zero broken references
- ✅ `/doc-check` reports docs in sync

When all seven pass, `/phase-complete` bumps `VERSION` to `0.2.0`, writes the completion ADR, and updates `active.md` to point at `phase-2.md`. Only then is Phase 1 done.

## Post-phase

Phase 2 begins in a fresh chat session. The first session message reads `active.md`, which by then points at `phase-2.md`, then reads the most recent handoff under `.claude/handoffs/latest.md`.

## Deferred follow-ups from earlier sub-phases

Every design choice that was knowingly deferred during a sub-phase is pinned here so it cannot be lost between sessions. Each item cites the ADR that captures its full rationale.

### From Sub-phase 4 — hooks

**Bootstrap fail-open paths** (ADR [#0002](../decisions/0002-fail-open-bootstrap-posture.md))

- [ ] Backfill the `ADR #0002` reference into the header comment of every hook that currently says "fails open" without citing the ADR. Do this in **Sub-phase 8** when the test harness runs over every hook.
- [ ] `/stale-rules` skill (**Sub-phase 6**) includes a check that each fail-open hook's activation signal would correctly flip the hook from allow to enforce given the current repo state.
- [ ] Test-harness fixtures (**Sub-phase 8**) cover both infrastructure-absent (fail-open) and infrastructure-present (enforcing) states for each of these six hooks: `pre-commit-continuous-green`, `pre-commit-docs-sync`, `pre-commit-requirements-sync`, `pre-commit-ide-parity`, `pre-edit-plan-required`, `pre-edit-requirement-link`.
- [ ] When Phase 2 adds the missing scripts/dirs that activate one of these hooks, the activating commit includes a smoke-test snippet in the PR body showing the hook now enforces.

**TodoWrite plan-marker emitter** (ADR [#0003](../decisions/0003-todowrite-plan-marker.md))

- [ ] **Sub-phase 8**: ship `.claude/hooks/post-todowrite-plan-marker.mjs` and wire it in `settings.json` under `PostToolUse` with matcher `TodoWrite`. Writes `.claude/.session-state/plans/<timestamp>.json`.
- [ ] **Sub-phase 8**: update `.claude/hooks/stop-session-check.mjs` to clean `.claude/.session-state/plans/` on Stop so the next session starts clean.
- [ ] **Sub-phase 8**: test-harness fixtures covering both states — no plan marker → block a >50-LOC Write; marker present → allow.
- [ ] **Sub-phase 8**: update the root `.gitignore` to include `.claude/.session-state/`.

**Reserved-identifiers per-user list** (ADR [#0004](../decisions/0004-reserved-identifiers-per-user.md))

- [ ] **Sub-phase 6**: `/contribute` skill reminds new teammates to copy `.claude/config/reserved-identifiers.example.json` → `reserved-identifiers.json` during onboarding.
- [ ] **Sub-phase 8**: test-harness fixtures covering both the empty-list (no-op) and populated-list (blocking) paths of `pre-edit-no-personal-names`.

**post-edit-meta-log auto-CHANGELOG** (ADR [#0005](../decisions/0005-post-edit-meta-log-changelog.md))

- [ ] **Sub-phase 6**: `/phase-complete` skill promotes `.claude/CHANGELOG.md` `[Unreleased]` to a numbered release, bumps `.claude/VERSION`, and writes the phase-completion ADR.
- [ ] **Sub-phase 8**: test-harness fixture verifies running the hook twice on the same path does not produce a duplicate changelog line.

### Cross-cutting

- [ ] **Sub-phase 9** (or earlier, if convenient during Sub-phase 5/6): populate `.claude/decisions/rejected/` with the Drizzle / Tauri / Bun / Express / Jest rejections discussed during Phase 1 planning. These were decided against in conversation but not yet recorded.
- [ ] **Sub-phase 12**: every checkbox above is either completed or explicitly moved to a later phase's plan before Phase 1 can close.
