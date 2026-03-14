# Coding Standards

## TypeScript

- Strict mode everywhere. No `any` — use `unknown` + narrowing or generics.
- Prefer discriminated unions for state variants (e.g., `{ status: "success"; data: T } | { status: "error"; error: AppError }`).
- Use branded types for IDs: `type TradeId = string & { __brand: "TradeId" }`.
- Exhaustive `switch` with `never` default: `default: const _exhaustive: never = value;`.
- Runtime validation at boundaries (API routes, WebSocket messages, webhook payloads) using Zod schemas from `packages/types`.

## Error Handling

- No silent catches. Every `catch` must log or re-throw.
- Use typed error classes (e.g., `OandaApiError`, `SignalValidationError`) — not bare strings.
- Log with structured context: `logger.error("Failed to place order", { tradeId, instrument, error })`.
- API routes return consistent `{ error: string; code?: string }` shape on failure.

## File Size Limits (lines of code)

| Type                            | Max LOC |
| ------------------------------- | ------- |
| UI component                    | 150     |
| Hook / utility                  | 200     |
| API handler / service           | 250     |
| Orchestration (scanner, syncer) | 350     |

Split when approaching limits. Extract sub-components, helper functions, or dedicated services.

## DRY & Composition

- Extract at 2+ occurrences. Shared helpers go in `packages/shared`.
- Shared UI patterns (cards, tabs, stat rows) live in `apps/web/src/components/ui/`.
- DB query logic lives in `packages/db/src/` service files — never inline Prisma calls in API routes.

## Dependencies

- Every new dependency must be justified (no overlapping libs).
- Use widely-adopted packages with active maintenance.
- Keep versions consistent across workspaces — define in root `package.json` where possible.
- No "utility dumping grounds" — each module has a single, clear purpose.

## Naming

- Files: kebab-case (`trade-syncer.ts`, `use-ai-analysis.ts`).
- Types/interfaces: PascalCase. Functions/variables: camelCase.
- React components: PascalCase, one per file, filename matches component name.
- DB service functions: verb-noun (`getTradeWithDetails`, `upsertSignal`).
