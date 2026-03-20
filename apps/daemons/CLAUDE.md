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

- `scanner.ts` — detects supply/demand zones, scores them (11 dimensions, max 18), auto-places orders.
- `entry-monitor.ts` — confirmation pattern detection (engulfing, pin bar, inside bar breakout, break of structure) + arrival speed filter.
- `trade-manager.ts` — post-fill management (breakeven with risk-scaled triggers, partial exits with "standard" or "thirds" strategy, trailing stop, time exit).
- `circuit-breaker.ts` — drawdown protection: 3 consecutive losses = 4hr pause, 5 daily losses = 24hr pause, 3% drawdown = 50% sizing, 5% drawdown = day pause.
- `auto-trade-queue.ts` — queue position computation + skip reason categorization + currency exposure checks.
- `adaptive-tuner.ts` — auto-tunes thresholds based on 30-day rolling performance.
- Setup lifecycle: `active → approaching → placed → filled → invalidated/expired`.
- **Entry confirmation flow**: When `entryConfirmation` is enabled, setups are NOT placed on detection. They wait for price to approach the zone, then require a confirmation pattern (engulfing/pin bar/inside bar/BOS) before placing a MARKET order. Timeout without confirmation → invalidation.
- **Auto-trade guard order**: session gate → circuit breaker → score threshold → trend alignment → R:R check → same-instrument → currency exposure → concurrent cap → daily cap → risk % cap → spread validation → news filter.
- **Session gating**: `isAutoTradeSession()` enforces institutional kill zones (London 07-10 UTC, NY 12-15 UTC). Asian session only for AUD/NZD/JPY pairs. Monday pre-London and Friday afternoon blocked.
- **Arrival speed filter**: Rejects entries where 3+ large-body candles approach the zone with momentum (> 0.8x ATR average body). Prevents "knife catching" at zones.
- **Correlation guard**: Max 2 concurrent auto-trades per base/quote currency via `checkCurrencyExposure()`.
- **Spread validation**: Rejects if current spread > 15% of SL distance.
- **News filter**: Skips auto-trade if high-impact economic event imminent (< 2 hours) for the pair's currencies.
- **SL buffer**: `ATR × 0.15 + spread` (not 0.02). Minimum risk: `max(ATR × 0.75, 8 pips)`.
- **Smart sizing**: Scales risk% down by score quality (81-100% = 1.0×, 63-80% = 0.75×, <63% = 0.5×). Circuit breaker further reduces by 0.5× when daily drawdown > 3%.
- **Dynamic R:R**: Ranging markets (ADX < 20) use tighter TP (2:1), trending markets (ADX > 25) use wider TP (3:1+).
- **Zone age decay**: Zones older than 30 candles are rejected. Freshness score penalized by -0.5 per 10 candles of age.
- **HTF confluence scoring**: LTF zones overlapping HTF zones of same type score +2, nearby (within 2×ATR) score +1.
- **Startup safety**: `repairDangerousConfig()` caps concurrent to 5, daily to 10, risk% to 10, minScore floor of 9.
- Fill detection: dual path — event-driven via `tradeSyncer.onOrderFilled` + fallback via `checkPlacedSetups()`.
- Auto-trade events ring buffer (max 50) exposed via `GET /trade-finder/auto-trade-events`.
- Circuit breaker state: `GET /trade-finder/circuit-breaker` + `POST /actions/trade-finder/reset-circuit-breaker`.
- Cap utilization: `GET /trade-finder/caps` endpoint + `trade_finder_cap_utilization` WS message.

## AI Trader

- **Deterministic position sizing**: position size is calculated in code, NOT by the LLM. Uses `getRiskPercent()` from settings with formula `units = floor(riskAmount / (riskPips * pipValuePerUnit))`, minimum 1 unit enforced. Cross-pair conversion factor applied: for non-USD-quoted pairs, `pipValuePerUnit = pipSize / entryPrice`.
- **Cooldown scoping**: consecutive loss cooldown only counts AI Trader trades (checked via `isAiTrade()` BEFORE `tradeManager.onTradeClosed` deletes from managed set). Trade Finder, TV Alert, and manual trade losses do not trigger cooldown.
- **Daily circuit breaker**: 4+ daily AI Trader losses → pause until midnight UTC. 3%+ daily drawdown → pause until midnight UTC. Counters reset at midnight. Checked before each scan in `runScan()`.
- **AI-first design**: Tier 1 gathers technical data and passes signals to the AI for evaluation. No confluence score gate — the AI (Tier 2 Haiku) decides signal quality. Only hard filters: spread > 30% of risk (physical constraint) and R:R below profile minimum. Soft penalties (HTF: −8, RSI: −5/−10, low-vol: −10) reduce confidence score but don't block signals. At least 1 directional reason required.
- **Full cost tracking**: ALL Tier 2 API costs are recorded to the DB (via opportunity records with status `"rejected"`), even when Tier 2 rejects the candidate or gates block pre-Tier-3. Cost calculations use model-aware pricing from `AI_MODEL_OPTIONS`.
- **Filter diagnostics**: Tier 1 scan results include a breakdown of why signals were filtered (low-vol, no-signal, low-confluence, spread, R:R, HTF-penalized, RSI-penalized) persisted in scan log metadata for observability.
- **Startup safety**: `repairDangerousConfig()` caps concurrent to 5, fixes Tier 2 model to Haiku (not Sonnet/Opus), fixes Tier 3 model to Sonnet (not Opus), floors minimumConfidence at 40.
- **Tier 3 adjustment validation**: LLM-adjusted entry/SL/TP are bounds-checked against ATR. Entry adjustments > 3x ATR from original are rejected. SL adjustments outside 0.3–5x ATR are rejected.

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
