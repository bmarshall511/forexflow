---
id: 0003
title: TodoWrite marker file is the plan-required signal
status: accepted
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [hooks, planning, session-state]
---

# 0003 — TodoWrite marker file is the plan-required signal

## Context

Rule `00-foundation.md` §1 mandates planning before code for any
non-trivial work. The `pre-edit-plan-required` hook enforces this by
blocking new files over ~50 LOC when no plan has been recorded in the
current session.

The open question is: **what is "a plan recorded in the current
session"?** The Claude Code harness does not expose a first-class
"did TodoWrite fire" event to PreToolUse hooks. The hook cannot read
session memory directly.

Options considered:

- Read the transcript JSONL in the user's Claude Code state directory
  (`~/.claude/projects/<slug>/*/*.jsonl`). Fragile — path format is
  undocumented and may change across versions.
- Require an explicit `// plan: <description>` comment at the top of
  every new file. User-hostile; the plan exists outside the file, in
  the session's TodoWrite.
- Use a filesystem marker written by a separate hook on TodoWrite use.

## Decision

1. A dedicated `PostToolUse` hook on the `TodoWrite` matcher writes a
   marker file under `.claude/.session-state/plans/<timestamp>.json`
   containing the current todo list snapshot.
2. `pre-edit-plan-required` checks whether `.claude/.session-state/plans/`
   contains any file (any recent plan counts). If the directory is
   absent or empty, the hook fails open per ADR #0002.
3. `stop-session-check` clears the `plans/` directory at session end
   so the next session starts clean.
4. `.claude/.session-state/` is gitignored — it's per-session,
   per-user, never committed.

The TodoWrite-emitter hook is **not shipped in Sub-phase 4**; it's
queued for Sub-phase 8 (test harness), where it can be added alongside
fixtures verifying both states of `pre-edit-plan-required`.

## Consequences

### Positive

- Deterministic, file-system-based signal. Any agent can write to the
  directory; any hook can check it. No coupling to harness internals.
- Works uniformly across Claude Code sessions, Cursor sessions, or
  scripted agent invocations.
- Gitignored → no repo noise.

### Negative

- Two hooks wired in series (emitter + checker) introduces a failure
  surface. Mitigated by: emitter is a tiny `fs.writeFile`, checker
  fails open if the emitter has never run.
- Session-state lives on disk across a crash, so a crashed-and-resumed
  session could inherit a stale marker. Acceptable — a stale marker
  relaxes enforcement, not tightens it.

### Neutral

- The marker file contents are not consumed by `pre-edit-plan-required`;
  the checker only looks for the file's presence. Contents exist for
  debugging / journal use.

## Alternatives considered

- **Parse transcript JSONL** — rejected. Fragile dependency on
  undocumented Claude Code internals.
- **Require plan comments at file top** — rejected. User-hostile.
- **Always enforce (no escape hatch)** — rejected. Trivial one-line
  fixes shouldn't require TodoWrite ceremony; the 50-LOC threshold
  keeps the hook targeted at genuine new work.

## Follow-ups

- [ ] Sub-phase 8: ship `post-todowrite-plan-marker.mjs` emitter and
      wire it in `settings.json` under `PostToolUse` with matcher
      `TodoWrite`.
- [ ] Sub-phase 8: update `stop-session-check.mjs` to clean
      `.claude/.session-state/plans/` on Stop.
- [ ] Sub-phase 8: test-harness fixtures for both states (no plan →
      block; plan present → allow).
- [ ] Update `.gitignore` to include `.claude/.session-state/` (part
      of the Sub-phase 8 commit).

## References

- `.claude/hooks/pre-edit-plan-required.mjs`
- `.claude/rules/00-foundation.md` §1
- ADR #0002
