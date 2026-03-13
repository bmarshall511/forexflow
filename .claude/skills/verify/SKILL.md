---
name: verify
description: Run full repo verification (lint, typecheck, test) and fix failures.
disable-model-invocation: true
---

# Verify

Run verification across the entire monorepo.

## Steps

1. From repo root, detect available scripts:
   - `pnpm lint` (ESLint across workspaces)
   - `pnpm typecheck` (TypeScript across workspaces)
   - `pnpm test` (Vitest across workspaces)
   - `pnpm format:check` (Prettier)

2. Run all checks sequentially:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm format:check
   ```

3. If any fail:
   - Fix the smallest root cause
   - Re-run only the failing step(s)
   - Repeat until all pass

4. Report:
   - Commands run with pass/fail status
   - What was fixed (if anything)
   - Any remaining issues
