---
id: 0001
title: Rebuild ForexFlow as v3 from an empty branch
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [process, scope]
---

# 0001 — Rebuild ForexFlow as v3 from an empty branch

## Context

The v2 codebase on `main` is mature but was assembled piecemeal as features
landed. Many subsystems exceed the LOC guidance the rules aspire to, tests
are thin in several apps, observability is inconsistent, and the Electron
packaging pipeline has accumulated workarounds.

Retrofitting strictness onto that codebase was explored and rejected —
the cost of introducing strict enforcement mid-stream (tests, docs, per-
file LOC limits) is higher than the cost of rebuilding fresh with those
rails already in place.

## Decision

1. Branch `v3` from `main` HEAD (commit `4bc6fce`). Clear-slate the
   working tree in the first commit on `v3`. Nothing survives except
   `.git/`.
2. Phase the rebuild explicitly. Phase 1 delivers the AI coding-agent
   configuration **before any application code** so the rails exist to
   enforce quality from line one of the app.
3. License the project MIT, public. Non-individuals-in-artifacts rule
   applies throughout except `.github/CODEOWNERS` (GitHub requires a
   handle there).
4. Target stack: Next.js 15 + Hono + Prisma + Pino + Vitest + Playwright
   - Electron + Cloudflare Workers + MCP server. T3 Env for env-var
     validation; credentials otherwise configured in the in-app Settings
     UI and encrypted at rest.
5. When Phase 14 completes, `v3` replaces `main` as the default branch.

## Consequences

### Positive

- Every line on `v3` is written against strict rails that existed before
  the line did. No retrofits.
- `main` remains a working reference throughout the rebuild so lessons
  (not code) can be pulled forward.
- Rebuild phases are independently verifiable; the maintainer reviews
  each sub-phase before the next starts.

### Negative

- During the rebuild, the project has effectively two codebases to
  reason about. Contributor attention is split.
- Some rework of already-solved problems (OANDA integration nuances,
  trading-core primitives) is unavoidable.
- Calendar cost. Phase count is 14 at present; each phase's duration
  depends on review cadence.

### Neutral

- The `.claude/` configuration itself becomes a first-class artifact
  with its own SemVer and CHANGELOG. The configuration is now part of
  the product.

## Alternatives considered

- **In-place refactor of v2** — rejected. See `rejected/0001-in-place-
refactor.md` (to be authored if the alternative warrants permanent
  record).
- **Fork to a new repo** — rejected. Loses git-history continuity and
  duplicates contributor onboarding overhead.

## Follow-ups

- [x] Phase 1 sub-phase plan pinned at `.claude/plans/phase-1.md`
- [x] `main` branch protection (maintainer-actioned in GitHub Settings)
- [ ] Phase 14 cutover ADR (to be written when the cutover is staged)
- [ ] Cross-link from `README.md` once v3 ships as default

## References

- `.claude/plans/phase-1.md`
- `.claude/CLAUDE.md` §"What is on this branch"
- `.claude/context/stack.md`
- Repository: `github.com/bmarshall511/forexflow`
