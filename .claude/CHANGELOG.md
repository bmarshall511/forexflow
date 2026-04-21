# Changelog — `.claude/` Configuration

All notable changes to the AI agent configuration are recorded here.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the configuration itself follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The `post-edit-meta-log` hook appends entries to `[Unreleased]` automatically when files under `.claude/` are modified. Sub-phase completions promote `[Unreleased]` to a numbered release.

## [Unreleased]

### Added

- 2026-04-21 skill: `.claude/skills/bootstrap/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/phase-complete/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/phase-start/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-test/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-ws-event/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-daemon-endpoint/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-db-service/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-api-route/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-hook/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/add-component/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/tail-logs/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/smoke-test/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/debug/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/dep-upgrade/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/migrate/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/trace/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/refactor/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/perf-audit/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/a11y/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/doc-check/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/stale-rules/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/security-review/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/review/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/verify/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/cost-report/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/contribute/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/why/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/handoff/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/status/SKILL.md` (write)
- 2026-04-21 skill: `.claude/skills/README.md` (write)
- 2026-04-21 agent: `.claude/agents/explorer.md` (write)
- 2026-04-21 agent: `.claude/agents/dep-upgrade.md` (write)
- 2026-04-21 agent: `.claude/agents/requirements-curator.md` (write)
- 2026-04-21 agent: `.claude/agents/migration-writer.md` (write)
- 2026-04-21 agent: `.claude/agents/perf-auditor.md` (write)
- 2026-04-21 agent: `.claude/agents/docs-syncer.md` (write)
- 2026-04-21 agent: `.claude/agents/refactor-planner.md` (write)
- 2026-04-21 agent: `.claude/agents/test-writer.md` (write)
- 2026-04-21 agent: `.claude/agents/debug-investigator.md` (write)
- 2026-04-21 agent: `.claude/agents/meta-reviewer.md` (write)
- 2026-04-21 agent: `.claude/agents/integration-reviewer.md` (write)
- 2026-04-21 agent: `.claude/agents/security-reviewer.md` (write)
- 2026-04-21 agent: `.claude/agents/code-reviewer.md` (write)
- 2026-04-21 agent: `.claude/agents/README.md` (write)
- 2026-04-21 plan: `.claude/plans/phase-1.md` (edit)
- 2026-04-21 decision: `.claude/decisions/rejected/README.md` (write)
- 2026-04-21 decision: `.claude/decisions/0005-post-edit-meta-log-changelog.md` (write)
- 2026-04-21 decision: `.claude/decisions/0004-reserved-identifiers-per-user.md` (write)
- 2026-04-21 decision: `.claude/decisions/0003-todowrite-plan-marker.md` (write)
- 2026-04-21 decision: `.claude/decisions/0002-fail-open-bootstrap-posture.md` (write)
- 2026-04-21 decision: `.claude/decisions/0001-v3-greenfield-rebuild.md` (write)
- 2026-04-21 decision: `.claude/decisions/_template.md` (write)
- 2026-04-21 decision: `.claude/decisions/README.md` (write)
- 2026-04-21 config: `.claude/config/reserved-identifiers.example.json` (write)
- 2026-04-21 config: `.claude/config/doc-map.json` (write)
- 2026-04-21 config: `.claude/config/import-boundary-graph.json` (write)
- 2026-04-21 config: `.claude/config/size-exceptions.json` (write)
- 2026-04-21 config: `.claude/config/README.md` (write)

## [0.1.0] — Phase 1, Sub-phase 2 — 2026-04-21

### Added

- `.claude/CLAUDE.md` — master project instructions for AI coding agents
- `.claude/README.md` — contributor-facing catalog of the agent configuration
- `.claude/VERSION` — semantic version for the configuration itself
- `.claude/CHANGELOG.md` — this file
- `.claude/context/domain.md`, `stack.md`, `conventions.md` — canonical context files
- `.claude/plans/phase-1.md` — active rebuild plan
- `.claude/plans/active.md` — symlink pointing at the current phase plan
- `.claude/plans/README.md` — plan lifecycle and phase-transition gate
- `.claude/settings.json` — shared sandbox, permissions, and hook wiring stubs
- `.claude/settings.local.example.json` — template for per-user settings

### Context

Greenfield rebuild initiated. `v3` branch created from `main` HEAD (`4bc6fce`). Phase 1 delivers the AI agent rails before any application code is written. See `.claude/plans/phase-1.md` for the full 12-sub-phase plan.
