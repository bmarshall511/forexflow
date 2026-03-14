/**
 * Lightweight structured logger. Outputs JSON to console with bound context.
 * No external dependencies, no file I/O, no log-level filtering.
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  msg: string
  timestamp: string
  [key: string]: unknown
}

export class Logger {
  private readonly context: Record<string, unknown>

  constructor(name: string, context?: Record<string, unknown>) {
    this.context = { name, ...context }
  }

  /** Create a child logger with additional bound context. */
  child(context: Record<string, unknown>): Logger {
    const merged = { ...this.context, ...context }
    const { name, ...rest } = merged
    return new Logger(name as string, rest)
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log("debug", msg, data)
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log("info", msg, data)
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log("warn", msg, data)
  }

  error(msg: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data }

    if (error instanceof Error) {
      errorData.error = error.message
      errorData.stack = error.stack
      if ("code" in error) {
        errorData.errorCode = (error as { code: string }).code
      }
      if ("context" in error) {
        errorData.errorContext = (error as { context: unknown }).context
      }
    } else if (error !== undefined && error !== null) {
      errorData.error = String(error)
    }

    this.log("error", msg, errorData)
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      msg,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    }

    const json = JSON.stringify(entry)

    switch (level) {
      case "debug":
        console.debug(json)
        break
      case "info":
        console.info(json)
        break
      case "warn":
        console.warn(json)
        break
      case "error":
        console.error(json)
        break
    }
  }
}
