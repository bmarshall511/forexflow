---
id: rejected-0004
title: Use Express instead of Hono for the daemon HTTP layer
status: rejected
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [stack, daemon, rejected]
---

# rejected-0004 — Use Express instead of Hono for the daemon HTTP layer

## Context

V2's daemon ran on Express. Carrying Express forward would preserve familiarity: middleware shape, error-handler pattern, request/response objects all unchanged.

## Why rejected

1. **Zod-first validation.** Hono's `@hono/zod-validator` produces fully-typed request bodies, queries, and params at the route level — `c.req.valid("json")` returns a typed value, no runtime cast. Express requires additional glue (`zod-express-middleware` or equivalent) and the result is less ergonomic. Given rule 04 mandates Zod at every boundary, Hono's native integration is a direct fit.

2. **Faster cold start + smaller dependency surface.** Hono's core is ~12 KB. Express + middlewares typically ~300 KB. For a process that reconnects, restarts, and gets Docker-built repeatedly, the cold-start difference is measurable.

3. **First-class fetch API.** Hono's request/response are `Request`/`Response` objects (Web-standard), matching what the CF Worker already uses. One mental model across daemon and Worker; less context-switching in code review.

4. **Type-level route table.** Hono can produce a typed RPC client from its route definitions. The MCP server (when wired) benefits directly — no hand-written client for the daemon.

5. **Rule 03's middleware requirements are simpler in Hono.** Correlation IDs, Pino-child logger binding, auth check — the Hono middleware signature is tighter than Express's.

## Why it might have stayed Express

- V2 familiarity
- Larger ecosystem of third-party middleware
- Battle-tested error-handling patterns

None of those outweigh the primary reason to switch: **Hono makes the Zod-at-boundary rule cheaper to follow**, which is the most frequently-exercised pattern in this codebase.

## When to reconsider

- A daemon feature requires a middleware that exists only for Express
- Hono's release cadence slows materially
- The team grows to include people whose Express muscle memory becomes a bottleneck (not a near-term concern)

Reopening requires a new ADR that supersedes this one.

## References

- `.claude/context/stack.md` §"Backend"
- `.claude/decisions/` — ADR [#0001](../0001-v3-greenfield-rebuild.md) §Stack decisions
