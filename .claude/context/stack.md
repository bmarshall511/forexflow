# Technology Stack — ForexFlow

> The declared target stack. Agents reference this when they need to know what tools, frameworks, and libraries the project uses. When in doubt, check here before proposing a new dependency.

## Toolchain

| Tool | Version | Pinned in |
|---|---|---|
| Node.js | 22.x | `mise.toml`, `.nvmrc` |
| pnpm | 10.x | `mise.toml` |
| Python | 3.12 | `mise.toml` (for tooling only; no Python app code) |
| Turbo | ^2 | Added in Phase 2 |

**Package manager:** pnpm with workspaces. Never `npm` or `yarn`. The `pnpm` catalog feature holds shared dependency versions.

**Monorepo:** Turbo for task orchestration. Caching on `build`, `lint`, `typecheck`, `test`. Persistent `dev` task.

## Languages

- **TypeScript 5.x**, strict mode
- No JavaScript source files except build scripts where TS adds no value
- No other application languages

## Monorepo structure (target, arriving in Phase 2)

```
apps/
  web/         Next.js 15 App Router (frontend + API routes)
  daemon/      Node.js (Hono HTTP + WebSocket, port 4100)
  cf-worker/   Cloudflare Worker + Durable Objects (TradingView webhook relay)
  desktop/     Electron (macOS DMG — bundles web + daemon)
  mcp-server/  Model Context Protocol bridge (deferred wiring, stub in Phase 2)

packages/
  types/       Shared TypeScript contracts (event envelopes, DTOs)
  shared/      Pure-TS runtime-agnostic utilities (pip, session, trading-core primitives)
  db/          Prisma schema, generated client, service files per domain, encryption
  config/      T3 Env schemas shared across apps
  logger/      Pino configuration shared across apps
```

Import boundaries (strict, enforced by hook):

- `apps/*` may import from `packages/*`
- `packages/*` never import from `apps/*`
- `apps/*` never import from other `apps/*`

## Frontend

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router | No Pages Router, no hybrid |
| React | 19 | Server Components, streaming, Suspense |
| Styling | Tailwind CSS 4 | With `prettier-plugin-tailwindcss` class sorting |
| Components | [shadcn/ui](https://ui.shadcn.com/) | Radix primitives, copy-in-the-repo approach |
| Charts | [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/) | For price + indicator visualization |
| Data viz | [Recharts](https://recharts.org) | For analytics, equity curves, breakdowns |
| Toasts | [Sonner](https://sonner.emilkowal.ski/) | |
| Theme | `next-themes` with class strategy | |
| PWA | Manifest + service worker | For mobile install |
| Icons | [Lucide React](https://lucide.dev/) | Only icon set; no mixing |

## Backend

| Concern | Choice | Notes |
|---|---|---|
| Daemon HTTP | [Hono](https://hono.dev/) | Replaces Express. Faster, Zod-friendly, typed routing |
| WebSocket | `ws` | For daemon → web broadcast |
| Cloudflare Worker | Workers runtime | With Durable Objects for single-instance state |
| Process manager | None (daemon is single process) | Electron forks it in local mode |

## Data

| Concern | Choice | Notes |
|---|---|---|
| ORM | [Prisma](https://www.prisma.io/) 7 | With `@prisma/adapter-libsql` for Turso |
| Local DB | SQLite with WAL mode | `./data/forexflow.db` |
| Cloud DB | [Turso](https://turso.tech) (LibSQL) | When self-hosted with remote DB |
| Migrations | Prisma Migrate | One migration per schema change |
| Encryption | AES-256-GCM | For OANDA credentials and any user secrets at rest |

## Validation

| Concern | Choice |
|---|---|
| Schema validation | [Zod](https://zod.dev/) |
| Env variable validation | [T3 Env](https://env.t3.gg/) with Zod |
| API request/response | Zod at every boundary |
| WebSocket messages | Zod on receive |

Never read `process.env.X` directly in application code. Always go through the T3 Env schema in `packages/config`.

## Logging

| Concern | Choice | Notes |
|---|---|---|
| Logger | [Pino](https://getpino.io/) | Structured JSON logs; configured in `packages/logger` |
| Log redaction | Pino `redact` config | Mask OANDA credentials, webhook tokens, session cookies |
| `console.log` policy | Banned in `apps/daemon/**` and `apps/web/src/app/api/**` | Use the Pino instance from `packages/logger` |
| UI `console.*` | Allowed during development; stripped in production builds |  |

## Testing

| Level | Tool | Scope |
|---|---|---|
| Unit | [Vitest](https://vitest.dev/) 3.x | Pure functions, utilities, reducers |
| Integration | Vitest with real SQLite | Service-level tests hitting an in-memory DB |
| End-to-end | [Playwright](https://playwright.dev/) 1.x | UI flows, required for any `apps/web/**` UI change |
| Contract | Vitest | Verify `packages/types` schemas match actual API responses |
| Visual regression | Playwright screenshots | Component-level snapshots |
| Load (later) | [k6](https://k6.io/) or [autocannon](https://github.com/mcollina/autocannon) | Daemon endpoints under realistic load |

Coverage targets (enforced in CI, later phase):

- `packages/*/src/**/*.ts` — 80% lines
- `apps/daemon/src/**/*.ts` — 70% lines
- `apps/web/src/**/*.{ts,tsx}` — no numeric target, but every user-facing flow has a Playwright spec

## Tooling

| Concern | Choice |
|---|---|
| Formatter | [Prettier](https://prettier.io) with `prettier-plugin-tailwindcss` |
| Linter | [ESLint](https://eslint.org) 9 Flat Config |
| Type-checker | `tsc --noEmit` |
| Dead-code detection | [Knip](https://knip.dev) |
| Git hooks | [Lefthook](https://github.com/evilmartians/lefthook) |
| Commit linting | [commitlint](https://commitlint.js.org/) with conventional-commits preset |
| Secrets scanning | [gitleaks](https://github.com/gitleaks/gitleaks) |
| Dep management | [Renovate](https://docs.renovatebot.com/) for PRs |
| Release automation | [semantic-release](https://semantic-release.gitbook.io/) |
| API docs | [TypeDoc](https://typedoc.org) |

## AI / LLM

| Concern | Choice |
|---|---|
| SDK | `@anthropic-ai/sdk` |
| Main models | Opus 4.7 (reasoning), Sonnet 4.6 (implementation), Haiku 4.5 (triage/exploration) |
| Prompt caching | Always enabled. System prompts are cached; volatile content is appended |
| Token budget | `MAX_THINKING_TOKENS=10000` in per-user settings |
| Cost tracking | Every invocation logged to `.claude/telemetry/` |

## Integrations

| Service | Purpose | Integration type |
|---|---|---|
| OANDA | Broker (account, orders, pricing) | REST + SSE streams |
| TradingView | External alert source | Webhook POST (via CF Worker) |
| Cloudflare Workers | Edge webhook relay | HTTP + Durable Object WS |
| Anthropic | AI analysis | REST (SDK) |
| FRED (optional) | US economic data | REST |
| Alpha Vantage (optional) | Supplementary market data | REST |

## Desktop

| Concern | Choice |
|---|---|
| Shell | Electron 34+ |
| Packaging | electron-builder (macOS DMG) |
| Auto-updater | electron-updater (GitHub Releases) |
| Persistent settings | electron-store |
| Native modules | `@libsql/darwin-arm64`, `@libsql/darwin-x64` bundled explicitly |

## CI / CD

| Concern | Choice |
|---|---|
| CI runner | GitHub Actions |
| Workflow tiering | push → lint/typecheck/test; PR → + build/E2E; release → + desktop DMG |
| Static analysis | CodeQL (weekly) |
| Secrets scan | gitleaks on every PR |
| Bundle analysis | On PRs touching `apps/web/**` or `packages/**` |
| Docs site | Astro site deployed to GitHub Pages |

## Explicitly rejected

| Rejected | In favor of | ADR |
|---|---|---|
| Drizzle | Prisma | `.claude/decisions/rejected/0001-*.md` |
| Tauri | Electron | `.claude/decisions/rejected/0002-*.md` |
| Bun | Node+pnpm | (to be written) |
| Express | Hono | `.claude/decisions/0002-*.md` |
| Winston | Pino | `.claude/decisions/0004-*.md` |
| Handwritten env parsing | T3 Env | `.claude/decisions/0003-*.md` |
| Drizzle-kit migrations | Prisma Migrate | |
| Redux / Zustand | React Context + hooks | |
| tRPC | Hono + Zod at boundaries | |
| Storybook | Playwright visual-regression specs | |
| Jest | Vitest | |

If an agent proposes a rejected tool, it must reference the ADR and provide a compelling reason to overturn the decision.

## Adding a new dependency

Not a free action. Every new dependency must:

1. Be justified (what problem does it solve that the existing stack can't)
2. Be widely-adopted and actively-maintained
3. Not overlap with an existing tool
4. Be added to the appropriate `package.json` (apps or packages, not root unless it's a workspace-wide tool)
5. Be pinned to a specific version in the pnpm catalog if it's shared

The `dep-upgrade` agent handles upgrades. Proposals for new dependencies should be filed as an issue with the `feature` template and discussed before the PR.
