---
paths:
  - "apps/daemons/**"
---

# Daemon Conventions

- Entry point: index.ts orchestrates subsystems in dependency order.
- Late-binding pattern: wire callbacks AFTER all subsystems constructed.
- StateManager is single source of truth — use event listeners, not polling.
- Trade.source always "oanda". True origin in Trade.metadata = { placedVia: "..." }.
- Per-instrument mutex for trade syncing and signal processing.
- Exponential backoff reconnection for all streams (5s→60s).
- Crash recovery: reset stuck "executing" states on startup.
- MFE/MAE watermarks updated per tick, persisted every 30s (not per tick).
- HTTP server on port 4100 + WebSocket broadcast to all connected clients.
