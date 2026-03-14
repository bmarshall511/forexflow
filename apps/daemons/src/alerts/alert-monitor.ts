/**
 * AlertMonitor — monitors live prices against user-defined price alerts.
 *
 * Keeps an in-memory index of active alerts grouped by instrument.
 * On each price tick from PositionPriceTracker, checks mid-price against
 * target levels and triggers matching alerts (DB update + WS broadcast + notification).
 *
 * @module alert-monitor
 */
import type { PriceAlertData, AnyDaemonMessage } from "@fxflow/types"
import {
  getActiveAlertInstruments,
  getActiveAlertsForInstrument,
  triggerPriceAlert,
  expireOldAlerts,
} from "@fxflow/db"

export class AlertMonitor {
  private alerts = new Map<string, PriceAlertData[]>()
  private expireTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private broadcast: (msg: AnyDaemonMessage) => void,
    private emitNotification: (
      title: string,
      message: string,
      severity: "info" | "warning" | "critical",
    ) => void,
  ) {}

  /** Load all active alerts from DB and group by instrument. */
  async initialize(): Promise<void> {
    await this.reload()

    // Expire old alerts every 60 seconds
    this.expireTimer = setInterval(() => void this.runExpiry(), 60_000)
    console.log(
      `[alert-monitor] Initialized with ${this.alerts.size} instruments, ` +
        `${this.totalAlertCount()} active alerts`,
    )
  }

  stop(): void {
    if (this.expireTimer) {
      clearInterval(this.expireTimer)
      this.expireTimer = null
    }
  }

  /** Returns instruments that have active alerts (for price subscription). */
  getMonitoredInstruments(): string[] {
    return Array.from(this.alerts.keys())
  }

  /** Called on every price tick — checks alerts for the given instrument. */
  onPriceTick(instrument: string, bid: number, ask: number): void {
    const instrumentAlerts = this.alerts.get(instrument)
    if (!instrumentAlerts || instrumentAlerts.length === 0) return

    const mid = (bid + ask) / 2
    const triggered: PriceAlertData[] = []

    for (const alert of instrumentAlerts) {
      if (alert.direction === "above" && mid >= alert.targetPrice) {
        triggered.push(alert)
      } else if (alert.direction === "below" && mid <= alert.targetPrice) {
        triggered.push(alert)
      }
    }

    for (const alert of triggered) {
      void this.triggerAlert(alert, mid)
    }
  }

  /** Add a newly created alert to the in-memory index. */
  async onAlertCreated(alert: PriceAlertData): Promise<void> {
    if (alert.status !== "active") return
    const existing = this.alerts.get(alert.instrument) ?? []
    existing.push(alert)
    this.alerts.set(alert.instrument, existing)
  }

  /** Remove an alert from the in-memory index. */
  async onAlertDeleted(alertId: string, instrument: string): Promise<void> {
    const existing = this.alerts.get(instrument)
    if (!existing) return
    const filtered = existing.filter((a) => a.id !== alertId)
    if (filtered.length === 0) {
      this.alerts.delete(instrument)
    } else {
      this.alerts.set(instrument, filtered)
    }
  }

  /** Reload all active alerts from DB (called after bulk operations). */
  async reload(): Promise<void> {
    this.alerts.clear()
    const instruments = await getActiveAlertInstruments()
    for (const instrument of instruments) {
      const alertsForInst = await getActiveAlertsForInstrument(instrument)
      if (alertsForInst.length > 0) {
        this.alerts.set(instrument, alertsForInst)
      }
    }
  }

  private async triggerAlert(alert: PriceAlertData, currentPrice: number): Promise<void> {
    try {
      const updated = await triggerPriceAlert(alert.id)
      const pair = alert.instrument.replace("_", "/")
      const dir = alert.direction === "above" ? "above" : "below"

      // Broadcast WS message
      this.broadcast({
        type: "price_alert_triggered",
        timestamp: new Date().toISOString(),
        data: updated,
      })

      // Emit notification
      const label = alert.label ? ` "${alert.label}"` : ""
      this.emitNotification(
        "Price Alert Triggered",
        `${pair}${label} crossed ${dir} ${alert.targetPrice} (now ${currentPrice.toFixed(5)})`,
        "info",
      )

      // Update in-memory state
      if (alert.repeating) {
        // Replace with updated version (triggeredAt updated, still active)
        const existing = this.alerts.get(alert.instrument) ?? []
        const idx = existing.findIndex((a) => a.id === alert.id)
        if (idx >= 0) existing[idx] = updated
      } else {
        // Remove non-repeating alert
        await this.onAlertDeleted(alert.id, alert.instrument)
      }
    } catch (err) {
      console.error(`[alert-monitor] Failed to trigger alert ${alert.id}:`, (err as Error).message)
    }
  }

  private async runExpiry(): Promise<void> {
    try {
      const count = await expireOldAlerts()
      if (count > 0) {
        console.log(`[alert-monitor] Expired ${count} alerts`)
        await this.reload()
      }
    } catch (err) {
      console.error("[alert-monitor] Expiry check failed:", (err as Error).message)
    }
  }

  private totalAlertCount(): number {
    let count = 0
    for (const alerts of this.alerts.values()) count += alerts.length
    return count
  }
}
