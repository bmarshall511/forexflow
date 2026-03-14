# Contributing to ForexFlow

Thanks for your interest in contributing! ForexFlow is a production-grade forex trading platform, so we care about code quality, consistency, and safety.

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- An OANDA practice account ([sign up free](https://www.oanda.com/apply/))

### Development Setup

```bash
# Clone the repo
git clone https://github.com/bmarshall511/forexflow.git
cd forexflow

# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @fxflow/db db:generate

# Copy environment files
cp apps/daemons/.env.example apps/daemons/.env.local
cp apps/web/.env.example apps/web/.env.local

# Generate an encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output as ENCRYPTION_KEY in both .env.local files

# Configure OANDA credentials via the Settings page (after starting the app)

# Start development
pnpm dev
```

The web app runs on `http://localhost:3000` and the daemon on `http://localhost:4100`.

## Using Claude Code

This project includes a complete AI governance system in the `.claude/` directory. If you use [Claude Code](https://claude.ai/claude-code), you get:

- **CLAUDE.md** — Project constitution loaded into every session (monorepo layout, import boundaries, coding standards, domain concepts)
- **8 path-scoped rules** — Context-specific guidance auto-loaded based on which files you're editing
- **8 reusable skills** — Task templates for common operations (adding API routes, daemon endpoints, DB services, WebSocket events)
- **Automated hooks** — Prettier format-on-edit + destructive command guard
- **Sandbox controls** — Prevents AI from accessing `.env` files or secrets

This means you can contribute effectively with AI assistance from your first session.

## Code Standards

The full coding standards are documented in [`docs/ai/standards.md`](docs/ai/standards.md). Key highlights:

- **Strict TypeScript** — No `any`. Discriminated unions, branded types for IDs, exhaustive switch/never
- **File size limits** — Components <= 150 LOC, services <= 300 LOC
- **Runtime validation** — Zod at system boundaries (webhooks, API responses, user input)
- **Error handling** — No silent catches. Errors must be typed, logged, and surfaced
- **Mobile-first** — Responsive layout, touch-friendly targets (min 44x44px)
- **Accessibility** — AAA baseline. Semantic HTML, keyboard navigation, visible focus indicators

## Monorepo Structure

```
apps/
  web/           — Next.js 15 App Router (frontend + API routes)
  daemons/       — Node.js daemon (trade syncing, signals, AI analysis)
  cf-worker/     — Cloudflare Worker (TradingView webhook relay)
  mcp-server/    — MCP server (Claude Code ↔ live data bridge)

packages/
  types/         — Shared TypeScript contracts
  shared/        — Pure utilities (no runtime-specific imports)
  db/            — Prisma schema + SQLite, service files per domain
```

### Import Boundaries (strict)

- `apps/*` may import from `packages/*`
- `apps/*` must NOT import from other `apps/*`
- `packages/*` must NOT import from `apps/*`
- `packages/shared` and `packages/types` must have no runtime-specific imports

## Making Changes

### Before you start

1. Check existing issues and PRs to avoid duplicate work
2. For non-trivial changes, open an issue first to discuss the approach

### Pull request process

1. Fork the repo and create a feature branch from `main`
2. Make your changes following the code standards above
3. Run the full check suite:
   ```bash
   pnpm typecheck    # TypeScript compilation
   pnpm lint         # ESLint
   pnpm test         # Vitest test suite
   pnpm format:check # Prettier formatting
   ```
4. Write a clear PR description explaining what and why
5. Keep PRs focused — one feature or fix per PR

### Commit messages

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint. Every commit message must follow this format:

```
type(scope): description
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes:** `web`, `daemons`, `cf-worker`, `mcp-server`, `types`, `shared`, `db`, `ci`, `docs`, `deps`

**Examples:**

```bash
git commit -m "feat(web): add dark mode toggle to settings"
git commit -m "fix(daemons): prevent duplicate signal processing"
git commit -m "docs: update API documentation"
```

Invalid commit messages will be rejected by the pre-commit hook.

### Pre-commit hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs automatically on git operations:

- **On commit:** Prettier auto-formats staged files, ESLint auto-fixes staged files
- **On commit message:** commitlint validates conventional commit format
- **On push:** TypeScript type checking + full test suite must pass

Hooks are installed automatically via `pnpm install` (postinstall script). If hooks are missing, run `pnpm lefthook install`.

### CI checks

Every pull request runs the following checks via GitHub Actions:

| Check            | What it does                                               |
| ---------------- | ---------------------------------------------------------- |
| **lint-format**  | ESLint + Prettier across all workspaces                    |
| **typecheck**    | `tsc --noEmit` across all workspaces                       |
| **test**         | Vitest test suites with coverage                           |
| **build**        | Full production build                                      |
| **audit**        | `pnpm audit` for known vulnerabilities                     |
| **knip**         | Detects unused exports and dependencies                    |
| **prisma-drift** | Ensures migrations match the schema                        |
| **danger**       | Automated PR review (size, description, import boundaries) |

All checks must pass before merging. PRs are squash-merged to `main`.

## Areas Welcoming Contributions

- **Additional broker integrations** — Currently OANDA only
- **More technical indicators** — Expand the AI analysis context
- **Testing coverage** — The app needs more automated tests
- **Zone detection refinements** — Algorithm improvements
- **Mobile responsiveness** — UI polish on small screens
- **Documentation** — User guides, tutorials, setup videos

## Questions?

Open a [Discussion](https://github.com/bmarshall511/forexflow/discussions) on GitHub.
