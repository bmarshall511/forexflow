# Skills

Slash-command workflows. Invoked as `/<skill-name>`. Each skill is a focused, procedural recipe: given inputs, run these steps, dispatch these agents, produce this output.

Skills are how everyday work gets done in this repo. If a workflow happens more than twice, it deserves a skill. If a workflow crosses multiple agents or tools, a skill orchestrates the sequence.

## Invocation

Inside a Claude Code session:

```
/<skill-name> [arguments]
```

Inside a Cursor session, the equivalent commands live in `.cursor/commands/` (generated from this directory by the Sub-phase 7 sync script). The generator preserves both names and argument shapes so contributors don't learn two vocabularies.

## Frontmatter schema

Every skill's `SKILL.md` starts with:

```yaml
---
name: verify
description: Run the full preflight — typecheck, lint, test, format, security, diff review
disable-model-invocation:
  true # true for procedural skills; false when the
  # skill needs model reasoning over its steps
model: haiku | sonnet | opus # cost routing when invocation is enabled
args:
  - name: scope
    type: string
    required: false
    description: Optional workspace filter, e.g. "@forexflow/shared"
dispatches: [test-writer, code-reviewer] # agents this skill uses
version: 0.1.0
---
```

Fields:

| Field                      | Required                | Meaning                                                                                                                           |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `name`                     | yes                     | Matches the directory name; becomes `/<name>`                                                                                     |
| `description`              | yes                     | One-line summary shown in `/help` output                                                                                          |
| `disable-model-invocation` | yes                     | `true` keeps the skill purely procedural (reliable, cheap); `false` lets a model reason over the steps (flexible, more expensive) |
| `model`                    | when invocation enabled | Cost tier: `haiku` for simple procedural, `sonnet` for moderate, `opus` only when a reviewer agent dominates the work             |
| `args`                     | no                      | Positional or named arguments the skill expects                                                                                   |
| `dispatches`               | no                      | Agents this skill may invoke                                                                                                      |
| `version`                  | yes                     | SemVer for the skill                                                                                                              |

## Model-aware cost routing

From rule 05 and ADR #0001:

| Skill type                                               | Default model                           | Reason                         |
| -------------------------------------------------------- | --------------------------------------- | ------------------------------ |
| Pure procedural (no reasoning)                           | none — `disable-model-invocation: true` | free of model cost             |
| Cheap workflows (format, doc-sync, stale-rules audit)    | haiku                                   | high volume, low complexity    |
| Moderate workflows (refactor planning, test writing)     | sonnet                                  | mixed reasoning and generation |
| Heavy-review workflows (security review, phase complete) | opus                                    | final decision surface         |

Skills escalate, never de-escalate. A skill tagged `haiku` that finds it needs deeper reasoning returns a request-for-escalation rather than silently running on Opus.

## Directory layout

```
.claude/skills/
├── README.md
│
├── verify/SKILL.md
├── review/SKILL.md
├── security-review/SKILL.md
├── ...
│
└── <skill-name>/
    ├── SKILL.md            (required — the skill itself)
    └── <helpers>           (optional — any scripts or templates the skill uses)
```

One directory per skill. The `SKILL.md` file is the source of truth. Any helper scripts (bash helpers, template files the skill copies in) sit alongside.

## Authoring conventions

- **Procedural-first.** Most skills are `disable-model-invocation: true`. The procedure is reliable and cheap. Only enable model invocation when the skill genuinely needs to reason over variable input (e.g., `/debug` reasoning about a novel symptom)
- **Short.** Skill files ≤200 LOC (rule 07). If a skill grows past that, split into sub-skills or extract shared logic to a helper script
- **Dispatch, don't implement.** A skill that dispatches `test-writer` is one sentence; a skill that reinvents test-writing is a maintenance liability
- **Structured output.** Every skill's output shape is declared in its SKILL.md so callers can consume results programmatically
- **Exit cleanly.** Every skill declares success / partial / failure states

## Catalog

**Meta / session**

| Skill                                  | Purpose                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| [/status](./status/SKILL.md)           | One-command health dashboard of the entire `.claude/` system                          |
| [/handoff](./handoff/SKILL.md)         | Generate a context-transfer prompt → `.claude/handoffs/<ts>.md` + `latest.md` symlink |
| [/why](./why/SKILL.md)                 | Explain a decision via ADRs + git blame + related rules                               |
| [/contribute](./contribute/SKILL.md)   | Onboard a new teammate: verify toolchain, copy per-user configs, walk first PR        |
| [/cost-report](./cost-report/SKILL.md) | Agent-invocation cost summary from `.claude/telemetry/`                               |

**Validation**

| Skill                                          | Purpose                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| [/verify](./verify/SKILL.md)                   | Full preflight: typecheck, lint, test, format, security, diff review        |
| [/review](./review/SKILL.md)                   | Dispatch `code-reviewer` + `integration-reviewer` on staged changes         |
| [/security-review](./security-review/SKILL.md) | Dispatch `security-reviewer`                                                |
| [/stale-rules](./stale-rules/SKILL.md)         | Audit `.claude/` for broken paths, stale references, frontmatter invalidity |
| [/doc-check](./doc-check/SKILL.md)             | Docs ↔ code drift audit via `docs-syncer`                                   |
| [/a11y](./a11y/SKILL.md)                       | AAA accessibility checklist against changed UI                              |
| [/perf-audit](./perf-audit/SKILL.md)           | Dispatch `perf-auditor`                                                     |

**Refactor / maintenance**

| Skill                                  | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| [/refactor](./refactor/SKILL.md)       | Dispatch `refactor-planner`, apply approved plan          |
| [/trace](./trace/SKILL.md)             | Map requirement ↔ tests ↔ code via `requirements-curator` |
| [/migrate](./migrate/SKILL.md)         | Prisma migration via `migration-writer`                   |
| [/dep-upgrade](./dep-upgrade/SKILL.md) | Dispatch `dep-upgrade` agent on a Renovate PR             |

**Observability / debug**

| Skill                                | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| [/debug](./debug/SKILL.md)           | Dispatch `debug-investigator` on a symptom                   |
| [/smoke-test](./smoke-test/SKILL.md) | Start dev, navigate to feature, verify end-to-end (Phase 2+) |
| [/tail-logs](./tail-logs/SKILL.md)   | Tail Pino logs with filters (Phase 2+)                       |

**Scaffolding** — seeded with stubs now; each activates when Phase 2+ brings the monorepo surface it scaffolds into.

| Skill                                                  | Purpose                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| [/add-component](./add-component/SKILL.md)             | Scaffold an `apps/web` component with sibling Playwright spec |
| [/add-hook](./add-hook/SKILL.md)                       | Scaffold an `apps/web` React hook                             |
| [/add-api-route](./add-api-route/SKILL.md)             | Scaffold a Next.js App Router API route with Zod validation   |
| [/add-db-service](./add-db-service/SKILL.md)           | Scaffold a `packages/db` service file + Prisma model          |
| [/add-daemon-endpoint](./add-daemon-endpoint/SKILL.md) | Wire a Hono route → web proxy → hook                          |
| [/add-ws-event](./add-ws-event/SKILL.md)               | Wire a WebSocket message type end-to-end                      |
| [/add-test](./add-test/SKILL.md)                       | Dispatch `test-writer` against a subject                      |

**Phase control**

| Skill                                        | Purpose                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [/phase-start](./phase-start/SKILL.md)       | Pin the next phase plan, load context, dry-run handoff                                           |
| [/phase-complete](./phase-complete/SKILL.md) | Gate the transition from phase N → N+1 — run every reviewer, every harness, write completion ADR |
| [/bootstrap](./bootstrap/SKILL.md)           | Scaffold the monorepo skeleton (Phase 2 entry point)                                             |

## Contributing a new skill

1. Pick a name in verb-object or verb-only style (`add-component`, `verify` — not `helper` or `utility`)
2. Create `.claude/skills/<name>/SKILL.md` with valid frontmatter
3. Write the procedure as a numbered sequence — what is read, what is run, what is written, what is dispatched
4. Declare the output shape
5. Add an entry in this README's catalog
6. For Sub-phase 8: add a test-harness fixture that invokes the skill against a synthetic input and asserts the output shape
