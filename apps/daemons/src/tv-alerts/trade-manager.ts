/**
 * TV Alerts Trade Manager — post-entry management for TV Alert trades.
 *
 * Monitors open TV Alert trades via price ticks and applies configurable
 * management rules using the shared trading-core functions:
 * - Breakeven: move SL to entry + buffer at configurable R:R
 * - Trailing stop: trail SL behind price by ATR × multiple
 * - Partial close: "thirds" strategy (33% at 1:1, 33% at 2:1) or "standard"
 * - Time exit: close stale trades after N hours if below R:R threshold
 * - Whipsaw detection: suppress entries on rapid UT Bot signal flips
 *
 * Follows the same late-binding pattern as TradeFinderTradeManager.
 *
 * @module tv-alerts/trade-manager
 */

import type {
  TVAlertsManagementConfig,
  PositionPriceTick,
  AnyDaemonMessage,
  OpenTradeData,
  CloseContext,
} from "@fxflow/types"
import { getTVAlertsManagementConfig } from "@fxflow/db"
import {
  getPipSize,
  priceToPips,
  evaluateBreakeven,
  evaluateTrailing,
  evaluateTimeExit,
  CircuitBreaker,
  computeProfitPips,
  computeRiskPips,
} from "@fxflow/shared"

/** Callback types for late-binding */
export interface ModifyTradeSLTPFn {
  (
    sourceTradeId: string,
    stopLoss?: number | null,
    takeProfit?: number | null,
  ): Promise<{ stopLoss: number | null; takeProfit: number | null }>
}

export interface CloseTradeFn {
  (
    sourceTradeId: string,
    units?: number,
    reason?: string,
    attribution?: {
      closedBy: NonNullable<CloseContext["closedBy"]>
      closedByLabel: string
      closedByDetail?: string
    },
  ): Promise<void>
}

export interface GetOpenTradesFn {
  (): OpenTradeData[]
}

/** Grace period after fill before management starts */
const FILL_GRACE_MS = 30_000
/** Minimum time between SL modifications */
const MODIFY_COOLDOWN_MS = 60_000
/** Config reload interval */
const CONFIG_RELOAD_MS = 60_000

interface ManagedTrade {
  sourceTradeId: string
  instrument: string
  direction: "long" | "short"
  entryPrice: number
  currentUnits: number
  stopLoss: number | null
  takeProfit: number | null
  atr: number // ATR at placement (stored from signal processor)
  filledAt: number
  lastModifiedAt: number
  breakevenApplied: boolean
  trailingActivated: boolean
  partialCloses: number // count of partial closes fired
}

export class TVAlertsTradeManager {
  private managedTrades = new Map<string, ManagedTrade>()
  private modifyTradeFn: ModifyTradeSLTPFn | null = null
  private closeTradeFn: CloseTradeFn | null = null
  private getOpenTradesFn: GetOpenTradesFn | null = null
  private config: TVAlertsManagementConfig | null = null
  private lastConfigLoad = 0
  private isAutoTradeFn: ((sourceTradeId: string) => boolean) | null = null

  /** Circuit breaker — pauses new entries after consecutive losses / drawdown. */
  readonly circuitBreaker = new CircuitBreaker({
    maxConsecLosses: 3,
    consecPauseMinutes: 60,
    maxDailyLosses: 5,
    maxDailyDrawdownPercent: 3.0,
  })

  constructor(private broadcast: (msg: AnyDaemonMessage) => void) {}

  /** Late-bind trade action callbacks */
  setCallbacks(
    modifyTrade: ModifyTradeSLTPFn,
    closeTrade: CloseTradeFn,
    getOpenTrades: GetOpenTradesFn,
    isAutoTrade: (sourceTradeId: string) => boolean,
  ): void {
    this.modifyTradeFn = modifyTrade
    this.closeTradeFn = closeTrade
    this.getOpenTradesFn = getOpenTrades
    this.isAutoTradeFn = isAutoTrade
  }

  /** Track a newly filled TV Alert trade */
  onOrderFilled(
    sourceTradeId: string,
    instrument: string,
    direction: "long" | "short",
    entryPrice: number,
    currentUnits: number,
    stopLoss: number | null,
    takeProfit: number | null,
    atr: number,
  ): void {
    this.managedTrades.set(sourceTradeId, {
      sourceTradeId,
      instrument,
      direction,
      entryPrice,
      currentUnits,
      stopLoss,
      takeProfit,
      atr,
      filledAt: Date.now(),
      lastModifiedAt: 0,
      breakevenApplied: false,
      trailingActivated: false,
      partialCloses: 0,
    })
    console.log(`[tv-alerts-mgr] Now managing: ${instrument} ${direction} (${sourceTradeId})`)
  }

  /** Stop managing a closed trade and record outcome for circuit breaker. */
  onTradeClosed(sourceTradeId: string, realizedPL?: number): void {
    // Only count TV Alert trades for circuit breaker — check BEFORE delete
    const wasManagedByUs = this.managedTrades.has(sourceTradeId)
    if (this.managedTrades.delete(sourceTradeId)) {
      console.log(`[tv-alerts-mgr] Stopped managing: ${sourceTradeId}`)
    }
    // Feed outcome to circuit breaker ONLY for our trades (not EdgeFinder, Trade Finder, etc.)
    if (wasManagedByUs && realizedPL !== undefined) {
      this.circuitBreaker.recordOutcome(realizedPL)
    }
  }

  /** Process price tick — evaluate all managed trades */
  async onPriceTick(tick: PositionPriceTick): Promise<void> {
    if (!this.modifyTradeFn || !this.closeTradeFn || !this.getOpenTradesFn) return

    // Reload config periodically
    if (Date.now() - this.lastConfigLoad > CONFIG_RELOAD_MS) {
      try {
        this.config = await getTVAlertsManagementConfig()
        this.lastConfigLoad = Date.now()
      } catch (err) {
        console.error("[tv-alerts-mgr] Config reload failed:", err)
      }
    }
    if (!this.config) return

    // Find managed trades on this instrument
    const openTrades = this.getOpenTradesFn()
    for (const [sourceTradeId, managed] of this.managedTrades) {
      if (managed.instrument !== tick.instrument) continue

      // Find the live trade data
      const liveTrade = openTrades.find((t) => t.sourceTradeId === sourceTradeId)
      if (!liveTrade) continue

      // Update cached state from live data
      managed.currentUnits = liveTrade.currentUnits
      managed.stopLoss = liveTrade.stopLoss
      managed.takeProfit = liveTrade.takeProfit

      // Grace period after fill
      if (Date.now() - managed.filledAt < FILL_GRACE_MS) continue

      const currentPrice = managed.direction === "long" ? tick.bid : tick.ask
      await this.evaluateTrade(managed, currentPrice, this.config)
    }
  }

  /** Evaluate management rules for a single trade */
  private async evaluateTrade(
    trade: ManagedTrade,
    currentPrice: number,
    config: TVAlertsManagementConfig,
  ): Promise<void> {
    const pipSize = getPipSize(trade.instrument)
    const profitPips = computeProfitPips({
      instrument: trade.instrument,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      currentPrice,
    })
    const riskPips = trade.stopLoss
      ? computeRiskPips({
          instrument: trade.instrument,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          stopLoss: trade.stopLoss,
        })
      : 0

    // 1. Time exit (checked first — can close the trade)
    if (config.timeExitEnabled && riskPips > 0) {
      const timeResult = evaluateTimeExit({
        openedAt: trade.filledAt,
        maxHours: config.timeExitHours,
      })
      if (timeResult.shouldFire && profitPips < riskPips * config.timeExitMinRR) {
        try {
          await this.closeTradeFn!(trade.sourceTradeId, undefined, "TIME_EXIT", {
            closedBy: "tv_alert_management",
            closedByLabel: "TV Alert Time Exit",
            closedByDetail: `Trade held ${timeResult.hoursOpen.toFixed(1)}h with insufficient progress`,
          })
          this.managedTrades.delete(trade.sourceTradeId)
          console.log(
            `[tv-alerts-mgr] Time exit: ${trade.instrument} after ${timeResult.hoursOpen.toFixed(1)}h`,
          )
        } catch (err) {
          console.error(`[tv-alerts-mgr] Time exit failed for ${trade.sourceTradeId}:`, err)
        }
        return
      }
    }

    // Cooldown check for SL modifications
    const now = Date.now()
    if (now - trade.lastModifiedAt < MODIFY_COOLDOWN_MS) return

    // 2. Breakeven
    if (config.breakevenEnabled && !trade.breakevenApplied && riskPips > 0) {
      const thresholdPips = riskPips * config.breakevenRR
      const beResult = evaluateBreakeven({
        instrument: trade.instrument,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        currentSL: trade.stopLoss,
        profitPips,
        thresholdPips,
        bufferPips: config.breakevenBufferPips,
        alreadyApplied: trade.breakevenApplied,
      })
      if (beResult.shouldFire && beResult.newSL !== null) {
        try {
          await this.modifyTradeFn!(trade.sourceTradeId, beResult.newSL)
          trade.stopLoss = beResult.newSL
          trade.breakevenApplied = true
          trade.lastModifiedAt = now
          console.log(
            `[tv-alerts-mgr] Breakeven: ${trade.instrument} SL → ${beResult.newSL.toFixed(pipSize < 0.001 ? 5 : 3)}`,
          )
        } catch (err) {
          console.error(`[tv-alerts-mgr] Breakeven failed for ${trade.sourceTradeId}:`, err)
        }
        return
      }
    }

    // 3. Trailing stop (activates after breakeven)
    if (config.trailingEnabled && trade.breakevenApplied) {
      trade.trailingActivated = true
      const trailDistance = trade.atr * config.trailingAtrMultiple
      if (trailDistance > 0) {
        const trailResult = evaluateTrailing({
          instrument: trade.instrument,
          direction: trade.direction,
          currentPrice,
          currentSL: trade.stopLoss,
          trailDistancePrice: trailDistance,
          activated: true,
        })
        if (trailResult.shouldFire && trailResult.newSL !== null) {
          // Check step size
          const slMovePips = trade.stopLoss
            ? priceToPips(trade.instrument, Math.abs(trailResult.newSL - trade.stopLoss))
            : config.trailingStepPips + 1
          if (slMovePips >= config.trailingStepPips) {
            try {
              await this.modifyTradeFn!(trade.sourceTradeId, trailResult.newSL)
              trade.stopLoss = trailResult.newSL
              trade.lastModifiedAt = now
            } catch (err) {
              console.error(`[tv-alerts-mgr] Trailing failed for ${trade.sourceTradeId}:`, err)
            }
            return
          }
        }
      }
    }

    // 4. Partial close
    if (config.partialCloseEnabled && riskPips > 0) {
      if (config.partialCloseStrategy === "thirds") {
        await this.evaluateThirdsPartialClose(trade, profitPips, riskPips, now)
      } else if (config.partialCloseStrategy === "standard") {
        await this.evaluateStandardPartialClose(trade, profitPips, riskPips, config, now)
      }
    }
  }

  /** Thirds strategy: 33% at 1:1, 33% at 2:1 (move SL to 1:1 level) */
  private async evaluateThirdsPartialClose(
    trade: ManagedTrade,
    profitPips: number,
    riskPips: number,
    _now: number,
  ): Promise<void> {
    if (trade.partialCloses >= 2) return // already closed both thirds

    const triggers = [
      { rr: 1.0, index: 0 },
      { rr: 2.0, index: 1 },
    ]

    for (const trigger of triggers) {
      if (trade.partialCloses > trigger.index) continue
      if (profitPips < riskPips * trigger.rr) continue

      const closeUnits = Math.floor(trade.currentUnits * 0.33)
      if (closeUnits <= 0) continue

      try {
        await this.closeTradeFn!(trade.sourceTradeId, closeUnits, "PARTIAL_CLOSE", {
          closedBy: "tv_alert_management",
          closedByLabel: "TV Alert Partial Close",
          closedByDetail: `Thirds strategy: closed ${closeUnits} units at ${trigger.rr}:1 R:R`,
        })
        trade.partialCloses = trigger.index + 1
        trade.currentUnits -= closeUnits

        // At second partial (2:1), move SL to 1:1 level
        if (trigger.index === 1 && trade.stopLoss !== null) {
          const pipSize = getPipSize(trade.instrument)
          const newSL =
            trade.direction === "long"
              ? trade.entryPrice + riskPips * pipSize
              : trade.entryPrice - riskPips * pipSize
          try {
            await this.modifyTradeFn!(trade.sourceTradeId, newSL)
            trade.stopLoss = newSL
          } catch {
            /* best effort */
          }
        }

        console.log(
          `[tv-alerts-mgr] Partial close (thirds ${trigger.index + 1}/2): ${trade.instrument} -${closeUnits} units`,
        )
        return
      } catch (err) {
        console.error(`[tv-alerts-mgr] Partial close failed for ${trade.sourceTradeId}:`, err)
      }
    }
  }

  /** Standard strategy: close X% at configurable R:R */
  private async evaluateStandardPartialClose(
    trade: ManagedTrade,
    profitPips: number,
    riskPips: number,
    config: TVAlertsManagementConfig,
    _now: number,
  ): Promise<void> {
    if (trade.partialCloses >= 1) return
    if (profitPips < riskPips * config.partialCloseRR) return

    const closeUnits = Math.floor(trade.currentUnits * (config.partialClosePercent / 100))
    if (closeUnits <= 0) return

    try {
      await this.closeTradeFn!(trade.sourceTradeId, closeUnits, "PARTIAL_CLOSE", {
        closedBy: "tv_alert_management",
        closedByLabel: "TV Alert Partial Close",
        closedByDetail: `Standard: closed ${closeUnits} units (${config.partialClosePercent}%) at ${config.partialCloseRR}:1`,
      })
      trade.partialCloses++
      trade.currentUnits -= closeUnits
      console.log(
        `[tv-alerts-mgr] Partial close: ${trade.instrument} -${closeUnits} units at ${config.partialCloseRR}:1`,
      )
    } catch (err) {
      console.error(`[tv-alerts-mgr] Partial close failed for ${trade.sourceTradeId}:`, err)
    }
  }

  // ─── Whipsaw Detection ──────────────────────────────────────────────────

  private signalHistory = new Map<string, number[]>() // instrument → timestamps

  /** Record a signal for whipsaw detection. Called by SignalProcessor. */
  recordSignal(instrument: string): void {
    const history = this.signalHistory.get(instrument) ?? []
    history.push(Date.now())
    // Keep only last 10 entries
    if (history.length > 10) history.shift()
    this.signalHistory.set(instrument, history)
  }

  /** Check if an instrument is in a whipsaw state (too many recent signal flips). */
  isWhipsawActive(instrument: string): boolean {
    if (!this.config?.whipsawDetectionEnabled) return false
    const history = this.signalHistory.get(instrument)
    if (!history) return false

    const windowMs = (this.config.whipsawWindowHours ?? 4) * 3_600_000
    const cutoff = Date.now() - windowMs
    const recentCount = history.filter((t) => t > cutoff).length
    return recentCount >= (this.config.whipsawMaxSignals ?? 3)
  }

  /** Get whipsaw cooldown remaining in ms, or 0 if not in cooldown. */
  getWhipsawCooldown(instrument: string): number {
    if (!this.isWhipsawActive(instrument)) return 0
    const history = this.signalHistory.get(instrument)
    if (!history || history.length === 0) return 0

    const lastSignal = history[history.length - 1]!
    const cooldownMs = (this.config?.whipsawCooldownMinutes ?? 60) * 60_000
    const remaining = lastSignal + cooldownMs - Date.now()
    return Math.max(0, remaining)
  }

  /** Number of currently managed trades */
  get managedCount(): number {
    return this.managedTrades.size
  }

  /** Count recent signals on an instrument within a time window (for AI filter context). */
  getRecentSignalCount(instrument: string, windowMs: number): number {
    const history = this.signalHistory.get(instrument)
    if (!history) return 0
    const cutoff = Date.now() - windowMs
    return history.filter((t) => t > cutoff).length
  }
}
