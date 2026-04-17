---
name: verify
description: Run full repo verification (lint, typecheck, test, security, diff review) and fix failures.
disable-model-invocation: true
---

# Verify

Run comprehensive verification across the entire monorepo with a structured pass/fail report.

## Phases

### Phase 1 — Lint

```bash
pnpm lint
```

If failures: fix the root cause, re-run until clean.

### Phase 2 — Type Check

```bash
pnpm typecheck
```

If failures: fix type errors, re-run until clean.

### Phase 3 — Tests

```bash
pnpm test
```

If failures: fix failing tests, re-run until clean.

### Phase 4 — Format

```bash
pnpm format:check
```

If failures: run `pnpm format` to auto-fix, then re-check.

### Phase 5 — Security Scan

Run these checks manually (grep/glob — no external tools needed):

1. **Hardcoded secrets**: Search all staged/modified `.ts`, `.tsx`, `.js` files for patterns:
   - API keys: `OANDA_API_KEY`, `OANDA_TOKEN`, `FRED_API_KEY`, `ALPHA_VANTAGE_KEY`, `ANTHROPIC_API_KEY`
   - Literal key patterns: strings matching `/[A-Za-z0-9]{32,}/` near `key`, `token`, `secret`, `password` assignments
   - `.env` references hardcoded as string literals (not `process.env.*`)

2. **Console.log in production code**: Search `apps/` and `packages/` for `console.log(` — flag any not inside test files (`*.test.*`, `*.spec.*`) or explicitly marked `// keep: debug`.

3. **Webhook token exposure**: Check that CF Worker webhook tokens are never logged or returned in responses.

4. **OANDA credentials**: Verify `packages/db/src/encryption.ts` is used for all credential storage — no plaintext API keys in DB service files.

If any findings: report them with file paths and line numbers. Fix critical issues (hardcoded secrets) immediately. Flag console.log instances for review.

### Phase 6 — Diff Review

If there are uncommitted changes (staged or unstaged):

1. Run `git diff --stat` to see scope of changes
2. Review changes against FXFlow rules:
   - **Import boundaries**: No cross-app imports, packages don't import apps
   - **File size**: Components ≤150 LOC, services ≤300 LOC
   - **Trading domain**: Source/metadata pattern respected, OANDA as repository
   - **Accessibility**: New UI components have proper ARIA, keyboard nav, focus management
3. Flag any violations with file path and specific concern

### Report

After all phases complete, output a structured report:

```
## Verification Report

| Phase          | Status |
|----------------|--------|
| Lint           | ✅/❌  |
| Type Check     | ✅/❌  |
| Tests          | ✅/❌  |
| Format         | ✅/❌  |
| Security Scan  | ✅/❌  |
| Diff Review    | ✅/❌  |

**Verdict: READY / NOT READY**

### Findings (if any)
- [severity] description (file:line)
```

Only report "READY" when ALL phases pass with zero findings.
