---
name: file-size
scope: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
enforcement: strict
version: 0.1.0
related:
  - "hooks/pre-edit-size-guard.mjs"
  - "agents/refactor-planner.md"
  - "skills/refactor/SKILL.md"
applies_when: "Any TypeScript file is added or modified"
---

# File Size

Small files force clean boundaries. A file that wants to be 600 lines usually wants to be three files that each have a clear responsibility. Limits are enforced at write time.

## Limits

| File class | Path pattern (examples) | Limit | Notes |
|---|---|---|---|
| React components | `apps/web/src/components/**/*.tsx` | **150 LOC** | Split a component by responsibility (container/presenter, subviews), not by mechanical chunking |
| React hooks | `apps/web/src/hooks/*.ts` | **200 LOC** | A hook over 200 lines usually has multiple responsibilities |
| Utility modules | `packages/shared/src/**/*.ts` (non-trading-core) | **200 LOC** | |
| Trading-core primitives | `packages/shared/src/trading-core/**/*.ts` | **300 LOC** | Trading logic can be dense; still split when it exceeds |
| DB service files | `packages/db/src/*-service.ts` | **300 LOC** | One domain per file; split domains if one service grows too large |
| API route handlers | `apps/web/src/app/api/**/route.ts` | **250 LOC** | Delegate to services; routes should be thin |
| Daemon subsystems | `apps/daemon/src/<subsystem>/*.ts` | **400 LOC** | Orchestration files (index, server) allowed up to 500 with explicit ADR |
| CF Worker files | `apps/cf-worker/src/*.ts` | **300 LOC** | |
| Electron main files | `apps/desktop/src/main/*.ts` | **300 LOC** | |
| MCP server tool files | `apps/mcp-server/src/tools/*.ts` | **200 LOC** | |
| Type contracts | `packages/types/src/**/*.ts` | **400 LOC** | Prefer one file per domain; a single 4000-line types file is a smell |
| Test files | `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | **500 LOC** | Tests can be verbose; if they exceed, the subject probably needs splitting too |
| Config / schema / migrations | `**/*.config.{ts,mjs}`, `**/*.prisma`, `packages/db/prisma/migrations/**` | **no limit** | Configuration files are what they are |
| Generated code | `**/generated/**`, `**/*.d.ts` emitted by build | **no limit** | |

"LOC" = source lines, including comments and blank lines, excluding the frontmatter for `.md` files and excluding auto-generated import blocks.

## Enforcement

The `pre-edit-size-guard` hook:

1. Computes the resulting file length after the proposed `Write` or `Edit`
2. Looks up the limit for the file's path
3. Blocks the write if the result exceeds the limit
4. Error message includes the limit, the projected size, and a suggestion to invoke `/refactor`

## Overrides

There are legitimate exceptions. The process:

1. Write an ADR under `.claude/decisions/` titled `<number>-file-size-exception-<path>.md`
2. The ADR explains: what the file is, why the limit is the wrong answer, what the agreed new limit is, and what invariants keep it from growing further
3. Add the file path + new limit to `.claude/config/size-exceptions.json` (source of truth for the hook's overrides)
4. The `meta-reviewer` agent reviews the ADR before the override lands

Exceptions are case-by-case. A blanket "just raise all the limits" is not an acceptable outcome.

## When a file hits its limit

Do not work around by:

- Extracting one function to a helper file just to dodge the count
- Moving constants to a separate file while the real bulk stays
- Reducing comments or blank lines

Do refactor the file by responsibility:

- Container (state, effects, callbacks) → `<name>.tsx`
- Presentation (markup) → `<name>-view.tsx` (or multiple sub-views)
- Pure helpers → `<name>-utils.ts`
- Types specific to this module → `<name>-types.ts` (only if types are nontrivial; otherwise inline)
- Constants → inline in the file that uses them, or a `<name>-constants.ts` if used elsewhere

The `/refactor` skill dispatches the `refactor-planner` agent, which proposes the split before any code moves. Review its proposal before accepting.

## Why these numbers

The limits are empirical, not dogmatic. They are set at the level where a reader can hold the whole file in their head on first read. They are not a mechanism to maximize file count; they are a mechanism to force responsibility boundaries.

A file under the limit can still be badly structured. A file that hits the limit is a trigger to consider structure, not just to split.

## Limits for `.claude/` itself

Yes — the agent configuration is subject to limits too:

| Artifact | Limit | Notes |
|---|---|---|
| Rule file (`.claude/rules/*.md`) | **400 LOC** | Long rules are usually multiple rules masquerading as one. Split by scope |
| Agent definition (`.claude/agents/*.md`) | **250 LOC** | An agent prompt over 250 lines is probably trying to be two agents |
| Skill definition (`.claude/skills/*/SKILL.md`) | **200 LOC** | Skills are procedural; if yours is longer, it's actually a workflow. Break into sub-skills |
| Hook script (`.claude/hooks/*.mjs`) | **200 LOC** | Hooks are focused guards. If you need 200+ lines, the hook is doing too much |
| Context file (`.claude/context/*.md`) | **500 LOC** | Context is reference material; modestly larger limit |
| Plan (`.claude/plans/*.md`) | **300 LOC** | Plans are sub-phase lists, not essays |
| ADR (`.claude/decisions/*.md`) | **250 LOC** | ADRs are focused decisions |

These are enforced by the same hook. Overrides require the same ADR process.
