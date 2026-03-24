/** Daemon is not running or not reachable (ECONNREFUSED, timeout, network error). */
export class DaemonUnreachableError extends Error {
  override readonly name = "DaemonUnreachableError" as const

  constructor(cause?: unknown) {
    super("Daemon is not reachable")
    this.cause = cause
  }
}

/** Daemon returned 404 — endpoint does not exist. */
export class DaemonNotFoundError extends Error {
  override readonly name = "DaemonNotFoundError" as const

  constructor(
    public readonly path: string,
    public readonly status: number,
  ) {
    super(`Daemon endpoint not found: ${path}`)
  }
}

/** Daemon returned 400 — request validation failed. */
export class DaemonValidationError extends Error {
  override readonly name = "DaemonValidationError" as const

  constructor(
    public readonly path: string,
    public readonly details: string,
  ) {
    super(`Daemon validation error on ${path}: ${details}`)
  }
}

/**
 * Convert a daemon error into a user-friendly message suitable for MCP tool responses.
 */
export function formatDaemonError(error: unknown): string {
  if (error instanceof DaemonUnreachableError) {
    return "Daemon is not running. Start the daemon with 'pnpm dev' and try again."
  }
  if (error instanceof DaemonNotFoundError) {
    return "Endpoint not found. The daemon may be running an older version."
  }
  if (error instanceof DaemonValidationError) {
    return `Invalid request: ${error.details}`
  }
  if (error instanceof Error) {
    return `Unexpected error: ${error.message}`
  }
  return `Unexpected error: ${String(error)}`
}
