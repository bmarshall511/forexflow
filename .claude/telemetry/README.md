# `.claude/telemetry/`

Per-invocation agent-cost telemetry. Lets `/cost-report` aggregate what the project has spent on AI agents without hitting a billing dashboard.

**This directory is gitignored.** The content is per-user and per-machine — committing it would mix one contributor's cost data with another's. Only this README is tracked.

## Format

One append-only JSONL file per month: `YYYY-MM.jsonl`. Each line is a single invocation:

```jsonl
{"ts":"2026-04-21T14:32:10Z","agent":"code-reviewer","model":"opus","input_tokens":12400,"output_tokens":890,"cost_usd":0.0953,"skill":"/review","session":"<uuid>"}
```

Fields (all required):

| Field | Meaning |
|---|---|
| `ts` | ISO-8601 timestamp (UTC) when the invocation completed |
| `agent` | Agent name from `.claude/agents/` (or `main` for the interactive agent) |
| `model` | `opus` / `sonnet` / `haiku` |
| `input_tokens` | Total input tokens (including any cached portion) |
| `output_tokens` | Total output tokens |
| `cost_usd` | Invocation cost in USD, derived from model pricing |
| `skill` | Slash-command that dispatched the agent (or `null`) |
| `session` | Opaque session identifier for grouping |

Cost derivation uses the per-model pricing constants in `packages/types/` once that package ships (Phase 3+). Until then, a pricing table lives in `.claude/telemetry/_pricing.json` (also gitignored) and gets refreshed when model pricing changes.

## Who writes to this directory

The writer doesn't exist yet. Phase 2+ introduces it in one of three ways:

1. A wrapper in `packages/shared/ai/` that the daemon and web app's AI-adjacent code calls, which writes after each SDK call completes
2. A PostToolUse hook that fires after specialist-agent dispatches and estimates cost from the reported token usage
3. A `/cost-record <payload>` skill that fires explicitly when an agent finishes its work and reports its token counts

Option 1 (shared wrapper) is the current direction but not ADR-ratified. When the writer lands, this README updates with the chosen shape.

## Who reads it

- **`/cost-report`** (Sub-phase 6 skill) — summarizes by agent, skill, model, and time window
- **`/status`** (Sub-phase 6 skill) — displays total cost this month on the health dashboard
- **`perf-auditor` agent** — flags invocations above their model's expected cost envelope
- Maintainer ad-hoc with `jq` when investigating a cost spike

## Privacy

- Never log prompt content or completion content in telemetry entries — only token counts and cost
- Session IDs are aggregated for this-month grouping only; never tied to a personal identifier (rule 00 §5)
- The directory is gitignored; per-user files never leave the contributor's machine
- If you ever need to share a cost breakdown in a PR or issue, export the *aggregated* `/cost-report` output — never the raw JSONL

## Retention

No automatic pruning. Files accumulate indefinitely. Pragmatic annual archive: after `YYYY-12.jsonl` closes, move the twelve monthly files to an external archive outside the repo if they grow unwieldy.

## Bootstrap state

During Phase 1, no telemetry is being written because the writer doesn't exist yet. `/cost-report` returns "no telemetry yet" by design (per its SKILL.md failure-mode section). This directory exists so future sessions know where to look the moment the writer ships.
