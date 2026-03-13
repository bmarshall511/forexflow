---
name: add-ws-event
description: Wire a new WebSocket event end-to-end (daemon → types → hook → component).
disable-model-invocation: true
---

# Add WebSocket Event

Wire a new real-time event through all layers of the FXFlow stack.

## Arguments

- `$ARGUMENTS[0]` — Event name (e.g., "trade_alert_triggered")
- `$ARGUMENTS[1]` — Data type description (e.g., "{ tradeId: string, alertType: string }")

## Steps

1. **packages/types/src/index.ts** — Add to `DaemonMessageType` union and create typed message interface.

2. **apps/daemons/src/server.ts** — Add broadcast call in the appropriate listener or endpoint:
   ```typescript
   broadcast({ type: "event_name", timestamp: new Date().toISOString(), data })
   ```

3. **apps/web/src/hooks/use-daemon-connection.ts** — Handle the new message type:
   - Add state variable: `const [lastEvent, setLastEvent] = useState<T | null>(null)`
   - Add case in message handler switch
   - Expose in return value

4. **apps/web/src/state/daemon-status-context.tsx** — Expose through context if needed by multiple consumers.

5. **Consuming component** — Use the hook/context to react to the event.

6. Run `/verify` to confirm types and lint pass.

## Checklist
- [ ] Type added to packages/types
- [ ] Daemon broadcasts the event
- [ ] Hook handles the message
- [ ] Context exposes it (if shared)
- [ ] Component consumes it
- [ ] Types pass
