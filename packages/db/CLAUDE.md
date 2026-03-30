# packages/db — Prisma + SQLite Database Layer

## Architecture

- Prisma ORM with SQLite (LibSQL adapter). Supports remote Turso (cloud LibSQL) connections.
- WAL mode enabled, `busy_timeout=5000` for concurrent access.
- Client: lazy-initialized singleton via `getDb()` in `client.ts`.
- Schema: `prisma/schema.prisma` (22+ models).

## Source Files

```
src/
  client.ts                    # Lazy DB client singleton
  encryption.ts                # AES-256-GCM encryption utilities
  utils.ts                     # Shared helpers
  index.ts                     # Barrel exports
  {domain}-service.ts          # One service file per domain
```

## Service Pattern

Each domain has a dedicated service file exporting pure functions that accept a DB client:

- `trade-service.ts` — trades, enrichment, upsert
- `notification-service.ts` — notifications with 5-sec dedup window
- `settings-service.ts` — app settings CRUD
- `ai-settings-service.ts` / `ai-analysis-service.ts` / `ai-recommendation-service.ts`
- `trade-condition-service.ts` — AI trade conditions
- `tv-alerts-config-service.ts` / `tv-alerts-signal-service.ts` (weekend-aware: `getTodaySignalCount()` and `getAutoTradesSummary()` use `getLastTradingSessionStart()` to show last session's data on weekends) / `signal-audit-service.ts`
- `zone-service.ts` / `zone-settings-service.ts`
- `trend-service.ts` / `trend-settings-service.ts`
- `trade-finder-service.ts` / `trade-finder-config-service.ts`
- `tag-service.ts` / `chart-layout-service.ts` / `curve-snapshot-service.ts`
- `ai-digest-service.ts`
- `deployment-service.ts` — deployment mode + cloud daemon URL

## Key Patterns

### enrichSource

- `Trade.source` in DB is always `"oanda"` (OANDA is the canonical trade repository).
- True origin is in `Trade.metadata` JSON: `{ placedVia: "ut_bot_alerts" | "fxflow" }`.
- `enrichSource(source, metadata)` resolves display-friendly source labels. Exported from `trade-service.ts` for reuse in other modules (e.g., `trade-syncer.ts`).
- Applied in `toClosedTradeData()`, `getTradeWithDetails()`, and at runtime in `reconcile()`.

### closeOrphanedTrades

- `closeOrphanedTrades()` accepts a `FetchOrphanCloseDetails` callback to fetch actual close details (P&L, exit price, close reason) from OANDA before marking trades closed.
- Returns `{ count: number; closedTradeIds: string[] }` (not just a count).
- New exported types: `OrphanCloseDetails`, `FetchOrphanCloseDetails`.

### Upsert

- `upsertTrade()` uses unique constraint `[source, sourceTradeId]`.
- Metadata is pre-seeded before first reconcile for TV-alert orders.

### Encryption

- `encryption.ts` — AES-256-GCM, format: `"iv:tag:ciphertext"`.
- Used for sensitive settings (API keys, tokens).

### Cost Calculation

- `calculateCost()` uses `AI_MODEL_OPTIONS` pricing from `@fxflow/types`.

### Reset

- `reset-service.ts` — selective, trading data, factory, and fresh install resets.
- `disableAllAutomation()` — server-side kill switch for all automation systems (TV Alerts, Trade Finder, AI Trader, SmartFlow). Called before DB reset to prevent auto-trade systems from re-placing trades.
- `setLastResetAt()` — records reset timestamp in `Settings.lastResetAt`. Daemon backfill uses this to skip pre-reset trades.
- `getLastResetAt()` in `settings-service.ts` — read the reset timestamp for backfill gating.

### Cleanup

- Most services have cleanup methods for pruning old records.
- Call patterns vary (scheduled, on-startup, manual).

### Cloud DB (Turso)

- `client.ts` auto-detects local vs remote via URL prefix (`file:` vs `libsql://`/`https://`).
- Remote connections pass `TURSO_AUTH_TOKEN` and skip SQLite pragmas (WAL, busy_timeout).
- `deployment-service.ts` — CRUD for deployment settings (`deploymentMode`, `cloudDaemonUrl` on Settings model).

## Gotchas

- Always use `getDb()` — never instantiate Prisma client directly.
- Notification dedup: 5-second window prevents duplicate notifications for the same event.
- SQLite limitations: no concurrent writes across processes, WAL helps but doesn't eliminate.
- Prisma generates types in `src/generated/` — run `prisma generate` after schema changes.
- Encryption key must be 32 bytes (256 bits) for AES-256-GCM.
- For cloud DB: set `DATABASE_URL=libsql://...` + `TURSO_AUTH_TOKEN`. WAL/busy_timeout pragmas are skipped automatically.
