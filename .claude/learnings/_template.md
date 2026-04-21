---
id: LRN-NNNN
observed_at: YYYY-MM-DD
source: correction | hook-fp | hook-fn | harness-fail | review-override | recurring
target:
  - path/to/rule-or-hook-or-skill.md
status: observed
outcome: null
---

# LRN-NNNN — Short imperative title

## Observation

What happened, with enough specifics to reproduce. Link to the commit,
diff, hook output, or harness fixture that surfaced the signal.

## Proposed change

The concrete edit. File path, diff sketch, or a bullet list of the
specific modifications. No hand-waving — if the proposal isn't concrete
enough to implement, it's not ready to mint.

## Evidence

- Commit(s): `<sha>` ...
- Hook output: `<excerpt>`
- Fixture: `<path>` reported: `<message>`
- Grep count (for recurring issues): `<N> instances`

## Rationale

Why this edit specifically. Why not alternatives. Which rules /
decisions in `.claude/decisions/` this supports or tensions against.

## Impact

- Files touched: `<list>`
- Version bumps: `<rule>.md 0.1.0 → 0.2.0`
- Risk: `<none | low | medium | high>` + what could go wrong
- Cursor-parity regen needed: `<yes | no>`

## Follow-ups

- [ ] `meta-reviewer` approves
- [ ] Implementer applies
- [ ] `.cursor/` regenerated (if applicable)
- [ ] Learning `status` → `applied`; `outcome` → commit SHA
- [ ] Consider whether a harness fixture should assert the fix stays
