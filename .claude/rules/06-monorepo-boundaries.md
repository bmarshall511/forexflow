---
name: monorepo-boundaries
scope: []
enforcement: strict
version: 0.1.0
related:
  - "hooks/pre-edit-import-boundary.mjs"
  - "agents/integration-reviewer.md"
  - "context/stack.md"
applies_when: "Any file with an import statement"
---

# Monorepo Boundaries

The monorepo shape is non-negotiable. Boundaries exist so modules can be reasoned about in isolation, so `packages/*` can be published independently if we ever want to, and so refactoring one app never cascades into another.

## The rules

1. **`apps/*` may import from `packages/*`.**
2. **`packages/*` may import from other `packages/*`** — but only within the allowed dependency graph below.
3. **`packages/*` may never import from `apps/*`.** Ever. This includes type-only imports.
4. **`apps/*` may never import from another `apps/*`.** Ever. If two apps need to share something, extract it to a package.
5. **Framework-specific code stays in its app.** React hooks live in `apps/web`. Hono middleware lives in `apps/daemon`. Cloudflare Worker runtime APIs live in `apps/cf-worker`. They do not leak into `packages/*`.
6. **`packages/shared` is runtime-agnostic.** No React. No Node built-ins that don't run in browsers and Workers and Electron main. No `fs`, `child_process`, `dgram`, etc. If you need it in `shared`, write the abstraction in `shared` and the platform bindings in each consuming app.

## Allowed dependency graph

```
                  ┌─────────────────┐
                  │ packages/types  │  (depends on: nothing — pure type + zod schemas)
                  └────────┬────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │packages/shared│ │packages/config│ │packages/logger│
  └────────┬─────┘ └───────┬──────┘ └───────┬──────┘
           │               │                │
           │               │                │
           └───────┬───────┴────────────────┘
                   ▼
            ┌─────────────┐
            │ packages/db │  (depends on: types, shared, config, logger)
            └──────┬──────┘
                   │
    ┌──────────────┼──────────────┬───────────────┬──────────────┐
    ▼              ▼              ▼               ▼              ▼
┌────────┐  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────────┐
│apps/web│  │apps/daemon│  │apps/desktop │  │apps/cf-worker│ │apps/mcp-server│
└────────┘  └──────────┘  └─────────────┘  └──────────┘  └──────────────┘
```

Key invariants:

- **`types` depends on nothing** (except `zod`). It is the foundation
- **`config`, `logger`, `shared` are peers**; they all depend on `types`, nothing depends on them among the peers
- **`db`** depends on `types`, `shared`, `config`, `logger`. Every other package stays above `db`
- **Apps** depend on any package; never on each other

## Enforcement

### Write-time

The `pre-edit-import-boundary` hook parses the `import` statements of any file being written or edited and blocks:

- An `apps/X/**` file importing `apps/Y/**` (cross-app)
- A `packages/X/**` file importing `apps/**` (package depending on app)
- A `packages/X/**` file importing `packages/Y/**` where `Y` is not in `X`'s allowed set
- `packages/shared/**` importing anything runtime-specific (`react`, `next`, `hono`, `electron`, `ws`, `node:fs`, `node:child_process`, etc.)

Hook implementation lives in `.claude/hooks/pre-edit-import-boundary.mjs`. The allowed graph is hardcoded in the hook (source of truth: this rule).

### Review-time

The `integration-reviewer` agent catches boundary violations that slip through write-time (e.g., re-exports that dodge the direct-import check). Dispatched automatically on every PR touching multiple packages or apps.

### Build-time

TypeScript project references enforce the graph at the type-check level. `tsc --build` fails if a package tries to reference something outside its declared deps.

## Path aliases

Each package declares a scoped name:

- `@forexflow/types`
- `@forexflow/shared`
- `@forexflow/config`
- `@forexflow/logger`
- `@forexflow/db`

Apps import by scoped name, never by relative path:

```ts
// good
import type { Trade } from "@forexflow/types"
import { calculatePositionSize } from "@forexflow/shared/trading-core"

// bad
import { calculatePositionSize } from "../../packages/shared/src/trading-core"
```

Within an app, `@/` maps to `src/`:

```ts
// apps/web/src/app/positions/page.tsx
import { PositionCard } from "@/components/positions/position-card"
```

## Re-exports

Workspace packages may have a root `src/index.ts` that re-exports from internal files:

```ts
// packages/shared/src/index.ts
export { calculatePositionSize } from "./trading-core/risk-sizing"
export { conditionsMatch } from "./condition-matching"
// ...
```

But:

- **Apps do not use barrel files.** Every import inside `apps/` is explicit about which file it comes from
- **No transitive re-exports that cross package boundaries.** `packages/shared` does not re-export from `packages/types` — consumers import from `@forexflow/types` directly

## When in doubt

If a piece of code feels like it wants to sit in two apps, extract it to a package now. The cost of the extraction is cheap early and expensive later.

If a piece of code is conditional on runtime environment (browser vs. Node vs. Worker), it belongs in the app, not in `shared`. Write the shared *logic* in `packages/shared` with pure inputs/outputs; write the platform bindings in the app.

Dispatch the `integration-reviewer` if unsure.
