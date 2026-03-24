import { mapTVTickerToOandaInstrument } from "@fxflow/shared"
import type { TVWebhookPayload } from "@fxflow/types"
import { webhookPayloadSchema } from "./webhook-schema"

/** Signal message sent to daemon over WebSocket */
interface SignalMessage {
  type: "signal"
  payload: TVWebhookPayload
  instrument: string
  timestamp: string
}

interface QueuedSignal {
  message: SignalMessage
  queuedAt: number
}

const MAX_QUEUE = 100
const MAX_QUEUE_AGE_MS = 60_000
const HEARTBEAT_INTERVAL_MS = 30_000
const DEDUP_WINDOW_MS = 5_000

/**
 * AlertRouter Durable Object — relays TradingView webhook signals to the
 * daemon via a persistent WebSocket connection. Queues signals if the daemon
 * is temporarily disconnected.
 */
export class AlertRouter implements DurableObject {
  private daemonWs: WebSocket | null = null
  private missedQueue: QueuedSignal[] = []
  private dedupMap = new Map<string, number>()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private readonly state: DurableObjectState
  private readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith("/webhook")) {
      return this.handleWebhook(request)
    }

    if (url.pathname.startsWith("/ws")) {
      return this.handleDaemonWS(request)
    }

    return new Response("Not found", { status: 404 })
  }

  // ─── Webhook Handler ───────────────────────────────────────────────────────

  private async handleWebhook(request: Request): Promise<Response> {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ status: "rejected", reason: "invalid_json" }, 200)
    }

    // Validate payload with Zod schema
    const result = webhookPayloadSchema.safeParse(body)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      const field = firstIssue?.path[0] ?? "unknown"
      const reason =
        field === "action"
          ? "invalid_action"
          : field === "ticker"
            ? "missing_ticker"
            : `invalid_field:${String(field)}`
      return jsonResponse(
        {
          status: "rejected",
          reason,
          errors: result.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        200,
      )
    }

    const parsed = result.data

    // Map ticker to OANDA instrument
    const instrument = mapTVTickerToOandaInstrument(parsed.ticker)
    if (!instrument) {
      return jsonResponse(
        { status: "rejected", reason: "unknown_instrument", ticker: parsed.ticker },
        200,
      )
    }

    // Dedup check
    const dedupKey = `${instrument}:${parsed.action}`
    const now = Date.now()
    const lastSeen = this.dedupMap.get(dedupKey)
    if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
      return jsonResponse({ status: "rejected", reason: "duplicate_signal" }, 200)
    }
    this.dedupMap.set(dedupKey, now)

    // Clean old dedup entries
    for (const [key, ts] of this.dedupMap) {
      if (now - ts > DEDUP_WINDOW_MS * 2) this.dedupMap.delete(key)
    }

    // Resolve price: prefer explicit price, fall back to close
    const resolvedPrice = parsed.price ?? parsed.close

    const signalId = crypto.randomUUID()

    const payload: TVWebhookPayload = {
      action: parsed.action,
      ticker: parsed.ticker,
      price: resolvedPrice,
      exchange: parsed.exchange,
      interval: parsed.interval,
      time: parsed.time,
      signalId,
    }

    const signal: SignalMessage = {
      type: "signal",
      payload,
      instrument,
      timestamp: new Date().toISOString(),
    }

    // Forward to daemon or queue
    if (this.daemonWs && this.daemonWs.readyState === WebSocket.OPEN) {
      try {
        this.daemonWs.send(JSON.stringify(signal))
        return jsonResponse({ status: "ok", instrument, action: parsed.action }, 200)
      } catch {
        // WS send failed, queue it
      }
    }

    // Queue if daemon not connected
    if (this.missedQueue.length >= MAX_QUEUE) {
      this.missedQueue.shift()
    }
    this.missedQueue.push({ message: signal, queuedAt: now })

    return jsonResponse({ status: "queued", instrument, action: parsed.action }, 200)
  }

  // ─── Daemon WebSocket Handler ──────────────────────────────────────────────

  private handleDaemonWS(request: Request): Response {
    const upgradeHeader = request.headers.get("Upgrade")
    if (upgradeHeader?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    server.accept()

    // P0.3: Hold as pending until authenticated — don't assign to this.daemonWs yet
    // so webhooks arriving during auth handshake use the previous connection (or queue).
    let authenticated = false

    server.addEventListener("message", (event) => {
      let msg: { type: string; secret?: string }
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }

      if (msg.type === "authenticate") {
        if (msg.secret === this.env.DAEMON_SECRET) {
          authenticated = true
          // Now that auth succeeded, close any existing connection and promote
          if (this.daemonWs && this.daemonWs !== server) {
            try {
              this.daemonWs.close(1000, "Replaced by new connection")
            } catch {
              /* ignore */
            }
          }
          this.daemonWs = server
          server.send(JSON.stringify({ type: "authenticated" }))
          this.flushQueue()
        } else {
          server.send(JSON.stringify({ type: "auth_failed" }))
          server.close(4001, "Authentication failed")
        }
        return
      }

      if (!authenticated) {
        server.close(4001, "Not authenticated")
        return
      }

      // Handle signal_ack, pong, etc. — no action needed
    })

    server.addEventListener("close", () => {
      if (this.daemonWs === server) {
        this.daemonWs = null
      }
      this.stopHeartbeat()
    })

    server.addEventListener("error", () => {
      if (this.daemonWs === server) {
        this.daemonWs = null
      }
      this.stopHeartbeat()
    })

    // Start heartbeat
    this.startHeartbeat()

    return new Response(null, { status: 101, webSocket: client })
  }

  // ─── Queue Management ─────────────────────────────────────────────────────

  // P0.2: Fixed to preserve unsent signals on partial send failure
  private flushQueue(): void {
    if (!this.daemonWs || this.daemonWs.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    const fresh = this.missedQueue.filter((q) => now - q.queuedAt < MAX_QUEUE_AGE_MS)

    let sentCount = 0
    for (const queued of fresh) {
      try {
        this.daemonWs.send(JSON.stringify(queued.message))
        sentCount++
      } catch {
        break
      }
    }

    // Only discard successfully sent signals; preserve the rest
    this.missedQueue = fresh.slice(sentCount)
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.daemonWs && this.daemonWs.readyState === WebSocket.OPEN) {
        try {
          this.daemonWs.send(JSON.stringify({ type: "ping" }))
        } catch {
          /* will be caught by error handler */
        }
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ─── Env Interface ───────────────────────────────────────────────────────────

interface Env {
  ALERT_ROUTER: DurableObjectNamespace
  WEBHOOK_TOKEN: string
  DAEMON_SECRET: string
}
