---
name: dependencies
scope: ["**/package.json"]
enforcement: strict
version: 0.1.0
related:
  - "agents/dep-upgrade.md"
  - "context/stack.md"
  - "decisions/rejected/"
applies_when: "Adding, removing, or updating a dependency in any package.json"
---

# Dependencies

Every dependency is a maintenance liability — security patches, breaking changes, abandonment, supply-chain risk. The answer to "should we add this" is usually "not yet."

## Before adding

Every new dependency must pass this checklist:

1. **Does the existing stack solve it?** Check `context/stack.md`. If Zod can validate it, don't add Joi. If shadcn has a primitive, don't add a second UI library.
2. **Is there an explicit rejection?** Check `decisions/rejected/`. If you're about to propose `drizzle-orm`, read `decisions/rejected/0001-drizzle-instead-of-prisma.md` first.
3. **Is it widely-adopted and actively-maintained?** Rule of thumb: ≥ 100k weekly npm downloads AND a commit in the last 90 days AND either a company backing or ≥ 20 active contributors in the last year.
4. **Does it have types?** TypeScript support is mandatory. `@types/*` from DefinitelyTyped counts if the package itself doesn't ship types. No untyped deps.
5. **Does it fit the runtime constraint?** `packages/shared` imports must work in browser, Node, Electron main, and Cloudflare Workers. Node-only modules do not go in `shared`.
6. **Does it respect our license posture?** MIT, Apache 2.0, BSD, ISC are fine. GPL and AGPL are not — they would force the project's license to change. Check `license` field in the package.

If it fails any of these: do not add it. File an issue or Discussion explaining the need; the maintainer will decide whether to overturn or find another path.

## Where does it go

- **Runtime dependency of an app** → that app's `package.json` `dependencies`
- **Runtime dependency of a package** → that package's `package.json` `dependencies`
- **Dev-only** (tests, tooling, types) → `devDependencies`
- **Shared across the monorepo at a fixed version** → pnpm catalog at the root `pnpm-workspace.yaml`
- **Never at the root `package.json` `dependencies`** — the root only holds workspace-tooling devDeps (Turbo, Prettier, ESLint, commitlint, lefthook, etc.)

## pnpm catalog

Versions used by multiple workspaces go in the pnpm catalog:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  react: ^19.0.0
  zod: ^3.23.0
  vitest: ^3.0.0
  # ...

catalogs:
  react19:
    react: ^19.0.0
    react-dom: ^19.0.0
```

Workspaces reference the catalog:

```json
{
  "dependencies": {
    "react": "catalog:react19",
    "zod": "catalog:"
  }
}
```

This guarantees every workspace uses the same version. Reviewer agents flag inconsistent versions across workspaces.

## Pinning

- **Libraries in `packages/*`**: version ranges with `^` (caret) — we want consumers to benefit from patch updates
- **Apps in `apps/*`**: also `^`, but tooling can be pinned exactly for build stability
- **Build tooling** (Vite, TypeScript, Prettier, ESLint): `^` at minor level
- **Security-critical** (encryption, auth): consider exact pinning with Renovate auto-PR on patch

## Upgrades

Two paths:

### Renovate (automated)

Renovate opens PRs for dependency updates. The `dep-upgrade` agent validates each:

- Patch and minor updates: auto-approve if CI passes and no breaking changes flagged in the changelog. Merged automatically.
- Major updates: agent reads the changelog, tests locally via `/verify`, produces a report with risks + migration notes. Human maintainer merges.

### Manual

`/dep-upgrade <package>` dispatches the `dep-upgrade` agent against a specific package. Same evaluation, same output.

## Adding a workspace dependency

When package A needs package B (both in `packages/` or apps):

```bash
pnpm add -D @forexflow/types --filter @forexflow/shared --workspace
```

The `workspace:` protocol resolves via the monorepo:

```json
{
  "dependencies": {
    "@forexflow/types": "workspace:*"
  }
}
```

Never use version ranges for internal packages.

## Banned

Categories of dependency the project explicitly refuses:

- **Packages with `install` scripts that run arbitrary code.** Exceptions require ADR (Prisma is one — its postinstall is mandatory; it's added to `onlyBuiltDependencies` in `pnpm-workspace.yaml`)
- **Packages that phone home for telemetry by default.** If the package has telemetry, it must be disabled by default or disabled at install time
- **Single-maintainer, infrequent-release packages** for critical paths (auth, crypto, networking). Use boring, broadly-trusted options
- **Packages that replicate existing capabilities** — `lodash` when Node and TS have native replacements; `moment` when `date-fns` or `Temporal` (when stable) exist; `axios` when `fetch` works

Anything previously added and since rejected lives under `.claude/decisions/rejected/`.

## Peer dependencies

- **Libraries declare peers for their consumer's expected runtime** (React for React components, etc.)
- **Apps do not declare peers** — they are terminal
- **Peer dependency ranges align with catalog ranges** — no `react: >=18` peer when the catalog is `^19`

## Lockfile

- `pnpm-lock.yaml` at the repo root, committed
- Never hand-edit the lockfile
- Never ignore `pnpm install --frozen-lockfile` failures in CI — the lockfile is authoritative
- Regenerate only via `pnpm install` or `pnpm up` explicitly

## Security

- `pnpm audit` runs in `lint-format` CI job; `high` or `critical` findings fail the build
- gitleaks runs on every PR
- CodeQL runs weekly
- Renovate has `vulnerability alerts` enabled — security-flagged patches get their own PR stream with higher priority

## What the `code-reviewer` and `dep-upgrade` agents check

- Any new dependency has been justified in the PR body or a linked issue
- Versions are consistent across workspaces (via catalog)
- No root `dependencies` additions — only devDeps and tooling
- License is compatible (MIT / Apache / BSD / ISC)
- The dep exists in the npm registry at the declared version (no typosquats)
- The dep does not overlap with an existing dep

Violations block the PR.
