---
name: add-db-service
description: Create a new database service following the FXFlow pattern.
disable-model-invocation: true
---

# Add DB Service

Create a new Prisma service file following established patterns.

## Arguments

- `$ARGUMENTS[0]` — Domain name (e.g., "alert-rule")
- `$ARGUMENTS[1]` — Brief description

## Steps

1. **packages/db/prisma/schema.prisma** — Add the Prisma model:

   ```prisma
   model AlertRule {
     id        String   @id @default(uuid())
     // ... fields
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     @@index([...])
   }
   ```

2. **Run migration**: `cd packages/db && npx prisma migrate dev --name add-alert-rule`

3. **packages/db/src/alert-rule-service.ts** — Create service file:

   ```typescript
   import { getDb } from "./client"
   // Follow patterns from existing services:
   // - Export typed functions (not classes)
   // - Use getDb() for Prisma client
   // - Include create, get, list, update, delete as needed
   // - Add cleanup method for old records if applicable
   // - Keep under 250 LOC
   ```

4. **packages/db/src/index.ts** — Export the new service.

5. Run `/verify`.

## Conventions

- One file per domain
- Export functions, not classes
- Use getDb() (lazy-init Prisma client)
- Encrypt sensitive fields via encryption.ts
- Include cleanup methods for time-series data
