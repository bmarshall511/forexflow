---
id: LRN-0003
observed_at: 2026-04-21
source: harness-fail
target:
  - test-harness/fixtures/structure-stale-refs.mjs
status: applied
outcome: Sub-phase 8 commit (forthcoming)
---

# LRN-0003 — Stale-refs fixture stripped `.md` / `.ts` extensions before resolving

## Observation

The `structure-stale-refs` fixture walks every markdown file under
`.claude/` and verifies in-body repo-path references resolve to real
files on disk.

Trailing punctuation stripping was too aggressive:

```js
const clean = candidate.replace(/[)"'`,.:]+$/, "");
```

The `.` character is in the strip-set to remove trailing sentence
periods after a cited path ("...see `docs/dev/GETTING_STARTED.md`.").
But markdown paths rarely appear with a trailing period, and the strip
was eating file extensions: `docs/dev/GETTING_STARTED.md` became
`docs/dev/GETTING_STARTED`, which then reported as missing even though
the `.md` file exists.

Compounding, the regex also matched bare prose fragments like
`scripts/dirs` (from "add the missing scripts/dirs that activate") —
false positives that aren't really paths.

## Proposed change

Two-part fix:

1. Remove `.` from the trailing-strip set so file extensions are
   preserved:
   ```js
   const clean = candidate.replace(/[)"'`,:]+$/, "");
   ```
2. Require the final path segment to include a dot (file extension)
   to count as a resolvable reference. Prose fragments whose tail
   segment is just a word ("dirs", "glossary") skip the resolution
   check:
   ```js
   const lastSeg = clean.split("/").pop() || "";
   if (!lastSeg.includes(".")) continue;
   ```

## Evidence

Harness output before fix (excerpt):

```
.claude/plans/phase-1.md: unresolved path "docs/dev/GETTING_STARTED"
.claude/rules/10-git-workflow.md: unresolved path "docs/claude/update-domain-glossary"
.claude/plans/phase-1.md: unresolved path "scripts/dirs"
```

All three were false positives:

- `docs/dev/GETTING_STARTED` — the `.md` had been stripped
- `docs/claude/update-domain-glossary` — a branch-name example, not a path
- `scripts/dirs` — prose fragment from "adds the missing scripts/dirs"

After the fix: zero unresolved.

## Rationale

A real path reference in our docs almost always ends in a file
extension (`.md`, `.ts`, `.mjs`, `.json`, `.yml`, etc.) or a trailing
slash. Bare directory words are usually category references or
prose. Requiring a dot in the tail segment eliminates the bulk of
false positives without sacrificing accuracy: if someone writes a
real directory path like `docs/requirements/` the trailing slash
check catches it (and that case is already handled separately).

## Impact

- Files touched: `.claude/test-harness/fixtures/structure-stale-refs.mjs`
- Version bump: none (fixture improvement)
- Risk: low — narrows the matcher, not broadens it. A real unresolved
  path without an extension would now be missed, but that's unusual
  in practice and the trade is worth it for the noise reduction
- Cursor parity regen needed: no

## Follow-ups

- [x] Fixture reruns green
- [x] Fix landed in Sub-phase 8

## Adjacent consideration

This class of bug (over-eager cleanup/normalization) is a pattern worth
watching for in other structural fixtures as they're added in later
phases. When in doubt, prefer "require the reference to clearly look
like a path" over "best-effort coerce anything that resembles one."
