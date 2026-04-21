---
name: dep-upgrade
description: Evaluate a dependency bump via the dep-upgrade agent — read changelog, verify types + tests, auto-approve patch, flag minor/major
disable-model-invocation: false
model: sonnet
args:
  - name: package
    type: string
    required: false
    description: "Package name to evaluate; default: the dep change in the current Renovate/Dependabot PR branch"
dispatches: [dep-upgrade, code-reviewer]
version: 0.1.0
---

# /dep-upgrade

Dependency-bump evaluator. Dispatches the `dep-upgrade` agent, relays the verdict, and — for `AUTO_APPROVE` — moves the PR toward merge.

## When to run

- Renovate / Dependabot PR auto-validation (CI workflow dispatches this)
- Manual evaluation of a specific package bump
- Security-tagged updates (treat as higher priority)

## Procedure

1. **Resolve the bump** (package, old range, new range) from:
   - Explicit `package` arg + the current PR branch
   - Else the Renovate PR the current branch is on
   - Else error — nothing to evaluate
2. **Dispatch `dep-upgrade` agent** with the resolved bump
3. **Relay the verdict**:
   - `AUTO_APPROVE` — procedural pass. Ready to merge
   - `NEEDS_REVIEW` — surface migration notes and affected consumers for the maintainer
   - `REJECT` — surface the reason (license, removed API, abandonment); close the PR with a comment
4. **For AUTO_APPROVE** on a security-tagged bump, mark the output with a `SECURITY` tag so CI can prioritize

## Output shape

```markdown
# /dep-upgrade result — <package> <old>→<new>

## Verdict: AUTO_APPROVE | NEEDS_REVIEW | REJECT

**Bump type:** patch | minor | major
**Security-tagged:** yes / no

## Release notes summary

<1–3 bullets>

## Verification

| Check        | Result           |
| ------------ | ---------------- |
| pnpm install | ✓                |
| typecheck    | ✓                |
| test         | ✓                |
| lint         | ✓                |
| bundle delta | +0.4 KB / n/a    |
| license      | MIT (acceptable) |

## Breaking notes (if any)

- <upstream-breaking-change> — affects: <files/lines>

## Migration notes (NEEDS_REVIEW only)

1. <concrete step>
2. ...

## Reject reason (REJECT only)

<one-line reason>

## Next step

- AUTO_APPROVE: merge PR; CI continues as normal
- NEEDS_REVIEW: share migration notes with the implementer; they apply,
  re-dispatch /review before merge
- REJECT: close PR with the reason; maintainer decides whether to
  pin the old version
```

## Time / cost

Sonnet-tier, 5-minute time-box. A well-behaved patch bump is under a minute; majors with consumer audits may hit the time-box and return partial with a scope narrowing.
