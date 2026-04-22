---
id: LRN-0006
observed_at: 2026-04-22
source: correction
target:
  - .gitignore
  - .claude/handoffs/README.md
status: applied
outcome: commit bd11c73
---

# LRN-0006 — Policy/enforcement drift: README said "tracked", .gitignore said "ignored"

## Observation

First cold-start session after Phase 1 close tried to read the Phase 1 handoff and found a dangling symlink. The handoff file
`.claude/handoffs/2026-04-22-phase-1-complete.md` was not in the commit because the `.gitignore` rule `.claude/handoffs/*.md`
matched it — even though `.claude/handoffs/README.md` explicitly said phase-boundary handoffs are **durable reference artifacts**
and belong in git. Also, `snapshots/README.md` made the same "committed across phase boundaries" promise.

The policy (READMEs) and the enforcement (`.gitignore`) had drifted. The policy was right; the enforcement was too broad.

## Proposed change

Narrow the handoff ignore so phase-completion handoffs are tracked while day-to-day handoffs stay per-user:

```
.claude/handoffs/*.md
!.claude/handoffs/README.md
!.claude/handoffs/latest.md
!.claude/handoffs/*-phase-*-complete.md
```

Commit the Phase 1 handoff that was previously untracked. Going forward: every phase-completion handoff produced by `/phase-complete` is automatically in the commit and readable by cold-start sessions.

## Evidence

- Cold-start session failed its Phase 2 kickoff at the reading-list step because `latest.md` symlink pointed at a missing file.
- `git check-ignore -v .claude/handoffs/2026-04-22-phase-1-complete.md` before fix → matched `.gitignore:64:.claude/handoffs/*.md`
- `.claude/handoffs/README.md` §"What a handoff contains" promises phase-boundary handoffs are tracked
- `.claude/snapshots/README.md` has the same pattern — "tracked for git history review"; that one was fixed proactively in Sub-phase 12 but the handoff case was missed

## Rationale

This is a recurring failure class worth cataloging, not a one-off. The same pattern has now hit twice during Phase 1:

1. Sub-phase 12: `.gitignore` for `snapshots/*` would have ignored `phase-1-end.json` — caught and fixed before commit
2. Sub-phase 12 close: `.gitignore` for `handoffs/*.md` ignored `2026-04-22-phase-1-complete.md` — shipped broken, caught by the first cold-start session

Writing a policy in a README doesn't enforce it. The gap between policy and `.gitignore`/hook/rule is **silent** — nothing in CI surfaces it until a user-visible effect appears. A proactive harness check would have caught both cases.

## Impact

- Files touched: `.gitignore`, `.claude/handoffs/2026-04-22-phase-1-complete.md`
- Risk: low — narrows existing negation pattern
- Cursor parity regen needed: no
- Promoted to failure mode `FM-0004` so the pattern is visible to future sessions

## Follow-ups

- [x] `.gitignore` narrowed (commit `bd11c73`)
- [x] Phase 1 handoff now tracked
- [x] LRN-0006 captured
- [x] FM-0004 promoted: README policy vs. gitignore drift
- [ ] Phase 2: write a structural harness fixture that reads every `**/README.md` inside `.claude/` and cross-checks `.gitignore`/hook/rule-config against stated policy. Specifically: when a README says "tracked" for a path glob, verify `git check-ignore` returns not-ignored for sample matches
- [ ] Phase 2: extend the same check to promise-shaped language in `.claude/decisions/*.md` — if an ADR says "X is committed" or "X is enforced", a fixture should verify the enforcement artifact exists and matches

## Adjacent consideration

iCloud sync created 129 "`<filename> 2.<ext>`" conflict duplicates during the Phase 1 close session. Those were cleaned up in the same session but they're a symptom of a broader issue: iCloud + multi-process git is a known-bad combination, and the rebuild has hit it multiple times (Sub-phase 1 `rm` permissions, Sub-phase 7 UTF-8 byte corruption, and now the conflict files). **Captured separately as FM-0005** so the pattern is visible to future sessions; relocating the repo off iCloud is a maintainer decision.
