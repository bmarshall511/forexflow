# packages/shared — Runtime-Agnostic Utilities

## Architecture

- Pure TypeScript utilities only.
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
  pip-utils.ts              # Pip value calculations, pip distance
  forex-pairs.ts            # Instrument groups, pair metadata
  ticker-mapping.ts         # mapTVTickerToOandaInstrument()
  timeframe-utils.ts        # Candle timeframe conversions
  zone-detector.ts          # detectZones() — supply/demand zone detection
  zone-scorer.ts            # scoreZone() / scoreZoneExtended()
  zone-utils.ts             # ATR calculation, candle classification
  zone-presets.ts           # Default zone detection parameters
  trend-detector.ts         # detectTrend() — trend analysis
  trend-defaults.ts         # Default trend detection parameters
  commodity-correlation.ts  # Commodity-currency correlation logic
  deployment.ts             # Deployment mode types + config resolver
```

## Key Utilities

### Market & Time

- `market-hours.ts` — uses ET (Eastern Time) timezone for all market session logic.
- `forex-trading-day.ts` — forex day rolls at 5pm ET, not midnight. `getLastTradingSessionStart()` returns the previous forex day start during weekends so "signals today" shows last session's count instead of 0.

### Formatting

- `format-currency.ts` — handles P&L display with sign, color hints, currency symbols.
- `pip-utils.ts` — pip calculations vary by pair (JPY pairs = 0.01, others = 0.0001).

### Ticker Mapping

- `mapTVTickerToOandaInstrument()` — converts TradingView ticker format to OANDA instrument name.
- Used by CF Worker when processing incoming webhooks.

### Zone Detection

- `zone-detector.ts` — `detectZones()` identifies supply/demand zones from candle data.
- `zone-scorer.ts` — `scoreZone()` and `scoreZoneExtended()` rank zones by quality.
- `zone-utils.ts` — ATR (Average True Range) calculation, candle body/wick classification.

### Trend Detection

- `trend-detector.ts` — `detectTrend()` analyzes price action for trend direction/strength.

### Deployment Config

- `deployment.ts` — `DeploymentMode` type (`"local" | "cloud"`), `DeploymentConfig` interface, `resolveDeploymentConfig()` function.
- Used by all layers to determine whether to connect to local daemon or remote cloud daemon.
- `LOCAL_DEFAULTS` constant provides default local configuration.

## Gotchas

- **Runtime-agnostic is mandatory**: if you need `fs`, `process`, `Request`/`Response`, or React — it does not belong here.
- Forex day boundary is 5pm ET, not midnight UTC — `forex-trading-day.ts` handles this.
- JPY pairs use different pip scale (0.01 vs 0.0001) — always use `pip-utils.ts` helpers.
- Zone detection is CPU-intensive on large candle datasets — callers should limit input size.
- All exports go through `index.ts` — add new exports there.
