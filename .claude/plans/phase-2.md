# Phase 2 — Monorepo Skeleton

**Status:** not started
**Target:** a buildable monorepo skeleton (root tooling + empty apps/packages shells) produced by the `/bootstrap` skill, reviewed, and committed in small verifiable pieces.
**Entry point:** [`/bootstrap`](../skills/bootstrap/SKILL.md)

This plan is a **proposal**, not a commitment. Per CLAUDE.md Non-negotiable #13 and rule 00 §2, agent-authored plans are planning aids. The maintainer adjusts, reorders, or overrides any sub-phase at will. The work ships when the maintainer says it does; there are no date or phase-count commitments.

## Why this phase exists

Phase 1 delivered the rails; no application code exists yet. Phase 2's purpose is to scaffold the **shells** — root `package.json` with pnpm workspace + Turbo, empty `apps/*` and `packages/*` directories with correct tsconfigs, shared tooling configs (ESLint, Prettier, Vitest, Playwright) — so that subsequent phases can land the first real source file without re-deciding where it goes.

No business logic lands in Phase 2. The product of this phase is a repo that runs `pnpm install && pnpm typecheck && pnpm lint && pnpm test` cleanly against empty packages.

## Proposed sub-phases

These are sketches. The `/bootstrap` skill's dry-run mode produces the canonical file plan; the maintainer reviews it before any `apply`.

| #   | Goal                                                                                            | Notes                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Root skeleton via `/bootstrap --dry-run` → review → `/bootstrap apply`                          | `package.json`, `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.base.json` + `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `playwright.config.ts`, `knip.json`, `lefthook.yml`, `scripts/preflight.sh` |
| 2   | `packages/types` empty shell                                                                    | `package.json`, `tsconfig.json`, `src/index.ts` (empty), `CLAUDE.md`. First workspace package; validates the workspace protocol                                                                                                       |
| 3   | `packages/config` empty shell                                                                   | T3 Env skeleton (daemon-env.ts, web-env.ts, cf-worker-env.ts stubs); validates that env schemas can import from `@forexflow/types`                                                                                                    |
| 4   | `packages/logger` empty shell                                                                   | Pino factory stubs (daemon.ts, web.ts, cf-worker.ts); imports from `@forexflow/config` for log-level                                                                                                                                  |
| 5   | `packages/shared` empty shell                                                                   | Runtime-agnostic utilities package; no trading-core yet (Phase 3)                                                                                                                                                                     |
| 6   | `packages/db` empty shell                                                                       | Prisma schema with no models; `client.ts` stub with deployment-mode switch; `encryption.ts` stub                                                                                                                                      |
| 7   | `apps/daemon` / `apps/web` / `apps/cf-worker` / `apps/mcp-server` / `apps/desktop` empty shells | Each with `package.json`, `tsconfig.json`, `src/` placeholder, `CLAUDE.md` last-verified today                                                                                                                                        |
| 8   | Lefthook install + commitlint wire + first `pnpm preflight` green                               | Preflight runs cleanly against the empty workspace                                                                                                                                                                                    |
| 9   | Phase 2 completion — snapshot, ADR, version bump (0.2.0 → 0.3.0), handoff                       | Mirror of the Phase 1 completion pattern                                                                                                                                                                                              |

## Stop criterion

Phase 2 completes when all of:

- ✅ Every sub-phase committed and maintainer-verified
- ✅ `pnpm install && pnpm typecheck && pnpm lint && pnpm test` all green
- ✅ `ci-push.yml` transitioned from inert to firing its lint/typecheck/test job (verified by a push to a feature branch, green CI)
- ✅ Harness still green (27+ plus any new structural fixtures added for the monorepo)
- ✅ `/bootstrap --dry-run` becomes obsolete — no further invocations; skill documents it as "Phase 2 only" from here on
- ✅ All fail-open hooks that depended on Phase 2 artifacts (`pre-commit-continuous-green` especially) confirmed active

## Hooks that activate during Phase 2

- `pre-commit-continuous-green` — fires the moment `package.json` + `pnpm` are present
- `post-edit-format` — Prettier runs on every edit once `node_modules/.bin/prettier` exists
- `ci-push.yml` — jobs run for real on every push
- No other hooks change state

## Carried forward from Phase 1

Every deferred follow-up from Phase 1's snapshot (`snapshots/phase-1-end.json`) has been either resolved or reparented. Any item still unresolved at Phase 1 completion is listed here before Phase 2 begins — the `/phase-complete` skill refuses to advance otherwise.

## Open maintainer decisions

Items to resolve before `/bootstrap apply`:

- **Commit scope for the bootstrap commit**: proposed `repo` (scaffolds the project shell). Alternative: `ci` if the maintainer prefers to group tooling commits under ci
- **Whether to commit the sub-phases as one big `feat(repo): bootstrap Phase 2 skeleton` or nine small commits**: the skill's default is one-commit-per-sub-phase mirroring Phase 1; `/bootstrap` generates per-sub-phase patches for review
- **Node version pin**: currently `mise.toml` says Node 22. Is that still correct when Phase 2 starts? (If a newer LTS has shipped by then, bumping is the first decision)

## Not in scope for Phase 2

- Business logic in any app (all `src/index.ts` are empty or export nothing)
- Any trading-domain primitive (Phase 3)
- Any Prisma model (Phase 4)
- Any feature requirement (Phase 5+ as specific features are designed)
- CI workflow changes beyond confirming the inert ones fire
