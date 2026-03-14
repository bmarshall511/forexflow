---
paths:
  - "apps/**"
  - "packages/**"
  - "docs/**"
---

# Documentation Sync

When making changes that affect documented behavior, update the corresponding documentation **in the same commit**.

## Documentation Map

| Code area                                       | Docs to update                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/components/`, `apps/web/src/app/` | `apps/web/CLAUDE.md` (component conventions, page layout, hooks) |
| `apps/web/src/hooks/`                           | `apps/web/CLAUDE.md` (hook conventions section)                  |
| `apps/web/src/app/api/`                         | `apps/web/CLAUDE.md` (API route pattern)                         |
| `apps/web/src/state/`                           | `apps/web/CLAUDE.md` (state management)                          |
| `apps/web/src/middleware.ts`, auth routes       | `apps/web/CLAUDE.md` (authentication, gotchas)                   |
| `apps/web/server.ts`, WS proxy, tunnel          | `apps/web/CLAUDE.md` + `docs/ai/remote-access.md`                |
| `apps/daemons/src/`                             | `apps/daemons/CLAUDE.md` + `docs/ai/realtime.md`                 |
| `apps/cf-worker/`                               | `apps/cf-worker/CLAUDE.md`                                       |
| `packages/db/prisma/schema.prisma`              | `packages/db/CLAUDE.md`                                          |
| `packages/db/src/*-service.ts`                  | `packages/db/CLAUDE.md`                                          |
| `packages/types/`, `packages/shared/`           | Respective `CLAUDE.md` files                                     |
| WebSocket messages, event types                 | `docs/ai/realtime.md`                                            |
| UI components (new shared primitives)           | `apps/web/CLAUDE.md` (shared UI primitives list)                 |
| Directory structure changes                     | `docs/ai/directory-structure.md`                                 |
| Testing patterns                                | `docs/ai/testing.md`                                             |
| Accessibility patterns                          | `docs/ai/accessibility-aaa.md`                                   |
| Auth, PIN, sessions, tunnel                     | `docs/ai/remote-access.md`                                       |
| New `.claude/rules/` or `.claude/skills/`       | `.claude/CLAUDE.md` (rules/skills list)                          |

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
