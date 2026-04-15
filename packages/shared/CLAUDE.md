# packages/shared — Runtime-Agnostic Utilities

## Architecture

- Pure TypeScript utilities only — zero runtime-specific dependencies.
- **NO framework imports**: no React, no Node.js-specific APIs, no Cloudflare-specific APIs.
- Must be importable by all consumers: `apps/web`, `apps/daemons`, `apps/cf-worker`.
- Imported as `@fxflow/shared`.

## Source Files

```
src/
  index.ts                  # Barrel exports
  market-hours.ts           # Market open/close logic (ET timezone)
  forex-trading-day.ts      # Forex period boundaries (5pm ET rollover)
  format-currency.ts        # P&L formatting, currency display
  pip-utils.ts              # Pip value calculations, pip distance (JPY handling)
  forex-pairs.ts            # Instrument groups, pair metadata
  ticker-mapping.ts         # mapTVTickerToOandaInstrument()
  timeframe-utils.ts        # Candle timeframe conversions
  session-utils.ts          # Trading session utilities
  zone-detector.ts          # detectZones() — supply/demand zone detection
  zone-scorer.ts            # scoreZone() / scoreZoneExtended()
  zone-utils.ts             # ATR calculation, candle classification
  zone-presets.ts           # Default zone detection parameters
  key-levels.ts             # Key price level detection
  trend-detector.ts         # detectTrend() — trend analysis
  trend-defaults.ts         # Default trend detection parameters
  smc-detector.ts           # Smart Money Concepts detection (OB, FVG, BOS, CHoCH)
  fibonacci-calculator.ts   # Fibonacci retracement/extension calculations
  technical-indicators.ts   # RSI, MACD, EMA, Bollinger Bands, Williams %R, ADX
  divergence-detector.ts    # Price/indicator divergence detection
  regime-detector.ts        # Market regime classification
  confluence-scorer.ts      # Signal confluence scoring
  confluence-scoring.ts     # Extended confluence evaluation
  commodity-correlation.ts  # Commodity-currency correlation logic
  ai-param-utils.ts         # AI parameter utilities
  ai-status-utils.ts        # AI status helpers
  ai-errors.ts              # AI-specific error types
  errors.ts                 # FxFlowError base class + error hierarchy
  logger.ts                 # Lightweight logger utility
  deployment.ts             # Deployment mode types + config resolver
  markdown.ts               # Markdown parsing utilities
```

## Key Utilities

### Market & Time

- `market-hours.ts` — uses ET (Eastern Time) timezone for all market session logic. Weekend detection.
- `forex-trading-day.ts` — forex day rolls at 5pm ET, not midnight. `getLastTradingSessionStart()` returns the previous forex day start during weekends so "signals today" shows last session's count instead of 0.
- `session-utils.ts` — trading session boundaries and utilities.

### Pip Calculations

- `pip-utils.ts` — pip calculations vary by pair (JPY pairs = 0.01, others = 0.0001).
- Pip value, pip distance, and position sizing helpers.

### Condition Matching

- `condition-matching.ts` — `conditionsMatch(a, b, { instrument })` and `findMatchingCondition(candidate, existing, opts)` for parameter-based fuzzy dedup of trade conditions. Compares `triggerType`/`actionType` exactly and `triggerValue`/`actionParams` with key-aware numeric tolerance (2 pips for price keys — pip-aware via instrument — 0.1 pts for percent keys, 3 pips for distance keys, etc.). Labels are ignored.
- Used by both the daemon (analysis-executor auto-apply dedup) AND the web UI (trade-conditions-panel suggestion state) so the two sides can never drift. This is the fix for the "AI re-suggests conditions that already exist" bug caused by label-based matching.

### Trading Core (shared guards, validators, sizers)

- `trading-core/` subdirectory — primitives shared across SmartFlow, EdgeFinder, Trade Finder, and TV Alerts so the four trading systems never silently diverge on common logic. All exports are re-surfaced via the top-level `@fxflow/shared` barrel.
- `trading-core/types.ts` — `TradeDirection`, `CorrelationPosition`, `GateResult`, `pass()`, `fail()`.
- `trading-core/correlation.ts` — `countSharedCurrencyExposure()`, `checkCorrelation()` (guard form), `filterCorrelatedCandidates()` (filter form). Replaces SmartFlow's `checkCorrelation` and EdgeFinder's `filterCorrelatedSignals`.
- `trading-core/circuit-breaker.ts` — `CircuitBreaker` class with injectable clock, parameterised by `CircuitBreakerConfig` (max consecutive losses, consec pause minutes, max daily losses, max daily drawdown percent). Handles day rollover at UTC midnight and pause-until-midnight semantics. Replaces SmartFlow's `scanner-circuit-breaker.ts` (kept as a thin adapter) and EdgeFinder's inline fields in `scanner.ts`.
- `trading-core/spread.ts` — `checkSpread({ spreadPips, riskPips, maxPercent })`, `spreadImpactPercent()`, `spreadAdjustedRR()`. Each caller picks its own `maxPercent` (SmartFlow 20%, EdgeFinder 50%, Trade Finder 15%) while the math stays canonical.
- `trading-core/risk-sizing.ts` — `calculatePositionSize()` supports `risk_percent | fixed_units | fixed_lots | kelly` modes. Handles USD-quoted vs non-USD-quoted pairs via the entryPrice approximation, with an explicit `pipValuePerUnitOverride` escape hatch for cross-pair USD conversion using `calculatePipValueUsd`.
- `trading-core/rr-multiplier.ts` — `getAdaptiveMinRR(baseMinRR, regime, date?)`, `getSessionRRMultiplier()`, `getRegimeRRMultiplier()`. Kill-zone = 1.0×, extended = 0.85×, off-session = 1.2×. Ranging regime = 0.75×, low-vol = 1.3×. Floored at 1.0.
- `trading-core/news-gate.ts` — `checkNewsGate({ instrument, bufferMinutes, source })` with dependency-injected `NewsCalendarSource` interface (the daemon wires a DB-backed source; `packages/shared` can't import `@fxflow/db`). Fails open on source error.
- All primitives have unit test coverage in `trading-core/trading-core.test.ts` (34 tests).

#### `trading-core/management/` — rule decision math

- `management/profit.ts` — `computeProfitPips()`, `computeRiskPips()`, `isBetterSL()`. Single source of truth for signed pip deltas, risk-in-pips, and the ratchet rule ("new SL must be strictly tighter than current SL for the direction").
- `management/breakeven.ts` — `evaluateBreakeven()` returns `{ shouldFire, newSL, reason }` given entry / current SL / profit in pips / threshold in pips / buffer in pips / already-applied flag. Callers compute the threshold however they want (SmartFlow uses `breakevenAtrMultiple × ATR × session`, EdgeFinder uses `riskPips × breakevenTriggerRR`) then pass the resulting number in.
- `management/trailing.ts` — `evaluateTrailing()` returns `{ shouldFire, newSL, reason }` given current price, trail distance in price units, and current SL. Rounds the new SL to pip precision. Callers gate activation externally via the `activated` flag.
- `management/time-exit.ts` — `evaluateTimeExit()` returns `{ shouldFire, hoursOpen, reason }` given `openedAt` ms timestamp and `maxHours`. Accepts an injected clock for tests.
- Test coverage lives in `management/management.test.ts` (25 tests covering profit/risk/SL ratchet math, breakeven threshold + ratchet guards, trailing ratchet + activation gate, and time-exit + injected clock).
- **All side effects stay in the caller**: OANDA modifications, DB writes, activity log emission, broadcast, and debounce tracking. The shared module is pure decision math only. This keeps SmartFlow's richer orchestration (session multipliers, debounce, safety nets, recovery/DCA, trend-rider TP) local while EdgeFinder reuses the same math in its simpler flow.

### Pip Value in Account Currency (CRITICAL — currency conversion)

- `pip-value.ts` — `calculatePipValueUsd({ instrument, units, currentPrice?, usdQuoteRates? })` and `derivePipValueUsdFromUnrealizedPL(trade)`. These are the ONLY correct way to convert pip distances into account-currency dollar amounts.
- **Do NOT** use `units × pips × pipSize` directly — that gives a value in the QUOTE currency, which for EUR/JPY is JPY (wrong by ~160x when displayed as USD). This bug caused a $259 "profit" display on a trade actually worth $1.62.
- Three pair structures are handled:
  1. **Quote = USD** (EUR/USD etc): pip is already USD, exact.
  2. **Base = USD** (USD/JPY etc): `pipSize / currentPrice`, exact when a current price is provided.
  3. **Cross** (EUR/JPY etc): returns `null` unless an explicit `usdQuoteRates` lookup is supplied. Callers MUST respect null and show pip distance instead of fabricating a dollar value.
- `derivePipValueUsdFromUnrealizedPL` is the preferred path whenever a trade has an OANDA-reported `unrealizedPL` — it inverts OANDA's own settlement math to get exactly the rate OANDA used, so it's always correct regardless of pair structure. Falls through to `calculatePipValueUsd` near breakeven where the ratio is unstable.
- Consumed by: `use-positions.ts` (live P/L override), `trade-card.tsx`/`trade-card-mobile.tsx` (R:R bar), `setup-card-utils.ts` (Trade Finder dollar projections), `condition-monitor.ts` (`pnl_currency` trigger evaluation).

### Technical Analysis

- `zone-detector.ts` — `detectZones()` identifies supply/demand zones from candle data.
- `zone-scorer.ts` — `scoreZone()` and `scoreZoneExtended()` rank zones by quality.
- `zone-utils.ts` — ATR (Average True Range) calculation, candle body/wick classification.
- `trend-detector.ts` — `detectTrend()` analyzes price action for trend direction/strength.
- `smc-detector.ts` — Smart Money Concepts: order blocks, fair value gaps, BOS, CHoCH, liquidity sweeps.
- `technical-indicators.ts` — RSI, MACD, EMA, Bollinger Bands, Williams %R, ADX calculations.
- `fibonacci-calculator.ts` — Fibonacci retracement and extension levels, OTE zone detection.
- `divergence-detector.ts` — detects price/indicator divergence patterns.
- `regime-detector.ts` — classifies market regime (trending, ranging, volatile).
- `confluence-scorer.ts` / `confluence-scoring.ts` — multi-signal confluence evaluation.

### Error Hierarchy

- `errors.ts` — `FxFlowError` base class with typed error codes. All custom errors extend this base.
- `ai-errors.ts` — AI-specific error types for analysis pipeline failures.

### Formatting

- `format-currency.ts` — handles P&L display with sign, color hints, currency symbols.
- `formatCurrency()` uses adaptive precision (4 decimals for sub-cent amounts).
- `formatPnL()` uses ±1e-8 threshold for accurate color/sign on sub-cent values.
- `formatPnLWithPips()` — returns dollar P/L alongside pip P/L for trade rows and cards.

### Ticker Mapping

- `mapTVTickerToOandaInstrument()` — converts TradingView ticker format to OANDA instrument name.
- Used by CF Worker when processing incoming webhooks.

### Deployment Config

- `deployment.ts` — `DeploymentMode` type (`"local" | "cloud"`), `DeploymentConfig` interface, `resolveDeploymentConfig()` function.
- Used by all layers to determine whether to connect to local daemon or remote cloud daemon.
- `LOCAL_DEFAULTS` constant provides default local configuration.

## Tests

- `market-hours.test.ts` — market session logic tests.
- `pip-utils.test.ts` — pip calculation tests including JPY pairs.
- `format-currency.test.ts` — currency formatting tests.
- `errors.test.ts` — error hierarchy tests.
- `logger.test.ts` — logger utility tests.

## Gotchas

- **Runtime-agnostic is mandatory**: if you need `fs`, `process`, `Request`/`Response`, or React — it does not belong here.
- Forex day boundary is 5pm ET, not midnight UTC — `forex-trading-day.ts` handles this.
- JPY pairs use different pip scale (0.01 vs 0.0001) — always use `pip-utils.ts` helpers.
- Zone detection is CPU-intensive on large candle datasets — callers should limit input size.
- All exports go through `index.ts` — add new exports there.
