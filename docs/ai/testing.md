# Testing Standards

## Framework

- **Vitest** for all test types (unit, integration, component).
- Config per workspace: `vitest.config.ts` in each app/package root.
- Run all: `pnpm test` (root). Run workspace: `pnpm --filter @fxflow/web test`.

## File Conventions

- Test files co-located with source: `trade-syncer.ts` → `trade-syncer.test.ts`.
- Component tests: `ai-analysis-sheet.tsx` → `ai-analysis-sheet.test.tsx`.
- Name pattern: `describe("functionName or ComponentName", () => { it("should ...") })`.

## Test Tiers

### Unit Tests (fast, isolated)

- `packages/shared` — all utility functions (formatting, validation, calculations).
- `packages/types` — Zod schema validation (valid + invalid inputs).
- `packages/db` — service functions against a test SQLite database.
- Daemon pure logic — signal parsing, price throttling, setup scoring.

### Integration Tests (real dependencies)

- **API routes**: Test with a real test SQLite DB, not mocked Prisma.
- **DB services**: Full Prisma queries against `test.db` (reset between suites).
- **WebSocket messages**: Verify daemon broadcast → message shape → correct dispatch.
- **Signal pipeline**: Webhook payload → SignalProcessor → expected DB state.

### Component Tests (UI behavior)

- Complex interactive components only (not every presentational component).
- Use `@testing-library/react` — test user behavior, not implementation.
- Verify: keyboard navigation, state transitions, error states, loading states.
- Mock daemon connection and API calls at the fetch/WS boundary.

## What NOT to Test

- Simple presentational components (pure props → JSX).
- Re-exports or type-only files.
- Third-party library behavior (shadcn/ui, Radix internals).

## Test DB Setup

```ts
// packages/db/src/test-utils.ts
// Provides: createTestDb(), resetTestDb(), seedTestData()
// Uses in-memory SQLite or file-based test.db with WAL mode
```

- Each test suite gets a clean DB state via `beforeEach(resetTestDb)`.
- Seed helpers for common entities: trades, signals, setups, AI analyses.

## CI Expectations

- All tests must pass before merge.
- No `.skip` or `.todo` in committed tests without a linked issue.
- Test coverage targets: services 80%+, utilities 90%+, components 60%+.
