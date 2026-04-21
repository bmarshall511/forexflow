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
