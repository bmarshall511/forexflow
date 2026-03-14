# FXFlow — Claude Code Project Instructions

You are an expert TypeScript/Next.js engineer writing production-quality code for a forex trading platform.

## Workflow

- **Plan first**: ask only necessary questions, then provide a plan (goals, files, steps, verify).
- **No guessing**: do not invent files, APIs, or libraries. Check what exists before creating.
- **Small changes**: prefer surgical edits over large rewrites.

## Code Standards

- **File size**: components ≤150 LOC, services ≤300 LOC. Split when approaching limits.
- **DRY**: extract shared logic into packages/ or shared hooks. No copy-paste.
- **Strict TypeScript**: no `any` (use TODO comment if temporary). Prefer discriminated unions, branded types for IDs, exhaustive switch/never.
- **Runtime validation**: validate at boundaries (webhooks, API responses, user input) with Zod.
- **Error handling**: no silent catches. Errors must be typed, logged, and surfaced to UI.
- **Mobile-first**: responsive layout, touch-friendly targets (min 44x44px), no hover-only interactions.
- **Accessibility**: AAA baseline. Semantic HTML, keyboard nav, visible focus, correct labels, no color-only meaning, respect prefers-reduced-motion.

## Monorepo Layout (locked)

```
apps/
  web/           — Next.js 15 App Router (frontend + API routes)
  daemons/       — Node.js daemon (trade syncing, signals, AI analysis, port 4100)
  cf-worker/     — Cloudflare Worker + Durable Objects (TradingView webhook relay)
  mcp-server/    — MCP server (Claude Code ↔ live trading data bridge)

packages/
  types/         — Shared TypeScript contracts (event envelopes, DTOs)
  shared/        — Shared utilities (pure TS, no runtime-specific imports)
  db/            — Prisma schema + SQLite, service files per domain, encryption
```

## Import Boundaries (strict)

- `apps/*` may import from `packages/*`.
- `apps/web` must NOT import from `apps/daemons` or `apps/cf-worker` (and vice versa).
- `packages/*` must NOT import from `apps/*`.
- Keep runtime-specific code out of `packages/shared` and `packages/types`.

## Build / Test / Lint Commands

| Command             | Scope    | Description                      |
| ------------------- | -------- | -------------------------------- |
| `pnpm dev`          | all      | Start all apps in dev mode       |
| `pnpm build`        | all      | Production build                 |
| `pnpm lint`         | all      | ESLint across workspaces         |
| `pnpm typecheck`    | all      | `tsc --noEmit` across workspaces |
| `pnpm test`         | all      | Run test suites                  |
| `pnpm format`       | all      | Prettier format                  |
| `pnpm format:check` | all      | Check formatting (no write)      |
| `pnpm knip`         | all      | Find unused exports/dependencies |
| `pnpm docs:api`     | packages | Generate TypeDoc API docs        |
| `pnpm changelog`    | root     | Generate changelog from commits  |

## Key Domain Concepts

### OANDA as Trade Repository

- OANDA is the source of truth for all positions and orders.
- Daemon reconciles OANDA state into the DB every 2 minutes.
- Transaction stream provides instant fill/cancel notifications.

### Source / Metadata Pattern

- `Trade.source` in the DB is always `"oanda"` (the trade repository).
- True origin is stored in `Trade.metadata = JSON.stringify({ placedVia: "..." })`.
- `placedVia` values: `"fxflow"` | `"ut_bot_alerts"` | `"trade_finder"` | `"trade_finder_auto"`.
- `enrichSource(source, metadata)` in `packages/db/src/trade-service.ts` maps to display labels.

### Daemon (port 4100)

- HTTP REST API + WebSocket broadcast to connected web clients.
- StateManager is single source of truth — use event listeners, not polling.
- Per-instrument mutex for trade syncing and signal processing.
- Crash recovery: reset stuck "executing" states on startup.

### Signal Flow

TradingView → CF Worker POST /webhook/{token} → Daemon WebSocket → SignalProcessor → placeOrder()

## Deep Dive References

Canonical standards with full detail live in:

- `docs/ai/standards.md` — coding standards
- `docs/ai/directory-structure.md` — where code goes
- `docs/ai/realtime.md` — WebSocket and realtime patterns
- `docs/ai/testing.md` — testing approach
- `docs/ai/accessibility-aaa.md` — accessibility requirements

## Claude Rules

Path-scoped rules in `.claude/rules/` provide context-specific guidance:

- `00-foundation.md` — core principles
- `01-typescript-quality.md` — strict TS patterns
- `02-web-patterns.md` — Next.js + UI conventions
- `03-daemon-patterns.md` — daemon architecture
- `04-cf-worker-patterns.md` — Cloudflare Worker patterns
- `05-db-patterns.md` — database conventions
- `06-accessibility.md` — AAA accessibility
- `07-dependencies.md` — dependency management
- `08-trading-domain.md` — trading domain rules
