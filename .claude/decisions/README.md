# Architecture Decision Records (ADRs)

Durable decisions, numbered and dated. Immutable once committed — corrections happen via superseding ADRs, not edits.

## Why ADRs

Anything the project decides non-trivially — enforcement posture, stack selection, bootstrap behavior, design tradeoffs — lands in an ADR so future sessions (with no memory of the conversation that produced the decision) can recover the rationale and judge whether the decision still applies.

Memory doesn't survive context resets. ADRs do.

## Format

- Filename: `<NNNN>-<kebab-slug>.md`, numbered sequentially from `0001`
- Status: `proposed` → `accepted` → `superseded` (or `rejected`, housed in `rejected/`)
- Immutable once accepted; corrections go in a new ADR that supersedes the earlier one

## Template

See [`_template.md`](./_template.md).

## Index

The `meta-reviewer` agent keeps this list current. Do not hand-edit below; regeneration happens when new ADRs land.

| #    | Title                                                                                    | Status   | Date       |
| ---- | ---------------------------------------------------------------------------------------- | -------- | ---------- |
| 0001 | [v3 greenfield rebuild](./0001-v3-greenfield-rebuild.md)                                 | accepted | 2026-04-21 |
| 0002 | [fail-open bootstrap posture for hooks](./0002-fail-open-bootstrap-posture.md)           | accepted | 2026-04-21 |
| 0003 | [TodoWrite marker as the plan-required signal](./0003-todowrite-plan-marker.md)          | accepted | 2026-04-21 |
| 0004 | [per-user gitignored reserved-identifiers list](./0004-reserved-identifiers-per-user.md) | accepted | 2026-04-21 |
| 0005 | [post-edit-meta-log auto-CHANGELOG behavior](./0005-post-edit-meta-log-changelog.md)     | accepted | 2026-04-21 |
| 0006 | [continuous-learning loop](./0006-continuous-learning-loop.md)                           | accepted | 2026-04-21 |
| 0007 | [Phase 1 complete](./0007-phase-1-complete.md)                                           | accepted | 2026-04-22 |

## Rejected proposals

See [`rejected/`](./rejected/) — ideas considered and explicitly decided against, with rationale. Before proposing a new idea, search here to avoid re-proposing something already decided against.
