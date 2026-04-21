---
name: handoff
description: Generate a context-transfer prompt for a new session; writes .claude/handoffs/<ts>.md and refreshes the latest.md symlink
disable-model-invocation: false
model: sonnet
args:
  - name: note
    type: string
    required: false
    description: Optional one-line note appended to the "What's next" section
dispatches: []
version: 0.1.0
---

# /handoff

Produce a self-contained prompt a fresh Claude Code (or Cursor) session can paste in to resume exactly where the current session left off. Covers everything a cold reader needs: active phase, last commit, uncommitted state, non-obvious decisions, open questions, verification recipe, paste-ready continuation prompt.

## When to run

- At any natural stopping point
- When `user-prompt-context-warn` hook surfaces its ~80% or urgent warning
- Before closing a session you plan to continue later
- At the end of every sub-phase (dogfooded — Phase 1 completion requires `/handoff` to produce a useful output)

## Procedure

1. **Resolve current state:**
   - Current branch (`git rev-parse --abbrev-ref HEAD`)
   - Latest commit (`git log -1 --format="%h %s"`)
   - Staged files (`git diff --cached --name-only`)
   - Unstaged changes (`git diff --name-only`)
   - `cat .claude/plans/active.md | head -5` — phase + sub-phase
   - Latest TodoWrite list snapshot under `.claude/.session-state/plans/` if present
2. **Scan recent ADRs** (`.claude/decisions/` newest 5) for non-obvious decisions that a new session should know about
3. **Scan this month's journal entry** (`.claude/journal/YYYY-MM.md`) for "what happened this session" context
4. **Assemble the handoff** using the template below
5. **Write** to `.claude/handoffs/YYYY-MM-DD-HHMM.md` (ISO date + local HHMM — distinct within a day)
6. **Update** `.claude/handoffs/latest.md` symlink to point at the new file
7. **Print** the handoff's "Paste this into the new chat" block so the operator can copy it immediately

## Handoff template

```markdown
# ForexFlow V3 — Session Handoff

Generated: <ISO timestamp>
Phase: <N> — <title>
Sub-phase in progress: <N> of <total>
Agent config version: <.claude/VERSION>

## Read these first (in order)

1. `.claude/plans/active.md` (resolves to `phase-<N>.md`)
2. `.claude/CLAUDE.md`
3. `.claude/context/domain.md`, `stack.md`, `conventions.md`
4. `.claude/decisions/` (newest last — latest 5)
5. `.claude/handoffs/latest.md` (this file)
6. Any rule file under `.claude/rules/` whose scope matches files you'll edit

## State summary

- Branch: `<branch>`
- Last commit: `<sha>` — <subject>
- Staged: <count> file(s)
- Uncommitted: <count> file(s)
- Active TodoWrite list (if any): <bullets>

## What's done

<bulleted list of sub-phases completed in this session — include SHAs>

## What's next

<note passed as argument, if any>

<bulleted list of the immediate next steps per the active plan>

## Non-obvious decisions made this session

- <decision> — see ADR #<id> / file `<path>`
- <decision> — see ADR #<id> / file `<path>`

## Open questions for maintainer

- <question>
- (or "None")

## Verification recipe (new session runs these to confirm state)

1. `git log --oneline v3 -<N>` — expect `<top SHA>` as HEAD
2. `cat .claude/plans/active.md | head -10` — expect "Phase <N>, sub-phase <N>..."
3. `/status` — expect clean state (zero unwired hooks, zero stale references)
4. `ls -1 .claude/handoffs/` | tail -1 — expect this file

## Paste this into the new chat

---

Continuing ForexFlow V3 rebuild. Phase <N>, sub-phase <N>.

Read these in order before taking any action:

1. `.claude/plans/active.md`
2. `.claude/handoffs/latest.md`
3. `.claude/CLAUDE.md`

Then run `/status` to confirm the session state matches the handoff.
If it does, continue with sub-phase <N>: <one-line description>.
If it doesn't, stop and ask before proceeding.

---
```

## Output shape

```markdown
## Handoff generated

- File: `.claude/handoffs/YYYY-MM-DD-HHMM.md`
- Symlink updated: `.claude/handoffs/latest.md`
- Size: <bytes>

## Paste block

<the literal paste-block from the handoff for easy copy>

## Quality checks

- [ ] Every "Read these first" path resolves
- [ ] Verification recipe commands have been run and pass
- [ ] No personal names / emails / handles in the handoff body
```

## Dogfooding

At the end of every sub-phase the agent runs a `/handoff --dry-run` and reads its own output. If the output isn't sufficient to cold-start the next sub-phase, the handoff generator itself needs work — file a task, don't paper over it.

## Failure mode

If a required input doesn't exist (e.g., `.claude/plans/active.md` missing), the skill writes the handoff anyway with explicit gaps marked. A gap-filled handoff is better than no handoff.

## Exit

Prints the paste block. Exits. Does not automatically end the session — the operator decides when to do that.
