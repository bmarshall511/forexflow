/**
 * Structured API request logging for Next.js route handlers.
 *
 * Provides a `withLogging` wrapper that logs method, path, duration, and status
 * for every API request. Errors are logged with stack traces.
 *
 * @module api-logger
 */
import { NextResponse, type NextRequest } from "next/server"

interface LogEntry {
  method: string
  path: string
  status: number
  durationMs: number
  error?: string
}

function formatLog(entry: LogEntry): string {
  const base = `[api] ${entry.method} ${entry.path} → ${entry.status} (${entry.durationMs}ms)`
  return entry.error ? `${base} ERROR: ${entry.error}` : base
}

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<NextResponse>

/**
 * Wrap a Next.js route handler with structured request logging.
 *
 * Logs: method, path, response status, duration in ms.
 * On error: logs the error message and returns a 500 JSON response.
 */
export function withLogging(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const start = performance.now()
    const method = request.method
    const path = request.nextUrl.pathname

    try {
      const response = await handler(request, context)
      const durationMs = Math.round(performance.now() - start)
      console.log(formatLog({ method, path, status: response.status, durationMs }))
      return response
    } catch (error) {
      const durationMs = Math.round(performance.now() - start)
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error(formatLog({ method, path, status: 500, durationMs, error: message }))
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }
}
