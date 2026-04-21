# Rejected Proposals

Ideas considered and explicitly decided against, with enough rationale that future sessions don't re-propose them.

Before proposing a new tool, pattern, or architectural change, search here. If what you're about to suggest is already on this list, read the rejection reason — the reason may still apply, or the landscape may have changed enough to warrant superseding.

## Format

Same ADR template as `.claude/decisions/_template.md`, with `status: rejected` and a prominent "Why rejected" section. Filename: `NNNN-<kebab-slug>.md`, numbering independent from accepted ADRs.

## Index

| #             | Title                                                            | Rejected   | Reason summary                                                                                                             |
| ------------- | ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| rejected-0001 | [Drizzle instead of Prisma](./0001-drizzle-instead-of-prisma.md) | 2026-04-21 | Prisma's migrate-diff, libsql adapter, and agent tooling are load-bearing; Drizzle benefits don't move the product forward |
| rejected-0002 | [Tauri instead of Electron](./0002-tauri-instead-of-electron.md) | 2026-04-21 | Daemon is Node-ecosystem-heavy; WebKit divergence from Chromium for the web app; Electron's packaging is proven            |
| rejected-0003 | [Bun instead of Node + pnpm](./0003-bun-instead-of-pnpm-node.md) | 2026-04-21 | Prisma / Electron / wrangler are Node-first; dev/prod divergence risk not worth the install-speed win                      |
| rejected-0004 | [Express instead of Hono](./0004-express-instead-of-hono.md)     | 2026-04-21 | Hono's Zod-validator matches rule 04 natively; smaller cold start; shared Request/Response model with CF Worker            |
| rejected-0005 | [Jest instead of Vitest](./0005-jest-instead-of-vitest.md)       | 2026-04-21 | Vitest is ESM-native, TS-runs-directly, faster, API-compatible; migration tax near zero                                    |
