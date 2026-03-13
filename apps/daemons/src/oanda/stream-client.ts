import type { TradingMode } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { MarketAnalyzer } from "../market/market-analyzer.js"
import { getStreamUrl, type OandaStreamMessage } from "./api-client.js"

export class OandaStreamClient {
  private abortController: AbortController | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat = 0
  private heartbeatCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    private stateManager: StateManager,
    private marketAnalyzer: MarketAnalyzer,
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

    const streamUrl = getStreamUrl(mode)
    const url = `${streamUrl}/v3/accounts/${accountId}/pricing/stream?instruments=EUR_USD`

    console.log(`[stream] Connecting to ${mode} pricing stream...`)

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Stream HTTP ${response.status}: ${await response.text()}`)
      }

      if (!response.body) {
        throw new Error("No response body from stream")
      }

      // Successfully connected
      this.reconnectAttempt = 0
      this.stateManager.updateOanda({ streamConnected: true, errorMessage: null })
      console.log("[stream] Connected successfully")

      // Start heartbeat monitoring (OANDA sends heartbeats every 5s)
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
        buffer = lines.pop() ?? "" // Keep incomplete last line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const msg = JSON.parse(trimmed) as OandaStreamMessage
            this.handleMessage(msg)
          } catch {
            console.warn("[stream] Failed to parse line:", trimmed.slice(0, 100))
          }
        }
      }

      // Stream ended normally (server closed it)
      console.log("[stream] Stream ended, will reconnect")
      this.handleDisconnect()
    } catch (error) {
      if ((error as Error).name === "AbortError") return // Intentional disconnect
      console.error("[stream] Connection error:", (error as Error).message)
      this.handleDisconnect()
    }
  }

  private handleMessage(msg: OandaStreamMessage): void {
    if (msg.type === "HEARTBEAT") {
      this.lastHeartbeat = Date.now()
      return
    }

    if (msg.type === "PRICE" && msg.instrument === "EUR_USD") {
      this.lastHeartbeat = Date.now()
      this.marketAnalyzer.onTradeableUpdate(msg.tradeable)
    }
  }

  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    // Check every 10s — if no heartbeat in 15s, consider connection stale
    this.heartbeatCheckInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat
      if (elapsed > 15_000) {
        console.warn("[stream] No heartbeat in 15s, reconnecting...")
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

    // Abort the current stream reader to prevent it from lingering
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    // Cancel any existing reconnect timer to prevent duplicates
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stateManager.updateOanda({ streamConnected: false })

    // Exponential backoff reconnection
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempt),
      this.maxReconnectDelay,
    )
    this.reconnectAttempt++

    console.log(`[stream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`)

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
    this.stateManager.updateOanda({ streamConnected: false })
  }
}
