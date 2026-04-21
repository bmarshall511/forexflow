---
id: 0005
title: post-edit-meta-log auto-appends .claude/ edits to CHANGELOG.md [Unreleased]
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [hooks, meta, auditability]
---

# 0005 — post-edit-meta-log auto-appends .claude/ edits to CHANGELOG.md [Unreleased]

## Context

Rule `13-documentation.md` and the self-modification clause in
`CLAUDE.md` require that changes to the agent configuration itself be
logged. Manually remembering to update `.claude/CHANGELOG.md` after
every config edit is the exact kind of "we'll remember" behavior the
rebuild is structured against.

## Decision

1. The `post-edit-meta-log.mjs` hook fires on every `Write` or `Edit`
   targeting a file under `.claude/` (except `.claude/CHANGELOG.md`
   itself, to avoid recursion).
2. The hook appends a single line to `CHANGELOG.md` under
   `## [Unreleased]` → `### Added`:

   ```
   - YYYY-MM-DD <kind>: `<path>` (<tool>)
   ```

   where `<kind>` is derived from the path (`rule`, `hook`, `agent`,
   `skill`, `context`, `plan`, `decision`, `config`, `test-harness`,
   or `meta` as fallback).

3. The hook de-duplicates entries within a session (if the exact line
   already appears in the Unreleased section, skip).
4. When a sub-phase completes, the maintainer (or a `phase-complete`
   skill in Sub-phase 6) promotes `[Unreleased]` to a numbered SemVer
   section with a date header. The hook's entries become the commit
   history of that release.

## Consequences

### Positive

- Every meta-configuration change is auditable without relying on
  contributor discipline.
- Reviewers see exactly which rails the AI has changed between two
  versions by reading the CHANGELOG, not a git log diff.
- The behavior is self-dogfooding: Sub-phase 4 shipped with the hook,
  and the hook's own arrival is logged.

### Negative

- A noisy edit session (many small writes to one file) produces many
  lines per file. Acceptable: one line per `Write`/`Edit` tool call
  matches what actually happened. The dedup guard prevents literal
  duplicates.
- Large bulk-write sub-phases (like this one, where dozens of hooks
  land) produce a dense `[Unreleased]` section. Mitigated by the
  sub-phase-complete promotion step that cleans and groups.

### Neutral

- The hook is tolerant of a missing `## [Unreleased]` header or a
  missing `### Added` subsection; it creates what's missing. It's
  also tolerant of the boilerplate `- (pending — next sub-phase)`
  placeholder in the seed changelog (it replaces it on first real
  entry).

## Alternatives considered

- **Append on git commit instead of on write** — rejected. A single
  sub-phase may contain many meta-edits; aggregating at commit time
  loses per-file granularity that's useful for forensics.
- **Append with full diff summary** — rejected. Diff summaries are
  noisy and the diff is already in the git log. The CHANGELOG is a
  navigation aid, not a full record.
- **Skip automatic logging; require manual updates** — rejected. The
  manual approach is exactly what ADRs exist to avoid.

## Follow-ups

- [ ] Sub-phase 6 `phase-complete` skill promotes `[Unreleased]` to a
      versioned release on sub-phase completion, bumping `.claude/VERSION`.
- [ ] Sub-phase 8 test-harness fixture: run the hook twice on the same
      path, verify the second run does not add a duplicate line.
- [ ] If the hook grows to handle additional filetypes (e.g., `docs/`),
      update this ADR or supersede with a new one.

## References

- `.claude/hooks/post-edit-meta-log.mjs`
- `.claude/CHANGELOG.md`
- `.claude/CLAUDE.md` §"Self-modification of .claude/"
- `.claude/rules/13-documentation.md`
