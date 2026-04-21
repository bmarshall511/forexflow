---
id: REQ-<SCOPE>-<NNN>
title: One-line imperative description
status: draft
scope: <commit-scope>
owner: maintainer
created: YYYY-MM-DD
implemented: null
tests: []
code: []
related: []
---

# REQ-<SCOPE>-<NNN> — One-line imperative description

## Rationale

Why does this requirement exist? What user problem does it address? If this is not immediately obvious, two to three sentences of context. If it is obvious, one sentence.

## Acceptance criteria

Numbered, testable, and unambiguous. Each criterion becomes at least one test.

1. Given `<precondition>`, when `<action>`, then `<observable outcome>`.
2. ...

## Non-goals

What is explicitly **not** in scope for this requirement. Useful to prevent drift during implementation.

- ...
- ...

## Test plan

Test levels this requirement requires (per rule 02):

- **Unit** — `<target file>` with cases for `<list>`
- **Integration** — if the requirement crosses a module boundary
- **Contract** — if the requirement defines a typed contract between daemon and web
- **E2E (Playwright)** — if user-facing behavior
- **Visual regression** — if UI layout is part of the promise

## Implementation notes

Hints for the implementer. These are **not** binding constraints — they're the maintainer's current best guess at where it'll live.

- Likely file: `<path>`
- Likely primitive: `<shared/existing pattern>`
- Risks: `<list>`

## Changelog

- `YYYY-MM-DD` — drafted
- `YYYY-MM-DD` — accepted (placeholder; filled in on status transition)
- `YYYY-MM-DD` — implemented in commit `<sha>` (placeholder)
