/**
 * Parameterised trading circuit breaker.
 *
 * Tracks consecutive losses, daily losses, and daily drawdown against a
 * starting balance, and reports whether trading is currently allowed.
 * Previously duplicated in `smart-flow/scanner-circuit-breaker.ts` and
 * inline inside `ai-trader/scanner.ts` with slightly different thresholds
 * and different reset semantics — now a single class parameterised by
 * `CircuitBreakerConfig` so each caller can pick its own limits while
 * sharing the day-rollover, drawdown, and pause-until-midnight logic.
 *
 * @module trading-core/circuit-breaker
 */

export interface CircuitBreakerConfig {
  /** Consecutive losses before a timed cooldown kicks in. */
  maxConsecLosses: number
  /** Minutes to pause after the consecutive-loss threshold trips. */
  consecPauseMinutes: number
  /** Daily losses before pausing until next UTC midnight. */
  maxDailyLosses: number
  /** Daily drawdown percent (0-100) before pausing until next UTC midnight. */
  maxDailyDrawdownPercent: number
}

export interface CircuitBreakerState {
  paused: boolean
  pausedUntil: string | null
  reason: string | null
  consecutiveLosses: number
  dailyLosses: number
  dailyDrawdownPercent: number
}

type ClockFn = () => number

/**
 * In-memory circuit breaker. Not persisted — on daemon restart the counters
 * start fresh, which is consistent with both legacy implementations.
 */
export class CircuitBreaker {
  private consecutiveLosses = 0
  private dailyLosses = 0
  private dailyPL = 0
  private startingBalance = 0
  private pausedUntil: number | null = null
  private pauseReason: string | null = null
  private lastResetDay = -1

  constructor(
    private config: CircuitBreakerConfig,
    private readonly now: ClockFn = () => Date.now(),
  ) {}

  updateConfig(next: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...next }
  }

  setStartingBalance(balance: number): void {
    this.startingBalance = balance
  }

  /** Record a closed-trade outcome. `pl` in account currency (positive = win). */
  recordOutcome(pl: number): void {
    this.resetIfNewDay()
    this.dailyPL += pl

    if (pl >= 0) {
      this.consecutiveLosses = 0
      return
    }

    this.consecutiveLosses++
    this.dailyLosses++

    if (!this.pausedUntil && this.consecutiveLosses >= this.config.maxConsecLosses) {
      const pauseMs = this.config.consecPauseMinutes * 60_000
      this.pausedUntil = this.now() + pauseMs
      this.pauseReason = `${this.consecutiveLosses} consecutive losses — paused ${this.config.consecPauseMinutes} minutes`
    }

    if (this.dailyLosses >= this.config.maxDailyLosses) {
      this.pauseUntilMidnightUTC()
      this.pauseReason = `${this.dailyLosses} daily losses — paused until midnight UTC`
    }

    if (this.startingBalance > 0) {
      const ddPercent = (Math.abs(Math.min(0, this.dailyPL)) / this.startingBalance) * 100
      if (ddPercent >= this.config.maxDailyDrawdownPercent) {
        this.pauseUntilMidnightUTC()
        this.pauseReason = `${ddPercent.toFixed(1)}% daily drawdown — paused until midnight UTC`
      }
    }
  }

  isAllowed(): { allowed: boolean; reason: string | null } {
    this.resetIfNewDay()
    if (this.pausedUntil && this.now() < this.pausedUntil) {
      return { allowed: false, reason: this.pauseReason }
    }
    if (this.pausedUntil && this.now() >= this.pausedUntil) {
      this.pausedUntil = null
      this.pauseReason = null
    }
    return { allowed: true, reason: null }
  }

  reset(): void {
    this.consecutiveLosses = 0
    this.dailyLosses = 0
    this.dailyPL = 0
    this.pausedUntil = null
    this.pauseReason = null
  }

  getState(): CircuitBreakerState {
    this.resetIfNewDay()
    const ddPercent =
      this.startingBalance > 0
        ? (Math.abs(Math.min(0, this.dailyPL)) / this.startingBalance) * 100
        : 0
    return {
      paused: this.pausedUntil != null && this.now() < this.pausedUntil,
      pausedUntil: this.pausedUntil ? new Date(this.pausedUntil).toISOString() : null,
      reason: this.pauseReason,
      consecutiveLosses: this.consecutiveLosses,
      dailyLosses: this.dailyLosses,
      dailyDrawdownPercent: Math.round(ddPercent * 100) / 100,
    }
  }

  private pauseUntilMidnightUTC(): void {
    const d = new Date(this.now())
    const midnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
    this.pausedUntil = midnight.getTime()
  }

  private resetIfNewDay(): void {
    const today = new Date(this.now()).getUTCDate()
    if (today === this.lastResetDay) return
    this.lastResetDay = today
    this.dailyLosses = 0
    this.dailyPL = 0
    // Consecutive losses intentionally carry across days (matches legacy).
    if (this.pausedUntil && this.now() >= this.pausedUntil) {
      this.pausedUntil = null
      this.pauseReason = null
    }
  }
}
