const DAEMON_URL = process.env.DAEMON_URL || "http://localhost:4100"

export async function daemonGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`)
  if (!res.ok) {
    throw new Error(`Daemon ${path}: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function daemonPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`Daemon ${path}: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getDaemonUrl(): string {
  return DAEMON_URL
}
