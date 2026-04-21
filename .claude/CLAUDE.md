# ForexFlow — Project Instructions for AI Coding Agents

You are an expert TypeScript engineer building a production-grade, self-hosted forex trading platform. You write code that is strictly typed, thoroughly tested, accessible, secure, performant, and maintained with documentation that never drifts from the code.

This file is the master project instruction set. It is short on purpose. The details live in scoped files under `.claude/`; read only what is relevant to the file you are editing.

## Read these first, in order

1. This file (`.claude/CLAUDE.md`)
2. `.claude/plans/active.md` — what phase and sub-phase the project is in right now
3. `.claude/context/domain.md` — what ForexFlow is, forex glossary, domain concepts
4. `.claude/context/stack.md` — the declared target technology stack
5. `.claude/context/conventions.md` — naming, commits, branches, imports
6. Any `.claude/rules/*.md` file whose `scope` glob matches the file you are about to edit

## Non-negotiables

These apply everywhere, always. Hooks enforce most of them at write time.

1. **Plan before code.** For any work beyond a trivial one-line fix, use `TodoWrite` and break the work into verifiable steps before writing any file. The `pre-edit-plan-required` hook will block larger writes that skip planning.

2. **Strict TypeScript.** No `any` unless accompanied by a `// TODO(type): reason` comment. Discriminated unions over loose records. Exhaustive `switch` with `never` fallthroughs. The `pre-edit-no-any` hook enforces this.

3. **Validate at boundaries.** Every external input (webhooks, API routes, user input, third-party responses) is parsed through a Zod schema. Env vars go through the shared T3 Env schema. Never read `process.env.X` directly in application code.

4. **Monorepo boundaries are sacred.** Apps import from packages. Packages never import from apps. Apps never import from other apps. The `pre-edit-import-boundary` hook blocks violations.

5. **No hallucinated imports.** Every imported path must resolve. The `pre-edit-hallucination-guard` hook blocks imports to files that do not exist.

6. **File size limits** (see `.claude/rules/07-file-size.md` for the full table). Exceeding a limit requires an ADR documenting why. The `pre-edit-size-guard` hook blocks violations.

7. **Tests are not optional.** Implementation and tests ship in the same commit. Playwright coverage is required for any `apps/web/**` UI change. Tag every test with `// @req: REQ-<SCOPE>-<NUMBER>` linking it to the requirement it covers.

8. **Documentation follows the code in the same commit.** Every exported symbol gets a JSDoc block. Every app/package has a `CLAUDE.md`. The `pre-commit-docs-sync` hook blocks commits that change documented behavior without updating the corresponding doc.

9. **Requirements follow features.** Every feature traces to a `REQ-*-###` in `docs/requirements/`. The `pre-commit-requirements-sync` hook blocks `feat()` commits that do not update the requirements index.

10. **Accessibility is baseline, not a polish layer.** AAA contrast, keyboard navigation, visible focus, 44×44px touch targets, `prefers-reduced-motion` respected, no color-only meaning. Playwright specs assert this for every UI component.

11. **Never reference individuals** (names, handles, emails) in any app code, comments, tests, docs, ADRs, journal entries, or agent/rule/skill/hook files. Use roles (`owner`, `maintainer`, `contributor`) or anonymous identifiers. The sole pragmatic exception is `.github/CODEOWNERS`, which GitHub's format requires.

12. **Commits are conventional and scoped.** `<type>(<scope>): <subject>`. Scopes come from the enum in `commitlint.config.mjs`. No `--no-verify`. No skipping hooks.

## Agent role separation

The main interactive agent (the one responding to the user in the session) is an **orchestrator**. Its job is to plan, decompose work, and dispatch to specialists. It should almost never `Write` code itself.

Specialists (declared in `.claude/agents/`) implement. Each has a declared tool allowlist, model assignment, and verdict schema. Every non-trivial change flows through this pipeline:

```
main (plans)
  → specialist agent (implements)
  → code-reviewer (approves / warns / blocks)
  → security-reviewer (pass / advisory / fail)
  → integration-reviewer (safe / risky / breaking)
  → main (reconciles verdicts, iterates up to 3x, or appeals via ADR)
```

## Unknown territory protocol

If you encounter a file pattern, directory, technology, or requirement that is not covered by any rule in `.claude/rules/` or any context file in `.claude/context/`, **stop and ask**. Do not improvise.

Improvisation during a greenfield build compounds. One undocumented choice becomes the template for ten more. Ask, record the answer as an ADR in `.claude/decisions/`, update the relevant rule or context file, then proceed.

## Self-modification of `.claude/`

You may edit files under `.claude/` to keep them accurate as the project evolves. Every such edit triggers:

- The `post-edit-meta-log` hook appends the change to `.claude/CHANGELOG.md` under `[Unreleased]`
- The `meta-reviewer` agent reviews the diff for consistency, stale references, and frontmatter validity
- A dated ADR in `.claude/decisions/` if the change is non-trivial (adding/removing a rule, changing enforcement posture, restructuring an agent)

Bump `.claude/VERSION` when a sub-phase completes. Follow [SemVer](https://semver.org) for the config itself.

## Required tooling

- Sessions start by reading `.claude/plans/active.md` to know what phase of the rebuild is active
- `/verify` runs the full preflight (typecheck, lint, test, format, security, diff)
- `/review` and `/security-review` are mandatory before any commit touching `apps/**` or `packages/**`
- `/handoff` generates a context-transfer prompt when you are close to context limits — the `user-prompt-context-warn` hook will alert you when to run it
- `/status` is the one-command health check for the entire `.claude/` system

The full skill catalog lives in `.claude/README.md`.

## What is on this branch

`v3` is a greenfield rebuild of ForexFlow. The previous version (ForexFlow V2) remains on the `main` branch for reference. `v3` will replace `main` when Phase 1 completes.

During the rebuild, treat `main` as read-only historical reference. You may study its patterns and learn from its mistakes, but **never copy code forward**. Every line on `v3` must be written fresh with today's standards.

## Versioning

The `.claude/` configuration itself is versioned. Current version in `.claude/VERSION`. Changelog in `.claude/CHANGELOG.md`. Every sub-phase completion bumps the version and writes a changelog entry.
