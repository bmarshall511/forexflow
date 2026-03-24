import { DaemonUnreachableError, DaemonNotFoundError, DaemonValidationError } from "./errors.js"

const DAEMON_URL = process.env.DAEMON_URL || "http://localhost:4100"
const FETCH_TIMEOUT_MS = 10_000

function isConnectionError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true
  if (error instanceof TypeError) {
    const msg = (error.cause as Error | undefined)?.message ?? error.message
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("ECONNRESET") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("fetch failed")
    ) {
      return true
    }
  }
  return false
}

async function handleResponse(res: Response, path: string): Promise<Response> {
  if (res.ok) return res

  if (res.status === 404) {
    throw new DaemonNotFoundError(path, res.status)
  }

  if (res.status === 400) {
    let details = res.statusText
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      details = body.error ?? body.message ?? details
    } catch {
      // body not JSON — keep statusText
    }
    throw new DaemonValidationError(path, details)
  }

  throw new Error(`Daemon ${path}: ${res.status} ${res.statusText}`)
}

export async function daemonGet<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${DAEMON_URL}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    if (isConnectionError(error)) throw new DaemonUnreachableError(error)
    throw error
  }
  await handleResponse(res, path)
  return res.json() as Promise<T>
}

export async function daemonPost<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${DAEMON_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    if (isConnectionError(error)) throw new DaemonUnreachableError(error)
    throw error
  }
  await handleResponse(res, path)
  return res.json() as Promise<T>
}

export function getDaemonUrl(): string {
  return DAEMON_URL
}
