---
paths:
  - "packages/db/**"
---

# Database Conventions

- Prisma schema at prisma/schema.prisma. SQLite with WAL mode + busy_timeout=5000.
- One service file per domain (trade-service.ts, notification-service.ts, etc.).
- Encryption: AES-256-GCM via encryption.ts. Never store raw tokens.
- enrichSource(source, metadata) pattern: source always "oanda", true origin from metadata.placedVia.
- Upsert pattern: unique constraints on [source, sourceTradeId].
- Notification dedup: 5-sec window prevents duplicates.
- Cleanup methods: most services have cleanupOld\*() for old records.
