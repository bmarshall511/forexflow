---
paths:
  - "apps/daemons/**"
  - "packages/db/**"
  - "packages/types/**"
  - "apps/web/src/components/positions/**"
  - "apps/web/src/components/tv-alerts/**"
  - "apps/web/src/components/trade-finder/**"
---

# Trading Domain Rules

## Order Lifecycle

- Pending → Open (on fill) → Closed (on SL/TP/manual close)
- Source field: DB always stores "oanda". True origin in metadata.placedVia.
- placedVia values: "fxflow" | "ut_bot_alerts" | "trade_finder" | "trade_finder_auto"
- enrichSource() in trade-service.ts maps to display labels.

## Price Precision

- Use getPipSize() and getDecimalPlaces() from packages/shared/pip-utils.ts.
- Never hardcode pip sizes. JPY pairs use 0.01, others use 0.0001.
- Format with formatPips() for display.

## OANDA Integration

- OANDA is the trade repository (source of truth for positions).
- Daemon reconciles OANDA state → DB every 2 minutes.
- Transaction stream provides instant fill/cancel notifications.
- API client in apps/daemons/src/oanda/api-client.ts.

## Trade Finder Lifecycle

- Setup statuses: active → approaching → placed → filled → invalidated → expired
- Dual fill detection: event-driven (onOrderFilled) + fallback polling (checkPlacedSetups)
- Auto-trade events tracked in ring buffer (max 50)
- Skip reasons persisted to DB (lastSkipReason column) — UI shows Eligible/Queued/Blocked badges
- Queue system: eligible-but-capped setups priority-ordered (score DESC, distance ASC), reactive placement on slot open
- Cap utilization broadcast via WS (trade_finder_cap_utilization) + REST (GET /trade-finder/caps)
