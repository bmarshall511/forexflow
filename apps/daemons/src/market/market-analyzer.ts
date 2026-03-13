import type { MarketCloseReason } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import { isWeekendClosed, isRolloverWindow, getNextExpectedChange } from "@fxflow/shared"

const CLOSE_LABELS: Record<MarketCloseReason, string> = {
  weekend: "Weekend Close",
  rollover: "Daily Rollover",
  holiday: "Holiday",
  paused: "Paused by OANDA",
}

export class MarketAnalyzer {
  private lastTradeableState: boolean | null = null
  private lastTradeableChangeTime = new Date()
  private updateTimer: ReturnType<typeof setInterval> | null = null

  constructor(private stateManager: StateManager) {
    // Periodically update the countdown target even when no stream data
    this.updateTimer = setInterval(() => this.updateCountdown(), 30_000)
  }

  /** Called by the stream client whenever a PRICE message arrives. */
  onTradeableUpdate(tradeable: boolean): void {
    const changed = this.lastTradeableState !== tradeable
    if (changed) {
      this.lastTradeableState = tradeable
      this.lastTradeableChangeTime = new Date()
    }

    const now = new Date()

    if (tradeable) {
      this.stateManager.updateMarket({
        isOpen: true,
        closeReason: null,
        closeLabel: null,
        lastStatusChange: changed ? now.toISOString() : this.stateManager.getMarket().lastStatusChange,
        nextExpectedChange: getNextExpectedChange(now).toISOString(),
      })
    } else {
      const reason = this.detectCloseReason(now)
      this.stateManager.updateMarket({
        isOpen: false,
        closeReason: reason,
        closeLabel: CLOSE_LABELS[reason],
        lastStatusChange: changed ? now.toISOString() : this.stateManager.getMarket().lastStatusChange,
        nextExpectedChange: getNextExpectedChange(now).toISOString(),
      })
    }
  }

  /** Determine WHY the market is closed using time-based heuristics. */
  private detectCloseReason(now: Date): MarketCloseReason {
    // Priority: weekend > rollover > holiday > paused
    if (isWeekendClosed(now)) return "weekend"
    if (isRolloverWindow(now)) return "rollover"

    // If non-tradeable for > 10 minutes outside rollover on a weekday, infer holiday
    const minutesSinceChange =
      (now.getTime() - this.lastTradeableChangeTime.getTime()) / 60_000
    if (minutesSinceChange > 10) {
      return "holiday"
    }

    // Default catch-all for brief OANDA-initiated pauses
    return "paused"
  }

  /** Update countdown target even when no stream data is flowing. */
  private updateCountdown(): void {
    const now = new Date()
    this.stateManager.updateMarket({
      nextExpectedChange: getNextExpectedChange(now).toISOString(),
    })
  }

  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }
}
