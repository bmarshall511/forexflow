import WebSocket from "ws"
import type { TVWebhookPayload } from "@fxflow/types"

interface CFWorkerClientConfig {
  url: string
  secret: string
  reconnectDelayMs?: number
  reconnectMaxMs?: number
}

/** Inbound signal message from CF Worker Durable Object. */
interface CFSignalMessage {
  type: "signal"
  payload: TVWebhookPayload
  instrument: string
  timestamp: string
}

/**
 * Outbound WebSocket client connecting the daemon to the CF Worker Durable Object.
 * Handles authentication, reconnection with exponential backoff, and heartbeat monitoring.
 */
export class CFWorkerClient {
  private ws: WebSocket | null = null
  private reconnectDelay: number
  private readonly initialDelay: number
  private readonly maxDelay: number
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private onSignal: (payload: TVWebhookPayload, instrument: string) => void
  private onConnectionChange: (connected: boolean) => void

  constructor(
    private config: CFWorkerClientConfig,
    callbacks: {
      onSignal: (payload: TVWebhookPayload, instrument: string) => void
      onConnectionChange: (connected: boolean) => void
    },
  ) {
    this.initialDelay = config.reconnectDelayMs ?? 5000
    this.maxDelay = config.reconnectMaxMs ?? 60000
    this.reconnectDelay = this.initialDelay
    this.onSignal = callbacks.onSignal
    this.onConnectionChange = callbacks.onConnectionChange
  }

  connect(): void {
    if (this.disposed) return
    if (!this.config.url) {
      console.log("[cf-worker-client] No CF Worker URL configured, skipping connection")
      return
    }

    console.log(`[cf-worker-client] Connecting to ${this.config.url}...`)

    try {
      this.ws = new WebSocket(this.config.url)
    } catch (err) {
      console.error("[cf-worker-client] Failed to create WebSocket:", err)
      this.scheduleReconnect()
      return
    }

    this.ws.on("open", () => {
      console.log("[cf-worker-client] Connected, authenticating...")
      this.ws?.send(JSON.stringify({ type: "authenticate", secret: this.config.secret }))
    })

    this.ws.on("message", (data) => {
      let msg: { type: string; payload?: TVWebhookPayload; instrument?: string }
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      if (msg.type === "authenticated") {
        console.log("[cf-worker-client] Authenticated successfully")
        this.reconnectDelay = this.initialDelay
        this.onConnectionChange(true)
        this.startHeartbeatMonitor()
        return
      }

      if (msg.type === "auth_failed") {
        console.error("[cf-worker-client] Authentication failed — check DAEMON_SECRET")
        this.ws?.close()
        return
      }

      if (msg.type === "signal") {
        const signalMsg = msg as CFSignalMessage
        if (signalMsg.payload && signalMsg.instrument) {
          this.onSignal(signalMsg.payload, signalMsg.instrument)
          // Send ack
          this.ws?.send(JSON.stringify({ type: "signal_ack", timestamp: new Date().toISOString() }))
        }
        return
      }

      if (msg.type === "ping") {
        this.ws?.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }))
        this.resetHeartbeatMonitor()
      }
    })

    this.ws.on("close", (code, reason) => {
      console.log(`[cf-worker-client] Disconnected (code=${code}, reason=${reason.toString()})`)
      this.onConnectionChange(false)
      this.stopHeartbeatMonitor()
      this.scheduleReconnect()
    })

    this.ws.on("error", (err) => {
      console.error("[cf-worker-client] WebSocket error:", err.message)
    })
  }

  /** Permanently disconnect (for daemon shutdown). */
  disconnect(): void {
    this.disposed = true
    this.closeAndCleanup("Daemon shutting down")
  }

  /**
   * Hot-reconfigure: disconnect from current CF Worker (if any),
   * update URL/secret, and connect to the new endpoint.
   * Pass empty url to just disconnect.
   */
  reconnect(url: string, secret: string): void {
    this.closeAndCleanup("Reconnecting with new config")
    this.config = { ...this.config, url, secret }
    this.disposed = false
    this.reconnectDelay = this.initialDelay
    if (url) {
      this.connect()
    } else {
      console.log("[cf-worker-client] No URL provided, staying disconnected")
      this.onConnectionChange(false)
    }
  }

  private closeAndCleanup(reason: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeatMonitor()
    if (this.ws) {
      this.ws.close(1000, reason)
      this.ws = null
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return

    this.ws = null
    console.log(`[cf-worker-client] Reconnecting in ${this.reconnectDelay}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay)

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    // If no heartbeat in 60s, consider connection dead
    this.heartbeatTimer = setTimeout(() => {
      console.warn("[cf-worker-client] Heartbeat timeout, closing connection")
      this.ws?.close(4000, "Heartbeat timeout")
    }, 60_000)
  }

  private resetHeartbeatMonitor(): void {
    this.startHeartbeatMonitor()
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
