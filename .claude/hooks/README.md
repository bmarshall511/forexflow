# Hooks

Executable guardrails that fire on Claude Code tool events. Each hook is a small, focused `.mjs` script that reads a JSON payload from stdin, inspects it, and either:

- **Blocks** the tool call with an explanation the user sees, or
- **Runs silently** (logs or amends) and exits 0

The enforcement model is **strict by default**: every hook backing a strict rule blocks on violation. Advisory hooks (rare) only log.

## Hook protocol

Every hook:

1. Reads a single JSON object from stdin
2. Extracts the fields it cares about (`tool_name`, `tool_input`, `file_path`, `command`, etc.)
3. Inspects them and decides an action
4. **To block**: writes a JSON response to stdout with `permissionDecision: "deny"` and `reason: "..."`, then exits 0
5. **To allow silently**: exits 0 with no stdout output
6. **To allow with a message**: writes a JSON response with `permissionDecision: "allow"` and `message: "..."`, then exits 0
7. **To fail open on internal error**: catches, logs to stderr, exits 0 (do not block a user on a hook bug)

See the individual hook files for examples. Shared response helpers live in `lib/io.mjs`.

## Events

| Event | Fires on | Payload includes |
|---|---|---|
| `PreToolUse` | Before a tool call runs | `tool_name`, `tool_input`, `file_path` (for Write/Edit), `command` (for Bash) |
| `PostToolUse` | After a tool call succeeds | Same plus `tool_output` |
| `UserPromptSubmit` | User submits a prompt | `prompt`, session context |
| `Stop` | Session ends | session context |

Wired in `.claude/settings.json` under the `hooks` key.

## File layout

```
.claude/hooks/
├── README.md               This file
├── lib/
│   ├── io.mjs              stdin/stdout helpers, JSON response builders
│   ├── matchers.mjs        glob → regex, path utilities
│   ├── size.mjs            LOC counting, size-limit lookup
│   ├── imports.mjs         import-statement parsing
│   └── logger.mjs          lightweight structured logging to stderr
├── guard-bash.mjs
├── pre-edit-size-guard.mjs
├── pre-edit-import-boundary.mjs
├── pre-edit-hallucination-guard.mjs
├── pre-edit-plan-required.mjs
├── pre-edit-no-any.mjs
├── pre-edit-no-personal-names.mjs
├── pre-edit-requirement-link.mjs
├── post-edit-format.mjs
├── post-edit-meta-log.mjs
├── pre-commit-secrets-scan.mjs
├── pre-commit-docs-sync.mjs
├── pre-commit-requirements-sync.mjs
├── pre-commit-ide-parity.mjs
├── pre-commit-continuous-green.mjs
├── user-prompt-context-warn.mjs
└── stop-session-check.mjs
```

## Authoring conventions

- **Top-of-file frontmatter comment** names the hook, what it blocks, which rule it enforces
- **Pure ESM** (`.mjs`), Node's built-in modules only — no npm dependencies. Hooks must work from a fresh clone before `pnpm install`
- **Defensive** — unexpected JSON shape, missing fields, bad regex → log and exit 0 (fail open). A bug in a hook never stops a user from working
- **Fast** — budget 100 ms for write-time hooks, 15 s for commit-time hooks. If a hook needs more time, raise its timeout in `settings.json` and document the reason
- **Testable** — every hook has a synthetic violation fixture under `.claude/test-harness/fixtures/` (populated in Sub-phase 8)

## Timeouts

Wired in `settings.json`:

| Hook | Event | Timeout |
|---|---|---|
| `guard-bash` | PreToolUse:Bash | 5 s |
| `pre-edit-*` | PreToolUse:Write/Edit | 10 s |
| `post-edit-format` | PostToolUse:Write/Edit | 30 s |
| `post-edit-meta-log` | PostToolUse:Write/Edit | 5 s |
| `pre-commit-secrets-scan` | PreToolUse:Bash (git commit) | 30 s |
| `pre-commit-docs-sync` | PreToolUse:Bash (git commit) | 15 s |
| `pre-commit-requirements-sync` | PreToolUse:Bash (git commit) | 15 s |
| `pre-commit-ide-parity` | PreToolUse:Bash (git commit) | 15 s |
| `pre-commit-continuous-green` | PreToolUse:Bash (git commit) | 300 s |
| `user-prompt-context-warn` | UserPromptSubmit | 5 s |
| `stop-session-check` | Stop | 60 s |

## Per-user overrides

Per-user settings in `.claude/settings.local.json` may `allow`-list specific tool patterns to short-circuit a hook for the maintainer's own invocations. This is rare — the shared `settings.json` is the default.

## Configuration

Some hooks read JSON config from `.claude/config/`:

- `size-exceptions.json` — per-path LOC-limit overrides (read by `pre-edit-size-guard.mjs`)
- `reserved-identifiers.json` — list of personal names/handles to block (read by `pre-edit-no-personal-names.mjs`; gitignored per-user list)
- `import-boundary-graph.json` — the allowed package dependency graph (read by `pre-edit-import-boundary.mjs`)
- `doc-map.json` — code-path → doc-path mapping (read by `pre-commit-docs-sync.mjs`)

These files are the source of truth for the hook's behavior and are versioned so their changes are reviewable.

## Failure modes

Hooks are fallible. When one misbehaves:

1. Catalog the failure in `.claude/failure-modes.md`
2. File a test-harness fixture reproducing the misbehavior
3. Fix the hook
4. Verify the fixture now passes

The `debug-investigator` agent owns diagnosing flaky hooks when dispatched.

## Related rules

Every hook backs one or more rules in `.claude/rules/`. The rule file's `related` frontmatter field cites the hook that enforces it. A rule with `enforcement: strict` and no backing hook is a bug — either the hook is missing, or the rule should be advisory.

See `.claude/rules/README.md` for the full rule → hook mapping.
