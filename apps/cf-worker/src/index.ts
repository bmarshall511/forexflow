import { isAllowedIP, isTestSignal } from "./ip-whitelist"

export { AlertRouter } from "./alert-router"

interface Env {
  ALERT_ROUTER: DurableObjectNamespace
  WEBHOOK_TOKEN: string
  DAEMON_SECRET: string
}

// ─── IP-based Rate Limiter ──────────────────────────────────────────────────

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

/**
 * Check rate limit for a given IP. Returns null if allowed,
 * or the number of seconds until the window resets if exceeded.
 */
function checkRateLimit(ip: string): number | null {
  const now = Date.now()

  // Sweep expired entries (simple linear scan, safe for moderate cardinality)
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }

  const existing = rateLimitMap.get(ip)

  if (!existing || now >= existing.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return null
  }

  existing.count++

  if (existing.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000)
    return retryAfterSeconds
  }

  return null
}

// ─── Worker Entry Point ─────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // ─── Health Check ──────────────────────────────────────────────────────
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    // ─── Webhook Endpoint: POST /webhook/{token} ──────────────────────────
    if (request.method === "POST" && url.pathname.startsWith("/webhook/")) {
      // Rate limit by source IP before any other processing
      const clientIP = request.headers.get("CF-Connecting-IP") ?? "unknown"
      const retryAfter = checkRateLimit(clientIP)
      if (retryAfter !== null) {
        return jsonResponse({ status: "rate_limited", retryAfterSeconds: retryAfter }, 429)
      }

      const token = url.pathname.split("/webhook/")[1]
      if (!token || token !== env.WEBHOOK_TOKEN) {
        // Always return 200 to TradingView to prevent retries
        return jsonResponse({ status: "rejected", reason: "invalid_token" }, 200)
      }

      // Validate TradingView IP (test signals bypass via daemon secret header)
      if (!isAllowedIP(clientIP) && !isTestSignal(request, env.DAEMON_SECRET)) {
        return jsonResponse({ status: "rejected", reason: "ip_not_allowed" }, 200)
      }

      // Forward to Durable Object (single global instance)
      const id = env.ALERT_ROUTER.idFromName("global")
      const stub = env.ALERT_ROUTER.get(id)

      const doRequest = new Request(`https://do/webhook`, {
        method: "POST",
        headers: request.headers,
        body: request.body,
      })

      return stub.fetch(doRequest)
    }

    // ─── Daemon WebSocket: GET /ws/{daemon_secret} ────────────────────────
    if (url.pathname.startsWith("/ws/")) {
      const secret = url.pathname.split("/ws/")[1]
      if (!secret || secret !== env.DAEMON_SECRET) {
        return new Response("Unauthorized", { status: 401 })
      }

      const id = env.ALERT_ROUTER.idFromName("global")
      const stub = env.ALERT_ROUTER.get(id)

      const doRequest = new Request(`https://do/ws`, {
        headers: request.headers,
      })

      return stub.fetch(doRequest)
    }

    return new Response("Not found", { status: 404 })
  },
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
