<!--
Thanks for contributing to ForexFlow. Every section below is required.
Pull requests with an empty or "N/A" section will be closed as needing more detail.
-->

## Summary

<!-- One or two sentences: what does this change and why? -->

## Linked requirement

<!--
Every non-trivial change traces to a requirement in docs/requirements/.
Format: REQ-<SCOPE>-<NUMBER>. Example: REQ-TRADING-014.
If this is a bug fix, link the issue or the failure-mode entry instead.
-->

- Requirement: `REQ-XXX-###` (or issue: `#123`)

## Changes

<!-- Bulleted list of the material changes. Skip the trivia. -->

-
-

## Test evidence

<!--
Describe how the change was verified. Check every box that applies.
"I ran it locally" is not sufficient on its own.
-->

- [ ] Unit tests added or updated
- [ ] Integration tests added or updated
- [ ] Playwright end-to-end test added or updated (required for any `apps/web/**` UI change)
- [ ] Contract test added or updated (if API surface changed)
- [ ] Manual verification notes below

**Manual verification:**

<!-- Steps performed to confirm the change works end-to-end. -->

## Security considerations

<!--
What security impact does this change have?
- Does it touch authentication, authorization, or session handling?
- Does it introduce new external inputs that need validation?
- Does it store, transmit, or log credentials?
- Could this change affect the webhook attack surface?
Write "None" only after you've actually thought about it.
-->

## Accessibility

<!-- Required for any UI change. Mark "N/A" only for non-UI PRs. -->

- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Touch targets meet 44x44px minimum
- [ ] Respects `prefers-reduced-motion`
- [ ] No color-only meaning

## Documentation

<!-- The pre-commit docs-sync hook will remind you if something is missing. -->

- [ ] `CLAUDE.md` files updated for any module whose behavior changed
- [ ] `docs/requirements/` updated if this is a new feature
- [ ] JSDoc on every new exported symbol
- [ ] No `v3` or "FXFlow" references in user-facing copy (use "ForexFlow")

## Agent invocation log

<!--
If you used Claude Code or Cursor agents to produce this change,
briefly list which agents or skills were invoked.
This helps reviewers understand the provenance.
-->

- Example: `/review`, `/security-review`, `test-writer` agent

## Checklist

- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] No personal names, emails, or identifying handles in code, comments, tests, or docs
- [ ] No `any` in TypeScript (or has `// TODO(type):` with reason)
- [ ] Preflight passes locally
- [ ] Branch is up to date with `v3`
