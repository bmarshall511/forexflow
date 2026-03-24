/**
 * Resolve the daemon REST URL for the current environment.
 *
 * - Server-side (API routes): reads DAEMON_REST_URL or NEXT_PUBLIC_DAEMON_REST_URL env vars.
 * - Client-side: detects desktop app (port 3456 → daemon 4200) vs dev (port 3000 → daemon 4100).
 *
 * @module daemon-url
 */

/** Daemon REST URL for use in server-side API routes. */
export function getServerDaemonUrl(): string {
  return (
    process.env.DAEMON_REST_URL ??
    process.env.NEXT_PUBLIC_DAEMON_REST_URL ??
    "http://localhost:4100"
  )
}

/**
 * Daemon REST URL for use in client-side hooks/components.
 * Desktop app (web on port 3456) → daemon on port 4200.
 * Dev mode (web on port 3000) → daemon on port 4100.
 */
export function getClientDaemonUrl(): string {
  if (typeof window === "undefined") return getServerDaemonUrl()

  // Cloud mode override
  const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_DAEMON_URL
  if (cloudUrl) return cloudUrl

  const isLocal =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  if (!isLocal) return "" // Remote: use Next.js API route proxies

  // Desktop app runs web server on port 3456, daemon on port 4200
  const isDesktopApp = window.location.port === "3456"
  const daemonPort = isDesktopApp ? "4200" : "4100"
  return process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? `http://localhost:${daemonPort}`
}
