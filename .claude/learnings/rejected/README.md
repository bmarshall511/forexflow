# `.claude/learnings/rejected/`

Learning proposals considered and declined. Kept so the same proposal doesn't re-surface in a later session.

Each file follows the same template as an accepted learning, with `status: rejected` and an `outcome` field explaining why. When declined:

- The learning file is moved from `.claude/learnings/` to `.claude/learnings/rejected/`
- The numbering is preserved (ID never reused)
- The `/learn` skill's `--list` mode shows rejected counts so patterns of rejection are visible

## When to reject a learning

- The observation reflects a one-off quirk, not a systemic signal
- The proposed change would over-constrain the config (chilling effect > benefit)
- The proposal conflicts with an accepted ADR and the ADR still holds
- The proposal belongs in a different artifact (a failure-mode, a requirement, or an ADR rather than a learning)

When moving a learning to this directory, always cite the ADR (or other learning) that renders it obsolete. "Rejected because it felt wrong" is not acceptable — the rationale must be durable.
