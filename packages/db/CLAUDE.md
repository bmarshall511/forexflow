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
- `ai-trader-reflection-service.ts` — Post-trade reflections for EdgeFinder (multi-agent memory)
- `tv-alerts-config-service.ts` (TVAlertsConfig fields: `riskPercent` Float default 1.0, `minUnits` Int default 1000 for risk-based position sizing; legacy `positionSizePercent` deprecated) / `tv-alerts-signal-service.ts` (weekend-aware: `getTodaySignalCount()` and `getAutoTradesSummary()` use `getLastTradingSessionStart()` to show last session's data on weekends) / `signal-audit-service.ts`
- `zone-service.ts` / `zone-settings-service.ts`
- `trend-service.ts` / `trend-settings-service.ts`
- `trade-finder-service.ts` / `trade-finder-config-service.ts`
- `tag-service.ts` / `chart-layout-service.ts` / `curve-snapshot-service.ts`
- `ai-digest-service.ts`
- `deployment-service.ts` — deployment mode + cloud daemon URL

## Key Patterns

### Account Isolation (Phase -1)

Every trade-derived model carries `account: TradingAccount` (= `TradingMode | "unknown"`). Practice and live history never commingle in analytics.

- **Writers** — every creator requires `account: TradingMode`. No optional shims. Daemon resolves `stateManager.getCredentials()?.mode` and drops the write if null rather than writing `"unknown"`.
- **Readers** — optional `account?: TradingMode` filter. Web routes inject `settings.tradingMode`; when set, legacy `"unknown"` rows are excluded via the equality match.
- **Join-derived tables** — `TradeEvent`, `AiAnalysis`, `TradeCondition`, `AiImmediateActionLog`, `AiRecommendationOutcome`, `SignalAuditEvent` deliberately do NOT duplicate the column — filter via the parent Trade or Signal join.
- **Performance trackers** read `trade.account` from the closed Trade row (not the active mode) so trades opened in practice don't get misattributed to live after a mode switch.
- **Migration** — `scripts/migrate-account-column.sql` applied once. Re-apply not supported (SQLite lacks `IF NOT EXISTS` on `ALTER TABLE ADD COLUMN`). Existing rows stamped `"unknown"`.
- **Legacy cleanup** — `legacy-data-service.ts` exports `getLegacyDataCounts()` + `clearLegacyData()`. `DELETE /api/settings/legacy-data` wipes unknown-account rows in a single transaction.

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

## Environment File Policy

- **One env file only**: `./.env.local` at the repo root is the canonical location for `DATABASE_URL`, `ENCRYPTION_KEY`, and any other shared env vars. Both the daemon (`apps/daemons/src/index.ts`) and the web app (`apps/web/next.config.ts`) load from this single file via `dotenv`. `apps/web/.env.local` and `apps/daemons/.env.local` are **deprecated** — if present, next.config.ts prints a deprecation warning.
- The reason is mechanical: `ENCRYPTION_KEY` and `DATABASE_URL` must be byte-identical between the two apps or the daemon silently fails to decrypt credentials the web successfully encrypted. A single root file makes that drift impossible to introduce.
- `apps/cf-worker/.dev.vars` remains separate because wrangler has its own loader and the Worker's secrets (`WEBHOOK_TOKEN`, `DAEMON_SECRET`) are Worker-scoped, not shared with the other apps.

## Database File Policy

- **One live DB only**: `./data/fxflow.db` at the repo root. Both apps resolve `DATABASE_URL=file:../../data/fxflow.db` from their respective CWDs to the same file. Nothing else should ever exist as a real SQLite file inside the repo — all other `.db` files are bugs.
- **Allowed exceptions**: `apps/desktop/assets/template.db` (fresh-install template shipped in the Electron installer) and `apps/desktop/daemon-bundle/data/fxflow.db` (git-ignored build artifact regenerated by `pnpm desktop:dist`).
- **Scripts and CI never create repo-local .db files**: all Prisma hook commands (preflight, lefthook pre-push, GitHub Actions, `desktop:dist`) use a throwaway path under `${TMPDIR:-/tmp}` because `prisma generate` and `prisma migrate diff --to-schema` only need `DATABASE_URL` to parse; they don't actually connect. See `lefthook.yml`, `scripts/preflight.sh`, `.github/workflows/*.yml`, and the root `package.json` `desktop:dist` script for the canonical form.
- **Startup logging**: `client.ts` logs the absolute resolved DB path on first client creation (`[@fxflow/db] DATABASE_URL → /.../data/fxflow.db (sqlite)`). If daemon and web log different paths in the same dev session, someone has a misconfigured `.env.local`.
- **No silent fallback**: `createPrismaClient()` throws if `DATABASE_URL` is unset, with an error message pointing to the `.env.example` files. This prevents the daemon/web from silently creating a new empty SQLite file in whatever happens to be the process CWD — the bug that historically produced orphan `apps/daemons/data/fxflow.db`, `apps/web/dev.db`, and `packages/db/{,prisma/}dev.db` files.

## Gotchas

- Always use `getDb()` — never instantiate Prisma client directly.
- Notification dedup: 5-second window prevents duplicate notifications for the same event.
- SQLite limitations: no concurrent writes across processes, WAL helps but doesn't eliminate.
- Prisma generates types in `src/generated/` — run `prisma generate` after schema changes.
- Encryption key must be 32 bytes (256 bits) for AES-256-GCM.
- For cloud DB: set `DATABASE_URL=libsql://...` + `TURSO_AUTH_TOKEN`. WAL/busy_timeout pragmas are skipped automatically.
