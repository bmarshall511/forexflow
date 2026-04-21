---
id: LRN-0004
observed_at: 2026-04-21
source: correction
target:
  - .claude/settings.json
  - .claude/settings.local.example.json
status: applied
outcome: Sub-phase 4 cleanup commit (early in the sub-phase)
---

# LRN-0004 — Claude Code rejects `_comment` keys inside `hooks`

## Observation

Sub-phase 4 seeded `.claude/settings.json` with `_comment` keys intended
as inline documentation:

```json
"hooks": {
  "_comment": "Hook scripts are added in Sub-phase 4. ..."
}
```

Claude Code v2.1.42 surfaced:

> Settings Error
> /.../.claude/settings.json
> └ hooks
> └ \_comment: Invalid key in record
>
> Files with errors are skipped entirely, not just the invalid settings.

The whole `settings.json` was therefore ignored. The schema validates
`hooks` to a known set of event keys (`PreToolUse`, `PostToolUse`,
`UserPromptSubmit`, `Stop`); `_comment` is not a valid event name.

Additional `_comment`, `_comment_env`, `_comment_permissions` keys at
the root and inside `env`/`permissions` of `settings.local.example.json`
were also removed as a precaution.

## Proposed change

Remove every `_comment*` key from `settings.json` and the example
local-settings file. Move inline documentation into adjacent README /
markdown files (e.g., `.claude/hooks/README.md` covers hook wiring;
`.claude/settings.local.example.json` carries a `$schema` field instead
of prose keys).

## Evidence

- Error message quoted above, reproduced in a live session
- After removing `_comment` from `hooks`, `settings.json` loaded cleanly
- Sub-phase 4's hook wiring otherwise worked as designed

## Rationale

Standards-compliant JSON doesn't support comments; `_comment`-as-key is
a common workaround, but it only works when the consuming schema is
permissive about extra properties. Claude Code's schema is strict for
the `hooks` subtree (it has to be, to validate event names against a
closed enum). Keep the inline-comment pattern to files whose parsers
we control; for Claude Code settings, rely on external docs.

## Impact

- Files touched: `.claude/settings.json`, `.claude/settings.local.example.json`
- Version bump: none (fix, not feature)
- Risk: none — removed keys were never consumed; docs still live in
  `.claude/hooks/README.md` and equivalents
- Cursor parity regen needed: no (settings aren't mirrored to Cursor)

## Follow-ups

- [x] Removed during Sub-phase 4
- [ ] Consider a structural fixture that validates `.claude/settings.json`
      against the Claude Code schema (would catch this class of error at
      harness time rather than runtime). Defer to Sub-phase 11 CI work —
      the claude-config workflow is the natural home for this check.
