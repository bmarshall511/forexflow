---
title: "Real-Time Patterns"
description: "WebSocket architecture, message types, connection management, and data flow patterns"
category: "dev"
order: 3
---

# Real-Time Patterns

## Architecture

```
OANDA Stream → Daemon (port 4100) → WebSocket → use-daemon-connection → Contexts → Components
```

- The daemon is the single source of truth for live data (prices, positions, account state).
- The web app connects via one WebSocket per session — no per-page connections.
- `use-daemon-connection` is the centralized dispatcher. It parses incoming messages and routes to the appropriate context/state updater.

## Message Types

All WebSocket message types are defined in `packages/types` as `DaemonMessageType` enum. Messages use the shape:

```ts
{ type: DaemonMessageType; payload: <type-specific data> }
```

Categories: price ticks, position updates, account snapshots, signal events, AI analysis events, trade finder events (setup updates, auto-trade events, cap utilization), notifications.

## Adding a New WebSocket Event

1. **Daemon**: Add broadcast call in the relevant service (`ws.broadcast({ type, payload })`)
2. **packages/types**: Add new `DaemonMessageType` enum value + payload type
3. **use-daemon-connection**: Add case to the message dispatcher switch
4. **Consumer**: Subscribe via the appropriate context or direct hook

All four locations must be updated — missing any one breaks the chain.

## Performance Rules

- **Price throttling**: 500ms minimum interval per instrument. Daemon throttles before broadcast.
- **Optimistic updates**: User actions (place order, close trade) update UI immediately, then reconcile on next sync.
- **Batch updates**: Group multiple position changes into a single re-render cycle.
- **No derived state in WS handler**: Dispatch raw data, compute derived values in components/hooks.

## Connection Management

- **Status states**: `connected | connecting | disconnected | warning | unconfigured`
- **Reconnection**: Exponential backoff starting at 2s, max 30s, with jitter.
- **Warning state**: Triggered when no heartbeat received within expected interval.
- **Unconfigured**: No daemon URL set — show setup prompt, do not attempt connection.
- **Cleanup**: Always close WebSocket on component unmount / route change.

### Connection Modes

`use-daemon-connection.ts` resolves the daemon URL based on environment:

1. **Cloud mode**: `NEXT_PUBLIC_CLOUD_DAEMON_URL` env var → connect directly to remote daemon (ws/wss)
2. **Local dev** (`localhost`): connect to `ws://localhost:4100` directly
3. **Remote/tunnel** (non-localhost): proxy through `wss://${host}/ws` (production) or REST polling fallback (dev)

REST polling (5s interval) supplements WebSocket when WS is unavailable, keeping the UI updated with daemon status via `isReachable` state.

## Data Flow Patterns

- **Streaming prices**: Daemon → `price_tick` → PriceContext → components read via `usePrices(instrument)`
- **Trade events**: Daemon → `position_update` → TradeContext → tables re-render
- **Signals**: CF Worker → Daemon WS → SignalProcessor → `signal_update` broadcast → TV Alerts UI
- **AI analysis**: Daemon → `ai_analysis_update` / `ai_analysis_completed` → AI sheet
- **Notifications**: Daemon → `notification` → NotificationContext → toast + bell badge
