---
name: tail-logs
description: Tail Pino structured logs from the daemon, web, CF Worker, or all; supports filters on subsystem, level, correlation ID
disable-model-invocation: true
args:
  - name: source
    type: string
    required: false
    description: "daemon | web | cf-worker | all. Default: daemon"
  - name: filter
    type: string
    required: false
    description: "Filter expression: 'level=error', 'subsystem=trade-syncer', 'correlationId=<uuid>', or a free grep pattern"
dispatches: []
version: 0.1.0
---

# /tail-logs

Structured log tail across the ForexFlow processes. Every log is Pino JSON — the skill pretty-prints by default and supports jq-style filtering on structured fields.

## When to run

- Debugging a live issue (pair with `/debug`)
- Watching a feature behave during `/smoke-test`
- Verifying a subsystem started cleanly after a change
- Investigating a production-like flow (daemon + cf-worker + web all chatting)

## Sources

| Source      | Typical path                                         | Notes                                                    |
| ----------- | ---------------------------------------------------- | -------------------------------------------------------- |
| `daemon`    | `logs/daemon.log` or Pino stdout                     | Most useful — trade syncing, signal processing, AI, etc. |
| `web`       | Next.js server logs (when Phase 7+ ships the server) | API route handlers                                       |
| `cf-worker` | `wrangler tail`                                      | Durable Object events, webhook ingress                   |
| `all`       | Multi-tail with prefix per source                    | When you need to correlate across processes              |

## Procedure

### 1. Locate the source

- `daemon` — check `apps/daemon/logs/daemon.log`; if absent, tail stdout of a running `pnpm --filter @forexflow/daemon dev` process
- `web` — `apps/web/.next/server/app-logs.json` or stdout of `pnpm --filter @forexflow/web dev`
- `cf-worker` — `pnpm --filter @forexflow/cf-worker tail` (wraps `wrangler tail`)
- `all` — three simultaneous tails with `[daemon]`, `[web]`, `[cf]` prefixes

### 2. Apply filters

If `filter` provided:

- `level=error` → filter to Pino level ≥ error
- `level>=warn` → any level at warn or above
- `subsystem=<name>` → logs bound to that subsystem via `logger.child({ subsystem })`
- `correlationId=<uuid>` → trace a specific request across processes
- `instrument=<EUR_USD>` → logs about a specific instrument
- `tradeId=<id>` → logs about a specific trade
- Anything else → free-text grep against the JSON line

### 3. Pretty-print

Default formatting:

```
14:32:10.841 INFO  [daemon/trade-syncer] reconciled trade tradeId=abc units=10000 instrument=EUR_USD
14:32:11.012 WARN  [daemon/oanda] stream reconnect attempt=2 backoff=5s
14:32:11.203 ERROR [web/api] request failed path=/api/positions error="..." correlationId=<uuid>
```

Redaction is automatic — Pino's redact config masks `apiKey`, `token`, `secret`, `session`, `cookie`, `authorization` before the skill ever sees them. The skill does not further filter; if a credential appears in a log, that's a security finding for `security-reviewer`.

### 4. Exit

`Ctrl-C` or end the feature being debugged. The skill does not kill the underlying log stream, just disconnects from it.

## Output shape

```markdown
# /tail-logs — <source> [<filter>]

<pretty-printed stream of log lines, newest at bottom>

... stream continues until interrupted ...

## Session summary (on exit)

- Source: <source>
- Filter: <filter or "(none)">
- Lines shown: N
- Level breakdown: trace N · debug N · info N · warn N · error N · fatal N
- Unique correlation IDs seen: N
```

## Bootstrap tolerance

During Phase 1–4, no daemon or web server exists. The skill returns "N/A — processes not yet shipped" and exits.

## What /tail-logs does NOT do

- Write logs (read-only)
- Redact beyond Pino's built-in config (that's the logger's job)
- Start or stop the sources (assume the dev env is already running)
- Persist tailed output — if you want a log snapshot, redirect manually

## Time / cost

Procedural, no model cost. Runs as long as the operator leaves it running.
