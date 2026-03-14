import type { TradingMode } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { AccountDataCollector } from "./account-data-collector.js"
import type { OandaTradeSyncer } from "./trade-syncer.js"
import { getRestUrl, type OandaTransactionStreamEvent } from "./api-client.js"

/**
 * Persistent stream connection to OANDA's transaction stream.
 * On ORDER_FILL events, triggers an immediate P&L refresh.
 *
 * Follows the same pattern as OandaStreamClient (pricing stream):
 * - Chunked fetch with line-by-line reading
 * - Heartbeat monitoring (15s timeout)
 * - Exponential backoff reconnection
 */
export class TransactionStreamClient {
  private abortController: AbortController | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat = 0
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null

  private tradeSyncer: OandaTradeSyncer | null = null

  constructor(
    private stateManager: StateManager,
    private accountDataCollector: AccountDataCollector,
    private baseReconnectDelay: number = 5000,
    private maxReconnectDelay: number = 60000,
  ) {
    // Listen for credential changes to reconnect
    stateManager.onCredentialChange((creds) => {
      this.disconnect()
      if (creds) {
        this.connect(creds.token, creds.accountId, creds.mode)
      }
    })
  }

  async connect(token: string, accountId: string, mode: TradingMode): Promise<void> {
    this.disconnect()
    this.abortController = new AbortController()

    // Transaction stream uses REST URL, not stream URL
    const baseUrl = getRestUrl(mode)
    const url = `${baseUrl}/v3/accounts/${accountId}/transactions/stream`

    console.log(`[tx-stream] Connecting to ${mode} transaction stream...`)

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Transaction stream HTTP ${response.status}: ${await response.text()}`)
      }

      if (!response.body) {
        throw new Error("No response body from transaction stream")
      }

      // Successfully connected
      this.reconnectAttempt = 0
      console.log("[tx-stream] Connected successfully")

      // Start heartbeat monitoring
      this.lastHeartbeat = Date.now()
      this.startHeartbeatMonitor()

      // Read the stream line-by-line
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
            const msg = JSON.parse(trimmed) as OandaTransactionStreamEvent
            this.handleMessage(msg)
          } catch {
            console.warn("[tx-stream] Failed to parse line:", trimmed.slice(0, 100))
          }
        }
      }

      // Stream ended normally
      console.log("[tx-stream] Stream ended, will reconnect")
      this.handleDisconnect()
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[tx-stream] Connection error:", (error as Error).message)
      this.handleDisconnect()
    }
  }

  /** Attach the trade syncer (called after both are constructed to avoid circular deps). */
  setTradeSyncer(syncer: OandaTradeSyncer): void {
    this.tradeSyncer = syncer
  }

  private handleMessage(msg: OandaTransactionStreamEvent): void {
    if (msg.type === "HEARTBEAT") {
      this.lastHeartbeat = Date.now()
      return
    }

    this.lastHeartbeat = Date.now()

    // On ORDER_FILL, trigger immediate today P&L refresh
    if (msg.type === "ORDER_FILL") {
      console.log("[tx-stream] Order fill detected, refreshing today P&L")
      this.accountDataCollector.refreshTodayPnL()
    }

    // Forward trade-relevant events to TradeSyncer
    const tradeEvents = [
      "ORDER_FILL",
      "ORDER_CANCEL",
      "STOP_LOSS_ORDER",
      "TAKE_PROFIT_ORDER",
      "TRAILING_STOP_LOSS_ORDER",
    ]
    if (this.tradeSyncer && tradeEvents.includes(msg.type)) {
      void this.tradeSyncer.handleTransactionEvent(msg)
    }
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    this.heartbeatCheckInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat
      if (elapsed > 15_000) {
        console.warn("[tx-stream] No heartbeat in 15s, reconnecting...")
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

  private handleDisconnect(): void {
    this.stopHeartbeatMonitor()

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    )
    this.reconnectAttempt++

    console.log(`[tx-stream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`)

    this.reconnectTimer = setTimeout(() => {
      const creds = this.stateManager.getCredentials()
      if (creds) {
        this.connect(creds.token, creds.accountId, creds.mode)
      }
    }, delay)
  }

  disconnect(): void {
    this.stopHeartbeatMonitor()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.reconnectAttempt = 0
  }
}
