---
name: doc-check
description: Docs ↔ code drift audit — dispatches docs-syncer; patches or flags stale per-package CLAUDE.md, API docs, requirements index
disable-model-invocation: false
model: sonnet
args:
  - name: range
    type: string
    required: false
    description: "Git range to scan (default: staged, else HEAD~1..HEAD)"
dispatches: [docs-syncer]
version: 0.1.0
---

# /doc-check

Audits and patches documentation to match the current code surface. Backs the `pre-commit-docs-sync` hook: when that hook surfaces a missing-doc-update complaint, this skill is the fix path.

## When to run

- Before every commit that changes `CLAUDE.md`-documented surfaces (exports, routes, schemas, WebSocket types, env vars)
- Before `/phase-complete` (mandatory)
- On the weekly agent-config-drift workflow
- When `/status` flags stale `Last verified:` dates

## Procedure

1. Resolve the scope (arg → staged → `HEAD~1..HEAD`)
2. Dispatch `docs-syncer` with the scope
3. Review the agent's output:
   - **SYNCED** — every relevant doc already matches. Bump `Last verified:` dates where confirmed current
   - **PATCH_PROPOSED** — review the proposed diffs, apply or amend
   - **STALE_FLAGGED** — broken references that the current change didn't cause. Schedule a follow-up task; do not let unrelated rot block the current commit
4. Re-run `/stale-rules` afterward to catch any path reference the patch introduced

## Output shape

```markdown
# /doc-check result — <scope>

## Verdict: SYNCED | PATCH_PROPOSED | STALE_FLAGGED

## Docs touched

| Doc    | Action               | Reason            |
| ------ | -------------------- | ----------------- |
| <path> | patched              | <reason>          |
| <path> | Last verified bumped | no content change |

## Patches applied

<diff excerpts>

## Stale flagged (separately scheduled)

- <doc>:<section> — <what's stale> — suggested follow-up

## Next step

- If SYNCED: commit docs updates alongside the code change
- If PATCH_PROPOSED: review the proposed diff, apply `docs-syncer`
  patches, re-run to verify
- If STALE_FLAGGED: capture the follow-up as a requirement or task;
  current commit can proceed if the stale item is out of scope
```

## Time / cost

Sonnet-tier. Typical 1–3 tool calls per affected doc. A full-tree audit (via `/phase-complete`) may hit the time-box — in that case the agent returns `PATCH_PROPOSED` with the top N items.
