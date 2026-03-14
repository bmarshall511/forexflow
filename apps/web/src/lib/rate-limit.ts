/**
 * Simple in-memory sliding window rate limiter.
 * No external dependencies — suitable for single-instance deployments.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000) // Keep 2 min window
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, CLEANUP_INTERVAL)
  // Allow process to exit
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref()
  }
}

/**
 * Check if a request should be rate limited.
 *
 * @param key - Unique identifier (e.g., IP address or IP + route)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with `allowed` boolean and `retryAfterMs` if blocked
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  startCleanup()

  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]!
    const retryAfterMs = windowMs - (now - oldestInWindow)
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) }
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return { allowed: true, retryAfterMs: 0 }
}
