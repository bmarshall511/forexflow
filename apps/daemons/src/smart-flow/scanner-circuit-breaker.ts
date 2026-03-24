import type { SmartFlowScannerCircuitBreakerState } from "@fxflow/types"

export class SmartFlowScannerCircuitBreaker {
  private consecutiveLosses = 0
  private dailyLosses = 0
  private dailyPL = 0
  private startingBalance = 0
  private pausedUntil: number | null = null
  private pauseReason: string | null = null
  private lastResetDay = -1

  // Configurable thresholds (set from settings)
  private maxConsecLosses = 3
  private consecPauseMinutes = 120
  private maxDailyLosses = 4
  private maxDailyDD = 3.0 // percent

  constructor() {}

  /** Update thresholds from settings. Call on startup and config change. */
  updateThresholds(opts: {
    maxConsecLosses: number
    consecPauseMinutes: number
    maxDailyLosses: number
    maxDailyDD: number
  }): void {
    this.maxConsecLosses = opts.maxConsecLosses
    this.consecPauseMinutes = opts.consecPauseMinutes
    this.maxDailyLosses = opts.maxDailyLosses
    this.maxDailyDD = opts.maxDailyDD
  }

  /** Set starting balance for drawdown calculation. Call on startup. */
  setStartingBalance(balance: number): void {
    this.startingBalance = balance
  }

  /** Record a trade outcome. */
  recordOutcome(pl: number): void {
    this.resetIfNewDay()
    this.dailyPL += pl

    if (pl < 0) {
      this.consecutiveLosses++
      this.dailyLosses++

      // Check consecutive loss limit
      if (this.consecutiveLosses >= this.maxConsecLosses) {
        const pauseMs = this.consecPauseMinutes * 60 * 1000
        this.pausedUntil = Date.now() + pauseMs
        this.pauseReason = `${this.consecutiveLosses} consecutive losses — paused ${this.consecPauseMinutes} minutes`
      }

      // Check daily loss limit
      if (this.dailyLosses >= this.maxDailyLosses) {
        this.pauseUntilMidnightUTC()
        this.pauseReason = `${this.dailyLosses} daily losses — paused until midnight UTC`
      }

      // Check daily drawdown
      if (this.startingBalance > 0) {
        const ddPercent = (Math.abs(this.dailyPL) / this.startingBalance) * 100
        if (ddPercent >= this.maxDailyDD) {
          this.pauseUntilMidnightUTC()
          this.pauseReason = `${ddPercent.toFixed(1)}% daily drawdown — paused until midnight UTC`
        }
      }
    } else {
      this.consecutiveLosses = 0 // Reset on win
    }
  }

  /** Check if trading is allowed. */
  isAllowed(): { allowed: boolean; reason: string | null } {
    this.resetIfNewDay()
    if (this.pausedUntil && Date.now() < this.pausedUntil) {
      return { allowed: false, reason: this.pauseReason }
    }
    // Clear expired pause
    if (this.pausedUntil && Date.now() >= this.pausedUntil) {
      this.pausedUntil = null
      this.pauseReason = null
    }
    return { allowed: true, reason: null }
  }

  /** Manual reset. */
  reset(): void {
    this.consecutiveLosses = 0
    this.dailyLosses = 0
    this.dailyPL = 0
    this.pausedUntil = null
    this.pauseReason = null
  }

  /** Get current state for API/UI. */
  getState(): SmartFlowScannerCircuitBreakerState {
    this.resetIfNewDay()
    const ddPercent =
      this.startingBalance > 0
        ? (Math.abs(Math.min(0, this.dailyPL)) / this.startingBalance) * 100
        : 0
    return {
      paused: this.pausedUntil != null && Date.now() < this.pausedUntil,
      pausedUntil: this.pausedUntil ? new Date(this.pausedUntil).toISOString() : null,
      reason: this.pauseReason,
      consecutiveLosses: this.consecutiveLosses,
      dailyLosses: this.dailyLosses,
      dailyDrawdownPercent: Math.round(ddPercent * 100) / 100,
    }
  }

  private pauseUntilMidnightUTC(): void {
    const now = new Date()
    const midnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    )
    this.pausedUntil = midnight.getTime()
  }

  private resetIfNewDay(): void {
    const today = new Date().getUTCDate()
    if (today !== this.lastResetDay) {
      this.lastResetDay = today
      this.dailyLosses = 0
      this.dailyPL = 0
      // Don't reset consecutive losses — they carry across days
      // But clear expired pauses
      if (this.pausedUntil && Date.now() >= this.pausedUntil) {
        this.pausedUntil = null
        this.pauseReason = null
      }
    }
  }
}
