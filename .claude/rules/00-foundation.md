---
name: foundation
scope: []
enforcement: strict
version: 0.1.0
related:
  - "CLAUDE.md"
  - "context/domain.md"
  - "context/conventions.md"
  - "agents/meta-reviewer.md"
applies_when: "Always. This is the baseline every other rule builds on."
---

# Foundation

The always-on rule. Everything else assumes these.

## 1. Plan before code

For any work beyond a trivial one-line fix, use `TodoWrite` to break the work into verifiable steps before writing a single file. The `pre-edit-plan-required` hook blocks new files over ~50 LOC when no planning has occurred in the session.

## 2. No guessing

If you do not know — about a file path, an API shape, a requirement, a convention — **stop and ask or investigate**. Do not invent. Do not "probably". A fabricated import or a hallucinated function wastes more time than the minute it takes to confirm.

When a piece of the system is not covered by any rule, any context file, or any existing code: that is the "unknown territory" signal. Stop. Ask the maintainer. Record the answer as an ADR. Update the relevant context or rule file. Then proceed.

## 3. Small surgical changes

Prefer the smallest change that solves the problem. No drive-by refactors. No "while I'm in here" cleanup. Each commit has a single, traceable intent.

If a change requires a refactor to happen first, do the refactor in a separate commit with its own justification. The reviewer agents will flag bundled refactors.

## 4. Respect the written plan

`.claude/plans/active.md` is the authoritative current task. Work advances sub-phase by sub-phase. No skipping ahead. No "I'll come back to Sub-phase 4's hooks later." If the plan is wrong, update the plan via an ADR — do not ignore it.

## 5. Never reference individuals

No names, handles, emails, or personal identifiers in any file this project produces. Not in code. Not in comments. Not in tests. Not in docs. Not in ADRs. Not in agent/rule/skill/hook files. Not in commit messages. Not in changelogs.

Use roles (`maintainer`, `contributor`, `owner`) or anonymous identifiers. The sole pragmatic exception is `.github/CODEOWNERS`, which GitHub's format requires — this exception is explicitly authorized by ADR and does not generalize.

A `pre-edit-no-personal-names` hook enforces this. The list of reserved identifiers lives in `.claude/config/reserved-identifiers.json` (gitignored).

## 6. Strict over advisory, always

Where a rule could plausibly be either strict or advisory, pick strict. The greenfield cost of strictness is measured in minutes; the cost of retrofitting enforcement onto a half-built codebase is measured in weeks. We are early. Be strict now.

An advisory rule that keeps getting violated should be promoted to strict, not left as a running warning.

## 7. Documentation is part of the change

Every change that alters externally-observable behavior updates documentation in the same commit. Not "I'll write docs after." Not "that's in a follow-up." Same commit. The `pre-commit-docs-sync` hook enforces this.

"Externally-observable" includes: module public API, exported type shapes, HTTP routes, WebSocket message types, environment variables, CLI flags, database columns visible to application code.

## 8. Tests are part of the change

Every implementation ships with its tests in the same commit. Exceptions carve-outs exist for purely presentational UI components (tested at the page level via Playwright) and thin glue code with no logic — these are defined in `02-testing.md`.

## 9. Verify before advancing

Each sub-phase ends with a verification step the maintainer executes. The agent does not advance to the next sub-phase autonomously. The maintainer types "next" — or equivalent — and the agent proceeds.

## 10. The `.claude/` configuration is not exempt

These rules apply to the agent-config directory itself. When editing a rule file, a hook file, a skill definition: the same standards of planning, testing (via the synthetic harness), and documentation (via `CHANGELOG.md` + ADRs) apply.

---

## Related reading

- `.claude/CLAUDE.md` — the non-negotiable list every session reads first
- `.claude/context/conventions.md` — naming, imports, commits, branches
- `.claude/context/domain.md` — what ForexFlow is
- `.claude/decisions/` — ADRs that explain why rules read the way they do
- `.claude/failure-modes.md` — when a rule has been violated before and what happened
