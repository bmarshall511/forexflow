# packages/types — Shared Type Contracts

## Architecture

- Single file: `src/index.ts` (~1800 lines).
- All shared TypeScript types, interfaces, enums, and constants.
- Imported by all apps and packages as `@fxflow/types`.

## Organization

Types are grouped by domain in this order:
1. **Trading** — Trade, Order, Position interfaces
2. **Settings** — App settings types
3. **Market** — Market hours, sessions, instruments
4. **Account** — OANDA account types
5. **Positions** — Position tracking, MFE/MAE
6. **Tags** — Trade tagging
7. **Notifications** — Notification types with source discriminator
8. **Charts** — Chart layout, candle data
9. **TV Alerts** — Signal types, config
10. **AI** — Analysis, conditions, model options
11. **Zones** — Supply/demand zone structures
12. **Trends** — Trend detection types
13. **Trade Finder** — Setup lifecycle types

## Key Patterns

### WebSocket Messages
- `DaemonMessageType` enum defines all WS message types.
- Each message type has a corresponding typed interface.
- Discriminated union pattern: `type` field determines payload shape.

### Status Lifecycles
- Trade finder setups: `active → approaching → placed → filled → invalidated → expired`
- AI analysis: `pending → executing → completed → failed → cancelled`
- Signals: `received → executing → executed → failed`

### AI Model Options
- `AI_MODEL_OPTIONS` array with per-model pricing (input/output per million tokens).
- Used by both daemon (execution) and web (settings UI) and db (cost calculation).

### Branded/Literal Types
- Instrument names as string literals (e.g., `"EUR_USD"`).
- Status fields as discriminated string unions.

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
