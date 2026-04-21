---
name: naming
scope: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.md"]
enforcement: strict
version: 0.1.0
related:
  - "context/conventions.md"
  - "agents/code-reviewer.md"
applies_when: "Naming a file, directory, symbol, or identifier anywhere in the project"
---

# Naming

Conventions are locked. Agents do not improvise on naming.

## File and directory names

| Kind | Convention | Example |
|---|---|---|
| Source files | `kebab-case` | `trade-syncer.ts`, `pip-utils.ts` |
| Directories | `kebab-case` | `trade-finder/`, `smart-flow/` |
| React component files | `kebab-case` | `position-card.tsx` |
| React hook files | `use-<name>.ts` | `use-daemon-connection.ts` |
| Test files | sibling + `.test.ts` | `pip-utils.test.ts` |
| Playwright specs | `.spec.ts` | `positions.spec.ts` |
| Contract tests | `.contract.test.ts` | `positions-api.contract.test.ts` |
| Visual regression | `.visual.spec.ts` | `trade-card.visual.spec.ts` |
| Benchmarks | `.bench.ts` | `reconcile-loop.bench.ts` |
| Type-only modules | `kebab-case`, no suffix | `trade-events.ts` (not `trade-events.types.ts`) |
| Config / schema | `<tool>.config.{ts,mjs}` | `vitest.config.ts`, `eslint.config.mjs` |
| Markdown docs | `kebab-case` or `SCREAMING_SNAKE` for top-level repo docs | `GETTING_STARTED.md`, `smart-flow.md` |

**No `camelCase` filenames.** No `PascalCase` filenames. No `snake_case`. No spaces.

## Directory layout

| Path | Contents |
|---|---|
| `apps/web/src/app/<path>/page.tsx` | Route pages (App Router) |
| `apps/web/src/app/api/<path>/route.ts` | API route handlers |
| `apps/web/src/components/ui/` | Shared UI primitives (shadcn + custom atoms) |
| `apps/web/src/components/<feature>/` | Feature-specific components |
| `apps/web/src/hooks/use-<name>.ts` | Reusable hooks |
| `apps/web/src/state/<name>-context.tsx` | React Context providers |
| `apps/web/src/lib/<name>.ts` | Pure utilities |
| `apps/daemon/src/<subsystem>/<file>.ts` | Daemon subsystems (`oanda/`, `ai/`, `trade-finder/`, etc.) |
| `packages/shared/src/<name>.ts` | Runtime-agnostic utilities |
| `packages/shared/src/trading-core/<name>.ts` | Trading-core primitives |
| `packages/types/src/<domain>.ts` | Type contracts by domain |
| `packages/db/src/<domain>-service.ts` | One service file per domain |
| `packages/db/prisma/schema.prisma` | Prisma schema (single file) |

When adding something new: if it fits a pattern above, follow the pattern. If it doesn't, stop and ask — new patterns are a decision, not a default.

## Identifier casing

| Kind | Convention | Example |
|---|---|---|
| Variables, functions, methods | `camelCase` | `calculatePositionSize`, `tradeId` |
| Types, interfaces, classes, enums | `PascalCase` | `Trade`, `SignalProcessor`, `TradeDirection` |
| Generic type parameters | `PascalCase` single-letter or descriptive | `T`, `TValue`, `TItem` |
| Type alias prefix | None | `type TradeId = ...`, not `type ITradeId` or `type TTradeId` |
| Enum members (when enums are used, which is rare) | `PascalCase` | `TradeDirection.Long` |
| Top-level true constants | `SCREAMING_SNAKE_CASE` | `const MAX_RETRIES = 3` |
| Config values | `camelCase` | `const defaultRiskPercent = 1.0` |
| React component exports | `PascalCase` | `export function PositionCard()` |
| React hook exports | `camelCase` starting with `use` | `export function useDaemonConnection()` |
| Component props type | `<ComponentName>Props` | `type PositionCardProps = {...}` |
| Context + provider | `<Name>Context`, `<Name>Provider` | `DaemonStatusContext`, `DaemonStatusProvider` |
| Private / internal | `_leadingUnderscore` (only when necessary to avoid shadowing) | `const _unused: never = x` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `DAEMON_PORT`, `ANTHROPIC_API_KEY` |
| URL path segments | `kebab-case` | `/api/trade-finder/setups` |
| WebSocket message types | `snake_case` string literals | `trade_placed`, `position_update` |
| Database column names (Prisma) | `camelCase` | `model Trade { entryPrice Float }` |
| Database model names (Prisma) | `PascalCase`, singular | `model Trade`, not `model Trades` |
| JSON keys in API payloads | `camelCase` | `{ tradeId, entryPrice }` |

## Abbreviations

Write the word:

- `configuration`, not `cfg`
- `position`, not `pos`
- `calculate`, not `calc`
- `instrument`, not `inst`
- `directory`, not `dir`
- `database`, not `db` in identifiers (`database`, not `db`; the package is `@forexflow/db` — that's a namespace, not an identifier)

Exceptions (industry-standard acronyms that read weird expanded):

- `URL`, `HTTP`, `HTTPS`, `API`, `DNS`, `CORS`, `CSRF`, `XSS`, `CSP`
- Trading-specific: `SL`, `TP`, `R:R` (always `rr` in camelCase), `ATR`, `RSI`, `MACD`, `EMA`, `BB`, `ADX`, `MFE`, `MAE`
- Methodology: `SMC`, `OB`, `FVG`, `BOS`, `OTE`
- Codes with ISO/IEEE canonical form: `ISO`, `UTC`, `IEEE`
- The project name: `ForexFlow` (or `@forexflow/*` as a namespace)

Everything else: write the word.

## Booleans

Use affirmative names with an `is`, `has`, `can`, `should` prefix:

```ts
// good
const isOpen = true
const hasError = false
const canClose = true
const shouldRetry = false

// bad
const open = true
const error = false
const close = true
const retry = false
```

Avoid negatives (`isNotReady`) — use affirmative and negate at the call site (`!isReady`).

## Functions

Use verbs:

- `calculate*`, `compute*` — pure calculation
- `get*`, `fetch*`, `load*`, `find*` — retrieval (`get` for local, `fetch` for network, `load` for async local, `find` for search that may miss)
- `create*`, `build*`, `make*` — construction
- `update*`, `patch*` — partial modification
- `delete*`, `remove*` — removal
- `validate*`, `check*`, `ensure*` — assertions
- `handle*`, `on*` — event handlers (`on*` for props that expose events)
- `render*` — React rendering
- `is*`, `has*`, `can*`, `should*` — predicates returning boolean

No `process*` (too vague), no `do*` (too vague), no `execute*` (too formal; except in scripts).

## Constants used as enums

```ts
// good
export const TRADE_STATUSES = ["pending", "open", "closed", "cancelled"] as const
export type TradeStatus = (typeof TRADE_STATUSES)[number]

// bad
export enum TradeStatus { Pending, Open, Closed, Cancelled }
```

The `as const` array gives you a runtime list (for validation, iteration) and a type (for exhaustiveness). TypeScript enums do not.

## API route paths

```
/api/<domain>/<action>
/api/<domain>/<id>
/api/<domain>/<id>/<sub-resource>
```

Examples:

- `/api/trades` — list
- `/api/trades/:id` — detail
- `/api/trades/:id/close` — action on resource
- `/api/trade-finder/setups` — sub-domain within a domain

No verbs at the top level — use HTTP methods for that. `POST /api/trades` creates; `POST /api/trades/:id/close` is a resource action.

## Database columns

- `camelCase` only
- `createdAt`, `updatedAt`, `deletedAt` for timestamps (Prisma convention)
- Foreign-key columns end with `Id`: `tradeId`, `userId`
- JSON columns named after their content: `metadata`, `managementLog`, `configOverrides`
- Boolean columns start with `is`, `has`, `should`, `can`: `isEnabled`, `hasNotified`

## What the `code-reviewer` agent checks

On every review:

- Filenames match the kebab/suffix rule for their kind
- Identifier casing matches the table above
- No banned abbreviations in identifiers
- Boolean naming uses affirmative prefixes
- Function names use verbs
- Database columns are camelCase
- React components are PascalCase
- Hooks start with `use`
- Context + provider naming pair up correctly

Violations are blockers, not suggestions.
