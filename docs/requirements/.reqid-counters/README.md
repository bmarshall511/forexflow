# Requirement ID counters

One file per requirement scope. Each file holds a single integer — the highest requirement number allocated in that scope so far. `0` means none allocated.

The `/trace --mint` skill is the only thing that should write to these files. Hand-editing is a bug; the counter is the skill's source of truth.

## Format

One line, one integer, trailing newline. Nothing else.

## Scopes

Pre-seeded to match the commit-scope enum from `commitlint.config.mjs` (rule 10, `context/conventions.md`). One file per scope:

- `trading` — REQ-TRADING-\<NNN\>
- `web` — REQ-WEB-\<NNN\>
- `daemon` — REQ-DAEMON-\<NNN\>
- `cf-worker` — REQ-CF-WORKER-\<NNN\>
- `mcp-server` — REQ-MCP-SERVER-\<NNN\>
- `desktop` — REQ-DESKTOP-\<NNN\>
- `db` — REQ-DB-\<NNN\>
- `shared` — REQ-SHARED-\<NNN\>
- `types` — REQ-TYPES-\<NNN\>
- `config` — REQ-CONFIG-\<NNN\>
- `logger` — REQ-LOGGER-\<NNN\>
- `claude` — REQ-CLAUDE-\<NNN\>
- `repo` — REQ-REPO-\<NNN\>

Sub-scopes (e.g. `web-positions`) mint against the parent scope's counter unless the scope's volume warrants a dedicated counter; `requirements-curator` decides when to promote.

## Never reuse an ID

If a requirement is `rejected` or `deprecated`, its ID stays reserved forever. The counter always moves forward.
