---
name: why
description: Explain a decision — read ADRs + git blame + related rules for a file, function, flag, or pattern, and return the rationale
disable-model-invocation: false
model: sonnet
args:
  - name: target
    type: string
    required: true
    description: A file path, function name, config key, rule ID, or free-text question
dispatches: [explorer]
version: 0.1.0
---

# /why `<target>`

Answer "why is this the way it is?" for anything in the repo. Pulls together ADRs, rule files, CLAUDE.md gotchas, and git blame to produce a rationale a cold reader can trust.

## When to run

- A reader inherits a file and needs the context behind a non-obvious choice
- A reviewer wants to confirm a pattern is intentional before flagging it
- A new teammate is onboarding to an area
- The `/contribute` skill dispatches this while walking onboarding

## Procedure

Given `<target>`:

1. **Classify the target:**
   - File path (`apps/web/src/components/positions/position-card.tsx`)
   - Exported symbol (`calculatePositionSize`)
   - Config key (`DATABASE_URL`, `hooks.PreToolUse`)
   - Rule ID (`rules/07-file-size.md`)
   - ADR ID (`#0002`)
   - Free text ("why is daemon on Hono and not Express?")
2. **Gather sources** appropriate to the classification:
   - **ADRs**: grep `.claude/decisions/**` for the target — both accepted and rejected
   - **Rules**: identify rules whose `scope` or body mentions the target
   - **CLAUDE.md files**: grep root + per-package `CLAUDE.md` for mentions
   - **Failure modes**: grep `.claude/failure-modes.md`
   - **Git blame**: for a file or symbol, `git log --follow --oneline <file>` and read the most illuminating commit messages (not every one — look for feat/refactor/fix entries that shaped the current shape)
   - **Context files**: `.claude/context/stack.md` often holds "why we picked X over Y" tables
3. **Dispatch `explorer`** for bulk searches to keep the Opus-level reasoning tokens focused on synthesis
4. **Synthesize** the rationale into a short document that leads with the decision and supports it with citations
5. **Call out contradictions** — if git history says one thing and an ADR says another, that is itself a finding worth surfacing

## Output shape

```markdown
# Why: <target>

**Target kind:** file | symbol | config | rule | ADR | free text

## One-line answer

<the single-sentence decision>

## Sources

- **ADR #<id>** — <title> — <one-line summary of relevance>
- **Rule `<path>` §<section>** — <relevance>
- **`<CLAUDE.md>` §<section>** — <relevance>
- **Commit `<sha>`** — <subject; author omitted per no-individuals rule>
- **Failure mode `<name>`** — <relevance>

## Full rationale

<2–4 paragraphs synthesizing the sources into the story of how the current
design came to be.>

## Alternatives rejected

- <option> — rejected because … (cite the ADR in `.claude/decisions/rejected/`
  when one exists)

## Contradictions found (if any)

- <area X says one thing; area Y says another — surface the gap>

## Recommended next step

- If the rationale is still current: cite it and move on
- If the rationale has aged out: propose a superseding ADR
- If contradictions exist: propose reconciliation (usually: dispatch
  `meta-reviewer`)
```

## What not to do

- Invent reasons the sources don't support
- Summarize without citation — every claim links to a source
- Include individuals' names when citing commits (use SHA + subject)
- Speculate about alternatives not actually considered
- Paste long source excerpts when a short quote suffices

## Failure mode

If no sources mention the target, return a `NOT_FOUND`-style response and suggest:

- Writing an ADR now (the target is undocumented and the current session is the latest moment when the reasoning is known)
- Updating the relevant CLAUDE.md
- Checking whether this is "unknown territory" per rule 00

## Time / cost

Sonnet-tier. Expect 1–3 tool calls for the Explorer + the synthesis.
