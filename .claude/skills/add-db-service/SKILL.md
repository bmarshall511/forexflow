---
name: add-db-service
description: Scaffold a packages/db service file with encryption where appropriate, integration test, and Prisma model via migration-writer
disable-model-invocation: false
model: sonnet
args:
  - name: domain
    type: string
    required: true
    description: "Kebab domain name, e.g. 'alert-rule', 'trade-condition'"
dispatches: [migration-writer, test-writer]
version: 0.1.0
---

# /add-db-service `<domain>`

Scaffold `packages/db/src/<domain>-service.ts` and its Prisma model. Service files export functions, not classes. Integration tests hit a real SQLite. Credential-bearing columns go through the encryption helper.

## Procedure

### 1. Resolve paths

```
packages/db/prisma/schema.prisma                          # append new model
packages/db/src/<domain>-service.ts                       # service
packages/db/src/<domain>-service.test.ts                  # integration test
```

### 2. Ask

- What does this domain own? (single responsibility — one model per file)
- Which requirement? REQ-<SCOPE>-<###>
- Any credential-bearing columns? (flag for encryption)
- Relationships to existing models? (foreign keys, cascades)

### 3. Append the Prisma model

Sketch the model in `schema.prisma`:

```prisma
model <Model> {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // domain fields
  @@index([<hot-query-column>])
}
```

Rule reminders:

- `PascalCase` singular model name (rule 08)
- `camelCase` columns (rule 08)
- `@@index` on every WHERE / ORDER BY predicate (rule 05)
- Credential columns decorated with a comment like `// encrypted; see encryption.ts`

### 4. Dispatch `migration-writer`

`/migrate add-<domain>`. Verifies safety, generates SQL, dry-runs against scratch DB. Expect `WRITTEN`.

### 5. Write the service

Template:

```ts
import { getDb } from "./client"
import { encrypt, decrypt } from "./encryption"
import { dbLogger } from "@forexflow/logger/db"
import type { <Model>Input, <Model>Record } from "@forexflow/types"

const log = dbLogger.child({ service: "<domain>-service" })

/**
 * Create a <model>.
 *
 * @req: REQ-<SCOPE>-<###>
 */
export async function create<Model>(input: <Model>Input): Promise<<Model>Record> {
  const db = getDb()
  const encrypted = input.<secretField> ? encrypt(input.<secretField>) : null
  const row = await db.<model>.create({ data: { ...input, <secretField>: encrypted } })
  log.debug({ id: row.id }, "created")
  return decode(row)
}

/**
 * Fetch a <model> by id. Returns null when not found.
 */
export async function get<Model>(id: string): Promise<<Model>Record | null> {
  const row = await getDb().<model>.findUnique({ where: { id } })
  return row ? decode(row) : null
}

/* ... updateX, deleteX, listX ... */

function decode(row: /* prisma type */): <Model>Record {
  return {
    ...row,
    <secretField>: row.<secretField> ? decrypt(row.<secretField>) : undefined,
  }
}
```

Enforced:

- One file per domain; ≤ 300 LOC (rule 07)
- Functions, not classes (rule 08)
- Encryption on every credential-bearing column (rule 04)
- Cleanup methods for time-series data included where relevant (rule 05)
- Scoped logger with redaction policy (rule 12)
- No raw SQL via `$queryRawUnsafe` (rule 04)
- No silent catches (rule 01)
- JSDoc + `@req:` (rules 13, 14)

### 6. Integration test

Dispatch `test-writer`. Test against a real in-memory SQLite (rule 02). Required cases:

- Create returns a record with id
- Get returns the created record; unknown id returns null
- Update modifies the record; non-existent id throws typed error
- Delete removes the record; idempotent second delete doesn't crash
- Credential fields round-trip correctly (encrypted at rest, plaintext in returned record)
- Pagination (if `listX` takes cursor/limit)

### 7. Export from the package

Add re-export in `packages/db/src/index.ts` for every exported symbol.

### 8. Review

`/review` + `/security-review` — always for DB work.

## Output shape

```markdown
# /add-db-service result — <domain>

## Files created / changed

- `packages/db/prisma/schema.prisma` — added model `<Model>`
- `packages/db/prisma/migrations/<timestamp>_add-<domain>/` — new migration
- `packages/db/src/<domain>-service.ts` — <N> LOC (limit 300)
- `packages/db/src/<domain>-service.test.ts` — <N> LOC
- `packages/db/src/index.ts` — re-exports

## Migration

- migration-writer verdict: WRITTEN / DRY_RUN_FAILED / NOT_SAFE
- Safety: SAFE / NOT SAFE (with plan)

## Test-writer: WRITTEN / PARTIAL

## Review: APPROVE / SAFE

## Security-review: PASS / ADVISORY / FAIL

## Requirement: REQ-<SCOPE>-<###>
```

## Bootstrap tolerance

Returns "N/A — `packages/db/` arrives in Phase 4" during earlier phases.
