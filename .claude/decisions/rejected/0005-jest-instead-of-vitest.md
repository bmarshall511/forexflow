---
id: rejected-0005
title: Use Jest instead of Vitest
status: rejected
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [stack, testing, rejected]
---

# rejected-0005 — Use Jest instead of Vitest

## Context

Jest is the default JS test runner for many projects. Carrying it forward would preserve the widely-known API (`describe`, `it`, `expect`, `jest.fn()`) without reinvention.

## Why rejected

1. **ESM-first.** The monorepo is pure ESM (`.mjs` configs, `type: "module"` in packages). Vitest runs ESM natively; Jest still requires transforms or `--experimental-vm-modules` for many cases. The friction compounds across `packages/*` with their shared tsconfig base.

2. **TypeScript execution without a build step.** Vitest uses Vite's transform pipeline, so `.ts` files run directly in tests. Jest requires `ts-jest` or Babel + a separate tsconfig. Another moving part to maintain across workspaces.

3. **Faster cold starts + watch cycles.** In a monorepo where `pnpm test` runs frequently and `pre-commit-continuous-green` gates commits on test success, Vitest's test startup is materially quicker. Over dozens of commits a day this matters.

4. **API-compatible with Jest.** `describe`/`it`/`expect` read identically. Contributor muscle memory transfers. Migration tax is near zero.

5. **Built-in coverage (v8) + UI + benchmark + in-source testing.** Vitest's surrounding tooling is a superset of what Jest+plugins provides, with one config file and no separate plugin-install matrix.

6. **Playwright coexistence.** Playwright has official Vitest integration (`@playwright/test` plays well with Vitest's test IDs and `--ui`). Jest integration exists but is secondary.

## Why it might have stayed Jest

- Maximum name recognition
- Existing third-party mocks/adapters (e.g., `jest-mock-extended`) have Vitest equivalents (`vitest-mock-extended`) but the Jest versions have longer release histories

Not enough to outweigh the ESM / TypeScript / speed arguments for a greenfield rebuild.

## When to reconsider

- A test scenario requires a library that ships only a Jest adapter and won't accept a Vitest PR
- Vitest's release cadence stalls materially

Reopening requires a new ADR that supersedes this one.

## References

- `.claude/context/stack.md` §"Testing"
- `.claude/rules/02-testing.md`
