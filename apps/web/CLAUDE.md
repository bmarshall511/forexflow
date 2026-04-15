# apps/web — Next.js 15 App Router

## Architecture

- Server Components by default. Add `"use client"` only for interactive/stateful components.
- `middleware.ts` handles PIN authentication (session cookie validation, redirect to /login or /setup).
- No Server Actions — all mutations go through REST API routes.
- Theme: next-themes, class-based dark/light, dark is default.
- `output: "standalone"` in `next.config.ts` produces a self-contained server for Electron desktop bundling.

## Directory Structure

```
src/
  app/(auth)/      # Auth pages (login, setup) — outside main layout
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
- **Price merging**: `positions_price_update` and `chart_price_update` are deltas (only instruments with ticks in the last 500ms). The handler merges incoming prices into existing state instead of replacing, preventing instruments from flickering in and out.
- **Live price hook**: `use-live-price.ts` uses `useDaemonStatus()` (shared context) — NOT `useDaemonConnection()` directly. This avoids creating per-component WebSocket connections. Includes a `lastKnownPriceRef` so price never flickers to null once obtained.

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
- **In-app docs**: `components/docs/` — renders `docs/user/` + `docs/dev/` via `/api/docs` route (category-based) and `lib/markdown.ts` (zero-dependency markdown-to-HTML with frontmatter, callouts, cross-links, TOC extraction). 3-column layout: grouped sidebar + content + TOC. Search via `/api/docs/search`. Styles in `.prose-fxflow` in `globals.css`.

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
- **P/L display**: pip P/L shown alongside dollar P/L on trade rows, cards, and mobile cards via `formatPnLWithPips()`. P/L colors use semantic tokens `text-status-connected`/`text-status-disconnected` (not raw green/red).

## Hook Conventions

- File naming: `use-{feature}.ts`
- Return typed objects (not arrays).
- Data hooks handle loading/error states internally.
- Examples: `use-positions.ts`, `use-ai-analysis.ts`, `use-trade-finder.ts`.
- **`use-ai-analysis.ts` lifecycle guarantees**: watchdog + reconciliation poll keep the spinner honest. If no progress update arrives in 60s the progress is flagged `isStale` (UI shows "still working…"). If no update in 240s the spinner hard-clears and the analysis is surfaced via `interruptedAnalysis` so the user can Retry/Dismiss. A 10s reconciliation poll refetches history while an analysis is active so a daemon-side crash that flips the row to `failed`/`cancelled` is detected without a WS completion message. Return fields: `interruptedAnalysis`, `dismissInterruption`. **Partial status**: when the daemon reports `truncated: true` via WS (Anthropic `stop_reason === "max_tokens"`), the hook builds the immediate display row with `status: "partial"` and surfaces `stopReason` for `TruncationBanner` to render.
- **Partial analysis rendering**: `components/ai/truncation-banner.tsx` renders above results whenever `displayAnalysis.status === "partial"` — offers a Regenerate CTA and tailors copy based on `stopReason`. `analysis-history.tsx` shows a Partial badge; `ai-stats-bar.tsx` counts partial analyses in its status pills. The completion-transition icon in `analysis-tab-content.tsx` branches on `progress.stage.includes("truncated")` to show an amber `AlertTriangle` instead of the green check.
- **`use-chart-trade-editor.ts` validates SL/TP context-aware**: pending orders compare against entry; open trades compare against current bid/ask (so breakeven and trailing stops past entry are legitimate). Pass `tradeStatus`, `currentBid`, `currentAsk` from the consumer. If bid/ask are null, directional check is skipped — daemon is still authoritative on save.

## Authentication

- PIN-based auth via `middleware.ts` — checks `fxflow_session` cookie against DB.
- First-time setup: `/setup` page creates PIN + auto-logs in.
- Login: `/login` page with numeric keypad, lockout after 5 failed attempts.
- Session management: Settings > Security (change PIN, session duration, active sessions).
- Rate limiting on `/api/auth/login` (5 req/min per IP) via `lib/rate-limit.ts`.

## Remote Access

- `server.ts` — custom Next.js server that proxies `/ws` WebSocket to daemon:4100 (production only).
- `use-daemon-connection.ts` auto-detects local vs remote vs cloud and switches between direct daemon connection, proxy, or cloud URL.
- **Cloud mode**: `NEXT_PUBLIC_CLOUD_DAEMON_URL` env var or Settings > Deployment overrides daemon URL to connect directly to a remote daemon.
- `/api/daemon/[...path]` — REST proxy route for daemon calls when remote.
- In dev mode (no WS proxy), `use-daemon-connection.ts` falls back to REST polling every 5s. `isReachable` state tracks REST-based connectivity alongside `isConnected` (WebSocket).
- `/api/settings/tunnel-status` — returns tunnel status + URL (read from `data/.tunnel-url` written by `dev.sh`).
- PWA manifest + service worker for installable mobile experience.
- See `docs/dev/06-remote-access.md` for full architecture.

## AI Trader (EdgeFinder) UI

- **Manual approval workflow**: `OpportunityList` renders `OpportunityCard` (with Approve/Reject buttons) for opportunities with status `"suggested"`. All other statuses use `OpportunityCompactCard`. The list receives `operatingMode`, `confidenceThreshold`, and `onAction` props from the dashboard.
- **Pair viability indicators**: `ai-trader-scan-config.tsx` pair picker shows colored viability dots next to each pair/profile combo — green (viable), amber (marginal), red (blocked), gray (unknown) — with tooltips. Data from `GET /api/ai-trader/pair-viability`.
- **Near-miss diagnostics**: `scan-log-entry-detail.tsx` displays near-miss data for `pair_scanned` log entries, showing closest-to-passing signals with pair, profile, direction, R:R, ATR, and rejection reason.
- **Opportunity filters**: `opportunity-filters.tsx` includes Profile (Scalper/Intraday/Swing/News) and Direction (Long/Short) filter chips in addition to existing filters.

## Naming

- **EdgeFinder** is the user-facing display name for the AI Trader feature. Code uses `ai-trader` in paths, types, and DB models. UI shows "EdgeFinder" in titles and navigation.

## Gotchas

- `middleware.ts` handles auth — public paths are exempted (api/auth, static assets).
- **Middleware always fetches `http://localhost:${PORT}/api/auth/status`** — never `request.nextUrl.origin`, which fails when the request arrives via a tunnel URL.
- API routes that proxy to daemon must handle daemon-down errors gracefully.
- WS reconnection is handled automatically by `use-daemon-connection.ts`.
- `use-daemon-status.ts` vs `use-daemon-connection.ts`: status is the consumer hook, connection is the provider. **Never import `use-daemon-connection` directly from components or hooks** — always use `useDaemonStatus()` which reads from the shared context. Direct calls create per-component WebSocket connections.
- `server.ts` is only used in production (`pnpm start`). Dev mode uses `next dev` directly (no WS proxy — REST polling fills the gap).
- Deployment settings (local/cloud mode, cloud daemon URL) stored in `Settings` model via `deployment-service.ts`.
- Settings > Deployment page: `components/settings/deployment/deployment-settings-page.tsx`.
