/**
 * SmartFlow scanner circuit breaker — thin adapter on the shared
 * `CircuitBreaker` from `@fxflow/shared/trading-core`.
 *
 * The class and method names are preserved so existing consumers
 * (`market-scanner.ts`) keep compiling; all logic lives in the shared
 * primitive. Future work should migrate callers to use `CircuitBreaker`
 * directly.
 */
import { CircuitBreaker, type CircuitBreakerConfig } from "@fxflow/shared"
import type { SmartFlowScannerCircuitBreakerState } from "@fxflow/types"

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxConsecLosses: 3,
  consecPauseMinutes: 120,
  maxDailyLosses: 4,
  maxDailyDrawdownPercent: 3.0,
}

export class SmartFlowScannerCircuitBreaker {
  private readonly cb = new CircuitBreaker(DEFAULT_CONFIG)

  updateThresholds(opts: {
    maxConsecLosses: number
    consecPauseMinutes: number
    maxDailyLosses: number
    maxDailyDD: number
  }): void {
    this.cb.updateConfig({
      maxConsecLosses: opts.maxConsecLosses,
      consecPauseMinutes: opts.consecPauseMinutes,
      maxDailyLosses: opts.maxDailyLosses,
      maxDailyDrawdownPercent: opts.maxDailyDD,
    })
  }

  setStartingBalance(balance: number): void {
    this.cb.setStartingBalance(balance)
  }

  recordOutcome(pl: number): void {
    this.cb.recordOutcome(pl)
  }

  isAllowed(): { allowed: boolean; reason: string | null } {
    return this.cb.isAllowed()
  }

  reset(): void {
    this.cb.reset()
  }

  getState(): SmartFlowScannerCircuitBreakerState {
    const state = this.cb.getState()
    return {
      paused: state.paused,
      pausedUntil: state.pausedUntil,
      reason: state.reason,
      consecutiveLosses: state.consecutiveLosses,
      dailyLosses: state.dailyLosses,
      dailyDrawdownPercent: state.dailyDrawdownPercent,
    }
  }
}
