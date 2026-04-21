---
id: 0004
title: reserved-identifiers.json is per-user and gitignored
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [hooks, privacy, configuration]
---

# 0004 — reserved-identifiers.json is per-user and gitignored

## Context

Rule `00-foundation.md` §5 forbids referencing individuals (names,
handles, emails) in any app artifact. The `pre-edit-no-personal-names`
hook enforces this by matching against a list of reserved identifiers.

That list itself is a paradox: to block contributor "Alice" from being
committed, the hook must know "Alice" is a name to block. But storing
the literal string "Alice" in a committed file would itself violate the
rule on the first commit.

## Decision

1. The hook reads its blocklist from
   `.claude/config/reserved-identifiers.json` — **gitignored** and
   per-user.
2. An example template is committed at
   `.claude/config/reserved-identifiers.example.json` with an empty
   `identifiers` array. Contributors copy it to the real filename and
   populate locally.
3. The hook's `ALLOWED_PATHS` list (currently `.github/CODEOWNERS`
   only) is the **sole** place where handle references are permitted,
   and that allowance is itself narrowly scoped and documented in the
   rule.
4. If the JSON file is absent or empty, the hook no-ops — consistent
   with ADR #0002's fail-open posture.

## Consequences

### Positive

- The list of names to block can itself name individuals without
  violating the rule it enforces.
- Different contributors maintain different lists (e.g., different
  team affiliations). No central coordination needed.
- Adding or removing entries doesn't require a PR.

### Negative

- The hook's behavior depends on a file a reader can't inspect in
  the repo. Surprise factor for contributors encountering a block.
  Mitigated by the deny message referencing the config path and the
  rule.
- New contributors may commit a personal name before populating their
  local blocklist. First line of defense is the reviewer agents;
  second is the maintainer's blocklist on merge.

### Neutral

- The gitignore entry sits alongside the other per-user exclusions in
  `.gitignore` (already added in Sub-phase 1).

## Alternatives considered

- **Commit a hashed blocklist** (SHA-256 of each name) — rejected.
  Adds hashing complexity to the hook and names-as-hashes still leak
  information via rainbow-table lookups for any common name. Does
  not genuinely preserve the rule.
- **Hard-code the blocklist in the hook script** — rejected for the
  same reason as committing the plaintext list: names would land in
  version control.
- **Query a remote service** — rejected. Network-dependent hook is
  fragile and contrary to the "zero-dependency" hook principle.

## Follow-ups

- [ ] Sub-phase 8: test-harness fixture exercising both the empty-list
      (no-op) and populated-list (blocking) paths.
- [ ] `/contribute` skill (Sub-phase 6) reminds new teammates to copy
      `reserved-identifiers.example.json` → `reserved-identifiers.json`
      during onboarding.
- [ ] If the allow-list (currently only `.github/CODEOWNERS`) grows,
      each addition needs an ADR justifying why the exception is
      necessary.

## References

- `.claude/hooks/pre-edit-no-personal-names.mjs`
- `.claude/config/reserved-identifiers.example.json`
- `.claude/rules/00-foundation.md` §5
- `.gitignore` — `.claude/config/reserved-identifiers.json`
- ADR #0002
