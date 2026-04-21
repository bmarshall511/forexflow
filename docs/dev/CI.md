# CI / CD

Reference for every automated workflow in `.github/workflows/`. Rule source: [`.claude/rules/10-git-workflow.md`](../../.claude/rules/10-git-workflow.md). Release automation: [`.releaserc.json`](../../.releaserc.json). Dependency automation: [`renovate.json`](../../renovate.json).

## Workflow catalog

| Workflow                                                                   | Triggers                 | Purpose                                                                              | Active from                                                  |
| -------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [`claude-config.yml`](../../.github/workflows/claude-config.yml)           | push + PR to `v3`/`main` | Runs the agent test harness, cursor-parity check, and JSON validation for `.claude/` | Phase 1 (now)                                                |
| [`agent-config-drift.yml`](../../.github/workflows/agent-config-drift.yml) | daily cron + manual      | Catches `.claude/` rot that didn't trigger on any individual PR                      | Phase 1 (now)                                                |
| [`codeql.yml`](../../.github/workflows/codeql.yml)                         | push + PR + weekly cron  | Static analysis for JS/TS; free on public repos                                      | Phase 1 (now)                                                |
| [`gitleaks.yml`](../../.github/workflows/gitleaks.yml)                     | push + PR                | Secret scanning; defensive layer atop `pre-commit-secrets-scan`                      | Phase 1 (now)                                                |
| [`ci-push.yml`](../../.github/workflows/ci-push.yml)                       | push + PR                | Lint + typecheck + test                                                              | **Skips until** `pnpm-workspace.yaml` + `package.json` exist |
| [`ci-pr.yml`](../../.github/workflows/ci-pr.yml)                           | PR                       | Build + Playwright E2E + contract tests                                              | **Skips until** monorepo + `apps/web/` exist                 |
| [`release.yml`](../../.github/workflows/release.yml)                       | push to `main` + manual  | semantic-release: version bump, CHANGELOG, GitHub Release                            | **Skips until** `package.json` + `.releaserc.json` exist     |

The three seeded-but-inert workflows (`ci-push`, `ci-pr`, `release`) activate automatically the moment the detected artifacts land. No human flip, per ADR-0002's fail-open bootstrap posture applied to CI.

## Required secrets

| Secret                              | Used by                                         | Populated by                                  | When                                  |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| `GITHUB_TOKEN`                      | every workflow                                  | auto-provided by GitHub Actions               | always                                |
| `RENOVATE_TOKEN`                    | (none yet; Renovate runs as its own GitHub App) | —                                             | when self-hosting Renovate, not today |
| Anthropic / OANDA / webhook secrets | **none in CI**                                  | rule 11 forbids CI access to user credentials | never                                 |

CI has no business with OANDA keys, Anthropic keys, or any user-owned credential. Those live in the in-app Settings UI (per rule 11) and never touch a workflow runner.

## Branch strategy during the rebuild

- **`v3`** is the active development branch. Every workflow runs against pushes and PRs on `v3`
- **`main`** is frozen for reference. When the maintainer decides `v3` is ready and merges, `main` becomes the active branch and `release.yml` starts producing versioned releases
- No phase number triggers the cutover. See CLAUDE.md Non-negotiable #13

## Commit conventions

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/). `commitlint` enforces the type + scope enum locally via `lefthook` pre-commit (when that ships in Phase 2's bootstrap) and via PR checks once CI gets a `commitlint` step.

**Type enum** (`commitlint.config.mjs`): `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `style`, `revert`.

**Scope enum**:

- Product apps: `web`, `daemon`, `cf-worker`, `mcp-server`, `desktop`
- Packages: `db`, `shared`, `types`, `config`, `logger`
- Infrastructure and meta: `claude`, `repo`, `docs`, `ci`, `agents`, `hooks`, `skills`, `rules`, `deps`

**Scope is required.** A commit without a scope fails commitlint. During Phase 1 the product-level scopes are placeholders (the apps don't exist yet); their reservation lets future commits land without re-editing the enum.

## Release automation

`release.yml` runs `semantic-release` on pushes to `main`. It:

1. Reads all commits since the last tag
2. Derives the next version per conventional-commits rules:
   - `feat` → minor bump
   - `fix` / `perf` / `refactor` / `revert` → patch bump
   - `BREAKING CHANGE:` footer → major bump
   - `docs` / `chore` / `test` / `ci` / `build` / `style` → no release
3. Updates `CHANGELOG.md` (root — distinct from `.claude/CHANGELOG.md`)
4. Creates a GitHub Release with release notes
5. Tags the commit

The configuration lives in `.releaserc.json`. The workflow's guard step skips until `package.json` exists — during Phase 1 nothing releases even if `main` receives commits.

## Dependency management

Renovate opens PRs for dependency updates. The [`dep-upgrade`](../../.claude/agents/dep-upgrade.md) agent evaluates each one, per rule 09:

- Patch / security-tagged — auto-merge if CI passes and no breaking notes
- Minor — needs-review with migration notes surfaced
- Major — always human-merge; flagged with `high-impact` label for the critical packages (Prisma, Hono, Electron, Next, React)

Full config in `renovate.json` with groupings for ESLint, Prettier, Vitest, Playwright, Hono, and `@types/*`.

## Cache + runner sizing

All Node-based workflows use:

- GitHub-hosted `ubuntu-latest`
- Node 22 via `actions/setup-node@v4` or `mise-action`
- pnpm as the primary package manager (installed via `npm install -g pnpm` in the handful of steps that need it; mise handles it in the rest)

No matrix builds currently. Node-version matrix arrives if we ever drop a Node-version floor; today the repo pins Node 22 in `mise.toml` and `.nvmrc`.

## Adding a workflow

1. Create `.github/workflows/<name>.yml`
2. Add an entry to the catalog table above with its triggers, purpose, and activation condition
3. If it checks `.claude/` structure, also add a fixture under `.claude/test-harness/fixtures/`
4. Update `.claude/config/doc-map.json` if the workflow documents behavior that requires a rule/doc update on future changes

## What CI does NOT do

- Run hooks (that's local, per rule 10)
- Deploy infrastructure (none is deployed remotely during the rebuild)
- Publish to npm (no package is published; the repo is self-hosted by design)
- Execute trades or touch real OANDA accounts (obviously; but worth stating)
