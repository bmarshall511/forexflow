# apps/daemons — Node.js Trading Daemon

## Architecture

- Entry point: `index.ts` orchestrates 13+ subsystems in a specific startup order.
- HTTP server on port 4100 (REST endpoints) + WebSocket broadcast to web clients.
- Single-process, event-driven. StateManager is the central source of truth.

## Startup & Late-Binding

Some subsystems are bound AFTER construction because they depend on each other:

- `CFWorkerClient` — connected after server starts
- `ConditionMonitor` — bound after AI services initialize
- `TradeFinderScanner` — bound after position tracking is ready

Do not reorder startup sequence without understanding dependencies.

## Directory Structure

```
src/
  index.ts              # Orchestrator
  config.ts             # All config from env vars with defaults
  state-manager.ts      # Central state, event-driven listeners
  server.ts             # Express + WS server
  notification-emitter.ts
  oanda/                # OANDA API integration
  positions/            # Position tracking, MFE/MAE
  ai/                   # AI analysis pipeline
  trade-finder/         # Zone detection, auto-trading
  tv-alerts/            # TradingView signal processing
  charts/               # Chart data services
  market/               # Market hours, sessions
  db/                   # DB sync operations
```

## OANDA Integration

- `api-client.ts` — HTTP calls (accounts, orders, trades, candles).
- `stream-client.ts` — SSE pricing stream (EUR_USD only for heartbeat/status).
- `transaction-stream-client.ts` — SSE transaction stream (fills, cancels, modifications). Tracks `lastTransactionId` from stream events; on reconnection, triggers immediate reconcile to catch up on missed events.

## Trade Syncing

- `trade-syncer.ts` reconciles OANDA state with DB every 2 minutes.
- Per-instrument mutex prevents concurrent syncs on the same pair.
- **Source pattern**: `Trade.source` is always `"oanda"`. True origin lives in `Trade.metadata = { placedVia: "ut_bot_alerts" | "fxflow" }`.
- Metadata is pre-seeded via `upsertTrade()` WITH metadata BEFORE the first reconcile when placing orders, eliminating the race window where reconcile could fire callbacks before metadata existed.
- **Orphan close details**: when a trade disappears from OANDA, `closeOrphanedTrades()` fetches actual close details (P&L, exit price, close reason) from OANDA's API before marking closed, instead of recording UNKNOWN/$0.
- **Metadata recovery**: `recoverSourceMetadata()` checks both `placeOrder` audit trail and TV Alert signals (`TVAlertSignal.resultTradeId`) to restore missing metadata.
- **SL/TP pre-validation**: `placeOrder()` validates stop-loss and take-profit before submission — SL/TP must be on the correct side of entry, and neither can equal entry after rounding.
- **Startup repair**: `repairOrphanedTrades()` runs on startup to fix existing trades with UNKNOWN close reason/$0 P&L, and repairs trades with null metadata by running recovery checks.

## Position Tracking

- `position-manager.ts` — in-memory FIFO position tracking.
- `position-price-tracker.ts` — manages dynamic price streams per open position.
- MFE/MAE watermarks updated on every tick, persisted to DB every 30 seconds.

## AI Pipeline

- `context-gatherer.ts` → `analysis-executor.ts` → results stored in DB.
- `condition-monitor.ts` — price conditions evaluated every tick (sub-ms), time conditions every 1 minute.
- Stuck "executing" conditions are reset on startup (crash recovery).
- Price ticks wire to ConditionMonitor via `positionPriceTracker.onPriceTick`, NOT streamClient.
- **Condition deduplication**: `analysis-executor.ts` deduplicates AI-suggested conditions by parameter values (triggerType + triggerValue + actionType + actionParams via JSON.stringify), not by label text. AI models can generate different labels for functionally identical conditions.
- **Grace period**: destructive actions (`close_trade`, `cancel_order`) are blocked for 60 seconds after `max(trade.openedAt, condition.createdAt)`. Uses `GracePeriodError` to revert condition to "active" for retry on the next tick.
- **Condition expiry**: AI-created conditions auto-expire after 7 days to prevent stale conditions from executing inappropriate actions.
- **Priority-based evaluation**: conditions are sorted by priority (ascending) before evaluation so higher-priority conditions fire first.
- **Early exit on close**: when a `close_trade` or `cancel_order` condition fires, remaining conditions for the same trade are skipped in that tick.
- **Filtered startup**: `listActiveConditions()` excludes conditions for closed trades to avoid wasted evaluation cycles on load.

## Trade Finder

- `scanner.ts` — detects supply/demand zones, scores them, auto-places orders.
- `auto-trade-queue.ts` — pure functions for queue position computation + skip reason categorization.
- Setup lifecycle: `active → approaching → placed → filled → invalidated/expired`.
- Fill detection: dual path — event-driven via `tradeSyncer.onOrderFilled` + fallback via `checkPlacedSetups()`.
- Risk cap counts BOTH pending AND filled auto-placed trades (`countPendingAutoPlaced()` + `getAutoPlacedTotalRiskPips()`), preventing cap bypass when orders fill.
- Auto-trade events ring buffer (max 50) exposed via `GET /trade-finder/auto-trade-events`.
- Skip reasons persisted to DB (`lastSkipReason` column) and broadcast via WS for accurate UI badges.
- Queue system: eligible-but-capped setups are priority-ordered (score DESC, distance ASC). Reactive placement on slot open (fill/cancel/invalidation).
- Cap utilization: `GET /trade-finder/caps` endpoint + `trade_finder_cap_utilization` WS message.

## AI Trader

- **Deterministic position sizing**: position size is calculated in code, NOT by the LLM. Uses `getRiskPercent()` from settings with formula `units = floor(riskAmount / (riskPips * pipSize))`, minimum 1 unit enforced.

## Market Hours

- `market-analyzer.ts` — determines market open/closed status from OANDA stream.
- **Weekend override**: OANDA practice accounts may report `tradeable=true` on weekends. `isWeekendClosed()` forces market closed on weekends regardless of OANDA stream state.

## TV Alerts

- `signal-processor.ts` — processes signals from CF Worker with per-instrument mutex.
- `CFWorkerClient` maintains WS connection to Cloudflare Durable Object.
- On WS client connect, a dedicated `tv_alerts_status` message is sent so the dashboard gets signal count immediately without waiting for the next broadcast cycle.

## Error Handling

- Exponential backoff reconnection (5s → 60s cap) for all streams.
- AbortController-based cancellation for in-flight operations.
- Heartbeat monitoring on all persistent connections.

## Notifications

- `notification-emitter.ts` — creates DB records + broadcasts via WS.
- Specialized emitters: `emitTradeFinder()`, `emitAiAnalysis()`, `emitTradeCondition()`.

## Cloud Deployment

- `Dockerfile` — multi-stage build (node:22-slim, pnpm install, prisma generate).
- `railway.toml` — Railway config with Dockerfile builder, health check, restart policy.
- Health endpoints: `/health` (liveness, always 200) + `/health/ready` (readiness, checks OANDA + DB). `/health/detailed` includes full tvAlerts data (signal counts, config status).
- `PORT` env var auto-set by Railway/Fly.io — `config.ts` falls back: `DAEMON_PORT ?? PORT ?? "4100"`.
- Cloud DB: `DATABASE_URL=libsql://...` + `TURSO_AUTH_TOKEN` for Turso connections.

## Gotchas

- Config values come from env vars — check `config.ts` for defaults before adding new ones.
- StateManager event listeners must be cleaned up to avoid memory leaks.
- Transaction stream handles order fills AND cancellations — both must be processed.
- Trade syncer mutex is per-instrument, not global — concurrent syncs on different pairs are OK.
- In Electron desktop mode, the daemon is spawned as a `fork()` child process with `--import tsx/esm` by `apps/desktop/src/main/daemon-manager.ts`.
- `tsx` is a production dependency (not dev-only) because it's needed at runtime for both Docker and Electron deployments.
