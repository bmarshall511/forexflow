# `.claude/test-harness/`

Synthetic-violation harness that proves every hook, rule, and structural invariant in `.claude/` does what it claims. When a rule says "strict: no `any` without `// TODO(type):`" and a hook backs it, the harness generates a synthetic violation, pipes it through the hook, and asserts the hook denies — with the expected reason and exit code.

If the `.claude/` configuration is the product, this is its test suite.

## Why this exists

Rules, hooks, and agents drift silently. A rule file is edited and the hook it cites stops matching. A hook is refactored and a subtle regex change means it no longer catches a whole class of violation. Without an automated test, rot accumulates between `meta-reviewer` runs.

The harness is deterministic, fast, and zero-dependency so it can run in CI (agent-config-drift workflow) on every PR.

## Structure

```
.claude/test-harness/
├── README.md                 This file
├── run.mjs                   Orchestrator — runs every fixture, reports pass/fail
├── lib/
│   ├── hook-runner.mjs       Pipes JSON to a hook's stdin, captures stdout, parses the response
│   ├── assert.mjs            Minimal assertion helpers (zero-dep)
│   └── fixture.mjs           Shared fixture builders
└── fixtures/
    ├── hook-guard-bash.mjs              Destructive-command blocking
    ├── hook-size-guard.mjs              LOC-limit blocking
    ├── hook-import-boundary.mjs         Cross-app / package-to-app imports blocked
    ├── hook-hallucination-guard.mjs     Unresolved local imports blocked
    ├── hook-no-any.mjs                  `: any` without TODO blocked
    ├── hook-no-personal-names.mjs       Blocklist enforcement + ALLOWED_PATHS exemption
    ├── hook-plan-required.mjs           Plan-marker enforcement (both states)
    ├── hook-requirement-link.mjs        @req tag enforcement (fail-open + active)
    ├── hook-ide-parity.mjs              Rules-changed-without-cursor enforcement
    ├── hook-secrets-scan.mjs            Credential patterns caught by regex fallback
    ├── hook-docs-sync.mjs               Code-without-doc-update blocking (fail-open + active)
    ├── hook-continuous-green.mjs        Script-missing fail-open; script-failing deny
    ├── hook-context-warn.mjs            UserPromptSubmit threshold thresholds
    ├── hook-stop-session-check.mjs      Exit-0 summary + session-state cleanup
    ├── hook-post-edit-format.mjs        Never blocks; handles missing prettier
    ├── hook-post-edit-meta-log.mjs      Appends CHANGELOG; dedupes; recursion-guard
    ├── hook-post-todowrite-plan-marker.mjs   Creates marker; non-blocking
    ├── structure-rule-frontmatter.mjs   Every rule has valid schema
    ├── structure-agent-frontmatter.mjs  Every agent has valid schema
    ├── structure-skill-frontmatter.mjs  Every skill has valid schema
    ├── structure-stale-refs.mjs         Every related:/scope: path resolves
    ├── structure-hook-wiring.mjs        Every hook in settings.json exists on disk
    ├── structure-rule-hook-coverage.mjs Every strict rule has a backing hook
    └── structure-cursor-parity.mjs      sync-ide-rules --check passes
```

## Running

From the repo root:

```bash
node .claude/test-harness/run.mjs
```

Flags:

- `--fixture <name>` — run only one fixture (matched on filename without `.mjs`)
- `--verbose` — print the full stdout/stderr from each fixture
- `--bail` — stop at first failure (default: run all, summarize at end)

Exit 0 on all-green; exit 1 otherwise.

During Phase 2+ this will be wired into `pnpm claude:test`. During Phase 1 it's invoked directly with `node`.

## Fixture contract

Every fixture exports:

```js
export const name = "hook-size-guard"
export const description = "blocks a 300-line component write"

export async function run() {
  // ... test logic
  return { passed: true | false, reason?: "..." }
}
```

The orchestrator imports each fixture, calls `run()`, reports status. Fixtures do not `process.exit()` — they return a result object.

## What a fixture does

Typical pattern for a hook fixture:

1. Assemble a synthetic hook input (the JSON that Claude Code would pipe)
2. Spawn the hook script with that input on stdin
3. Capture stdout, exit code
4. Assert:
   - exit code is 0 (hooks never crash the harness)
   - stdout parses as JSON and matches the expected shape
   - permissionDecision is the expected value (deny/allow/absent)
   - reason (for deny) mentions the expected rule/pattern

For structural fixtures (frontmatter, stale refs, wiring), the fixture reads files directly and asserts invariants.

## Isolation

Fixtures do not modify the repo tree. File-system-touching tests use `$TMPDIR` scratch paths and clean up on exit. The harness runs safely during a `git commit` or in CI.

## Adding a fixture

1. Create `.claude/test-harness/fixtures/<name>.mjs` per the contract above
2. Register nothing — the orchestrator auto-discovers every `.mjs` file in `fixtures/`
3. Run `node .claude/test-harness/run.mjs --fixture <name>` to verify it runs
4. The `meta-reviewer` agent treats missing fixtures (any hook without one) as a `NEEDS_CHANGES` finding
