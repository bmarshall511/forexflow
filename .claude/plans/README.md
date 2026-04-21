# Plans

> The rebuild is executed as a sequence of phases. Each phase is a set of sub-phases that each produce a single reviewable commit. At any given time, `active.md` points at the current phase's plan.

## How plans work

- Every phase has a numbered plan file: `phase-1.md`, `phase-2.md`, etc.
- `active.md` is a symlink that points at the currently-active phase plan
- A session always starts by reading `active.md`
- Within a phase, sub-phases run sequentially — the session implements, verifies, commits one sub-phase, then waits for maintainer confirmation before advancing

## Phase transitions

Moving from phase N to phase N+1 is gated by the `/phase-complete` skill, which:

1. Runs all reviewer agents on the phase's output
2. Runs the agent test harness
3. Verifies the requirements index has been updated
4. Runs a `/handoff` dry-run to confirm the phase is handoff-ready
5. Writes a phase-completion ADR in `.claude/decisions/`
6. Updates `VERSION` and `CHANGELOG.md`
7. Updates `active.md` to point at the next phase

No phase advances without all seven steps completing. The skill will refuse otherwise.

## Current phase

See [`active.md`](./active.md).

## Phase roadmap (subject to refinement each phase)

| Phase | Title | Status |
|---|---|---|
| 1 | AI agent configuration | In progress |
| 2 | Monorepo skeleton + toolchain (package.json, turbo, tsconfig, eslint, env, logger) | Planned |
| 3 | `packages/types` + `packages/shared` (runtime-agnostic utilities, trading-core primitives) | Planned |
| 4 | `packages/db` — Prisma schema + service files | Planned |
| 5 | `apps/daemon` — Hono HTTP + WebSocket + OANDA integration | Planned |
| 6 | `apps/cf-worker` — TradingView webhook relay | Planned |
| 7 | `apps/web` — foundation (auth, shell, home, positions) | Planned |
| 8 | Trade discipline features (circuit breakers, risk caps, correlation guards) | Planned |
| 9 | Trade Finder (zone scanner) | Planned |
| 10 | AI Trader (multi-tier pipeline) | Planned |
| 11 | SmartFlow (autonomous management) | Planned |
| 12 | Desktop packaging (Electron DMG) | Planned |
| 13 | MCP server wiring | Planned |
| 14 | Cutover — merge `v3` → `main` | Planned |

Later phases will be re-scoped as earlier ones surface constraints. Nothing is locked beyond the current phase.

## Archive

Completed phase plans stay in this directory as historical record. They are not edited after the phase is done. Corrections or updates are documented via ADR instead.
