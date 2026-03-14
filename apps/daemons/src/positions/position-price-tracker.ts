import type { AnyDaemonMessage, PositionPriceTick } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { PositionManager } from "./position-manager.js"
import { getStreamUrl } from "../oanda/api-client.js"
import { updateTradeMfeMae } from "@fxflow/db"

/**
 * Dynamic pricing stream for instruments with active positions/orders.
 * Watches PositionManager for instrument changes, reconnects stream as needed.
 * Broadcasts throttled price updates and tracks MFE/MAE per open trade.
 */
export class PositionPriceTracker {
  private abortController: AbortController | null = null
  private currentInstruments: string[] = []
  private pendingPrices = new Map<string, PositionPriceTick>()
  private throttleTimer: ReturnType<typeof setInterval> | null = null
  private mfePersistTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat = 0
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null

  /** Called immediately on each price tick (before throttle) — used by ConditionMonitor */
  onPriceTick: ((tick: PositionPriceTick) => void) | null = null

  constructor(
    private stateManager: StateManager,
    private positionManager: PositionManager,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private throttleMs: number = 500,
  ) {
    // Re-evaluate instruments when positions change
    positionManager.onPositionsChange(() => this.evaluateInstruments())

    // Reconnect on credential change
    stateManager.onCredentialChange((creds) => {
      this.disconnect()
      if (creds) this.evaluateInstruments()
    })
  }

  disconnect(): void {
    this.stopHeartbeatMonitor()
    this.stopThrottle()
    this.stopMfePersist()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.reconnectAttempt = 0
    this.currentInstruments = []
  }

  // ─── Instrument tracking ──────────────────────────────────────────────────

  private evaluateInstruments(): void {
    const instruments = this.positionManager.getActiveInstruments()
    const sorted = instruments.sort()

    if (JSON.stringify(sorted) === JSON.stringify(this.currentInstruments)) return

    this.currentInstruments = sorted

    if (sorted.length > 0) {
      this.connectStream(sorted)
    } else {
      this.disconnect()
    }
  }

  // ─── Stream connection ────────────────────────────────────────────────────

  private async connectStream(instruments: string[]): Promise<void> {
    // Clean up any existing connection
    this.stopHeartbeatMonitor()
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    const creds = this.stateManager.getCredentials()
    if (!creds) return

    this.abortController = new AbortController()
    const baseUrl = getStreamUrl(creds.mode)
    const instrumentList = instruments.join(",")
    const url = `${baseUrl}/v3/accounts/${creds.accountId}/pricing/stream?instruments=${instrumentList}`

    console.log(`[pos-price] Connecting to pricing stream for: ${instrumentList}`)

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Pricing stream HTTP ${response.status}: ${await response.text()}`)
      }

      if (!response.body) {
        throw new Error("No response body from pricing stream")
      }

      this.reconnectAttempt = 0
      this.lastHeartbeat = Date.now()
      this.startHeartbeatMonitor()
      this.startThrottle()
      this.startMfePersist()

      console.log("[pos-price] Connected successfully")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const msg = JSON.parse(trimmed) as {
              type: string
              instrument?: string
              bids?: Array<{ price: string }>
              asks?: Array<{ price: string }>
              time?: string
            }
            this.handleMessage(msg)
          } catch {
            // Ignore malformed lines
          }
        }
      }

      console.log("[pos-price] Stream ended, will reconnect")
      this.handleDisconnect()
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[pos-price] Connection error:", (error as Error).message)
      this.handleDisconnect()
    }
  }

  private handleMessage(msg: {
    type: string
    instrument?: string
    bids?: Array<{ price: string }>
    asks?: Array<{ price: string }>
    time?: string
  }): void {
    if (msg.type === "HEARTBEAT") {
      this.lastHeartbeat = Date.now()
      return
    }

    if (msg.type === "PRICE" && msg.instrument && msg.bids?.length && msg.asks?.length) {
      this.lastHeartbeat = Date.now()

      const firstBid = msg.bids![0]
      const firstAsk = msg.asks![0]
      if (!firstBid || !firstAsk) return

      const bid = parseFloat(firstBid.price)
      const ask = parseFloat(firstAsk.price)

      const tick: PositionPriceTick = {
        instrument: msg.instrument,
        bid,
        ask,
        time: msg.time ?? new Date().toISOString(),
      }

      // Update PositionManager (computes unrealizedPL and MFE/MAE)
      this.positionManager.updateTradePrice(msg.instrument, bid, ask)

      // Notify condition monitor immediately (before throttle)
      this.onPriceTick?.(tick)

      // Buffer for throttled broadcast
      this.pendingPrices.set(msg.instrument, tick)
    }
  }

  // ─── Throttled broadcast ──────────────────────────────────────────────────

  private startThrottle(): void {
    this.stopThrottle()
    this.throttleTimer = setInterval(() => this.flushPrices(), this.throttleMs)
  }

  private stopThrottle(): void {
    if (this.throttleTimer) {
      clearInterval(this.throttleTimer)
      this.throttleTimer = null
    }
  }

  private flushPrices(): void {
    if (this.pendingPrices.size === 0) return

    const prices = Array.from(this.pendingPrices.values())
    this.pendingPrices.clear()

    this.broadcast({
      type: "positions_price_update",
      timestamp: new Date().toISOString(),
      data: { prices },
    })
  }

  // ─── MFE/MAE persistence (every 30s) ─────────────────────────────────────

  private startMfePersist(): void {
    this.stopMfePersist()
    this.mfePersistTimer = setInterval(() => void this.persistMfeMae(), 30_000)
  }

  private stopMfePersist(): void {
    if (this.mfePersistTimer) {
      clearInterval(this.mfePersistTimer)
      this.mfePersistTimer = null
    }
  }

  private async persistMfeMae(): Promise<void> {
    const entries = this.positionManager.getAllMfeMae()
    for (const [sourceTradeId, state] of entries) {
      try {
        await updateTradeMfeMae("oanda", sourceTradeId, state.mfe, state.mae)
      } catch {
        // Ignore — trade may have been closed between check and persist
      }
    }
  }

  // ─── Heartbeat monitor ────────────────────────────────────────────────────

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    this.heartbeatCheckInterval = setInterval(() => {
      if (Date.now() - this.lastHeartbeat > 15_000) {
        console.warn("[pos-price] No heartbeat in 15s, reconnecting...")
        this.handleDisconnect()
      }
    }, 10_000)
  }

  private stopHeartbeatMonitor(): void {
    if (this.heartbeatCheckInterval) {
      clearInterval(this.heartbeatCheckInterval)
      this.heartbeatCheckInterval = null
    }
  }

  // ─── Reconnection ────────────────────────────────────────────────────────

  private handleDisconnect(): void {
    this.stopHeartbeatMonitor()
    this.stopThrottle()

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempt), 60_000)
    this.reconnectAttempt++

    console.log(`[pos-price] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`)

    this.reconnectTimer = setTimeout(() => {
      if (this.currentInstruments.length > 0) {
        this.connectStream(this.currentInstruments)
      }
    }, delay)
  }
}
