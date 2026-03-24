# packages/types — Shared Type Contracts

## Architecture

- Single file: `src/index.ts` (~4000 LOC, ~294 exported interfaces/types/enums/constants, 42 domain sections).
- Schemas: `src/schemas.ts` (Zod validation schemas for runtime boundary checks).
- Tests: `src/schemas.test.ts`.
- All shared TypeScript types, interfaces, enums, and constants.
- Imported by all apps and packages as `@fxflow/types`.
- No runtime-specific imports — pure type definitions and constants only.

## Organization

Types are grouped by domain section (delimited by `// ─── Section ───` comments):

1. **Trading Mode** — `TradingMode` live/practice
2. **OANDA Settings** — credentials, settings response
3. **API Response Wrapper** — generic response envelope
4. **Connection Status** — daemon/stream connection states
5. **Market Status** — open/closed, session info
6. **OANDA Health** — API health check types
7. **Daemon Status** — aggregate daemon state
8. **Account Overview** — balance, equity, margin, NAV
9. **Trade / Position Types** — core trade/order/position interfaces
10. **Pending Order Data** — limit/stop order shapes
11. **Open Trade Data** — live trade with P&L
12. **Closed Trade Data** — historical trade with outcome
13. **Aggregate Positions Payload** — grouped position summary
14. **Live Price Tick** — streaming price data
15. **Positions Summary** — header pill counts
16. **Tags** — trade tagging
17. **Trade Actions** — close, modify, breakeven
18. **Order Placement** — new order request/response
19. **Trade Events** — timeline display
20. **Trade Detail** — drawer/sheet detail view
21. **Notifications** — notification types with source discriminator
22. **Chart Layout** — saved chart configurations
23. **WebSocket Messages** — `DaemonMessageType` enum + all typed message interfaces
24. **TradingView Alerts** — signal types, config, quality settings
25. **Signal Confluence Engine** — confluence scoring types
26. **CF Worker / Daemon Messages** — worker relay protocol
27. **AI Analysis** — analysis pipeline, model options, `AI_MODEL_OPTIONS` pricing array
28. **AI Accuracy & Digest** — accuracy tracking, daily digest
29. **Trade Conditions** — AI-created trade conditions
30. **Supply & Demand Zones** — zone detection/display types
31. **Trend Detection** — trend analysis types
32. **Trend Display Settings** — UI trend configuration
33. **Trade Finder** — setup lifecycle, scanner config
34. **AI Trader** — strategy profiles, scan pipeline, opportunities
35. **AI Trader WebSocket Messages** — scan progress, activity log
36. **Economic Calendar** — news event types
37. **Price Alerts** — alert configuration and state
38. **Performance Analytics** — equity curve, stats
39. **Source Priority** — trade source ordering
40. **SmartFlow** — smart flow pipeline types
41. **SmartFlow Activity Feed** — activity log types
42. **Zod Schemas** — schema re-export note

## Key Patterns

### Discriminated Unions

- `DaemonMessageType` enum defines all WS message types.
- Each message type has a corresponding typed interface.
- Discriminated union pattern: `type` field determines payload shape.

### String Literal Unions

- Instrument names as string literals (e.g., `"EUR_USD"`).
- Status fields as discriminated string unions.

### Event Envelopes

- WebSocket messages follow an envelope pattern: `{ type: DaemonMessageType, ...payload }`.
- Consumers switch on `type` to narrow the payload type.

### Status Lifecycles

- Trade finder setups: `active → approaching → placed → filled → invalidated → expired`
- AI analysis: `pending → executing → completed → failed → cancelled`
- Signals: `received → executing → executed → failed`

### AI_MODEL_OPTIONS

- `AI_MODEL_OPTIONS` array with per-model pricing (input/output cost per million tokens).
- Used by daemon (execution), web (settings UI), and db (cost calculation).

## Zod Schemas

- `schemas.ts` contains runtime validation schemas used at API boundaries.
- `CreateConditionSchema` uses `.superRefine()` for server-side validation: checks that `triggerValue` has the correct keys for each trigger type (price, pips, amount, datetime, hours, distancePips) and validates `actionParams` for partial_close (percent), move_stop_loss (price), move_take_profit (price).

## Adding New Types

1. Find the correct domain section in `src/index.ts`.
2. Add types grouped with related interfaces.
3. Export from the file (all exports are at declaration site, no barrel re-exports needed).
4. Run `pnpm build` in packages/types to ensure downstream consumers pick up changes.

## Gotchas

- This is a single large file by design — do not split into multiple files.
- Changes here affect ALL apps and packages — ensure backward compatibility.
- Enum values are used as WS message discriminators — never rename without updating all consumers.
- `AI_MODEL_OPTIONS` pricing must stay in sync with actual provider pricing.
