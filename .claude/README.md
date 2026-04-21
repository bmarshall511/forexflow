# ForexFlow AI Agent Configuration

This directory configures how AI coding agents (Claude Code, Cursor) develop the ForexFlow codebase. It is a first-class part of the project — versioned, tested, and reviewed with the same rigor as application code.

If you are a contributor landing here for the first time, read [`CLAUDE.md`](./CLAUDE.md) first. This file is the catalog.

## Directory layout

```
.claude/
├── CLAUDE.md              Master project instructions (agents read this first)
├── README.md              This file — the catalog
├── VERSION                SemVer for the agent configuration itself
├── CHANGELOG.md           Keep-a-Changelog record of configuration changes
├── settings.json          Shared sandbox, permissions, and hook wiring
├── settings.local.example.json   Template for per-user settings (gitignored)
├── failure-modes.md       Catalogued failure modes and their fixes
│
├── context/               Canonical context agents reference (single source of truth)
│   ├── domain.md          What ForexFlow is, forex glossary
│   ├── stack.md           Target technology stack
│   └── conventions.md     Naming, commits, branches, imports
│
├── rules/                 Path-scoped rules with machine-readable frontmatter
│   ├── 00-foundation.md   Applies to all files
│   ├── 01-typescript.md   Applies to **/*.{ts,tsx}
│   └── ...                (populated in Sub-phase 3)
│
├── hooks/                 Executable guardrails fired on tool events
│   ├── guard-bash.mjs
│   ├── pre-edit-*.mjs
│   ├── post-edit-*.mjs
│   ├── pre-commit-*.mjs
│   └── ...                (populated in Sub-phase 4)
│
├── agents/                Specialist sub-agents (tool-allowlisted, model-routed)
│   ├── code-reviewer.md
│   ├── security-reviewer.md
│   └── ...                (populated in Sub-phase 5)
│
├── skills/                Slash-command workflows (/verify, /handoff, etc.)
│   └── ...                (populated in Sub-phase 6)
│
├── plans/                 Active rebuild plan + archived phase plans
│   ├── active.md          Symlink to the currently active phase plan
│   ├── phase-1.md         Phase 1 — AI agent configuration
│   └── README.md          How plans work; phase-transition gate
│
├── decisions/             Architecture Decision Records (ADRs)
│   ├── 0001-*.md          Numbered, dated, immutable once merged
│   ├── rejected/          Ideas considered and explicitly rejected
│   └── _template.md
│
├── journal/               Monthly session journals (auto-written by agents)
│   └── YYYY-MM.md
│
├── handoffs/              Context-transfer prompts for session continuity
│   ├── latest.md          Symlink to the most recent handoff
│   └── YYYY-MM-DD-HHMM.md (gitignored content; structure committed)
│
├── snapshots/             Phase-completion snapshots (tests, bundle, LOC, coverage)
│
├── telemetry/             Per-invocation agent cost tracking
│
└── test-harness/          Synthetic violations that verify every hook fires correctly
    ├── run.mjs
    └── fixtures/
```

## Agents

Specialist sub-agents live in `agents/`. Each has a declared model, tool allowlist, and verdict schema. The main interactive agent orchestrates; specialists implement.

Populated in Sub-phase 5. See `.claude/plans/active.md` for current phase status.

## Skills (slash commands)

Skills are invoked with `/<name>`. Full list populated in Sub-phase 6. The headline ones:

| Skill | Purpose |
|---|---|
| `/status` | Health dashboard of the entire `.claude/` system |
| `/verify` | Full preflight: typecheck, lint, test, format, security, diff |
| `/review` | Dispatch `code-reviewer` on staged changes |
| `/security-review` | Dispatch `security-reviewer` |
| `/handoff` | Generate a context-transfer prompt for a new session |
| `/bootstrap` | Scaffold the monorepo skeleton (Phase 2 entry point) |
| `/phase-complete` | Gate the transition from one phase to the next |

## Rules

Rules are path-scoped markdown files with machine-readable frontmatter:

```yaml
---
name: typescript-strict
scope: ["**/*.ts", "**/*.tsx"]
enforcement: strict          # strict | advisory
version: 0.1.0
related: ["hooks/pre-edit-no-any.mjs", "agents/code-reviewer.md"]
applies_when: "Editing TypeScript source files"
---
```

The main agent loads a rule when the file it is editing matches the rule's `scope`. The `meta-reviewer` agent and the `/stale-rules` skill keep rules consistent and free of broken references.

## Hooks

Hooks fire on tool events (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`). They are small, focused, and either block the tool call with an explanation or run silently.

Enforcement is **strict by default**. If a hook blocks you and you believe the rule is wrong for this case, file an appeal ADR under `.claude/decisions/` rather than bypassing the hook.

## Cursor parity

Everything under `.claude/rules/` is the single source of truth. The `.cursor/rules/` directory is **generated** from `.claude/rules/` by `scripts/sync-ide-rules.mjs`. The `pre-commit-ide-parity` hook blocks commits that change one without regenerating the other.

Do not edit `.cursor/rules/*.mdc` by hand.

## Invoking agents and skills

**In Claude Code**: `/<skill-name>` or mention an agent by name (e.g. "use the code-reviewer agent on this diff").

**In Cursor**: the equivalent commands live under `.cursor/commands/` (generated).

## Contributing to `.claude/`

The agent configuration itself is a contribution target. Propose changes through:

1. Edit the relevant file
2. The `post-edit-meta-log` hook auto-appends to `CHANGELOG.md`
3. For non-trivial changes, write an ADR in `decisions/`
4. The `meta-reviewer` agent reviews the diff
5. Bump `VERSION` if the change is user-visible

Non-trivial includes: adding/removing a rule, changing enforcement posture, adding an agent, restructuring the directory layout.

## Health check

Run `/status` any time to see:

- Current phase and sub-phase
- Rule count (active, stale)
- Hook count (installed, firing correctly)
- Agent count (declared, tested)
- Skill count (invocable)
- Last successful `/verify` run
- Cost spent this month
- Requirements coverage

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — the project instructions every session loads
- [`plans/active.md`](./plans/active.md) — what we're building right now
- [`context/stack.md`](./context/stack.md) — the target technology stack
- [`failure-modes.md`](./failure-modes.md) — what has gone wrong before and how we caught it
