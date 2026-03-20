/**
 * Trade Finder Circuit Breaker — drawdown protection for auto-trading.
 *
 * Monitors consecutive losses, daily losses, and daily drawdown.
 * Pauses auto-trading when thresholds are breached to prevent catastrophic losses.
 */

import type { AnyDaemonMessage, TradeFinderCircuitBreakerState } from "@fxflow/types"

export class TradeFinderCircuitBreaker {
  private consecutiveLosses = 0
  private dailyLosses = 0
  private dailyDrawdownPercent = 0
  private pausedUntil: Date | null = null
  private pauseReason: string | null = null
  private reducedSizing = false
  private broadcast: (msg: AnyDaemonMessage) => void
  private dailyResetTimer: ReturnType<typeof setInterval>

  constructor(broadcast: (msg: AnyDaemonMessage) => void) {
    this.broadcast = broadcast
    // Check for daily reset every minute
    this.dailyResetTimer = setInterval(() => this.checkDailyReset(), 60_000)
  }

  /** Called when a Trade Finder auto-trade closes */
  onTradeClose(outcome: "win" | "loss" | "breakeven", plPercent: number): void {
    if (outcome === "win") {
      this.consecutiveLosses = 0
      // Gradually restore sizing after recovery
      if (this.reducedSizing && this.dailyDrawdownPercent < 2) {
        this.reducedSizing = false
      }
      this.broadcastState()
      return
    }

    if (outcome === "breakeven") {
      this.broadcastState()
      return
    }

    // Loss
    this.consecutiveLosses++
    this.dailyLosses++
    this.dailyDrawdownPercent += Math.abs(plPercent)

    // 3 consecutive losses → pause 4 hours
    if (this.consecutiveLosses >= 3 && !this.isPaused()) {
      this.pause(4 * 60, "3 consecutive auto-trade losses")
    }

    // 5 losses in 24h → pause 24 hours
    if (this.dailyLosses >= 5 && !this.isPaused()) {
      this.pause(24 * 60, "5 auto-trade losses in 24 hours")
    }

    // Daily drawdown > 5% → pause rest of day
    if (this.dailyDrawdownPercent > 5 && !this.isPaused()) {
      this.pause(this.minutesToMidnightUTC(), "Daily drawdown exceeded 5%")
    }

    // Daily drawdown > 3% → reduce sizing 50%
    if (this.dailyDrawdownPercent > 3) {
      this.reducedSizing = true
    }

    this.broadcastState()
  }

  /** Check if auto-trading is allowed */
  isAllowed(): { allowed: boolean; reason: string | null } {
    if (this.isPaused()) {
      return { allowed: false, reason: this.pauseReason }
    }
    return { allowed: true, reason: null }
  }

  /** Get sizing multiplier (0.5 when in reduced mode) */
  getSizingMultiplier(): number {
    return this.reducedSizing ? 0.5 : 1.0
  }

  /** Get current state for API/WS */
  getState(): TradeFinderCircuitBreakerState {
    return {
      paused: this.isPaused(),
      pausedUntil: this.pausedUntil?.toISOString() ?? null,
      reason: this.isPaused() ? this.pauseReason : null,
      consecutiveLosses: this.consecutiveLosses,
      dailyLosses: this.dailyLosses,
      dailyDrawdownPercent: Math.round(this.dailyDrawdownPercent * 100) / 100,
      reducedSizing: this.reducedSizing,
    }
  }

  /** Manually reset the circuit breaker */
  reset(): void {
    this.consecutiveLosses = 0
    this.dailyLosses = 0
    this.dailyDrawdownPercent = 0
    this.pausedUntil = null
    this.pauseReason = null
    this.reducedSizing = false
    this.broadcastState()
  }

  dispose(): void {
    clearInterval(this.dailyResetTimer)
  }

  private isPaused(): boolean {
    if (!this.pausedUntil) return false
    if (Date.now() >= this.pausedUntil.getTime()) {
      // Pause expired
      this.pausedUntil = null
      this.pauseReason = null
      return false
    }
    return true
  }

  private pause(minutes: number, reason: string): void {
    this.pausedUntil = new Date(Date.now() + minutes * 60_000)
    this.pauseReason = reason
    console.log(
      `[trade-finder-cb] PAUSED: ${reason} — resuming at ${this.pausedUntil.toISOString()}`,
    )
  }

  private minutesToMidnightUTC(): number {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setUTCDate(midnight.getUTCDate() + 1)
    midnight.setUTCHours(0, 0, 0, 0)
    return Math.ceil((midnight.getTime() - now.getTime()) / 60_000)
  }

  private checkDailyReset(): void {
    const now = new Date()
    // Reset at midnight UTC
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
      this.dailyLosses = 0
      this.dailyDrawdownPercent = 0
      this.reducedSizing = false
      console.log("[trade-finder-cb] Daily counters reset")
      this.broadcastState()
    }
  }

  private broadcastState(): void {
    this.broadcast({
      type: "trade_finder_circuit_breaker",
      timestamp: new Date().toISOString(),
      data: this.getState(),
    })
  }
}
