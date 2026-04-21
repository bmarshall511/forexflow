---
id: LRN-0001
observed_at: 2026-04-21
source: harness-fail
target:
  - hooks/pre-edit-no-any.mjs
status: applied
outcome: Sub-phase 8 commit (forthcoming)
---

# LRN-0001 — `pre-edit-no-any` regex rejected the most common `: any` case

## Observation

The `pre-edit-no-any` hook's original regex was:

```js
{ re: /(^|[^a-zA-Z0-9_])(:\s*any)\b/g, label: ": any" },
```

The `[^a-zA-Z0-9_]` lookbehind required a non-identifier character
immediately before the `:`. In practice, `: any` almost always appears
_after_ an identifier (`param: any`, `const x: any`, etc.). So the hook
never caught the standard case. `.claude/test-harness/fixtures/hook-no-any.mjs`
surfaced this immediately on its first run against
`export function danger(x: any) { return x }`.

## Proposed change

Drop the lookbehind entirely; rely on the existing `stripStrings` and
`isComment` pre-filters to avoid false positives inside quoted strings
and comments.

```js
{ re: /:\s*any\b/g, label: ": any" },
{ re: /\bas\s+any\b/g, label: "as any" },
{ re: /(<any>|<\s*any\s*>)/g, label: "<any>" },
{ re: /\bany\[\]/g, label: "any[]" },
```

## Evidence

- Harness fixture `hook-no-any.mjs` reported:
  `unjustified any decision: expected "deny", got null`
- Manual invocation confirmed: `export function danger(x: any)` produced
  exit 0 with no deny response before the fix; deny after.
- The `as any` pattern had a related issue (`[^a-zA-Z0-9_]` before `as`)
  fixed in the same commit.

## Rationale

The original lookbehind looked like it was trying to avoid matching
inside identifiers (e.g., `Map<string, any>`), but the `\b` word
boundary at the end of `any` already handles that. `stripStrings`
handles string false-positives; `isComment` handles comment lines. The
lookbehind was adding no value and removing the primary-case coverage.

## Impact

- Files touched: `.claude/hooks/pre-edit-no-any.mjs`
- No rule file changed; behavior-preserving from the rule's perspective
  (the rule was always about `: any` with/without `TODO` — the hook
  just wasn't enforcing it)
- Version bump: none (patch-level hook fix)
- Risk: low — `stripStrings` keeps string-internal `: any` from
  matching; comment-line filter unchanged
- Cursor parity regen needed: no

## Follow-ups

- [x] meta-reviewer equivalent: harness fixture `hook-no-any.mjs` now
      covers both the denied and TODO-justified paths
- [x] Landed in Sub-phase 8 hook-regex fix commit
- [x] Harness fixture confirms the fix stays fixed
