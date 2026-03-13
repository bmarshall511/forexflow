import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "./generated/prisma/client"

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL environment variable is required")

  const adapter = new PrismaLibSql({ url })
  const client = new PrismaClient({ adapter })

  // Configure SQLite for concurrent access between the daemon and web processes.
  // WAL mode allows concurrent reads while serializing writes without blocking readers.
  // busy_timeout=5000ms makes writes wait up to 5 seconds instead of immediately
  // failing with SQLITE_BUSY when the DB is locked by the daemon's reconcile cycles.
  void (async () => {
    try {
      await client.$executeRaw`PRAGMA journal_mode=WAL`
      await client.$executeRaw`PRAGMA busy_timeout=5000`
    } catch {
      // Pragmas may not be supported in remote/read-only DB contexts — safe to ignore
    }
  })()

  return client
}

/** Lazy-initialized Prisma client. Defers creation until first access so
 *  env vars loaded by Next.js (.env.local) are available. */
export function getDb(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createPrismaClient()
  }
  return globalForPrisma.__prisma
}

/** Convenience proxy — use `db` in service code just like before, but
 *  the underlying client is created lazily on first property access. */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getDb()
    const value = client[prop as keyof PrismaClient]
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
})
