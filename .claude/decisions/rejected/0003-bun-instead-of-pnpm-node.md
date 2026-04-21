---
id: rejected-0003
title: Use Bun instead of Node + pnpm
status: rejected
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [stack, toolchain, rejected]
---

# rejected-0003 — Use Bun instead of Node + pnpm

## Context

Bun offers fast installs, a built-in test runner, TypeScript execution without a build step, and a bundler in one binary. For a greenfield repo, it's tempting to start there and avoid the split toolchain.

## Why rejected

1. **Prisma support is incomplete.** Prisma's engine binary and code-generation path assume Node semantics. Bun can run it in many cases, but edge cases (engine resolution, binary paths after install) still produce intermittent failures that an application team should not be debugging. When the database layer is load-bearing, toolchain uncertainty there is a product risk.

2. **Electron bundling.** Electron ships Node — the desktop app's packaged daemon runs under Node-the-runtime regardless of what we develop against. Developing against Bun and shipping against Node creates a dev/prod divergence in subtle places (crypto, streams, worker threads, fs events) that would surface late.

3. **CF Worker testing.** `wrangler` (Cloudflare's local Worker runtime) is firmly Node-first. Bun compatibility exists but is not guaranteed.

4. **Vitest over Bun's built-in runner.** The Vitest ecosystem (vitest-mock-extended, @vitest/coverage-v8, @vitest/ui, Playwright integration) is deeper. Bun's runner is fast but less integrated with the rest of the stack the project has chosen.

5. **pnpm's workspace story is proven.** pnpm catalog (rule 09), workspace protocol for internal packages, and content-addressable store all work cleanly across Electron-packaging and CF Worker deployment. Bun's workspaces are functional but younger.

## When to reconsider

- Prisma ships official Bun support with parity for `migrate`/`generate`/adapter-libsql
- Electron ships a path to package a Bun runtime instead of Node
- Wrangler adds a Bun target

Reopening requires a new ADR that supersedes this one.

## References

- `.claude/context/stack.md` §"Toolchain"
- `mise.toml` — pinned toolchain
