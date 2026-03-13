---
paths:
  - "apps/cf-worker/**"
---

# Cloudflare Worker Conventions

- Modular: entry/routing separate from business logic.
- Durable Objects in src/ (AlertRouter handles webhook + daemon WS).
- Validate payloads at boundary, normalize into packages/types contracts.
- Idempotency for repeated events. Deterministic state transitions.
- Typed message envelopes between webhook→DO→WS→daemon.
- Queue management: max 100, 60s max age, flush on daemon reconnect.
- IP whitelist for TradingView IPs. X-Test-Signal header for test bypass.
