/**
 * Theoretical Outcome Monitor — tracks what would have happened without management intervention.
 *
 * After a Trade Finder trade closes, this monitors price for up to 2x the hold time
 * (capped at 48 hours) to determine:
 * - Would price have reached the original TP?
 * - Would price have reached the original SL?
 * - Max favorable/adverse excursion after close
 *
 * Results stored in TradeFinderSetup.theoreticalOutcomeJson for learning/adaptation.
 *
 * @module theoretical-monitor
 */
import { getPipSize } from "@fxflow/shared"
import { updateSetupTheoreticalOutcome, getFilledSetups } from "@fxflow/db"
import type { TradeFinderSetupData, TradeFinderTheoreticalOutcome, ZoneCandle } from "@fxflow/types"

/** Max monitoring period after trade close */
const MAX_MONITOR_HOURS = 48

interface MonitoredTrade {
  setup: TradeFinderSetupData
  closedAt: number // ms timestamp
  monitorUntil: number // ms timestamp
  maxFavorable: number // pips
  maxAdverse: number // pips
  reachedTP: boolean
  reachedSL: boolean
}

export class TheoreticalOutcomeMonitor {
  private monitored = new Map<string, MonitoredTrade>()
  private timer: ReturnType<typeof setInterval> | null = null
  private fetchCandlesFn:
    | ((instrument: string, timeframe: string, count: number) => Promise<ZoneCandle[]>)
    | null = null

  /** Set the candle fetching callback */
  setFetchCandles(
    fn: (instrument: string, timeframe: string, count: number) => Promise<ZoneCandle[]>,
  ): void {
    this.fetchCandlesFn = fn
  }

  /** Start monitoring: check every 5 minutes */
  start(): void {
    this.timer = setInterval(() => void this.evaluate(), 5 * 60 * 1000)
    console.log("[trade-finder-theoretical] Monitor started")
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Called when a Trade Finder trade closes — start tracking theoretical outcome */
  onTradeClose(setup: TradeFinderSetupData, holdTimeMs: number): void {
    // Monitor for 2x hold time, capped at 48 hours
    const monitorDuration = Math.min(holdTimeMs * 2, MAX_MONITOR_HOURS * 60 * 60 * 1000)
    const now = Date.now()

    this.monitored.set(setup.id, {
      setup,
      closedAt: now,
      monitorUntil: now + monitorDuration,
      maxFavorable: 0,
      maxAdverse: 0,
      reachedTP: false,
      reachedSL: false,
    })

    console.log(
      `[trade-finder-theoretical] Monitoring ${setup.instrument} for ${(monitorDuration / 3600000).toFixed(1)}h`,
    )
  }

  /** Periodic evaluation — fetch recent prices and check TP/SL levels */
  private async evaluate(): Promise<void> {
    const now = Date.now()

    for (const [setupId, mon] of this.monitored) {
      // Check if monitoring period expired
      if (now >= mon.monitorUntil) {
        await this.finalize(setupId, mon)
        continue
      }

      try {
        await this.checkPrices(mon)
      } catch (err) {
        console.error(`[trade-finder-theoretical] Error checking ${mon.setup.instrument}:`, err)
      }
    }
  }

  /** Check recent candles for TP/SL hits and MFE/MAE tracking */
  private async checkPrices(mon: MonitoredTrade): Promise<void> {
    const { setup } = mon
    const pipSize = getPipSize(setup.instrument)

    if (!this.fetchCandlesFn) return
    // Fetch recent M5 candles
    const candles = await this.fetchCandlesFn(setup.instrument, "M5", 60)
    const closedAtSec = mon.closedAt / 1000

    // Only check candles after close
    const postCloseCandles = candles.filter((c) => c.time >= closedAtSec)
    if (postCloseCandles.length === 0) return

    for (const candle of postCloseCandles) {
      // Calculate excursion from entry
      if (setup.direction === "long") {
        const favorable = (candle.high - setup.entryPrice) / pipSize
        const adverse = (setup.entryPrice - candle.low) / pipSize
        if (favorable > mon.maxFavorable) mon.maxFavorable = favorable
        if (adverse > mon.maxAdverse) mon.maxAdverse = adverse

        // Check if candle reached TP or SL
        if (candle.high >= setup.takeProfit) mon.reachedTP = true
        if (candle.low <= setup.stopLoss) mon.reachedSL = true
      } else {
        const favorable = (setup.entryPrice - candle.low) / pipSize
        const adverse = (candle.high - setup.entryPrice) / pipSize
        if (favorable > mon.maxFavorable) mon.maxFavorable = favorable
        if (adverse > mon.maxAdverse) mon.maxAdverse = adverse

        if (candle.low <= setup.takeProfit) mon.reachedTP = true
        if (candle.high >= setup.stopLoss) mon.reachedSL = true
      }
    }
  }

  /** Finalize and persist the theoretical outcome */
  private async finalize(setupId: string, mon: MonitoredTrade): Promise<void> {
    const hoursMonitored = (Date.now() - mon.closedAt) / 3600000

    const outcome: TradeFinderTheoreticalOutcome = {
      reachedTP: mon.reachedTP,
      reachedSL: mon.reachedSL,
      maxFavorableAfterClose: Math.round(mon.maxFavorable * 10) / 10,
      maxAdverseAfterClose: Math.round(mon.maxAdverse * 10) / 10,
      monitoredHours: Math.round(hoursMonitored * 10) / 10,
    }

    try {
      await updateSetupTheoreticalOutcome(setupId, outcome)
      console.log(
        `[trade-finder-theoretical] ${mon.setup.instrument}: TP=${mon.reachedTP} SL=${mon.reachedSL} MFE=${outcome.maxFavorableAfterClose}p MAE=${outcome.maxAdverseAfterClose}p (${outcome.monitoredHours}h)`,
      )
    } catch (err) {
      console.error(`[trade-finder-theoretical] Failed to save outcome for ${setupId}:`, err)
    }

    this.monitored.delete(setupId)
  }

  /** Load any existing filled setups that need monitoring on startup */
  async initialize(): Promise<void> {
    try {
      const setups = await getFilledSetups()
      // Only monitor setups that were filled recently (last 48 hours)
      const cutoff = Date.now() - MAX_MONITOR_HOURS * 60 * 60 * 1000
      for (const setup of setups) {
        if (setup.theoreticalOutcome) continue // Already has outcome
        const filledAt = setup.placedAt ? new Date(setup.placedAt).getTime() : 0
        if (filledAt > cutoff) {
          this.monitored.set(setup.id, {
            setup,
            closedAt: Date.now(),
            monitorUntil: Date.now() + 4 * 60 * 60 * 1000, // 4 hours for startup recovery
            maxFavorable: 0,
            maxAdverse: 0,
            reachedTP: false,
            reachedSL: false,
          })
        }
      }
      if (this.monitored.size > 0) {
        console.log(
          `[trade-finder-theoretical] Loaded ${this.monitored.size} setups for monitoring`,
        )
      }
    } catch {
      // Non-critical — don't block startup
    }
  }
}
