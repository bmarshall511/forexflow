# Rules

Path-scoped rules that AI coding agents load when editing files matching their `scope` glob. Every rule has machine-readable frontmatter so the `meta-reviewer` agent, the `/stale-rules` skill, and the Cursor-parity generator can all reason about it programmatically.

## Frontmatter schema

Every rule file starts with YAML frontmatter in this shape:

```yaml
---
name: rule-slug                             # kebab-case; must match the filename minus prefix/ext
scope: ["**/*.ts", "**/*.tsx"]              # array of globs; empty array = applies everywhere
enforcement: strict                         # strict | advisory
version: 0.1.0                              # SemVer for this rule
related:                                    # files this rule cross-references
  - "hooks/pre-edit-no-any.mjs"
  - "agents/code-reviewer.md"
applies_when: "Editing TypeScript source"   # one-line human-readable trigger
---
```

Fields:

| Field | Required | Meaning |
|---|---|---|
| `name` | yes | Stable identifier; used in cross-references and telemetry |
| `scope` | yes | Globs (relative to repo root) that determine when the rule loads. Empty array = always-on |
| `enforcement` | yes | `strict` = a hook blocks violations; `advisory` = reviewer flags but does not block |
| `version` | yes | SemVer; bumped when the rule's substance changes |
| `related` | no | Files whose existence/content depends on this rule. Used by `/stale-rules` |
| `applies_when` | yes | Human-readable summary of the trigger condition |

## Rule catalog

| # | Rule | Scope | Enforcement |
|---|---|---|---|
| 00 | [foundation](./00-foundation.md) | all files | strict |
| 01 | [typescript](./01-typescript.md) | `**/*.{ts,tsx}` | strict |
| 02 | [testing](./02-testing.md) | `**/*.{ts,tsx}` | strict |
| 03 | [accessibility](./03-accessibility.md) | `apps/web/src/components/**`, `apps/web/src/app/**` | strict |
| 04 | [security](./04-security.md) | all files | strict |
| 05 | [performance](./05-performance.md) | `apps/**` | advisory |
| 06 | [monorepo-boundaries](./06-monorepo-boundaries.md) | all files | strict |
| 07 | [file-size](./07-file-size.md) | all source files | strict |
| 08 | [naming](./08-naming.md) | all source files | strict |
| 09 | [dependencies](./09-dependencies.md) | `**/package.json` | strict |
| 10 | [git-workflow](./10-git-workflow.md) | all commits | strict |
| 11 | [env-vars](./11-env-vars.md) | `apps/**`, `packages/**` | strict |
| 12 | [logging](./12-logging.md) | `apps/**` | strict |
| 13 | [documentation](./13-documentation.md) | all files | strict |
| 14 | [requirements-traceability](./14-requirements-traceability.md) | `apps/**`, `packages/**`, `**/*.test.{ts,tsx}` | strict |
| 15 | [trading-domain](./15-trading-domain.md) | trading-adjacent paths | strict (placeholder until code arrives) |

## Enforcement mechanics

When an agent is about to edit a file at path `P`:

1. The agent computes the set of rules whose `scope` matches `P`
2. It loads those rules into its working context
3. It proposes a change
4. The relevant `PreToolUse` hook(s) inspect the proposed change
5. If a `strict` rule is violated, the hook blocks with an explanation
6. If an `advisory` rule is violated, the agent (or reviewer) surfaces a warning but does not block

Strict rules are backed by a hook. Advisory rules are surfaced by reviewers (`code-reviewer`, `meta-reviewer`) but not write-time blockers.

## Changing a rule

Rule changes are not a free action. The workflow:

1. Edit the rule file
2. Bump its `version`
3. The `post-edit-meta-log` hook appends the diff summary to `.claude/CHANGELOG.md`
4. For non-trivial changes (enforcement flip, scope change, adding/removing a rule), write an ADR in `.claude/decisions/`
5. The `meta-reviewer` agent reviews the change
6. If the rule has a backing hook, confirm the hook still enforces the new text
7. Regenerate `.cursor/rules/` via `scripts/sync-ide-rules.mjs`

## Stale-reference detection

The `/stale-rules` skill validates:

- Every file listed in a rule's `related` field exists
- Every glob in `scope` matches at least one file (once code exists) — warning only, not an error
- Every rule referenced from another rule or agent exists
- Every `.cursor/rules/*.mdc` file has a corresponding `.claude/rules/*.md` source

Run it before every commit touching `.claude/rules/` (the `pre-commit-ide-parity` hook enforces this once installed).

## Rejected rule proposals

Rejected rule proposals live in `.claude/decisions/rejected/`. Before proposing a new rule, search there to avoid re-proposing something already decided against.
