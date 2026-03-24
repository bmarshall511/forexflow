---
paths:
  - "apps/**"
  - "packages/**"
  - "docs/**"
---

# Documentation Sync

When making changes that affect documented behavior, update the corresponding documentation **in the same commit**.

## Documentation Map

| Code area                                       | Docs to update                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/components/`, `apps/web/src/app/` | `apps/web/CLAUDE.md` (component conventions, page layout, hooks)     |
| `apps/web/src/hooks/`                           | `apps/web/CLAUDE.md` (hook conventions section)                      |
| `apps/web/src/app/api/`                         | `apps/web/CLAUDE.md` (API route pattern)                             |
| `apps/web/src/state/`                           | `apps/web/CLAUDE.md` (state management)                              |
| `apps/web/src/middleware.ts`, auth routes       | `apps/web/CLAUDE.md` (authentication, gotchas)                       |
| `apps/web/server.ts`, WS proxy, tunnel          | `apps/web/CLAUDE.md` + `docs/dev/06-remote-access.md`                |
| `apps/web/src/components/smart-flow/`           | `docs/user/smart-flow/`                                              |
| `apps/web/src/components/alerts/`               | `docs/user/automation/05-price-alerts.md`                            |
| `apps/daemons/src/`                             | `apps/daemons/CLAUDE.md` + `docs/dev/03-realtime.md`                 |
| `apps/cf-worker/`                               | `apps/cf-worker/CLAUDE.md`                                           |
| `apps/mcp-server/`                              | `docs/dev/07-mcp-server.md`, `docs/user/automation/06-mcp-server.md` |
| `apps/desktop/`                                 | `docs/user/getting-started/06-desktop-app.md`                        |
| `packages/db/prisma/schema.prisma`              | `packages/db/CLAUDE.md`                                              |
| `packages/db/src/*-service.ts`                  | `packages/db/CLAUDE.md`                                              |
| `packages/types/`, `packages/shared/`           | Respective `CLAUDE.md` files                                         |
| WebSocket messages, event types                 | `docs/dev/03-realtime.md`                                            |
| UI components (new shared primitives)           | `apps/web/CLAUDE.md` (shared UI primitives list)                     |
| Directory structure changes                     | `docs/dev/02-directory-structure.md`                                 |
| Testing patterns                                | `docs/dev/04-testing.md`                                             |
| Accessibility patterns                          | `docs/dev/05-accessibility-aaa.md`                                   |
| Auth, PIN, sessions, tunnel                     | `docs/dev/06-remote-access.md`                                       |
| New `.claude/rules/` or `.claude/skills/`       | `.claude/CLAUDE.md` (rules/skills list)                              |
| User-facing features, workflows                 | `docs/user/` (relevant category subdirectory)                        |

## What Counts as "Affects Documented Behavior"

- Adding, removing, or renaming exports, hooks, components, API routes, WS message types
- Changing conventions (new patterns, deprecated patterns)
- Adding new shared UI primitives or removing existing ones
- Modifying directory structure or file organization
- Changing auth flow, middleware behavior, or deployment setup
- Adding new daemon endpoints or changing existing ones

## What Does NOT Need Doc Updates

- Bug fixes that don't change the API surface
- Internal refactors that preserve the same public interface
- Style/CSS-only changes
- Test additions that don't change documented testing patterns

## How to Update

1. Before committing, review the map above against your changed files.
2. Update the relevant docs with the new state (not a changelog — describe current behavior).
3. Keep docs concise — they exist to orient future AI and human readers, not to be exhaustive.
