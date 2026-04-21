# `.claude/config/`

Machine-readable data files the hooks and agents read at runtime. Separating data from code keeps hooks small and the policies they enforce reviewable as data rather than buried in script logic.

## Files

| File                         | Read by                                | Committed?          | Purpose                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size-exceptions.json`       | `hooks/pre-edit-size-guard.mjs`        | yes                 | Per-path overrides to the file-size limit table. Every entry is backed by an ADR under `.claude/decisions/`.                                                                                                                                  |
| `import-boundary-graph.json` | `hooks/pre-edit-import-boundary.mjs`   | yes                 | The allowed package dependency graph. Mirror of the diagram in `.claude/rules/06-monorepo-boundaries.md`.                                                                                                                                     |
| `doc-map.json`               | `hooks/pre-commit-docs-sync.mjs`       | yes                 | Code-path glob → required doc path mapping. Determines which doc the hook asks to be updated when a given code file changes.                                                                                                                  |
| `reserved-identifiers.json`  | `hooks/pre-edit-no-personal-names.mjs` | **no (gitignored)** | Per-user list of personal names/handles/emails to block. The file is gitignored because the list is context-specific (it names actual people, which the project otherwise forbids committing anywhere). Each contributor maintains their own. |

## Schema

Each file has its own shape — see the top of the file for the expected keys. All files are valid JSON; the hooks load them with `JSON.parse` and fail open on any error.

## Changing policy

The hook scripts read these files on every invocation; there is no caching. Changes take effect immediately without restarting the session.

When updating these files as a policy change:

1. Edit the file
2. Bump `.claude/VERSION` if the change is user-visible
3. Append a `CHANGELOG.md` entry (the `post-edit-meta-log` hook does this automatically)
4. For non-trivial policy shifts (new size-exception, import-graph change, doc-map restructure), write an ADR in `.claude/decisions/`
5. The `meta-reviewer` agent reviews the diff
