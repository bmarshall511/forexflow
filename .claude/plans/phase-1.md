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

| # | Goal | Status |
|---|---|---|
| 1 | Clear slate + repo hygiene (LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, .github/, mise, .editorconfig, .gitignore, docs/dev/GETTING_STARTED) | ✅ committed `96d4c0e` |
| 2 | `.claude/` foundation (CLAUDE.md, README, VERSION, CHANGELOG, settings.json, settings.local.example.json, context/*, plans/*) | In progress |
| 3 | Rules — 16 path-scoped rules with machine-readable frontmatter | Pending |
| 4 | Hooks — 16 executable guardrails, wired into settings.json | Pending |
| 5 | Agents — 13 specialist sub-agents (reviewers, implementers, explorers) | Pending |
| 6 | Skills — 29 slash-command workflows | Pending |
| 7 | Cursor-parity generator + test harness | Pending |
| 8 | Agent test harness (synthetic violations verify every hook fires) | Pending |
| 9 | Meta directories (decisions, journal, failure-modes, telemetry, handoffs, snapshots) | Pending |
| 10 | Requirements scaffolding (`docs/requirements/` index + README + template + counter) | Pending |
| 11 | CI workflows (config-only validation; app CI templates seeded but inert) | Pending |
| 12 | Validation + `/bootstrap --dry-run` + phase completion ADR + promote to Phase 2 | Pending |

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
