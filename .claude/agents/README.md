# Agents

Specialist sub-agents. Each has a declared model, tool allowlist, verdict schema, and prompt-cache-friendly layout. The main interactive agent **orchestrates**; these specialists **implement** (or **review**).

## Invocation

Inside a Claude Code session, dispatch an agent via the `Agent` tool with `subagent_type` set to the agent's file basename (without `.md`). Dispatch multiple agents in a single message with multiple tool calls to run them in parallel.

Most agents are also wrapped by slash-command skills (Sub-phase 6) — e.g. `/review` dispatches `code-reviewer`, `/security-review` dispatches `security-reviewer`. Skills are the normal entry point; direct dispatch is for orchestration subtleties.

## Frontmatter schema

Every agent file starts with YAML frontmatter:

```yaml
---
name: code-reviewer
description: Reviews staged changes against ForexFlow coding standards
model: opus              # opus | sonnet | haiku
tools:                   # tool allowlist this agent may use
  - Read
  - Grep
  - Glob
  - Bash
version: 0.1.0
timebox_minutes: 10      # hard stop the agent self-observes
cache_strategy: static-prefix  # the stable "who I am + rules" section
                               # is positioned at the top for prompt cache hits
verdict:                 # the structured output the agent must return
  type: enum
  values: [APPROVE, WARNING, BLOCK]
invoked_by:              # skills or events that trigger this agent
  - "skills/review/SKILL.md"
  - "hooks/pre-commit-*" (indirect via review skill chain)
---
```

Fields:

| Field             | Required | Meaning                                                                                                                             |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`            | yes      | Stable ID; matches filename minus `.md`                                                                                             |
| `description`     | yes      | One-line summary surfaced to the main agent during dispatch                                                                         |
| `model`           | yes      | `opus` for reasoning-heavy / final review, `sonnet` for implementation, `haiku` for triage / exploration                            |
| `tools`           | yes      | Array of allowed tools. Narrower is better — agents should not have Write access unless they implement                              |
| `version`         | yes      | SemVer for this agent's prompt                                                                                                      |
| `timebox_minutes` | yes      | Internal stop condition: the agent reports what it has and exits after this many minutes of work                                    |
| `cache_strategy`  | yes      | Usually `static-prefix` — the stable system-prompt section is at the top for prompt-cache hits; the volatile input is at the bottom |
| `verdict`         | yes      | The structured output shape — every reviewer has a stable verdict schema so skills and hooks can consume it programmatically        |
| `invoked_by`      | no       | Skills or hooks that normally dispatch this agent                                                                                   |

## Model routing

From ADR #0001 and the stack declaration in `context/stack.md`:

| Tier                     | Model          | Used for                                                                                                                    |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Reasoning / final review | **Opus 4.7**   | `code-reviewer`, `security-reviewer`, `integration-reviewer`, `meta-reviewer`, `debug-investigator`                         |
| Implementation           | **Sonnet 4.6** | `test-writer`, `refactor-planner`, `docs-syncer`, `perf-auditor`, `migration-writer`, `requirements-curator`, `dep-upgrade` |
| Exploration / triage     | **Haiku 4.5**  | `explorer`                                                                                                                  |

Reviewer agents run on Opus because the cost of missing a real issue in a trading-platform review is higher than the marginal cost of the better model.

## Verdict vocabulary

Different agents use different verdict vocabularies. All are discrete enums so downstream tooling can branch on them.

| Agent                  | Verdict values                                         |
| ---------------------- | ------------------------------------------------------ |
| `code-reviewer`        | `APPROVE` · `WARNING` · `BLOCK`                        |
| `security-reviewer`    | `PASS` · `ADVISORY` · `FAIL`                           |
| `integration-reviewer` | `SAFE` · `RISKY` · `BREAKING`                          |
| `meta-reviewer`        | `APPROVE` · `NEEDS_CHANGES` · `REJECT`                 |
| `debug-investigator`   | `ROOT_CAUSE` · `HYPOTHESIS` · `INCONCLUSIVE`           |
| `test-writer`          | `WRITTEN` · `PARTIAL` · `BLOCKED`                      |
| `refactor-planner`     | `PROPOSED` · `NEEDS_CLARIFICATION` · `NOT_RECOMMENDED` |
| `docs-syncer`          | `SYNCED` · `PATCH_PROPOSED` · `STALE_FLAGGED`          |
| `perf-auditor`         | `GREEN` · `YELLOW` · `RED`                             |
| `migration-writer`     | `WRITTEN` · `DRY_RUN_FAILED` · `NOT_SAFE`              |
| `requirements-curator` | `UPDATED` · `PATCH_PROPOSED` · `ORPHAN_DETECTED`       |
| `dep-upgrade`          | `AUTO_APPROVE` · `NEEDS_REVIEW` · `REJECT`             |
| `explorer`             | `FOUND` · `PARTIAL` · `NOT_FOUND`                      |

## Review pipeline

Non-trivial changes typically flow through three reviewers in parallel:

```
main-agent (plans, dispatches)
  ├──▶ code-reviewer     → APPROVE / WARNING / BLOCK
  ├──▶ security-reviewer → PASS / ADVISORY / FAIL
  └──▶ integration-reviewer → SAFE / RISKY / BREAKING
       │
       ▼
  main-agent reconciles:
    - any BLOCK / FAIL / BREAKING → address or appeal via ADR
    - any WARNING / ADVISORY / RISKY → acknowledge, continue
    - all APPROVE / PASS / SAFE → commit
```

The auto-re-review loop has a cap of 3 iterations per change (per ADR #0001 agenda) and a per-iteration time-box.

## Rejection appeals

If a reviewer returns a blocking verdict that the implementer believes is wrong for this case, the correct response is **not** to bypass. It's to:

1. File an ADR under `.claude/decisions/` explaining why the rule should be overridden for this case
2. The `meta-reviewer` agent reviews the appeal
3. If accepted, the rule's exception list or scope gets updated
4. Only then does the original change land

This keeps every override auditable and prevents reviewer erosion.

## Time-box

Every agent has a hard `timebox_minutes` from its frontmatter. Opus agents cap at 10 minutes, Sonnet at 5, Haiku at 2. If the agent hasn't concluded by the time-box, it reports what it has and exits. Unbounded agent runs are the most common way to burn money on Claude Code; the time-box is non-negotiable.

## Prompt caching

Every agent's prompt is structured:

```
<static system-prompt section>
  - agent identity, role, non-negotiables
  - relevant rule summaries (scope-appropriate)
  - verdict schema
  - time-box and exit conditions
</static>
<volatile input section>
  - the specific change, file, or question being reviewed
  - staged diff, test output, error log, etc.
</volatile>
```

Anthropic's prompt cache is breakpointed at the boundary between static and volatile. Repeat invocations hit cache on the static section, paying only ~10% of the input token cost for it. Cost savings compound quickly for agents that run many times per session (reviewers).

## Writing a new agent

1. Pick a clear specialist name in the verb-object style (`refactor-planner`, not `refactor-helper`)
2. Write the frontmatter with all required fields
3. Structure the prompt static-then-volatile
4. Define a verdict enum with exactly 3 values (APPROVE / WARN / BLOCK shape — one happy, one advisory, one blocking)
5. Add a test fixture in `.claude/test-harness/fixtures/agent-<name>.mjs` (Sub-phase 8)
6. Wire a slash-command skill in `.claude/skills/` if normal dispatch deserves one (Sub-phase 6)
7. Bump `.claude/VERSION` if the addition is user-visible

## Catalog

| #   | Agent                                             | Model  | Purpose                                         |
| --- | ------------------------------------------------- | ------ | ----------------------------------------------- |
| 1   | [code-reviewer](./code-reviewer.md)               | opus   | Reviews staged changes against ForexFlow rules  |
| 2   | [security-reviewer](./security-reviewer.md)       | opus   | OWASP + credential + auth + encryption review   |
| 3   | [integration-reviewer](./integration-reviewer.md) | opus   | Cross-module impact analysis                    |
| 4   | [meta-reviewer](./meta-reviewer.md)               | opus   | Reviews edits to `.claude/` itself              |
| 5   | [debug-investigator](./debug-investigator.md)     | opus   | Symptom → hypothesis → evidence → fix           |
| 6   | [test-writer](./test-writer.md)                   | sonnet | Generates Vitest / Playwright tests             |
| 7   | [refactor-planner](./refactor-planner.md)         | sonnet | Plans LOC-limit-driven splits before any move   |
| 8   | [docs-syncer](./docs-syncer.md)                   | sonnet | Keeps CLAUDE.md + docs current with code        |
| 9   | [perf-auditor](./perf-auditor.md)                 | sonnet | Bundle size, render cost, DB query analysis     |
| 10  | [migration-writer](./migration-writer.md)         | sonnet | Writes + validates Prisma migrations            |
| 11  | [requirements-curator](./requirements-curator.md) | sonnet | Mints IDs, drafts requirements, maintains index |
| 12  | [dep-upgrade](./dep-upgrade.md)                   | sonnet | Evaluates Renovate/Dependabot PRs               |
| 13  | [explorer](./explorer.md)                         | haiku  | Cheap codebase exploration delegate             |
