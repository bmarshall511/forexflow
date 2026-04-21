---
id: LRN-0002
observed_at: 2026-04-21
source: harness-fail
target:
  - hooks/pre-commit-requirements-sync.mjs
status: applied
outcome: Sub-phase 8 commit (forthcoming)
---

# LRN-0002 — `-m` commit-message regex required no whitespace before the quote

## Observation

The `pre-commit-requirements-sync` hook needs to extract the commit
message text out of a `git commit -m "..."` bash command to decide
whether the commit type is `feat|fix|perf`.

The original regex was:

```js
/\s-(?:m|-message(?:=|\s+))(?:'([\s\S]*?)'|"([\s\S]*?)"|(\S+))/;
```

For inputs like `git commit -m "feat(shared): b"`, the `-m` branch
matched the `m` literal, then tried to match the quoted message — but
had no `\s+` between `m` and the quote. Result: no match, no extracted
message, commit type inferred as empty, hook fell through to allow.
The `--message` branch handled whitespace correctly; the `-m` short
form did not.

The harness fixture `hook-requirements-sync.mjs` surfaced this on
the Case B test (feat commit with no `@req` tag). Expected deny, got
allow.

## Proposed change

Make the `-m` branch explicitly consume trailing whitespace:

```js
/\s-(?:m\s+|-message(?:=|\s+))(?:'([\s\S]*?)'|"([\s\S]*?)"|(\S+))/;
```

## Evidence

- Harness fixture `hook-requirements-sync.mjs` reported:
  `feat without @req → deny: expected "deny", got null`
- Manual repro: `echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat(x): y\""}}' | node .claude/hooks/pre-commit-requirements-sync.mjs`
  returned exit 0 with no deny before the fix, deny after.

## Rationale

The intent of the original regex was clearly to support both `-m "..."`
and `--message "..."` / `--message=...`. The author handled the
long-form's whitespace with `(?:=|\s+)` after `-message`, but
accidentally omitted the analog after the short-form `m`. A one-word
fix restores the intent.

## Impact

- Files touched: `.claude/hooks/pre-commit-requirements-sync.mjs`
- Version bump: none
- Risk: low — the regex becomes stricter, not looser; any input that
  matched before still matches now (the space was always there in valid
  commands)
- Cursor parity regen needed: no

## Follow-ups

- [x] Harness fixture now covers this case
- [x] Fix landed in Sub-phase 8

## Adjacent consideration

The `heredoc` branch (`<<EOF`) and the `-F/--file` branch were not
affected, but a sibling harness fixture covering those two branches
would harden the hook further. Noted as a potential follow-up fixture,
not required.
