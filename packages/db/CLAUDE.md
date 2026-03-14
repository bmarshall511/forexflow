# packages/db — Prisma + SQLite Database Layer

## Architecture

- Prisma ORM with SQLite (LibSQL adapter).
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
- `tv-alerts-config-service.ts` / `tv-alerts-signal-service.ts` / `signal-audit-service.ts`
- `zone-service.ts` / `zone-settings-service.ts`
- `trend-service.ts` / `trend-settings-service.ts`
- `trade-finder-service.ts` / `trade-finder-config-service.ts`
- `tag-service.ts` / `chart-layout-service.ts` / `curve-snapshot-service.ts`
- `ai-digest-service.ts`

## Key Patterns

### enrichSource

- `Trade.source` in DB is always `"oanda"` (OANDA is the canonical trade repository).
- True origin is in `Trade.metadata` JSON: `{ placedVia: "ut_bot_alerts" | "fxflow" }`.
- `enrichSource(source, metadata)` resolves display-friendly source labels.
- Applied in `toClosedTradeData()`, `getTradeWithDetails()`, and at runtime in `reconcile()`.

### Upsert

- `upsertTrade()` uses unique constraint `[source, sourceTradeId]`.
- Metadata is pre-seeded before first reconcile for TV-alert orders.

### Encryption

- `encryption.ts` — AES-256-GCM, format: `"iv:tag:ciphertext"`.
- Used for sensitive settings (API keys, tokens).

### Cost Calculation

- `calculateCost()` uses `AI_MODEL_OPTIONS` pricing from `@fxflow/types`.

### Cleanup

- Most services have cleanup methods for pruning old records.
- Call patterns vary (scheduled, on-startup, manual).

## Gotchas

- Always use `getDb()` — never instantiate Prisma client directly.
- Notification dedup: 5-second window prevents duplicate notifications for the same event.
- SQLite limitations: no concurrent writes across processes, WAL helps but doesn't eliminate.
- Prisma generates types in `src/generated/` — run `prisma generate` after schema changes.
- Encryption key must be 32 bytes (256 bits) for AES-256-GCM.
