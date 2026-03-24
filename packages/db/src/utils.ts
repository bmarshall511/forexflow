/**
 * Shared database utilities used across service files.
 *
 * @module utils
 */

/**
 * Safely parse a JSON string with a fallback value.
 * Logs a warning on parse failure instead of throwing.
 */
/**
 * Safely convert an unknown value to an ISO date string.
 * Falls back to the current time if the value is invalid.
 */
export function safeIso(val: unknown): string {
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString()
  if (typeof val === "string" && val) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  if (typeof val === "number") return new Date(val).toISOString()
  return new Date().toISOString()
}

export function safeJsonParse<T>(json: string | null, fallback: T, context?: string): T {
  if (json == null) return fallback
  try {
    return JSON.parse(json) as T
  } catch (err) {
    console.warn(`[db] JSON parse failed${context ? ` (${context})` : ""}:`, (err as Error).message)
    return fallback
  }
}
