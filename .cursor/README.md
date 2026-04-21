# `.cursor/` — Generated IDE artifacts

**Everything in this directory is generated.** Do not edit by hand.

## Source of truth

| Generated               | Source                      |
| ----------------------- | --------------------------- |
| `.cursor/rules/*.mdc`   | `.claude/rules/*.md`        |
| `.cursor/commands/*.md` | `.claude/skills/*/SKILL.md` |

The generator is [`scripts/sync-ide-rules.mjs`](../scripts/sync-ide-rules.mjs). Run it after any change to `.claude/rules/` or `.claude/skills/`:

```bash
node scripts/sync-ide-rules.mjs
```

The `pre-commit-ide-parity` hook blocks commits that change `.claude/rules/` without regenerating `.cursor/rules/`. The hook also refuses to commit if `.cursor/` contains orphan files (a generated file whose source was deleted).

## Why generate instead of hand-maintain

- Claude Code and Cursor use different frontmatter formats. Claude's rule frontmatter is `scope:` + `enforcement:` + `related:`; Cursor's MDC frontmatter is `description:` + `globs:` + `alwaysApply:`. Two formats, one semantic. The generator applies the mapping.
- Double-source drift is the most common rail rot. A generator makes it impossible.
- Contributors using Cursor don't need to learn `.claude/` internals — they read `.cursor/rules/` which Cursor auto-loads.
- A CI job (agent-config-drift workflow) runs the generator in `--check` mode on every PR, so drift can never land on `v3`.

See ADR [#0007](../.claude/decisions/) — to be written in Sub-phase 9 — for the full rationale.

## Running the parity validator

```bash
bash scripts/test-cursor-parity.sh
```

Exits 0 on parity; exits 1 with a drift report otherwise.

## If a Cursor user spots a Cursor-specific rule tweak needed

Do **not** edit `.cursor/rules/<name>.mdc`. Edit `.claude/rules/<name>.md` (or propose a rule-level change via ADR), then regenerate.

## Files Cursor manages per-user

Cursor writes some per-user state into `.cursor/` — notably `mcp.json`. That file is gitignored via `.gitignore`. The generated files (rules, commands) are committed; per-user state is not.
