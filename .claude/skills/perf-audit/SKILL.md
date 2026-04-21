---
name: perf-audit
description: Dispatch the perf-auditor agent against the current change or a named scope; bundle / render / DB / AI-cost regressions vs. baseline
disable-model-invocation: false
model: sonnet
args:
  - name: scope
    type: string
    required: false
    description: "Optional scope: 'bundle', 'daemon', 'ai', or a file path. Default: changed files in the current diff"
dispatches: [perf-auditor]
version: 0.1.0
---

# /perf-audit

Run the perf-auditor agent. Advisory — it never blocks a commit, but its output is expected input when making performance-relevant decisions (new dependency, algorithm swap, bundle-growing UI change).

## When to run

- Any PR touching `apps/web/**` that affects bundle size (new imports, new dependency, new chart library usage)
- Any PR touching `apps/daemon/src/**` hot paths (reconcile loop, signal processor, position tracker)
- Before shipping a new AI-tier pipeline change (prompt shape, model swap, cache breakpoint)
- Monthly baseline audit against `v3` snapshot

## Procedure

1. Resolve scope (arg → current diff → prompt for narrower input)
2. Dispatch `perf-auditor` with the scope and baseline source
3. Relay the agent's GREEN / YELLOW / RED verdict to the caller with a summary and ranked remediations
4. For any RED finding, surface the specific file/line and the suggested change

## Output shape

```markdown
# /perf-audit result — <scope>

## Verdict: GREEN | YELLOW | RED

<one-line summary>

## Measurements

<key-axis table from perf-auditor — bundle, route, lighthouse, throughput, etc.>

## Findings

### RED (N)

- <finding>
  Remediation: <specific change>

### YELLOW (N)

- ...

### GREEN

- <areas measured and within budget>

## AI spend (when scope includes AI)

| Feature | Invocations | Cost | Budget used |
| ------- | ----------- | ---- | ----------- |

## Recommendations (priority-ordered)

1. ...
2. ...

## Next step

- If GREEN: no action; include the snapshot in the commit if baselines
  are tracked
- If YELLOW: acknowledge; schedule follow-up or accept tradeoff in
  commit body
- If RED: address before landing, or write an ADR if the regression is
  a deliberate tradeoff (rare)
```

## Bootstrap tolerance

During Phase 1–6, no app code exists. The skill reports "N/A — no app to measure; baselines not yet established" and suggests re-running once Phase 2 lands a buildable package.

## Time / cost

Sonnet-tier, 5-minute time-box. Fast when baselines exist; slower when first establishing them (full `--analyze` build + lighthouse run).
