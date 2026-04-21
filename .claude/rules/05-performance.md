---
name: performance
scope: ["apps/**"]
enforcement: advisory
version: 0.1.0
related:
  - "agents/perf-auditor.md"
  - "skills/perf-audit/SKILL.md"
applies_when: "Editing application code (not libraries or config)"
---

# Performance

Advisory, but taken seriously. The `perf-auditor` agent runs on every PR that touches `apps/web/**` or `apps/daemon/**` and flags regressions. The `/perf-audit` skill runs a manual audit on demand.

## Web

### Bundle budgets

Enforced in CI via `bundle-analysis.yml` starting Phase 7:

| Bundle | Budget | Source |
|---|---|---|
| Initial JS (first load) | ≤ 180 KB gzipped | Next.js `_app` + page shell |
| Per-route JS | ≤ 60 KB gzipped | Route-specific |
| Total CSS | ≤ 40 KB gzipped | Tailwind output |
| LCP image | ≤ 100 KB | Hero images |

Regressions over budget fail the build. Check-in via ADR if the budget genuinely needs to grow.

### React render cost

- **Memoize expensive derivations** with `useMemo`, not every derivation — only the ones that show up in profiler traces
- **Stable callback refs** (`useCallback`) when passing to memoized children
- **`React.memo` for heavy leaf components** on routes with frequent re-renders (positions table, chart overlays)
- **Split state** to minimize the re-render surface. A context that holds both `connectionStatus` and `liveTrades` re-renders everyone on any change — split into separate contexts
- **Container/presenter split** for components that fetch AND render. The container owns state; the presenter is a pure function of props

### Realtime

- **One WebSocket connection per session.** Never one per component. Multiplex through a single context and selector hooks
- **Message merge, not replace** for price-update messages that carry only changed instruments
- **Throttle high-frequency updates** to the UI layer at 10 Hz max — the model can update faster, the DOM doesn't need to
- **`flushSync` only when necessary** (focus management, scroll position preservation). Default is batched rendering

### Fetching

- **Streaming RSC** where Server Components fit
- **Suspense boundaries** at page level for initial load; at component level for secondary content
- **`fetch(..., { cache: "force-cache" })`** for static references; `{ cache: "no-store" }` for user-specific
- **SWR-like pattern via context hooks** — no per-component `useEffect(() => fetch(...))` chains
- **Batch requests** when UI renders N items each needing data — fetch in one trip

### Images

- **Next `<Image>`** always. Never `<img>` on user-facing pages
- **`priority` on LCP image only** — above-the-fold hero
- **`sizes` attribute** on responsive images
- **AVIF or WebP** sources preferred; PNG/JPG as fallback
- **Preload critical fonts** in the root layout

### Animation

- **CSS transforms and opacity only** for 60fps animations (GPU-composited)
- **No animating `top`, `left`, `width`, `height`** — forces layout
- **`will-change` sparingly** — only on elements actively animating

## Daemon

### Concurrency

- **Per-instrument mutex** for trade syncing and signal processing
- **No global mutex** on anything hot — a single shared lock kills throughput
- **`AbortController` everywhere**: every long-running operation accepts a signal and cooperatively cancels
- **Don't `await` inside loops** when operations are independent — use `Promise.all` with bounded concurrency (`p-limit` or similar)

### Database

- **Indexed columns on every WHERE / ORDER BY predicate.** Prisma's `@@index` declarations are mandatory, not optional
- **N+1 is a ship-blocker.** Use `include` or `select` to fetch relations in one query. The `perf-auditor` flags N+1 patterns
- **Pagination on every list endpoint** — no unbounded `findMany()` in a route handler
- **Prepared statements automatic with Prisma**; never use `$queryRawUnsafe` (also a security rule, see `04-security.md`)
- **SQLite WAL mode** + `busy_timeout=5000` for concurrent reads during writes

### HTTP (Hono)

- **Streaming responses** for long queries (CSV export, candle history) via `c.stream()`
- **`Cache-Control` headers** on every response. Static: `max-age=31536000, immutable`. Dynamic user-specific: `private, no-store`. Aggregates: `public, max-age=60, stale-while-revalidate=300`
- **Gzip/brotli compression** handled by reverse proxy (in cloud mode) or Electron's static server

### Memory

- **Watch for unbounded caches.** Anything that grows with user activity needs a bounded LRU (`lru-cache` library)
- **WebSocket client list** bounded and cleaned on disconnect
- **Position price tracker** bounded by number of open instruments, not forever

### Startup

- **Lazy-load non-critical subsystems.** AI analysis doesn't need to initialize if no AI feature is enabled. Check settings, skip init, save hundreds of ms
- **Parallel init** where dependencies allow. OANDA client + DB + settings init in parallel, not sequentially
- **Health check reports readiness** only after all critical subsystems are ready — so orchestrators don't route traffic prematurely

## CF Worker

- **Single-instance Durable Object per webhook token** — the signal router is single-threaded by design
- **SQLite-backed DO storage** — the new Workers-native SQLite is faster than KV for this use case
- **No CPU-heavy work.** Validate payload, enqueue, respond. Hard work happens in the daemon
- **Queue depth bounded** at 100 messages, 60-second max age

## AI / LLM

- **Prompt caching everywhere** — the stable "who I am + rules + context" prefix is cached (`cache_control: ephemeral`). The volatile "what you're looking at" goes last. Expected 80–90% cache hit rate → 90% input cost reduction on cached portions
- **Route by model tier.** Triage on Haiku 4.5. Implementation on Sonnet 4.6. Reasoning and review on Opus 4.7. Never Opus for what Haiku can do
- **Streaming responses** for any UI-visible AI output
- **Budget caps per month per feature** — AI analysis, AI trader each have their own monthly USD ceiling. Hit the ceiling, feature soft-pauses until the next month or manual override
- **Cost telemetry** on every invocation to `.claude/telemetry/` (meta) and to the database (application-level for user-facing budgets)

## Benchmarks (required for hot paths)

Hot paths ship with a benchmark that a reviewer can run to verify baseline performance:

- Trade reconciliation loop (one pass over N open trades)
- Signal validation and placement (p50, p99 latencies)
- Chart price tick merge (throughput)
- Zone scanning (full-pair scan time)

Benchmarks live next to the code: `<file>.bench.ts`. They do not run in CI by default — opt-in via `pnpm bench`. Regressions ≥ 20% against the baseline noted in the ADR are reviewer-blockers.

## What the `perf-auditor` agent checks

- Bundle size deltas against `main` baseline
- Lighthouse performance score ≥ 90 on key pages
- No synchronous work on the main thread > 50 ms
- N+1 query patterns
- Unbounded memory growth (heap snapshots across a 5-minute soak)
- Render count per user interaction (reconciler log)

Dispatch via `/perf-audit`. Verdict: `green` (no regressions), `yellow` (regressions within budget), `red` (over budget, requires ADR or fix).
