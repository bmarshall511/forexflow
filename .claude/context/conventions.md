# Conventions — ForexFlow

> Naming, file layout, commits, branches, imports. When the rules are ambiguous, this file is the tiebreaker. When this file is silent, ask rather than invent.

## File and directory names

| Kind | Convention | Example |
|---|---|---|
| Source files | `kebab-case` | `trade-syncer.ts`, `use-live-price.ts` |
| React components (file) | `kebab-case` | `position-card.tsx` |
| React components (export) | `PascalCase` | `export function PositionCard() {}` |
| React hooks (file) | `use-*.ts` (kebab) | `use-daemon-connection.ts` |
| React hooks (export) | `camelCase` starting with `use` | `export function useDaemonConnection() {}` |
| Utility modules | `kebab-case` | `pip-utils.ts`, `format-currency.ts` |
| Types-only modules | `kebab-case`, no suffix | `trade-events.ts` not `trade-events.types.ts` |
| Test files | sibling to source, `.test.ts` / `.test.tsx` | `pip-utils.test.ts` |
| E2E specs | `apps/*/e2e/<feature>.spec.ts` | `apps/web/e2e/positions.spec.ts` |
| API route handlers | `apps/web/src/app/api/<path>/route.ts` | App Router convention |
| DB service files | `packages/db/src/<domain>-service.ts` | `trade-service.ts` |

## Identifier casing

| Kind | Convention |
|---|---|
| Variables, functions, methods | `camelCase` |
| Types, interfaces, classes, enums | `PascalCase` |
| Enum members | `PascalCase` (not `SCREAMING_SNAKE`) |
| Constants (top-level, truly immutable) | `SCREAMING_SNAKE_CASE` only for compile-time constants that read like constants (`const MAX_RETRIES = 3`). Everything else is `camelCase` |
| React component props | `camelCase` |
| CSS classes (if custom) | `kebab-case` |
| Environment variables | `SCREAMING_SNAKE_CASE`, prefixed by app when app-specific (`DAEMON_PORT`, `WEB_BASE_URL`) |
| Database columns (Prisma schema) | `camelCase` |
| API route params | `kebab-case` in URL (`/api/trade-finder/setups`) |
| WebSocket message types | `snake_case` string literals (`trade_placed`, `position_update`) |

## No abbreviations

Write the word. `configuration`, not `cfg`. `position`, not `pos`. `calculate`, not `calc`. Exceptions are industry-standard acronyms that would read weird expanded: `URL`, `HTTP`, `API`, `SL`, `TP`, `R:R`, `ATR`, `RSI`, `SMC`, `MFE`, `MAE`.

## Imports

Order (top of file down, blank line between groups):

1. Node built-ins (`node:path`, `node:fs`)
2. External dependencies (`react`, `zod`, `@anthropic-ai/sdk`)
3. Internal workspace packages (`@forexflow/types`, `@forexflow/shared`, `@forexflow/db`)
4. Local relative imports (`./foo`, `../bar`)
5. Type-only imports at the end of their group with `import type { ... }`

**Use `import type` for type-only imports.** ESLint will enforce this. It keeps runtime bundles lean.

**No barrel files** except for workspace packages' root `index.ts`. Do not create `index.ts` re-exports inside app directories — it confuses tree-shaking and obscures the real import paths.

**Absolute imports in apps** via path aliases:

- `apps/web` uses `@/*` → `apps/web/src/*`
- Other apps follow the same convention when they add path aliases

**Workspace imports** always by scoped name:

- `import { foo } from "@forexflow/shared"`, never `import { foo } from "../../packages/shared"`

## Exports

- One primary export per file. If a file contains several loosely-related exports, it usually wants to be split.
- `export function foo()` preferred over `export const foo = () =>` for top-level functions — makes them hoisting-correct and lets you use overloads if needed
- Named exports only. No `export default` except where a framework requires it (Next.js pages, `next.config.js`, Playwright config, etc.)
- If a file exports types **and** implementations, export types at the top with `export type`

## Commits

**Format:** [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `style`.

**Scopes (enum, enforced by commitlint):**

During Phase 1 (pre-code):

- `claude` — changes to `.claude/` configuration
- `docs` — documentation changes
- `ci` — GitHub Actions, Lefthook, workflow changes
- `repo` — top-level repo hygiene (LICENSE, README, CODEOWNERS, etc.)
- `agents` — `.claude/agents/` additions or changes
- `hooks` — `.claude/hooks/` additions or changes
- `skills` — `.claude/skills/` additions or changes
- `rules` — `.claude/rules/` additions or changes

Arriving in later phases:

- `web`, `daemon`, `cf-worker`, `mcp-server`, `desktop` — per-app scope
- `types`, `shared`, `db`, `config`, `logger` — per-package scope
- `deps` — dependency updates from Renovate

**Subject line:** imperative mood, ≤70 chars, no trailing period.

Good: `fix(daemon): reset stuck executing states on startup`
Bad: `Fixed a bug where the daemon would get stuck.`

**Body:** optional but encouraged. Explain **why**, not **what**. The diff shows what.

**Footer:** conventional footers for breaking changes and issue/requirement references:

- `BREAKING CHANGE: <description>` — triggers major version bump
- `@req: REQ-TRADING-014` — links the commit to a requirement
- `Closes: #123` — closes an issue

**No `Co-Authored-By` lines in commits.** (Rule: never reference individuals in app artifacts.) Git `user.name` / `user.email` in local config is the real author record; that is not "app code".

## Branches

Format: `<type>/<scope>/<short-description>`

- `feat/web/add-equity-curve-drawdown`
- `fix/daemon/null-metadata-recovery`
- `refactor/shared/split-pip-utils`
- `docs/claude/update-domain-glossary`
- `chore/repo/bump-node-to-22-lts`

All feature branches are based on `v3` during the rebuild; `main` is frozen for reference. When `v3` ships as the new `main`, base branches off `main` thereafter.

## Error handling

- **Typed errors only.** Use the hierarchy declared in `packages/shared/errors.ts` (added in Phase 2). No generic `throw new Error("bad")`.
- **No silent catches.** `catch (err) {}` with no handling is a hook-blocked violation. If you must swallow, comment *why* and log at `debug` level.
- **Errors surface to the UI.** API routes return `{ error: { code, message } }` with appropriate HTTP status. The web layer renders them in toasts or inline, never silently.
- **Errors are logged with context.** Pino's bound child loggers (`logger.child({ operation, tradeId })`) are preferred over stringly-included context.

## Comments

Default: **no comments.** Good names and types document intent. Write a comment only when:

- The *why* is non-obvious and cannot be expressed in code (a hidden constraint, a workaround for a specific bug, a counter-intuitive choice)
- A regex, bit manipulation, or compact expression genuinely benefits from a plain-English description
- A public API has a caller-facing consideration that belongs in JSDoc

**Never write:**

- Comments that paraphrase what the next line does
- Change-log comments inside source (`// added for ticket #123`)
- "Removed" comments (`// removed: old logic`) — the diff shows that
- `// TODO` with no owner, date, or link to an issue

**JSDoc** is required on every **exported** symbol (per non-negotiable #8 in `CLAUDE.md`). Use the concise one-liner form unless there is genuinely more to say.

## Formatting

All formatting is Prettier's job. Never fight the formatter. If you disagree with a Prettier output, open an issue; don't work around it.

- 2-space indent, LF line endings, UTF-8
- `printWidth: 100`
- No semicolons
- Double quotes for strings (Prettier default)
- Trailing commas everywhere
- Tailwind class sorting via `prettier-plugin-tailwindcss`

## Database schema (Prisma)

- Model names: `PascalCase`, singular (`Trade`, not `Trades`)
- Column names: `camelCase`
- Relations: explicit `@relation` with named constraint
- Indices: always explicit, named
- JSON columns: typed via Zod schemas in `packages/types`
- Migrations: generated via `pnpm --filter @forexflow/db db:migrate`; manual `ALTER TABLE` is not permitted

## WebSocket messages

- Message envelope: `{ type: string, payload: {...}, ts: number }`
- `type` is `snake_case` string literal, defined as a union in `@forexflow/types`
- Every new message type requires: (a) type union update, (b) server-side broadcast, (c) client-side handler in `use-daemon-connection`, (d) a contract test
- Backwards-incompatible message changes require a new `type` value (e.g. `position_update_v2`), not a payload reshuffle

## What lives where

Quick map agents can reference:

- UI primitives (shadcn, custom atoms) → `apps/web/src/components/ui/`
- Feature components → `apps/web/src/components/<feature>/`
- Feature hooks → `apps/web/src/hooks/use-<feature>.ts`
- State contexts → `apps/web/src/state/<name>-context.tsx`
- API route handlers → `apps/web/src/app/api/<path>/route.ts`
- Page routes → `apps/web/src/app/<path>/page.tsx`
- Daemon subsystems → `apps/daemon/src/<subsystem>/<file>.ts`
- Shared utilities (runtime-agnostic) → `packages/shared/src/<name>.ts`
- Trading core primitives → `packages/shared/src/trading-core/<name>.ts`
- Type contracts → `packages/types/src/<domain>.ts`
- DB service files → `packages/db/src/<domain>-service.ts`
- Prisma schema → `packages/db/prisma/schema.prisma`
- Env schemas → `packages/config/src/<app>-env.ts`
- Logger factories → `packages/logger/src/<app>-logger.ts`

When adding something and you are not sure where it goes: check this list. If it doesn't fit, stop and ask.
