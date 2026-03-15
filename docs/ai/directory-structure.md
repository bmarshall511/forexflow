# Directory Structure

## Monorepo Layout

```
apps/
  web/                  # Next.js 15 App Router — UI + API routes
    src/
      app/              # Pages & API routes (App Router file conventions)
        api/            # REST endpoints (route.ts files)
      components/       # React components organized by domain
        ui/             # Shared UI primitives (shadcn/ui, custom)
        ai/             # AI analysis UI
        trade-finder/   # Trade finder UI
        tv-alerts/      # TradingView alerts UI
      hooks/            # Custom React hooks (use-*.ts)
      state/            # Contexts and state management
      lib/              # Client-side utilities
  daemons/              # Node.js daemon — background services + WebSocket
    src/
      oanda/            # OANDA API client, streaming, account management
      ai/               # AI analysis pipeline (context, executor, monitor)
      trade-finder/     # Scanner, setup detection, auto-trade
      tv-alerts/        # Signal processor, webhook handling
  desktop/              # Electron macOS app — wraps web + daemon for end users
    src/
      main/             # Main process (window, tray, daemon manager, IPC, updater)
      preload/          # contextBridge preload script
    assets/             # App icons, tray icon
    electron-builder.yml # Build config (DMG, unsigned, GitHub publish)
  cf-worker/            # Cloudflare Worker — webhook relay
    src/                # Worker entry, Durable Objects

packages/
  types/                # Shared TypeScript contracts
    src/index.ts        # All shared types, enums, Zod schemas
  shared/               # Pure TS utilities (no runtime deps)
    src/                # Formatting, validation, constants, deployment config
  db/                   # Prisma + SQLite/Turso data layer
    prisma/
      schema.prisma     # Single schema file
    src/                # Service files (one per domain)
```

## Import Boundaries

| From              | To               | Allowed                               |
| ----------------- | ---------------- | ------------------------------------- |
| `apps/*`          | `packages/*`     | Yes                                   |
| `packages/*`      | `apps/*`         | **Never**                             |
| `apps/web`        | `apps/daemons`   | **Never** (communicate via HTTP/WS)   |
| `apps/desktop`    | `packages/*`     | Yes                                   |
| `apps/desktop`    | `apps/*`         | **Never** (bundles as extraResources) |
| `packages/db`     | `packages/types` | Yes                                   |
| `packages/shared` | `packages/types` | Yes                                   |
| `packages/types`  | other packages   | **Never** (leaf dependency)           |

## Where New Code Goes

- **New UI feature**: `apps/web/src/components/<domain>/` + hook in `hooks/`
- **New API endpoint**: `apps/web/src/app/api/<domain>/route.ts`
- **New daemon service**: `apps/daemons/src/<domain>/`
- **New DB query**: `packages/db/src/<domain>-service.ts`
- **New shared type**: `packages/types/src/index.ts`
- **New pure utility**: `packages/shared/src/<module>.ts`
- **New Prisma model**: `packages/db/prisma/schema.prisma` + matching service file

## Workspace Commands

- `pnpm dev` — run all apps in dev mode (Turbo). Desktop app is excluded.
- `pnpm build` — build all workspaces (except desktop)
- `pnpm --filter @fxflow/web dev` — run single workspace
- `pnpm db:migrate` — apply Prisma migrations

### Desktop commands

- `pnpm desktop:dist` (from repo root) — single command to build everything and package the arm64 DMG locally
- `pnpm electron:dev` — run Electron in dev mode (from `apps/desktop/`)
- `pnpm electron:build` — compile Electron main/preload via `tsc`
- `pnpm electron:package` — build macOS DMG via electron-builder (CI passes `--publish never`; uploads via `gh release upload`)
