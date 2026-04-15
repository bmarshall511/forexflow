/**
 * Database client — lazy-initialized Prisma singleton.
 *
 * Supports two connection modes:
 * - **Local (SQLite):** `DATABASE_URL=file:./path/to/db.sqlite` — configures WAL + busy_timeout.
 * - **Cloud (Turso):** `DATABASE_URL=libsql://xxx.turso.io` + `TURSO_AUTH_TOKEN` — remote LibSQL.
 *
 * Provides a lazy proxy (`db`) that defers Prisma client creation until first
 * property access, ensuring environment variables from Next.js (.env.local)
 * are available.
 *
 * @module client
 */
import * as path from "node:path"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "./generated/prisma/client"

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient }

/** Check if a DATABASE_URL points to a remote Turso/LibSQL instance. */
function isRemoteUrl(url: string): boolean {
  return url.startsWith("libsql://") || url.startsWith("https://")
}

/**
 * Resolve a `file:...` DATABASE_URL to an absolute path so startup logging
 * and diagnostics show *exactly* which SQLite file is in use. Returns the
 * input unchanged for remote URLs.
 */
function resolveDbPath(url: string): string {
  if (isRemoteUrl(url)) return url
  if (!url.startsWith("file:")) return url
  const rel = url.slice("file:".length)
  return path.resolve(process.cwd(), rel)
}

/**
 * Create a new Prisma client with LibSQL adapter and configure SQLite pragmas
 * for WAL mode and busy_timeout (local mode only).
 *
 * For remote Turso connections, passes the auth token and skips SQLite pragmas.
 *
 * @returns Configured PrismaClient instance
 * @throws Error if DATABASE_URL is not set
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required — no silent fallback. " +
        "Set it in apps/daemons/.env.local and apps/web/.env.local, typically " +
        "`file:../../data/fxflow.db`. See apps/daemons/.env.example for the canonical value.",
    )
  }

  const isRemote = isRemoteUrl(url)
  const authToken = process.env.TURSO_AUTH_TOKEN

  // Log the resolved absolute DB path on first client creation so stale
  // orphan DB files can't hide. If daemon and web log different paths,
  // someone has a misconfigured .env.local.
  const resolved = resolveDbPath(url)
  // eslint-disable-next-line no-console
  console.log(`[@fxflow/db] DATABASE_URL → ${resolved}${isRemote ? " (remote)" : " (sqlite)"}`)

  const adapter = new PrismaLibSql({
    url,
    ...(isRemote && authToken ? { authToken } : {}),
  })
  const client = new PrismaClient({ adapter })

  // Configure SQLite for concurrent access between the daemon and web processes.
  // WAL mode allows concurrent reads while serializing writes without blocking readers.
  // busy_timeout=5000ms makes writes wait up to 5 seconds instead of immediately
  // failing with SQLITE_BUSY when the DB is locked by the daemon's reconcile cycles.
  // Only applies to local SQLite — remote Turso handles this server-side.
  if (!isRemote) {
    void (async () => {
      try {
        await client.$executeRaw`PRAGMA journal_mode=WAL`
        await client.$executeRaw`PRAGMA busy_timeout=5000`
      } catch {
        // Pragmas may not be supported in remote/read-only DB contexts — safe to ignore
      }
    })()
  }

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
