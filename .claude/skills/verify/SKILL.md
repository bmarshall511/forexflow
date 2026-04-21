---
name: verify
description: Full preflight — format, lint, typecheck, test, secret scan, diff review. Mirror of CI. Run before every commit of real work.
disable-model-invocation: true
args:
  - name: scope
    type: string
    required: false
    description: "Optional workspace filter, e.g. @forexflow/shared"
dispatches: []
version: 0.1.0
---

# /verify

Local CI mirror. Runs the full preflight chain and reports pass/fail for each phase. If green, the commit is safe to make. If red, do not bypass — fix the underlying issue.

## When to run

- Before any commit of real work (mandatory for `feat`, `fix`, `perf` commits)
- Before pushing a branch
- Before requesting code review from another contributor
- After pulling `v3` if the pull brought in non-trivial changes
- When `/status` flags stale verification

## Procedure

Run these in order. Fail fast (stop at the first failure) unless `--continue` is passed.

### Phase 1 — format

```bash
pnpm format:check        # or fall back to: pnpm prettier --check .
```

If it fails: run `pnpm format` (or `pnpm prettier --write .`) and re-stage.

### Phase 2 — lint

```bash
pnpm lint
```

If it fails: fix the root cause. Do not silence the lint. If the rule itself is wrong for the case, propose an ESLint config change via ADR.

### Phase 3 — typecheck

```bash
pnpm typecheck
```

If it fails: fix the types. Do not add `any` (rule 01). Do not add `@ts-ignore` / `@ts-nocheck`.

### Phase 4 — test

```bash
pnpm test
```

If it fails: do not commit. Fix the test or the code. Flaky tests are a ship-blocker per rule 02.

### Phase 5 — security (manual scan; gitleaks when available)

- `gitleaks detect --no-banner --redact` if gitleaks is installed
- Fallback: grep the working tree for secret patterns listed in
  `.claude/hooks/pre-commit-secrets-scan.mjs`:
  - Anthropic, OpenAI, AWS, GitHub, Slack, Cloudflare token shapes
  - "-----BEGIN ... PRIVATE KEY-----" blocks
  - Generic high-entropy assignments (`api_key = "..."`)

### Phase 6 — diff review

If `git diff --cached` is non-empty:

```
- Run `/review` (dispatches code-reviewer + integration-reviewer)
- Run `/security-review` (dispatches security-reviewer)
- Review the verdict set; do not proceed on BLOCK / FAIL / BREAKING
```

### Phase 7 — meta checks

- `/stale-rules` — zero stale references
- `/doc-check` — no drift from code
- `/trace --coverage` — requirements coverage within threshold (once
  requirements scaffolding exists)

## Bootstrap tolerance

Phases that depend on infrastructure that doesn't exist yet (per ADR #0002 fail-open posture) report "N/A — infrastructure not present" and move on. Specifically:

- Phases 2–4 no-op during Phase 1 (no `package.json` scripts yet)
- `/trace --coverage` no-ops until `docs/requirements/` exists
- Secret scan always runs (regex fallback; no install requirement)

## Output shape

```markdown
# /verify result

| Phase       | Status                        | Notes                    |
| ----------- | ----------------------------- | ------------------------ |
| Format      | ✓ PASS / ✗ FAIL / N/A         | <details if fail or N/A> |
| Lint        | ✓ / ✗ / N/A                   | ...                      |
| Typecheck   | ✓ / ✗ / N/A                   | ...                      |
| Test        | ✓ / ✗ / N/A                   | ...                      |
| Secret scan | ✓ / ⚠ potentially flagged / ✗ | ...                      |
| Diff review | ✓ / ⚠ WARNING / ✗ BLOCK       | ...                      |
| Meta checks | ✓ / ⚠ / N/A                   | ...                      |

## Summary

<one-line summary>

**Verdict: READY TO COMMIT | FIX REQUIRED**

## Fix queue (when not ready)

1. <specific fix for phase N>
2. <specific fix for phase M>

## Commands to rerun after fixing

<the minimum command sequence>
```

## Verdict logic

- **READY TO COMMIT** — every phase PASS or N/A, no WARNING/BLOCK from reviewers
- **FIX REQUIRED** — any FAIL or BLOCK. Work through the fix queue in order

## What you do NOT do

- Auto-fix without showing the diff (format phase can auto-run, but the resulting diff is surfaced in the report)
- Skip phases silently
- Accept a "I'll fix tests next commit" path — continuous-green invariant per rule 10
- Bypass with `--no-verify` on git commit/push. Ever.

## Time / cost

Procedural; no model cost. Total wall-clock typically 30–120 seconds depending on repo size. During Phase 1 (no app code yet), under 5 seconds.

## Exit

Prints the report. Exits 0 on READY, exits 1 on FIX REQUIRED so CI-integrated callers can detect the outcome.
