/**
 * Fire-and-forget pokes to the daemon telling it to resync OANDA state immediately.
 *
 * The daemon's credential-watcher polls the DB every ~5s; a test-connection click
 * would otherwise not trigger a fresh health check at all. These helpers close
 * those realtime gaps after credential save/delete and after a connection test
 * so `status_snapshot` is broadcast to connected WS clients within the request.
 *
 * Fire-and-forget: we never surface poke failures to the caller (save/test
 * responses are authoritative regardless); we just log and move on.
 */

import { getServerDaemonUrl } from "./daemon-url"

const POKE_TIMEOUT_MS = 2000

async function poke(path: string): Promise<void> {
  const url = `${getServerDaemonUrl()}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POKE_TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: "POST", signal: controller.signal })
    if (!res.ok) {
      console.warn(`[poke-daemon] ${path} returned ${res.status}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[poke-daemon] ${path} failed: ${message}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Tell the daemon to re-read credentials from the DB (save/delete pathway). */
export function pokeDaemonCredentialRefresh(): Promise<void> {
  return poke("/refresh-credentials")
}

/** Tell the daemon to re-run the OANDA health check now (test-connection pathway). */
export function pokeDaemonHealthRefresh(): Promise<void> {
  return poke("/actions/oanda/refresh-health")
}
