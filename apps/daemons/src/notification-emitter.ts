import type { StateManager } from "./state-manager.js"
import type { PositionManager } from "./positions/position-manager.js"
import type {
  AnyDaemonMessage,
  OandaHealthData,
  NotificationData,
  NotificationSource,
  PositionsData,
} from "@fxflow/types"
import { createNotification, cleanupOldNotifications } from "@fxflow/db"
import { formatCurrency } from "@fxflow/shared"

export class NotificationEmitter {
  private prevApiReachable: boolean | null = null
  private prevStreamConnected: boolean | null = null
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null
  private prevOpenIds = new Set<string>()
  private prevClosedIds = new Set<string>()

  constructor(
    private stateManager: StateManager,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private positionManager?: PositionManager,
  ) {}

  start(): void {
    // Listen for OANDA state changes
    this.stateManager.onOandaChange((oanda) => this.handleOandaChange(oanda))

    // Listen for position changes (trade opens and closes)
    if (this.positionManager) {
      this.positionManager.onPositionsChange((data) => this.handlePositionsChange(data))
    }

    // Run cleanup on startup and every 24 hours
    void cleanupOldNotifications(30).catch((err) => {
      console.error("[notification-emitter] Cleanup error:", err)
    })
    this.cleanupIntervalId = setInterval(
      () => {
        void cleanupOldNotifications(30).catch((err) => {
          console.error("[notification-emitter] Cleanup error:", err)
        })
      },
      24 * 60 * 60 * 1000,
    )
  }

  stop(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
    }
  }

  private async handleOandaChange(oanda: OandaHealthData): Promise<void> {
    // API reachability transitions
    if (this.prevApiReachable !== null && this.prevApiReachable !== oanda.apiReachable) {
      if (!oanda.apiReachable) {
        await this.emit({
          severity: "critical",
          source: "oanda_api",
          title: "OANDA API Disconnected",
          message: oanda.errorMessage ?? "The OANDA REST API is no longer reachable.",
        })
      } else {
        await this.emit({
          severity: "info",
          source: "oanda_api",
          title: "OANDA API Reconnected",
          message: "The OANDA REST API connection has been restored.",
        })
      }
    }

    // Stream connectivity transitions
    if (this.prevStreamConnected !== null && this.prevStreamConnected !== oanda.streamConnected) {
      if (!oanda.streamConnected) {
        await this.emit({
          severity: "warning",
          source: "oanda_stream",
          title: "Price Stream Lost",
          message: "The OANDA pricing stream has disconnected. Attempting to reconnect.",
        })
      } else {
        await this.emit({
          severity: "info",
          source: "oanda_stream",
          title: "Price Stream Restored",
          message: "The OANDA pricing stream is active again.",
        })
      }
    }

    this.prevApiReachable = oanda.apiReachable
    this.prevStreamConnected = oanda.streamConnected
  }

  private handlePositionsChange(data: PositionsData): void {
    // Detect newly opened trades
    const currentOpenIds = new Set(data.open.map((t) => t.sourceTradeId))
    for (const trade of data.open) {
      if (!this.prevOpenIds.has(trade.sourceTradeId)) {
        const dir = trade.direction === "long" ? "Long" : "Short"
        const pair = trade.instrument.replace("_", "/")
        void this.emit({
          severity: "info",
          source: "oanda_api",
          title: "Position Opened",
          message: `${pair} ${dir} — ${trade.currentUnits} units @ ${trade.entryPrice}`,
        })
      }
    }

    // Detect newly closed trades
    const currentClosedIds = new Set(data.closed.map((t) => t.sourceTradeId))
    for (const trade of data.closed) {
      if (!this.prevClosedIds.has(trade.sourceTradeId)) {
        const dir = trade.direction === "long" ? "Long" : "Short"
        const pair = trade.instrument.replace("_", "/")
        const pl = formatCurrency(trade.realizedPL, "USD")
        const prefix = trade.realizedPL >= 0 ? "+" : ""
        void this.emit({
          severity: trade.outcome === "win" ? "info" : "warning",
          source: "oanda_api",
          title: "Position Closed",
          message: `${pair} ${dir} — ${prefix}${pl}`,
        })
      }
    }

    this.prevOpenIds = currentOpenIds
    this.prevClosedIds = currentClosedIds
  }

  /** Emit a notification for a user-initiated action (cancel, close, modify). */
  async emitUserAction(title: string, message: string): Promise<void> {
    await this.emit({
      severity: "info",
      source: "user_action",
      title,
      message,
    })
  }

  /** Emit a notification from the TV Alerts module. */
  async emitTVAlert(
    title: string,
    message: string,
    severity: "info" | "warning" | "critical" = "info",
  ): Promise<void> {
    await this.emit({
      severity,
      source: "tv_alerts",
      title,
      message,
    })
  }

  /** Emit a notification from the Trade Finder module. */
  async emitTradeFinder(
    title: string,
    message: string,
    severity: "info" | "warning" | "critical" = "info",
  ): Promise<void> {
    await this.emit({
      severity,
      source: "trade_finder",
      title,
      message,
    })
  }

  /** Emit a notification from the Price Alert module. */
  async emitPriceAlert(
    title: string,
    message: string,
    severity: "info" | "warning" | "critical" = "info",
  ): Promise<void> {
    await this.emit({
      severity,
      source: "price_alert",
      title,
      message,
    })
  }

  /** Emit a notification from the AI Trader module. */
  async emitAiTrader(
    title: string,
    message: string,
    severity: "info" | "warning" | "critical" = "info",
  ): Promise<void> {
    await this.emit({
      severity,
      source: "ai_trader",
      title,
      message,
    })
  }

  private async emit(input: {
    severity: "critical" | "warning" | "info"
    source: NotificationSource
    title: string
    message: string
  }): Promise<void> {
    try {
      const notification = await createNotification(input)
      if (notification) {
        this.broadcastNotification(notification)
      }
    } catch (error) {
      console.error("[notification-emitter] Failed to create notification:", error)
    }
  }

  private broadcastNotification(notification: NotificationData): void {
    this.broadcast({
      type: "notification_created",
      timestamp: new Date().toISOString(),
      data: notification,
    })
  }
}
