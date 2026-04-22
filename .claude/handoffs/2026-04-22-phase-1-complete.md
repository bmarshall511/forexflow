# ForexFlow V3 — Phase 1 Completion Handoff

**Generated:** 2026-04-22 — Phase 1 Sub-phase 12 completion dogfood
**Agent config version:** 0.2.0
**Next phase:** 2 — Monorepo skeleton via `/bootstrap`

This handoff was produced as part of the Phase 1 stop criterion (per ADR 0001). A new session that kicks off Phase 2 pastes the block at the bottom into a fresh chat.

## Read these first, in order

1. `.claude/plans/active.md` (resolves to `phase-2.md` after this commit)
2. `.claude/CLAUDE.md` — the non-negotiables, especially #13 about timing claims
3. `.claude/context/domain.md`, `stack.md`, `conventions.md`
4. `.claude/decisions/0001-v3-greenfield-rebuild.md` through `0007-phase-1-complete.md`
5. `.claude/failure-modes.md` — especially FM-0001 (speculation-as-authority) before writing any prose about future work
6. `.claude/learnings/0005-fabricated-phase-cutover-claim.md` — read once; the pattern is the single biggest trap
7. `.claude/skills/bootstrap/SKILL.md` — Phase 2's entry-point skill

## State summary

- **Branch:** `v3`
- **Last commit:** Sub-phase 12 completion (the commit this handoff ships with)
- **Previous commit:** `3c78e75 feat(ci): CI workflows, commitlint, Renovate, semantic-release scaffolding`
- **Staged:** none after the Sub-phase 12 commit
- **Uncommitted:** none expected
- **Harness:** 27/27 green
- **Phase 1 snapshot:** `.claude/snapshots/phase-1-end.json`

## What's done (Phase 1)

All 12 sub-phases committed, snapshot written, version bumped to 0.2.0, CHANGELOG promoted.

| Sub-phase | Commit | What |
|---|---|---|
| 1 | 96d4c0e | Clear slate, repo hygiene, LICENSE, mise, .github/ templates |
| 2 | 0e1a901 | `.claude/` foundation — CLAUDE.md, context, plans, settings |
| 3 | 83a05f2 | 16 path-scoped rules |
| 4 | 6e44113 | 17 hooks wired |
| 5 | 6bbb57f | 13 specialist agents |
| — | 51e6202 | 5 ADRs + deferred-follow-up pins in phase-1.md |
| 6 | fd549ea | 29 skills (30 after /learn added in SP8) |
| 7 | c4e56db | Cursor-parity generator + activated ide-parity hook |
| 8 | ad0f125 | Test harness + continuous-learning loop + LRN-0001..0005 |
| 9 | bc03d94 | LRN-0005 guardrails + rejected ADRs + failure-modes + meta dirs |
| 10 | 6cc6fdf | `docs/requirements/` scaffolding + activated requirements hooks |
| 11 | 3c78e75 | 7 CI workflows + commitlint + Renovate + semantic-release |
| 12 | (this commit) | Phase 1 completion — snapshot, ADR 0007, version bump, handoff |

## What's next (Phase 2)

**Monorepo skeleton via `/bootstrap`.** The skill's procedure is canonical; read `.claude/skills/bootstrap/SKILL.md` in full before starting. Summary:

1. Start with `/bootstrap` (dry-run mode by default) — produces a file plan for the root + packages + apps scaffold
2. Maintainer reviews the dry-run output
3. Run `/bootstrap apply` — writes every file, runs `pnpm install`, runs `/verify`, runs `/review` + `/security-review` + `integration-reviewer` on the full diff
4. Commit as `feat(repo): bootstrap Phase 2 monorepo skeleton`

**Key activations that happen during Phase 2:**

- `pre-commit-continuous-green` flips from fail-open to enforcing the moment root `package.json` exists with typecheck/lint/test scripts
- `ci-push.yml` starts running its lint/typecheck/test job on PRs
- `ci-pr.yml` stays inert until `apps/web/` exists (Phase 7); `release.yml` stays inert until the maintainer decides to merge to `main`

## Non-obvious decisions made during Phase 1

- **Fail-open bootstrap posture (ADR-0002)**: every hook that depends on not-yet-shipped infrastructure detects the missing dependency and silently allows, then activates automatically as soon as the dependency lands. No manual flip required — the harness confirmed both states for six hooks
- **Agent-authored plans are proposals, not commitments** (LRN-0005, rule 00 §2): the `.claude/plans/*.md` files and roadmap tables are the agent's own speculative planning, not maintainer-ratified schedules. Never cite them as authority for timing or cutover claims. CLAUDE.md Non-negotiable #13 enforces this. FM-0001 catalogs the pattern
- **Cursor parity is generated** (ADR-0007 rejected documenting this at first; done via Sub-phase 7 generator): `.claude/rules/` is source of truth; `.cursor/rules/` is produced by `scripts/sync-ide-rules.mjs`. `pre-commit-ide-parity` enforces regeneration
- **Credentials never in `.env`** (rule 11): `.env` holds only infrastructure values (DATABASE_URL, port, log level, NEXT_PUBLIC_DEPLOYMENT_MODE). OANDA keys, Anthropic keys, webhook tokens all live in the in-app Settings UI, encrypted AES-256-GCM at rest
- **Continuous-learning loop (ADR-0006)**: corrections, false-positives, recurring fix-ups get captured as `LRN-*` files and proposed as config edits. Five learnings already recorded — four of them caught bugs the harness or maintainer surfaced and fixed same-session

## Open questions for maintainer

- Does `/bootstrap` apply mode want the maintainer on hand for the interactive review, or should the scaffold-then-review-diff be the autonomous default? (Current SKILL.md says dry-run first is the default; apply requires explicit invocation.)
- Commit scope for the monorepo scaffold commit: `repo` or `ci`? Recommendation: `repo`, since the scaffold adds the project shell rather than modifying CI workflows.
- Are there any Phase 1 artifacts the maintainer wants to revisit before Phase 2 writes the first `package.json`? (If so, Phase 2 pauses until they land.)

## Verification recipe (new session runs these to confirm state)

```bash
# Branch + top commit
git branch --show-current                # expect: v3
git log --oneline v3 -1                  # expect: Phase 1 sub-phase 12 completion

# Active plan points at phase-2.md
readlink .claude/plans/active.md         # expect: phase-2.md
head -3 .claude/plans/phase-2.md         # expect: "# Phase 2 — Monorepo..."

# Harness
node .claude/test-harness/run.mjs        # expect: 27 passed, 0 failed

# Version + changelog
cat .claude/VERSION                      # expect: 0.2.0
grep '^## \[0.2.0\]' .claude/CHANGELOG.md  # expect: exactly one line

# Snapshot
ls .claude/snapshots/phase-1-end.json    # expect: present
```

## Paste this into the new chat

---

Continuing ForexFlow V3 rebuild. Phase 1 is complete; Phase 2 begins.

Read these in order before taking any action:

1. `.claude/plans/active.md` (resolves to `phase-2.md`)
2. `.claude/handoffs/latest.md` (this handoff)
3. `.claude/CLAUDE.md` — non-negotiables #1-13
4. `.claude/failure-modes.md` — FM-0001 especially
5. `.claude/skills/bootstrap/SKILL.md` — Phase 2's entry-point skill

Then run `/status` to confirm the session state matches the handoff's verification recipe. If it does, the first real action is `/bootstrap` in dry-run mode. Do **not** apply until the maintainer reviews the dry-run.

No timing claims. The cutover from `v3` to `main` is the maintainer's decision alone (CLAUDE.md #13).

---
