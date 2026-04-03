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
