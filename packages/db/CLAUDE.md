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
- `tv-alerts-config-service.ts` (TVAlertsConfig fields: `riskPercent` Float default 1.0, `minUnits` Int default 1000 for risk-based position sizing; legacy `positionSizePercent` deprecated) / `tv-alerts-signal-service.ts` (weekend-aware: `getTodaySignalCount()` and `getAutoTradesSummary()` use `getLastTradingSessionStart()` to show last session's data on weekends) / `signal-audit-service.ts`
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

### AI Analysis v2 Schema

- `AiAnalysis` added columns: `partialStreamText` (preserved on cancel), `cancelledAt`, `schemaVersion` (1 = legacy, 2 = includes `conditionChanges`), `reconciliationLog` (JSON array of `AiReconciliationLogEntry`), `cacheReadTokens`/`cacheWriteTokens` (prompt caching accounting), `truncated` + `stopReason` (response cut off by `max_tokens` → row is saved with `status: "partial"` and UI renders `TruncationBanner`).
- `saveAnalysisResult(id, { truncated, stopReason, ... })` persists truncation state and flips status to `"partial"` when `truncated=true`. All stats aggregations (`getUsageStats`, `getLatestCompletedAnalysis`, `getAnalysisCountsByTradeIds`) treat `completed` and `partial` as equivalent — partial analyses have usable sections, just incomplete.
- Added `pruneTerminalConditions(olderThanHours = 24)` which soft-deletes expired/triggered/cancelled conditions older than the window. Runs hourly from `ConditionMonitor.startTimeBasedChecks` to keep the re-run AI prompt clean of dead rules.
- `TradeCondition` added: `lastModifiedAt` (stamped by `updateCondition`), `deletedAt` (soft-delete — `deleteCondition` now soft-deletes so re-runs can see rejected ideas; `hardDeleteCondition` for GDPR), `expiredNotified` (idempotency flag for expiry notifications). `listConditionsForTrade`/`listActiveConditions` filter out soft-deleted rows; `listRecentlyDeletedForTrade(tradeId, sinceDays=7)` exposes them for the re-run context gatherer.
- `AiSettings` added: `autoRetryInterrupted`, `monthlyBudgetCapUsd`, `maxReconciliationOps` (default 20 — hard cap on re-run ops), `reanalysisScheduleJson`.
- New model `AiImmediateActionLog` tracks lifecycle of immediate (one-shot) actions proposed by analyses. Service at `ai-immediate-action-log-service.ts` — `logProposedAction`, `resolveAction`, `listActionsForTrade`, `listActionsForAnalysis`.
- `cancelAnalysis(id, partialStreamText?)` now accepts optional partial stream text which is persisted so the UI can render what Claude got to before being stopped.

### SmartFlow Trade Service

- `SmartFlowTrade` now has a nullable Prisma relation to `Trade` via the existing `tradeId` column. `getActiveSmartFlowTrades` / `getSmartFlowTradeHistory` / `getSmartFlowTrade` all include the joined Trade (entryPrice, exitPrice, realizedPL, closeReason, direction, instrument). `toTradeData()` computes `realizedPips` from the join using `getPipSize()` from `@fxflow/shared` (JPY-aware).
- `SmartFlowTradeData` exposes: `realizedPL`, `realizedPips`, `exitPrice`, `closeReason`, `avgSpread`, `lastManagementAction`. All nullable.
- `lastManagementAction` column (TEXT, nullable) is stamped automatically by `appendManagementLog` (from the log entry's `action`), `appendPartialCloseLog` (`"partial_close"`), and `closeSmartFlowTrade` (`"safety_net:<reason>"` or `"trade_closed"`). Consumers never write it directly.
- `estimateHoldTime(instrument, preset, direction, targetPips)` returns `{ estimatedHours, low, high } | null` by computing a per-sample hours-per-pip rate from `SmartFlowTimeEstimate` (excluding `safety_net` outcomes), clipping outliers past 4× median, and scaling by the new target. Returns null when there's no usable history. Called by `SmartFlowManager.placeMarketEntry` to pre-populate the trade's estimate fields.
- **Schema drift note**: The live SQLite DB carries ~46 MB of production data and is currently out of sync with `prisma/schema.prisma` on several fields from prior WIP. Phase 0 added `lastManagementAction` via manual `ALTER TABLE` (see commit message) rather than `prisma migrate dev` which would have reset the DB. A proper baseline reset is planned for Phase 1 of the SmartFlow/EdgeFinder audit.

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
