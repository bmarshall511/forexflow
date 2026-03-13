/**
 * Safely parse a JSON string with a fallback value.
 * Logs a warning on parse failure instead of throwing.
 */
export function safeJsonParse<T>(json: string | null, fallback: T, context?: string): T {
  if (json == null) return fallback
  try {
    return JSON.parse(json) as T
  } catch (err) {
    console.warn(`[db] JSON parse failed${context ? ` (${context})` : ""}:`, (err as Error).message)
    return fallback
  }
}
