# Contributing to ForexFlow

Thanks for your interest. ForexFlow is an open-source project and contributions are welcome — from bug reports and documentation fixes to full features.

This guide covers the contribution workflow. For the coding standards the project enforces, see the files under [`.claude/rules/`](./.claude/rules/).

## Ground rules

- Be kind. All participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Discuss before building. For anything non-trivial, open a [Discussion](https://github.com/bmarshall511/forexflow/discussions) or issue first. We don't want you to waste time on a PR that doesn't fit.
- Security issues never go in public — see [`SECURITY.md`](./SECURITY.md).
- During the `v3` rebuild, the `main` branch is frozen. Contribute on top of `v3`.

## Prerequisites

- [mise](https://mise.jdx.dev/) for toolchain version management
  - Installs Node, pnpm, and anything else the project pins
- An editor with AI assistance (optional but recommended):
  - [Cursor](https://cursor.com), or
  - VS Code with the [Claude Code extension](https://claude.com/claude-code)

From a fresh clone:

```bash
mise install          # installs the pinned Node + pnpm versions
pnpm install          # installs project dependencies (once they exist)
```

See [`docs/dev/GETTING_STARTED.md`](./docs/dev/GETTING_STARTED.md) for the full local setup walkthrough.

## Workflow

1. **Fork + clone** the repository (or create a feature branch if you have push access)
2. **Branch from `v3`**, not from `main`
3. **Name your branch** descriptively: `feat/<scope>/<short-description>` or `fix/<scope>/<short-description>`
4. **Make your change**. The repository ships with a configured AI agent setup; if you use Cursor or Claude Code, the rules and hooks will guide you
5. **Tests are required** for most changes (see below)
6. **Commit using conventional commits** — see below
7. **Push and open a pull request** against `v3`
8. **Fill out the PR template completely** — linked requirement ID, test evidence, security considerations

## Conventional commits

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, enforced by commitlint:

```
<type>(<scope>): <short description>

<optional longer body>

<optional footer>
```

Accepted `<type>` values: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `style`.

Accepted `<scope>` values grow as the project grows. The current enum lives in [`commitlint.config.mjs`](./commitlint.config.mjs) (added in a later sub-phase of Phase 1). During Phase 1 rebuild, scopes include: `claude`, `docs`, `ci`, `repo`, `agents`, `hooks`, `skills`, `rules`.

Example:

```
feat(web): add equity curve drawdown overlay

Overlays peak-to-trough drawdown segments on the equity curve so a
trader can see where their worst stretches were. Respects the
prefers-reduced-motion setting.

@req: REQ-ANALYTICS-014
```

## Tests

Most non-trivial changes require tests. The project uses:

- **Vitest** for unit + integration tests
- **Playwright** for end-to-end tests (required for any `apps/web/**` change that touches UI behavior)
- **Contract tests** for API ↔ type-package consistency
- **Visual regression** for UI components

Tests live next to the code they test (`*.test.ts`, `*.test.tsx`) or under `apps/*/e2e/` for Playwright specs. Every test should reference the requirement it covers with a `// @req: REQ-ID` tag.

## The AI agent setup

ForexFlow is actively developed with AI tooling. The agent configuration under [`.claude/`](./.claude/) is considered part of the project and is treated with the same rigor as application code:

- Rules are versioned and schema-validated
- Hooks block violations at write time
- Agents have declared tool allowlists and verdict schemas
- `.cursor/rules/` is generated from `.claude/rules/` — don't edit `.cursor/` by hand

See [`.claude/README.md`](./.claude/README.md) for how to invoke agents and skills.

## Pull request checklist

Before opening a PR, make sure:

- [ ] Branch is based on latest `v3`
- [ ] Commit messages follow conventional commits
- [ ] Tests cover the change and pass locally
- [ ] No `any` in TypeScript (or a `// TODO(type):` comment explaining the exception)
- [ ] Any new exported symbol has JSDoc
- [ ] Documentation updated (the `pre-commit-docs-sync` hook will remind you)
- [ ] Requirements file updated if this is a new feature (the `pre-commit-requirements-sync` hook will remind you)
- [ ] No personal names, emails, or identifying handles in code, comments, tests, or docs
- [ ] PR description fills out every section of the template

## Questions

Open a [GitHub Discussion](https://github.com/bmarshall511/forexflow/discussions). We'd rather answer a question than see you struggle alone.
