# Getting Started (Contributors)

Internal setup guide for anyone working on ForexFlow locally. Outside-contributor-friendly too — this is the same walkthrough a maintainer would use on a fresh machine.

## 1. Prerequisites

- **git** — 2.40 or newer
- **[mise](https://mise.jdx.dev/)** — manages the Node + pnpm + Python versions this repo pins
- An editor:
  - **Cursor** (recommended), or
  - **VS Code** with the Claude Code extension
- **macOS** is the primary development platform. Linux works. Windows is not tested — use WSL2 if you must.

Install mise (one-time):

```bash
curl https://mise.run | sh
# follow the printed instructions to add mise to your shell rc file
```

## 2. Clone

```bash
git clone git@github.com:bmarshall511/forexflow.git
cd forexflow
git checkout v3   # during the rebuild, v3 is the active branch
```

## 3. Toolchain

From the repo root:

```bash
mise install
```

This installs the pinned Node, pnpm, and Python versions declared in `mise.toml`. Once installed, mise activates them automatically whenever you `cd` into the repo.

Verify:

```bash
node --version    # should match mise.toml
pnpm --version    # should match mise.toml
```

## 4. Dependencies

> **Phase 1 note:** During the `v3` rebuild's first phase, there are no dependencies to install yet — the monorepo skeleton arrives in Phase 2. `pnpm install` will report an empty workspace until then. That is expected.

Once Phase 2 ships:

```bash
pnpm install
```

## 5. Environment variables

ForexFlow keeps `.env` files minimal. They hold only infrastructure bootstrapping values — the things the process needs to know before the database or UI is reachable (DB URL, port, log level, build-time deployment mode).

**User-owned credentials — OANDA API keys, webhook tokens, Anthropic keys, etc. — are not in `.env` files.** They are configured through the in-app Settings UI and stored encrypted in the database.

Copy the example files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/daemon/.env.example apps/daemon/.env.local
```

Review each `.env.example` — every variable has an explanatory comment. Typical defaults work for local dev; override only what you need.

See [`.claude/rules/11-env-vars.md`](../../.claude/rules/11-env-vars.md) for the full policy on what belongs in env vars versus the settings UI.

## 6. Database (local dev)

ForexFlow uses SQLite locally, with a Prisma schema. To initialize:

```bash
pnpm --filter @forexflow/db db:migrate
```

This creates `./data/forexflow.db` and applies the current migrations. On first app launch, open Settings and enter your OANDA credentials, webhook tokens, and any optional API keys — everything is stored encrypted in this database.

## 7. Run it

Dev mode runs every app in parallel via Turbo:

```bash
pnpm dev
```

- Web app: http://localhost:3000
- Daemon REST: http://localhost:4100
- Daemon WebSocket: ws://localhost:4100/ws

## 8. Verify your setup

Run the preflight script — it mirrors CI locally:

```bash
pnpm preflight
```

Green across the board? You're ready to contribute.

## 9. Install git hooks

The project uses [Lefthook](https://github.com/evilmartians/lefthook) to enforce pre-commit and pre-push checks. It installs automatically the first time you run `pnpm install`, but you can install manually:

```bash
pnpm exec lefthook install
```

Do **not** skip hooks with `--no-verify`. The hooks enforce the standards in [`.claude/rules/`](../../.claude/rules/) — bypassing them almost always means shipping a bug.

## 10. Using the AI agents

See [`.claude/README.md`](../../.claude/README.md).

The short version:

- `/verify` — run the full preflight check
- `/review` — run the code reviewer on your staged changes
- `/security-review` — run the security auditor
- `/handoff` — generate a context prompt you can paste into a fresh chat session
- `/status` — dashboard of the `.claude/` system's own health

All available skills are listed in `.claude/skills/` with one-line descriptions in `.claude/README.md`.

## Troubleshooting

**mise can't find Node / pnpm after install**

Make sure mise's activation line is in your shell rc file (`.zshrc`, `.bashrc`, or `config.fish`). The installer prints the exact line; add it and restart your shell.

**iCloud-synced clones fail with pnpm permission errors**

Move the clone to a non-iCloud path (`~/dev/forexflow` instead of `~/Documents/...`). pnpm's content-addressable store doesn't play well with iCloud's file lock semantics.

**Port already in use**

Default ports: web `3000`, daemon `4100`. Either kill the conflicting process or override via `PORT=3001 pnpm dev`.

**Something else**

Open a [Discussion](https://github.com/bmarshall511/forexflow/discussions). If it turns out to be a real bug, file an issue using the bug template.
