---
id: rejected-0001
title: Use Drizzle ORM instead of Prisma
status: rejected
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [stack, database, rejected]
---

# rejected-0001 — Use Drizzle ORM instead of Prisma

## Context

Early in the Phase 1 planning conversation, the agent proposed evaluating Drizzle ORM against Prisma for `packages/db`. Drizzle offers:

- SQL-first syntax that reads like SQL
- Smaller runtime (no query engine binary)
- Faster cold starts (notable for the daemon and CF Worker)
- Simpler migration story (raw SQL migrations committed as `.sql` files)

## Why rejected

1. **Prisma's tooling is load-bearing** for the project's chosen workflow. `prisma migrate diff --exit-code` runs in CI as part of the Prisma-drift check; `prisma generate` produces the typed client every app consumes; `prisma migrate dev --create-only` is how the `migration-writer` agent produces safe migrations for review. Drizzle Kit has equivalents but they are less mature and would require rewriting the migration skill from scratch.

2. **Turso (LibSQL) cloud-DB support** works well via `@prisma/adapter-libsql`. Drizzle also supports LibSQL, but the Prisma adapter pattern is what the deployment-mode switch in `packages/db/src/client.ts` will key off of — a pattern carried forward from V2.

3. **Agent familiarity.** The `migration-writer` agent, the DB service pattern, and the encryption helper all assume Prisma. Switching to Drizzle would require reauthoring those artifacts for benefits that don't move the product forward.

4. **Runtime size isn't in the critical path.** The daemon is a long-lived process; cold-start cost amortizes to zero. The CF Worker doesn't talk to the DB directly — only through the daemon.

## When to reconsider

- Prisma's adapter API changes in a way that breaks Turso support and stays broken for > 3 months
- A future feature (vector columns, replication, custom types) turns out to be first-class in Drizzle but second-class in Prisma
- The project moves to an edge-deployed daemon where Prisma's engine binary becomes genuinely problematic

Reopening requires a new ADR that supersedes this one.

## References

- `.claude/context/stack.md` §"Data"
- ADR [#0001 (accepted)](../0001-v3-greenfield-rebuild.md) — initial stack selection
