# apps/web — Next.js 15 App Router

## Architecture

- Server Components by default. Add `"use client"` only for interactive/stateful components.
- No `middleware.ts`. No Server Actions — all mutations go through REST API routes.
- Theme: next-themes, class-based dark/light, dark is default.

## Directory Structure

```
src/
  app/(app)/       # Pages behind layout (dashboard, positions, charts, etc.)
  app/api/         # Route handlers (route.ts files)
  components/
    {feature}/     # Feature-specific components (ai/, charts/, positions/, etc.)
    ui/            # shadcn/ui primitives + custom shared components
    layout/        # Shell, sidebar, header
  hooks/           # use-*.ts — custom hooks, return typed objects
  state/           # React Context providers (no Redux)
  lib/             # Utilities
```

## API Route Pattern

- Files: `app/api/{domain}/route.ts`
- **Reads**: query DB directly via `packages/db` services.
- **Trade actions** (place, close, modify): proxy to daemon REST at `http://localhost:4100`.
- Always return `NextResponse.json()`.

## State Management

- React Context providers in `state/` (DaemonStatus, InternetStatus, Notification, Sidebar, TradingMode).
- No global state library. Local state + context + SWR-like hooks.

## WebSocket

- Single connection: `use-daemon-connection.ts` manages WS to daemon.
- Feeds into `DaemonStatusContext` — consuming hooks subscribe to specific message types.
- Message types defined in `@fxflow/types` (`DaemonMessageType` enum).

## Component Conventions

- **shadcn/ui**: extend via composition, never fork the base components.
- **Shared UI primitives**:
  - `PageHeader` — `components/ui/page-header.tsx` (icon, title, subtitle, actions, children, bordered)
  - `TabNav` / `TabNavButton` — `components/ui/tab-nav.tsx`
  - `PriceCard` / `StatRow` — `components/ui/price-card.tsx`
  - `DataTile` — `components/ui/data-tile.tsx`
  - `SectionCard` — `components/ui/section-card.tsx`
  - `Select` (Radix-based) — `components/ui/select.tsx`
- **Toast**: Sonner via `components/ui/sonner.tsx`.

## Page Layout Pattern

Every feature page follows this structure:

1. Hero header (page icon + title + subtitle + action buttons via `PageHeader`)
2. Status/summary tiles (DataTile grid)
3. Sticky `TabNav` for sub-sections
4. Tab content area

## Responsive / Mobile-First

- Container queries in header for adaptive layout.
- Card-based layout on mobile, table layout on desktop.
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`).

## Hook Conventions

- File naming: `use-{feature}.ts`
- Return typed objects (not arrays).
- Data hooks handle loading/error states internally.
- Examples: `use-positions.ts`, `use-ai-analysis.ts`, `use-trade-finder.ts`.

## Gotchas

- No `middleware.ts` exists — don't create one.
- API routes that proxy to daemon must handle daemon-down errors gracefully.
- WS reconnection is handled automatically by `use-daemon-connection.ts`.
- `use-daemon-status.ts` vs `use-daemon-connection.ts`: status is the consumer hook, connection is the provider.
