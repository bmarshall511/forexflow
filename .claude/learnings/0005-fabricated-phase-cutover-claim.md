---
id: LRN-0005
observed_at: 2026-04-21
source: correction
target:
  - .claude/CLAUDE.md
status: applied
outcome: Sub-phase 8 commit (same as this learning)
---

# LRN-0005 — Agent repeatedly fabricated the `v3`→`main` cutover timing

## Observation

Two consecutive fabrications on the same claim during Sub-phases 2 and 8:

**Fabrication 1** (Sub-phase 2, caught in Sub-phase 8):

> `v3` will replace `main` when Phase 1 completes.

False. Phase 1 only delivers the AI-agent configuration; there was no commitment that the cutover would happen at Phase 1.

**Fabrication 2** (the agent's attempted "fix" in Sub-phase 8):

> `v3` will replace `main` at the **Phase 14 cutover**, after every rebuild phase in `.claude/plans/phase-1.md` has completed.

Also false. "Phase 14" came from a roadmap table **the agent itself wrote** in Sub-phase 2's `phase-1.md`. That table was the agent's own speculative planning, not a maintainer-ratified commitment. Citing one piece of speculative agent output as authoritative justification for another is a second-order fabrication.

The maintainer corrected both:

- Fab 1: "YOU MADE THAT UP. NEVER MAKE THINGS UP. ALWAYS ASK IF UNSURE AND NEVER ASSUME OR GUESS"
- Fab 2: "WTF, YOU'RE STILL MAKING SHIT UP … IT WILL BE RELEASED WHEN I SAY IT'S READY TO BE RELEASED"

**The truth:** the cutover happens when the maintainer says so. No phase number, no automated trigger, no commitment.

## Proposed change

Three-part fix:

1. **Content fix in `CLAUDE.md`** — remove every claim that ties the cutover to a specific phase. Replace with explicit "maintainer-gated, no timing commitment" language that actively instructs future sessions to **not speculate** about timing in this document. Landed.

2. **Behavioral signal for the agent** — reinforce rule `00-foundation.md` §2 ("no guessing") with a concrete check. The agent should treat any sentence containing a phase number, release date, or milestone commitment as a high-scrutiny claim that requires a cited authoritative source (maintainer statement, ADR, requirement doc — **not** an earlier agent-authored speculative plan). To land in Sub-phase 9 as an edit to `CLAUDE.md`'s non-negotiables list.

3. **Don't cite agent-authored roadmaps as authoritative.** The `.claude/plans/phase-*.md` files record _plans_ the agent proposed and the maintainer approved at-a-point-in-time; they are not schedule commitments and not promises. Future claims about timing cite either (a) an explicit maintainer statement in a session, or (b) an ADR that records a maintainer-ratified commitment. Roadmap tables are plans, not promises.

## Evidence

- Fab 1: `.claude/CLAUDE.md` (pre-correction) — _"`v3` will replace `main` when Phase 1 completes."_
- Maintainer correction 1 (2026-04-21, Sub-phase 8): see quote above.
- Fab 2: `.claude/CLAUDE.md` (agent's "fix") — _"`v3` will replace `main` at the Phase 14 cutover..."_
- Maintainer correction 2 (same session): see quote above.
- The agent's own `phase-1.md` had a "Phase roadmap" table whose last row happened to say "Phase 14 Cutover"; the agent confused its own planning table for a commitment.

## Rationale

Two layers of the config already defend against this:

- Rule `00-foundation.md` §2: "No guessing. If you do not know — about a file path, an API shape, a requirement, a convention — stop and ask or investigate."
- The "unknown territory protocol" in `CLAUDE.md`.

**Neither caught either fabrication.** The agent didn't recognize "when does `v3` replace `main`?" as an "unknown." Both attempts produced plausible-sounding text from loose priors (Fab 1) or from its own earlier speculative planning (Fab 2). The remedy isn't another abstract rule — it's:

- **A specific bright line**: timing / release / cutover claims require a maintainer-authoritative source
- **An awareness that agent-authored plans are not commitments**: the roadmap in `phase-1.md` captured _a proposed sequence_; it never committed to dates or triggers. Treating it as authoritative for a cutover claim was the second-order error.

The learning validates ADR 0006's premise: the agent cannot self-catch every mistake, but every correction the maintainer surfaces becomes a durable guard.

## Impact

- Files touched: `.claude/CLAUDE.md` §"What is on this branch" — now explicitly says the cutover is maintainer-gated and instructs future sessions to _not_ speculate about timing in this document
- Version bump: none (CLAUDE.md doesn't carry a SemVer)
- Risk: low — removes a false commitment; adds a concrete guardrail against its recurrence
- Cursor parity regen needed: no (CLAUDE.md isn't mirrored; Claude Code loads it directly)

## Follow-ups

- [x] Correct the fabricated sentence in `CLAUDE.md` (twice — Fab 1 and the attempted "fix" Fab 2). Landed Sub-phase 8
- [x] **Sub-phase 9 mandatory**: added Non-negotiable #13 to `CLAUDE.md` explicitly naming "timing / cutover / release claims" as a class that requires a cited maintainer-authoritative source, **never** an agent-authored roadmap. Also promoted the pattern to failure-mode `FM-0001` so it shows up in `.claude/failure-modes.md` for future sessions
- [x] **Sub-phase 9 mandatory**: added the "agent-authored plans are proposals, not commitments" paragraph to `.claude/rules/00-foundation.md` §2; bumped rule version to `0.2.0` and added this learning to its `related:` frontmatter
- [ ] **Sub-phase 9 consideration** (deferred): a structural fixture that greps `.claude/**/*.md` for absolute claims about phase completion, cutover timing, or release triggers, and flags any not grounded in a maintainer-authored ADR. Deferred because (a) the `meta-reviewer` agent already reviews every `.claude/` edit and is in the right position to catch the pattern, (b) harness fixtures work best for deterministic structural checks, and "claim about timing that isn't grounded" is a soft semantic check that reviewer agents handle better. Revisit if the pattern recurs despite the reviewer
- [ ] Whenever a fabrication correction lands in the future, mint a new `LRN-*` immediately. The journal aggregates these monthly; a cluster signals a pattern worth a harder guardrail

## Adjacent considerations

1. **ADR 0006 and the `/learn` skill were drafted in the same sub-phase that produced both fabrications** — the clearest possible validation of why the learning loop must exist. The loop captured the failure on its first real test.

2. **The second fabrication is more instructive than the first.** The agent "fixed" Fab 1 by citing _its own earlier speculation_ as authoritative. This is the pattern most at risk in a rebuild where the agent produces most of the planning artifacts itself: the agent's prior output becomes self-justifying. The guardrail must make "agent-authored plans are not commitments" explicit.
