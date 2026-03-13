# apps/cf-worker — Cloudflare Worker + Durable Objects

## Architecture

- Cloudflare Worker with a single Durable Object class: `AlertRouter`.
- Relays TradingView webhook signals to the daemon via WebSocket.
- Config: `wrangler.toml`, SQLite-backed Durable Object storage.

## Source Files

```
src/
  index.ts           # Worker fetch handler, routes requests
  alert-router.ts    # Durable Object: webhook→signal + daemon WS
  ip-whitelist.ts    # TradingView IP validation
```

## Routes

| Method | Path               | Purpose                        |
|--------|--------------------|---------------------------------|
| POST   | `/webhook/{token}` | TradingView webhook ingestion   |
| GET    | `/ws/{secret}`     | Daemon WebSocket connection     |

## Webhook Flow

1. Worker receives POST from TradingView.
2. IP validated against TradingView whitelist (`ip-whitelist.ts`).
3. Request forwarded to `AlertRouter` Durable Object.
4. DO queues signal and forwards to daemon over WS if connected.

## AlertRouter Durable Object

- Manages daemon WebSocket connection (one at a time).
- **Queue**: max 100 signals, 60-second max age. Flushed on daemon reconnect.
- **Dedup**: 5-second window per `instrument:action` to prevent duplicate signals.
- **Heartbeat**: 30-second ping from DO to daemon WS.
- **Auth**: daemon sends secret on connect, DO validates before accepting.

## Test Signals

- `X-Test-Signal` header bypasses IP whitelist validation.
- Used by the web app's test signal feature (`/api/tv-alerts/test-signal`).

## Shared Imports

- `@fxflow/shared` — `mapTVTickerToOandaInstrument()` for ticker mapping.
- `@fxflow/types` — WebSocket message type contracts.

## Gotchas

- DO is single-instance per name — all webhooks route to the same AlertRouter.
- Queue flush on reconnect means signals can be replayed — daemon must handle idempotently.
- IP whitelist is hardcoded TradingView IPs — update if TradingView changes their egress IPs.
- Durable Object has SQLite storage but primary state is in-memory (queue, connection).
