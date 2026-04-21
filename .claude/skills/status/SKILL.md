---
name: status
description: One-command health dashboard of the entire .claude/ system — phase, rules, hooks, agents, skills, requirements coverage, cost
disable-model-invocation: true
args: []
dispatches: []
version: 0.1.0
---

# /status

Report a concise dashboard of the `.claude/` system's own health plus current project state. Fast, cheap, deterministic.

## When to run

- First thing after opening a session in a new context
- Before `/phase-complete`
- When you suspect drift

## Procedure

1. **Read `.claude/plans/active.md`** — resolve the symlink, extract the current phase + current sub-phase status
2. **Read `.claude/VERSION`**
3. **Count** `.claude/rules/*.md`, `.claude/hooks/*.mjs`, `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `.claude/decisions/*.md`
4. **Check** each hook file has a matching entry in `.claude/settings.json` — report count of wired vs. unwired
5. **Check** `.claude/config/*.json` files parse valid JSON
6. **Check** `docs/requirements/index.md` exists; if so, count requirements by status (`draft`, `accepted`, `implemented`, `deprecated`, `rejected`)
7. **Git state**: current branch, staged count, unstaged count, ahead/behind against origin
8. **Last verified dates** across `**/CLAUDE.md` files — count how many are >30 days stale
9. **Telemetry peek** — sum this-month cost entries from `.claude/telemetry/` if files exist
10. **Assemble report**

## Output shape

```markdown
# ForexFlow Status

**Phase:** 1 — AI Agent Configuration
**Sub-phase status:** 1–5 committed · 6 pending
**Agent config version:** 0.1.0

## Repo

- Branch: `v3`
- Staged: 0 files · Unstaged: 0 files
- Ahead of `origin/v3`: 2 commits · Behind: 0

## .claude/ tree

| Component        | Count | Wired / valid             |
| ---------------- | ----- | ------------------------- |
| Rules            | 16    | 16 valid frontmatter      |
| Hooks            | 17    | 17 wired in settings.json |
| Agents           | 13    | 13 valid frontmatter      |
| Skills           | N     | N valid                   |
| Decisions (ADRs) | 5     | —                         |
| Config files     | 4     | 4 valid JSON              |

## Requirements

- Directory: `docs/requirements/` — present / absent
- By status: draft N · accepted N · implemented N · deprecated N · rejected N
- Orphans: N (code files without @req)

## Last-verified freshness

- CLAUDE.md files: N
- Stale (>30 days): N
- (list any that are stale)

## Cost (this month)

- Total: $X.XX
- By agent:
  - code-reviewer: $...
  - security-reviewer: $...
  - ...

## Notes

- Any component that failed validation appears here with a pointer to
  the skill that can fix it (e.g., `/stale-rules`, `/doc-check`)
```

## Failure mode

If something is misconfigured (unwired hook, invalid JSON, missing directory), the report lists it in the "Notes" section. This skill is diagnostic; it does not fix.

## Exit

Prints the report. Exits.
