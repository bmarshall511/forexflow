# Failure-Mode Catalog

Durable record of catastrophic or recurring failure patterns the project has seen, each paired with the rule, hook, or skill that prevents recurrence. Read before undertaking anything in the pattern's blast radius.

Distinct from `.claude/learnings/` — learnings are small corrections with proposed edits; failure modes are **patterns that warranted a permanent guard**. A learning can promote into a failure mode when its fix needs to live here for long-term visibility.

## Format

Each entry:

```markdown
## FM-NNNN — Short title

**First seen:** YYYY-MM-DD · **Category:** <category>
**Signature:** what you will observe if this failure happens again
**Prevention:** rule / hook / skill / agent that guards against it
**Origin:** LRN / ADR / incident link

### What happened

1–2 paragraphs describing the pattern.

### Why it was dangerous

Concrete impact. Be specific: lost data, security exposure, silent drift,
hours to diagnose, user harm.

### What catches it now

Exact mechanism. If multiple layers, list them.

### How to recognize it next time

The shape you'd see in a diff, log, or review comment.
```

## Catalog

### FM-0001 — Agent cites its own speculation as authority

**First seen:** 2026-04-21 · **Category:** fabrication / reasoning
**Signature:** timing, release, or cutover claim in prose that references a `.claude/plans/*.md` roadmap, sub-phase sequence, or other agent-authored document as the source of the claim.
**Prevention:** `.claude/CLAUDE.md` Non-negotiable #13 + `.claude/rules/00-foundation.md` §2 ("Agent-authored plans are proposals, not commitments") + `meta-reviewer` on every `.claude/` edit.
**Origin:** [`LRN-0005`](./learnings/0005-fabricated-phase-cutover-claim.md)

#### What happened

Sub-phase 2 CLAUDE.md shipped with _"`v3` will replace `main` when Phase 1 completes."_ — false. Sub-phase 8's attempted "fix" was worse: _"at the Phase 14 cutover, after every rebuild phase in phase-1.md has completed"_ — also false, and this time cited an agent-authored roadmap table as if it were a maintainer commitment.

#### Why it was dangerous

The agent had already recorded its own speculation as a plan; it then treated that plan as authoritative. If the maintainer hadn't caught it twice in-session, the false commitment would have propagated into `CONTRIBUTING.md`, the public README, commit messages, and external docs. Ratcheting false commitments into public docs is the kind of thing that embarrasses a maintainer and misleads contributors.

#### What catches it now

- CLAUDE.md Non-negotiable #13 explicitly names "timing / cutover / release claims" as a class requiring a maintainer-authoritative source
- Rule 00 §2 forbids treating agent-authored plans as commitments
- `meta-reviewer` reads `.claude/` edits and will flag claims that cite plan documents as authority for timing statements

#### How to recognize it next time

Any sentence with the shape "_X will happen when Phase N completes_" or "_v3 replaces main at <trigger>_" or "_release is targeted for <date>_" — and the supporting citation is a file under `.claude/plans/` or `.claude/decisions/` that the agent itself wrote in an earlier sub-phase. Stop and ask. Strip the claim. Ask the maintainer.

---

### FM-0002 — Settings-file skipped entirely due to invalid schema key

**First seen:** 2026-04-21 · **Category:** config validity / silent drop
**Signature:** Claude Code prints a Settings Error, and subsequent hooks don't fire because the whole settings file was rejected.
**Prevention:** stop using `_comment` / `_note` keys inside strict-schema subtrees (`hooks`, `permissions.*` at their typed levels); documentation goes in neighboring README / MD files.
**Origin:** [`LRN-0004`](./learnings/0004-settings-json-comment-key-invalid.md)

#### What happened

`.claude/settings.json` was seeded with `_comment` keys intended as inline documentation. The Claude Code v2.1.42 schema enforces the `hooks` object's keys as a closed enum (event names only). The entire file was rejected with a single "Invalid key in record" error, and every hook ceased firing until the keys were removed.

#### Why it was dangerous

Silent degradation. Hooks appeared to not be running, and nothing else about the session looked wrong. If the maintainer hadn't noticed the error dialog, an invalid settings file would have disabled every guardrail while work proceeded as normal.

#### What catches it now

- Knowledge captured here and in LRN-0004
- Sub-phase 11 CI work will include a JSON-schema validator in the `claude-config` workflow

#### How to recognize it next time

If a hook that worked yesterday stops firing today with no code changes to the hook itself, check `.claude/settings.json` for a schema error. The error output names the invalid key and the path under `hooks` / `permissions` / `sandbox`.

---

### FM-0003 — Regex lookbehind accidentally rejects the primary case

**First seen:** 2026-04-21 · **Category:** hook / regex
**Signature:** a hook that should block a common pattern silently allows it; adding a test-harness fixture catches it immediately.
**Prevention:** every strict-rule hook ships with a harness fixture exercising both a known-violation and a known-compliant input; fixtures live in `.claude/test-harness/fixtures/hook-*.mjs` and run in CI.
**Origin:** [`LRN-0001`](./learnings/0001-no-any-regex-false-negative.md), [`LRN-0002`](./learnings/0002-commit-message-dash-m-regex.md)

#### What happened

Two hook regexes had clever-but-wrong boundary handling:

- `pre-edit-no-any` required a non-identifier char before `:`, which rejected the most common `paramName: any` case (false negative)
- `pre-commit-requirements-sync` omitted the whitespace between `-m` and the commit message, so `git commit -m "feat(...): ..."` didn't parse

Both hooks appeared to work in isolation against the cases the author had in mind, but failed against real-world inputs until the test harness surfaced them.

#### Why it was dangerous

The hooks were enforcing nothing. The agent could have shipped `x: any` code and `feat()` commits without requirement links all the way through Phase 7 before anyone noticed.

#### What catches it now

- The test harness (Sub-phase 8) runs every hook against synthetic violations
- Structural fixture `structure-rule-hook-coverage.mjs` asserts every strict rule has a backing hook or reviewer
- New hooks must ship with a fixture in the same commit

#### How to recognize it next time

A review feedback note like "I thought the hook was supposed to catch this?" is the smoke signal. Check whether the hook has a corresponding harness fixture and whether that fixture exercises _this specific input shape_. If it doesn't, the fixture is the first deliverable of the fix.

---

### FM-0004 — README policy drifts silently from .gitignore / hook / rule enforcement

**First seen:** 2026-04-22 · **Category:** meta / policy-drift
**Signature:** a cold-start session or cold-checkout clone fails because a file a README described as "tracked / committed / enforced" is in fact not, due to a broader ignore/hook/rule pattern that captured it.
**Prevention:** narrow ignore/rule patterns so they match the README's stated policy; cross-check via a structural harness fixture that reads every `.claude/**/README.md` claim and verifies the enforcement artifact agrees.
**Origin:** [`LRN-0006`](./learnings/0006-policy-enforcement-drift-handoff-gitignore.md)

#### What happened

Phase 1 close shipped with the Phase 1 completion handoff gitignored — the `.gitignore` pattern `.claude/handoffs/*.md` was too broad and caught the file even though `handoffs/README.md` explicitly said phase-boundary handoffs are durable reference artifacts. The first cold-start session broke at the reading-list step because `latest.md` pointed at a file that didn't exist on a fresh clone. Same class of issue almost bit `snapshots/*` and was caught proactively mid-Sub-phase-12.

#### Why it was dangerous

The failure is **silent until a cold-start session hits it** — there's no CI signal, no hook warning, no visible artifact. The repo looks healthy to the author because the file exists locally. The handoff system was designed precisely for cold-start continuity and this class of drift defeats it.

#### What catches it now

- `.gitignore` narrowed: `!.claude/handoffs/*-phase-*-complete.md` so phase-boundary handoffs are tracked
- LRN-0006 captures the pattern and the specific fix
- Pending (Phase 2): a structural harness fixture that reads every `.claude/**/README.md`, extracts "tracked" / "committed" / "enforced" claims about paths, and verifies `git check-ignore` and enforcement artifacts agree

#### How to recognize it next time

A README sentence like "X is committed / tracked / enforced" paired with a `.gitignore` / hook / rule that could possibly catch X. If either artifact is broader than the other, there's drift. Also: any cold-start session that can't find a file it was told to read is this pattern until proven otherwise.

---

### FM-0005 — iCloud sync generates "<filename> 2.<ext>" conflict duplicates across the repo

**First seen:** 2026-04-22 · **Category:** environment / sync-conflict
**Signature:** `git status` shows dozens of untracked files with the suffix pattern ` 2` before the extension (e.g., `README 2.md`, `claude-config 2.yml`, `.counter 2`). They appear anywhere in the tree iCloud is syncing.
**Prevention:** long-term — relocate the repo out of iCloud-synced paths. Short-term — clean conflict duplicates before committing via `find . -name "* 2.*" -not -path "./.git/*" -delete` plus explicit `rm` for the extension-less cases.
**Origin:** Phase 1 Sub-phase 12 close; also referenced in LRN-0006 "Adjacent consideration"

#### What happened

During Phase 1 close, ~129 conflict-duplicate files materialized across `.claude/`, `.github/`, `scripts/`, and root-level files. iCloud's conflict-resolution writes both versions with ` 2` appended before the extension. Left uncleaned, `git add .` on the next commit would have included them all.

This is the fourth iCloud-related incident during the rebuild:

1. Sub-phase 1 — `rm` blocked on iCloud-xattr-marked `.mcp.json` (sandbox permission issue)
2. Sub-phase 7 — UTF-8 byte corruption in a file with a Unicode character (iCloud re-encoded on sync)
3. Sub-phase 7 — `cp` to `/tmp` blocked by sandbox on iCloud-xattr-marked files
4. Sub-phase 12 close — conflict duplicates across 129 files

#### Why it was dangerous

Any `git add -A` or `git add .` after iCloud syncs a conflict silently commits the duplicate files. Even if `git status` lists them as untracked, busy sessions skip over the output. The duplicates pollute every subsequent operation (harness sees extra files, directory listings get confusing, imports could accidentally resolve to ` 2` variants).

#### What catches it now

- This failure-mode entry exists so future sessions recognize the pattern
- Short-term playbook: `find . -name "* 2.*" -not -path "./.git/*" -not -path "./node_modules/*" -delete`; follow up with explicit `rm` for extension-less cases like `VERSION 2`
- Long-term: relocate the repo out of iCloud — captured as an open decision for the maintainer; a future ADR would formalize the relocation path

#### How to recognize it next time

`git status` after any session that had multiple processes writing to the repo (Claude Code + VS Code + terminal + another editor all touching the same files via iCloud sync) — if the output contains `??  "<filename> 2.<ext>"` entries, this is FM-0005. Clean before staging.
