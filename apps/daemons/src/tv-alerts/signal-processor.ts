import type {
  TVWebhookPayload,
  TVAlertStatus,
  TVAlertRejectionReason,
  TVAlertsConfig,
  TVAlertsQualityConfig,
  TVAlertSignal,
  TVExecutionDetails,
  ConfluenceResult,
  AnyDaemonMessage,
  PlaceOrderRequest,
} from "@fxflow/types"
import {
  isMarketExpectedOpen,
  getPipSize,
  computeATR,
  calculateATRStopLoss,
  calculateRRTakeProfit,
  checkSpread,
  countSharedCurrencyExposure,
} from "@fxflow/shared"
import {
  createSignal,
  updateSignalStatus,
  getRecentSignal,
  getActiveAutoTradeCount,
  getTodayAutoTradePL,
  getAutoTradesSummary,
  syncClosedSignalResults,
  cleanupOldSignals,
  getTVAlertsConfig,
  getTVAlertsQualityConfig,
  logAuditEvent,
  cleanupOldAuditEvents,
  getOpenTradeIdsByPlacedVia,
  hasImminentHighImpactEvent,
  getSignalRecentResults,
} from "@fxflow/db"
import type { StateManager } from "../state-manager.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { PositionPriceTracker } from "../positions/position-price-tracker.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import type { TVAlertsState } from "./alerts-state.js"
import type { TVAlertsTradeManager } from "./trade-manager.js"
import { ConfluenceEngine } from "./confluence-engine.js"
import { CandleCache, fetchOandaCandles } from "../trade-finder/candle-cache.js"
import { getRestUrl } from "../oanda/api-client.js"

const RETRY_DELAYS = [1000, 2000, 4000] // ms

/**
 * Central signal processing engine for TV Alerts.
 * Processes signals through a sequential validation pipeline, then executes trades.
 * Per-instrument mutex prevents concurrent execution on the same pair.
 */
export class SignalProcessor {
  private config: TVAlertsConfig | null = null
  private qualityConfig: TVAlertsQualityConfig | null = null
  private confluenceEngine: ConfluenceEngine
  private candleCache = new CandleCache()
  private instrumentMutex = new Map<string, Promise<void>>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private selfHealTimer: ReturnType<typeof setInterval> | null = null
  private priceTracker: PositionPriceTracker | null = null
  private tradeManager: TVAlertsTradeManager | null = null

  /** Late-bind the price tracker (wired after construction in index.ts). */
  setPriceTracker(tracker: PositionPriceTracker): void {
    this.priceTracker = tracker
  }

  /** Late-bind the trade manager for post-entry management. */
  setTradeManager(manager: TVAlertsTradeManager): void {
    this.tradeManager = manager
  }

  constructor(
    private stateManager: StateManager,
    private positionManager: PositionManager,
    private tradeSyncer: OandaTradeSyncer,
    private notificationEmitter: NotificationEmitter,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private alertsState: TVAlertsState,
  ) {
    this.confluenceEngine = new ConfluenceEngine(stateManager)
  }

  /** Load config from DB, restore state, and start cleanup timer. */
  async start(): Promise<void> {
    await this.reloadConfig()

    // Restore TV alerts state from DB so stats are correct after daemon restart
    try {
      const summary = await getAutoTradesSummary()
      this.alertsState.initializeFromDB(summary)
      console.log(
        `[signal-processor] Restored state: ${summary.activeAutoPositions} active positions, ` +
          `${summary.signalCountToday} signals today, $${summary.todayAutoPL.toFixed(2)} daily P&L`,
      )
    } catch (err) {
      console.error("[signal-processor] Failed to restore state from DB:", err)
    }

    // Cleanup old signals + audit events every 24 hours
    this.cleanupTimer = setInterval(
      () => {
        void cleanupOldSignals(30).catch((err) => {
          console.error("[signal-processor] Cleanup error:", err)
        })
        void cleanupOldAuditEvents(30).catch((err) => {
          console.error("[signal-processor] Audit cleanup error:", err)
        })
      },
      24 * 60 * 60 * 1000,
    )

    // Initial cleanup + sync closed signal results for P&L tracking
    void cleanupOldSignals(30).catch((err) =>
      console.error("[signal-processor] Background task error:", err),
    )
    void cleanupOldAuditEvents(30).catch((err) =>
      console.error("[signal-processor] Background task error:", err),
    )
    void syncClosedSignalResults().catch((err) =>
      console.error("[signal-processor] Background task error:", err),
    )

    // Periodically sync closed signal results (catches SL/TP hits between signals)
    this.syncTimer = setInterval(() => {
      void syncClosedSignalResults()
        .then((count) => {
          if (count > 0) {
            // Update daily P&L after syncing new results
            void getTodayAutoTradePL().then((pl) => this.alertsState.updateDailyPL(pl))
          }
        })
        .catch((err) => console.error("[signal-processor] Background task error:", err))
    }, 30_000) // every 30 seconds

    // Self-healing: rebuild autoTradeIds from DB metadata every 60 seconds
    this.selfHealTimer = setInterval(() => {
      void this.alertsState
        .syncAutoTradeIdsFromDB(() => getOpenTradeIdsByPlacedVia("ut_bot_alerts"))
        .catch((err) => {
          console.error("[signal-processor] Self-heal sync error:", err)
        })
    }, 60_000)
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
    if (this.selfHealTimer) {
      clearInterval(this.selfHealTimer)
      this.selfHealTimer = null
    }
  }

  async reloadConfig(): Promise<void> {
    this.config = await getTVAlertsConfig()
    this.qualityConfig = await getTVAlertsQualityConfig()
    this.alertsState.loadFromConfig(this.config)
  }

  /**
   * Process an incoming signal. Acquires per-instrument mutex to prevent
   * concurrent execution on the same pair.
   */
  async processSignal(payload: TVWebhookPayload, instrument: string): Promise<void> {
    // Serialize per instrument
    const prev = this.instrumentMutex.get(instrument) ?? Promise.resolve()
    const current = prev
      .then(() => this.processSignalInner(payload, instrument))
      .catch((err) => {
        console.error(`[signal-processor] Unhandled error for ${instrument}:`, err)
      })
    this.instrumentMutex.set(instrument, current)
  }

  private async processSignalInner(payload: TVWebhookPayload, instrument: string): Promise<void> {
    const receivedAt = new Date()
    const t0 = Date.now()
    this.alertsState.recordSignal()

    // Reload config each signal to pick up changes
    await this.reloadConfig()
    const config = this.config
    if (!config) return

    const direction = payload.action

    // Dedup check: reject if a recent signal with the same instrument+direction exists
    if (config.dedupWindowSeconds > 0) {
      const recent = await getRecentSignal(instrument, direction, config.dedupWindowSeconds)
      if (recent) {
        // Still record the signal so it appears in history, but mark as rejected
        const dup = await createSignal({
          source: "ut_bot_alerts",
          instrument,
          direction,
          status: "rejected",
          rejectionReason: "duplicate_signal",
          rawPayload: payload,
          receivedAt,
          processedAt: new Date(),
        })
        this.broadcastSignalUpdate(dup.id)
        await logAuditEvent(dup.id, "rejected", {
          reason: "duplicate_signal",
          duplicateOf: recent.id,
          dedupWindowSeconds: config.dedupWindowSeconds,
          rawPayload: payload,
          duration_ms: Date.now() - t0,
        })
        console.log(
          `[signal-processor] Signal ${dup.id} rejected: duplicate_signal (within ${config.dedupWindowSeconds}s of ${recent.id})`,
        )
        return
      }
    }

    // Record signal for whipsaw detection (after dedup so duplicates don't count)
    this.tradeManager?.recordSignal(instrument)

    // Create initial signal record
    const signal = await createSignal({
      source: "ut_bot_alerts",
      instrument,
      direction,
      status: "received",
      rawPayload: payload,
      receivedAt,
    })

    // Audit: signal received
    await logAuditEvent(signal.id, "received", {
      instrument,
      direction,
      rawPayload: payload,
      receivedAt: receivedAt.toISOString(),
      duration_ms: Date.now() - t0,
    })

    // Audit: config loaded
    const tConfig = Date.now()
    await logAuditEvent(signal.id, "config_loaded", {
      enabled: config.enabled,
      marketHoursFilter: config.marketHoursFilter,
      dedupWindowSeconds: config.dedupWindowSeconds,
      cooldownSeconds: config.cooldownSeconds,
      maxOpenPositions: config.maxOpenPositions,
      dailyLossLimit: config.dailyLossLimit,
      riskPercent: config.riskPercent,
      minUnits: config.minUnits,
      pairWhitelist: config.pairWhitelist,
      duration_ms: tConfig - t0,
    })

    // Determine whether this signal would be a reversal BEFORE running validation.
    // Check ALL positions on this instrument (auto AND manual) — reversals close everything on the pair.
    const positions = this.positionManager.getPositions()
    const positionsOnInstrument = positions.open.filter((t) => t.instrument === instrument)

    const oppositePositions = positionsOnInstrument.filter(
      (t) =>
        (t.direction === "long" && direction === "sell") ||
        (t.direction === "short" && direction === "buy"),
    )
    const sameDirectionPositions = positionsOnInstrument.filter(
      (t) =>
        (t.direction === "long" && direction === "buy") ||
        (t.direction === "short" && direction === "sell"),
    )

    const isReversal = oppositePositions.length > 0
    const tradeIdsToClose = oppositePositions.map((t) => t.sourceTradeId)

    // Special case: circuit breaker is tripped but a reversal signal arrived.
    // Close all existing positions on the pair to stop losses, but do NOT open a new one.
    if (isReversal && this.alertsState.isCircuitBreakerTripped()) {
      console.log(
        `[signal-processor] ${instrument}: circuit breaker active — executing protective close for ${tradeIdsToClose.length} position(s)`,
      )
      await logAuditEvent(signal.id, "validated", {
        result: "protective_close",
        isReversal: true,
        circuitBreakerTripped: true,
        closingTradeIds: tradeIdsToClose,
        duration_ms: Date.now() - t0,
      })
      await this.executeProtectiveClose(signal.id, tradeIdsToClose, instrument, t0)
      await this.postExecution(instrument, config, signal.id, t0)
      return
    }

    // Run validation pipeline.
    const rejection = this.validate(config, instrument, direction, isReversal)
    if (rejection) {
      await logAuditEvent(signal.id, "validated", {
        result: "rejected",
        reason: rejection,
        isReversal,
        positionsOnInstrument: positionsOnInstrument.map((t) => t.sourceTradeId),
        duration_ms: Date.now() - t0,
      })
      await this.rejectSignal(signal.id, rejection)
      return
    }

    // Async validation: news event filter (bypassed for reversals — closing is always appropriate)
    if (!isReversal) {
      try {
        const newsCheck = await hasImminentHighImpactEvent(instrument, 2)
        if (newsCheck.imminent) {
          await logAuditEvent(signal.id, "validated", {
            result: "rejected",
            reason: "news_event_imminent",
            event: newsCheck.event,
            duration_ms: Date.now() - t0,
          })
          await this.rejectSignal(signal.id, "news_event_imminent")
          return
        }
      } catch (err) {
        // Fail-open: if news check fails (e.g. no events in DB), don't block the signal
        console.warn("[signal-processor] News check failed (continuing):", (err as Error).message)
      }
    }

    const currentStatus = this.alertsState.getStatus()
    await logAuditEvent(signal.id, "validated", {
      result: "passed",
      isReversal,
      tradeIdsToClose: isReversal ? tradeIdsToClose : [],
      activeAutoPositions: currentStatus.activeAutoPositions,
      dailyPL: currentStatus.todayAutoPL,
      duration_ms: Date.now() - t0,
    })

    // Evaluate signal confluence (if quality engine is enabled).
    // For reversals: always close existing positions, but only open new if confluence passes.
    let confluenceResult: ConfluenceResult | null = null
    const qc = this.qualityConfig
    if (qc?.enabled) {
      try {
        confluenceResult = await this.confluenceEngine.evaluate(
          instrument,
          direction as "buy" | "sell",
          payload.interval,
          qc,
        )
        await logAuditEvent(signal.id, "confluence_evaluated", {
          score: confluenceResult.score,
          passed: confluenceResult.passed,
          minScore: qc.minScore,
          atr: confluenceResult.atr,
          breakdown: confluenceResult.breakdown,
          duration_ms: Date.now() - t0,
        })

        if (!confluenceResult.passed && !isReversal) {
          // Reject: insufficient confluence for new entries
          await this.rejectSignal(signal.id, "low_confluence")
          return
        }
      } catch (err) {
        // Confluence evaluation failed — log but don't block execution
        console.warn(`[signal-processor] Confluence evaluation error for ${instrument}:`, err)
        await logAuditEvent(signal.id, "confluence_evaluated", {
          error: (err as Error).message,
          fallthrough: true,
          duration_ms: Date.now() - t0,
        })
      }
    }

    // AI signal filter — Haiku pre-trade evaluation (opt-in, bypassed for reversals)
    if (config.aiFilterEnabled && !isReversal) {
      try {
        const { evaluateSignalWithAI } = await import("./ai-signal-filter.js")
        const tick = this.priceTracker?.getLatestPrice(instrument)
        const spreadPips = tick ? (tick.ask - tick.bid) / getPipSize(instrument) : null
        const recentCount = this.tradeManager?.getRecentSignalCount(instrument, 4 * 3_600_000) ?? 0
        const status = this.alertsState.getStatus()

        // Fetch recent pair performance (best-effort, filter to this instrument)
        let recentWins = 0
        let recentLosses = 0
        try {
          const recent = await getSignalRecentResults(20)
          for (const r of recent) {
            if (r.instrument !== instrument) continue
            if (r.realizedPL > 0.005) recentWins++
            else if (r.realizedPL < -0.005) recentLosses++
          }
        } catch {
          /* best-effort */
        }

        const aiResult = await evaluateSignalWithAI({
          instrument,
          direction: direction as "buy" | "sell",
          signalPrice: payload.price ?? null,
          confluenceScore: confluenceResult?.score ?? null,
          confluenceBreakdown: confluenceResult?.breakdown ?? null,
          atr: confluenceResult?.atr ?? 0,
          spreadPips,
          recentSignalCount: recentCount,
          openAutoTradeCount: status.activeAutoPositions,
          todayPL: status.todayAutoPL,
          recentWins,
          recentLosses,
        })

        if (aiResult) {
          await logAuditEvent(signal.id, "ai_filter_evaluated", {
            execute: aiResult.execute,
            confidence: aiResult.confidence,
            reason: aiResult.reason,
            model: aiResult.model,
            inputTokens: aiResult.inputTokens,
            outputTokens: aiResult.outputTokens,
            durationMs: aiResult.durationMs,
          })

          if (!aiResult.execute || aiResult.confidence < config.aiFilterMinConfidence) {
            await this.rejectSignal(signal.id, "ai_filter_rejected")
            return
          }
        }
      } catch (err) {
        // Fail-open: if AI filter crashes, continue without it
        console.warn("[signal-processor] AI filter error (continuing):", (err as Error).message)
      }
    }

    // Execute: reversal, same-direction skip, or new entry
    if (isReversal) {
      await this.executeReversal(
        signal.id,
        tradeIdsToClose,
        direction,
        instrument,
        config,
        t0,
        confluenceResult,
      )
    } else if (sameDirectionPositions.length > 0) {
      await logAuditEvent(signal.id, "validated", {
        result: "rejected",
        reason: "same_direction_exists",
        existingTradeIds: sameDirectionPositions.map((t) => t.sourceTradeId),
        duration_ms: Date.now() - t0,
      })
      await this.rejectSignal(signal.id, "same_direction_exists")
      return
    } else {
      await this.executeNewEntry(signal.id, direction, instrument, config, t0, confluenceResult)
    }

    await this.postExecution(instrument, config, signal.id, t0)
  }

  /** Shared post-execution housekeeping: sync P&L, update position count, start cooldown. */
  private async postExecution(
    instrument: string,
    config: TVAlertsConfig,
    signalId?: string,
    t0?: number,
  ): Promise<void> {
    await syncClosedSignalResults().catch((err) =>
      console.error("[signal-processor] Background task error:", err),
    )

    const autoCount = await getActiveAutoTradeCount()
    this.alertsState.setActiveAutoPositions(autoCount)

    const dailyPL = await getTodayAutoTradePL()
    this.alertsState.updateDailyPL(dailyPL)

    this.alertsState.startCooldown(instrument, config.cooldownSeconds)

    if (signalId) {
      await logAuditEvent(signalId, "post_execution", {
        activeAutoPositions: autoCount,
        dailyPL,
        cooldownSeconds: config.cooldownSeconds,
        totalDuration_ms: t0 ? Date.now() - t0 : undefined,
      })
    }
  }

  // ─── Validation Pipeline ──────────────────────────────────────────────────

  private validate(
    config: TVAlertsConfig,
    instrument: string,
    direction: string,
    isReversal: boolean,
  ): TVAlertRejectionReason | null {
    // 1. Module enabled check
    if (!config.enabled) return "kill_switch_active"

    // 2. Kill switch
    if (this.alertsState.isKillSwitchActive()) return "kill_switch_active"

    // 3. Market hours filter (applies to all signals — don't open new positions outside market hours)
    if (config.marketHoursFilter && !isMarketExpectedOpen(new Date())) return "market_closed"

    // 4. Cooldown check
    // Bypassed for reversals: a position flip should never be blocked by the cooldown that
    // started when the now-existing position was opened.
    if (!isReversal && this.alertsState.isCooldownActive(instrument)) return "cooldown_active"

    // 5. Max positions check
    // Bypassed for reversals: a reversal closes one position and opens one — net-zero change
    // against the cap. Counting the trade-to-be-closed would incorrectly block the flip.
    if (!isReversal) {
      const autoTrades = this.positionManager
        .getPositions()
        .open.filter((t) => this.alertsState.isAutoTrade(t.sourceTradeId))
      if (autoTrades.length >= config.maxOpenPositions) return "max_positions_reached"
    }

    // 6. Circuit breaker / daily loss limit
    // (Reversal + circuit breaker is handled before validate() via executeProtectiveClose)
    if (this.alertsState.isCircuitBreakerTripped()) return "daily_loss_limit"
    // Also check the trade manager's shared circuit breaker (consecutive losses, drawdown)
    if (this.tradeManager) {
      const cb = this.tradeManager.circuitBreaker.isAllowed()
      if (!cb.allowed) return "daily_loss_limit"
    }

    // 7. Pair whitelist check
    const whitelist: string[] =
      typeof config.pairWhitelist === "string"
        ? JSON.parse(config.pairWhitelist || "[]")
        : config.pairWhitelist
    if (whitelist.length > 0 && !whitelist.includes(instrument)) return "pair_not_whitelisted"

    // 8. Manual position conflict (any non-auto trade on this instrument)
    // Bypassed for reversals: reversals close ALL positions on the pair (auto + manual)
    // then open a new auto-trade position.
    if (!isReversal) {
      const manualPosition = this.positionManager
        .getPositions()
        .open.find(
          (t) => t.instrument === instrument && !this.alertsState.isAutoTrade(t.sourceTradeId),
        )
      if (manualPosition) return "manual_position_conflict"
    }

    // 9. OANDA connectivity
    const oanda = this.stateManager.getOanda()
    if (!oanda.apiReachable) return "execution_failed"

    // 10. Whipsaw detection — too many rapid signal flips on this instrument
    if (!isReversal && this.tradeManager?.isWhipsawActive(instrument)) return "whipsaw_detected"

    // 11. Spread validation — reject if current spread is too wide relative to expected risk
    if (!isReversal && this.priceTracker) {
      const tick = this.priceTracker.getLatestPrice(instrument)
      if (tick && tick.ask > tick.bid) {
        const spreadPrice = tick.ask - tick.bid
        const pipSize = getPipSize(instrument)
        const spreadPips = spreadPrice / pipSize
        // Use a conservative 20% threshold (same as SmartFlow)
        // If we know the ATR, calculate actual risk pips; otherwise use a 30-pip heuristic
        const riskPips = 30 // conservative estimate; actual SL distance checked later
        const spreadResult = checkSpread({ spreadPips, riskPips, maxPercent: 0.2 })
        if (!spreadResult.passed) return "spread_too_wide"
      }
    }

    // 12. Correlation guard — max 2 same-currency same-direction auto-trades
    if (!isReversal) {
      const autoTrades = this.positionManager
        .getPositions()
        .open.filter((t) => this.alertsState.isAutoTrade(t.sourceTradeId))
      const dir: "long" | "short" = direction === "buy" ? "long" : "short"
      const positions = autoTrades.map((t) => ({
        instrument: t.instrument,
        direction: t.direction as "long" | "short",
      }))
      const exposure = countSharedCurrencyExposure(instrument, dir, positions)
      if (exposure >= 2) return "currency_overexposure"
    }

    return null
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  /**
   * Protective close: circuit breaker is active, so close all existing positions on the pair
   * to stop further losses but do NOT open a new position in the opposite direction.
   */
  private async executeProtectiveClose(
    signalId: string,
    existingTradeIds: string[],
    instrument: string,
    t0: number,
  ): Promise<void> {
    await updateSignalStatus(signalId, "executing")
    await logAuditEvent(signalId, "executing", {
      type: "protective_close",
      closingTradeIds: existingTradeIds,
      instrument,
      duration_ms: Date.now() - t0,
    })

    const closedIds: string[] = []
    const failedIds: string[] = []

    for (const tradeId of existingTradeIds) {
      try {
        await this.tradeSyncer.closeTrade(tradeId, undefined, "REVERSAL", {
          closedBy: "tv_alert_reversal",
          closedByLabel: "TradingView Reversal",
          closedByDetail: "Opposite-direction alert received — protective close",
        })
        this.alertsState.removeAutoTradeId(tradeId)
        closedIds.push(tradeId)
      } catch (err) {
        failedIds.push(tradeId)
        console.error(
          `[signal-processor] Protective close failed for ${tradeId}:`,
          (err as Error).message,
        )
      }
    }

    if (closedIds.length === 0) {
      await logAuditEvent(signalId, "failed", {
        type: "protective_close",
        error: "All close attempts failed",
        failedTradeIds: failedIds,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(
        signalId,
        `Protective close failed for all ${failedIds.length} position(s)`,
      )
      await this.emitNotification(
        "Signal Failed (Protective Close)",
        `${instrument.replace("_", "/")} — failed to close ${failedIds.length} position(s). Manual intervention may be needed.`,
        "critical",
      )
      return
    }

    const executionDetails: TVExecutionDetails = {
      isReversal: false,
      isProtectiveClose: true,
      closedTradeId: closedIds[0] ?? null,
      closedTradeIds: closedIds,
      openedTradeId: null,
      units: 0,
      fillPrice: null,
      retryAttempt: 0,
    }

    await updateSignalStatus(signalId, "executed", {
      executionDetails,
      processedAt: new Date(),
    })

    this.broadcastSignalUpdate(signalId)
    await logAuditEvent(signalId, "executed", {
      type: "protective_close",
      closedTradeIds: closedIds,
      failedTradeIds: failedIds,
      duration_ms: Date.now() - t0,
    })
    await this.emitNotification(
      "Position(s) Closed — Circuit Breaker Active",
      `${instrument.replace("_", "/")} — closed ${closedIds.length} position(s)${failedIds.length > 0 ? `, ${failedIds.length} failed` : ""}. New position NOT opened (daily loss limit reached).`,
      failedIds.length > 0 ? "critical" : "warning",
    )
  }

  private async executeReversal(
    signalId: string,
    existingTradeIds: string[],
    newDirection: string,
    instrument: string,
    config: TVAlertsConfig,
    t0: number,
    confluenceResult: ConfluenceResult | null,
  ): Promise<void> {
    await updateSignalStatus(signalId, "executing")

    // Risk-based position sizing with ATR fallback
    const sizing = await this.calculateRiskBasedUnits(
      config,
      instrument,
      newDirection as "buy" | "sell",
      confluenceResult?.atr ?? null,
    )
    let units = sizing.units
    let sizeMultiplier = 1.0
    const qc = this.qualityConfig
    if (qc?.enabled && confluenceResult && qc.dynamicSizing) {
      sizeMultiplier = this.confluenceEngine.getSizeMultiplier(confluenceResult.score, qc)
      units = Math.floor(units * sizeMultiplier)
    }

    // Enforce minimum units floor
    if (units > 0 && units < config.minUnits) {
      await logAuditEvent(signalId, "failed", {
        type: "reversal",
        step: "min_units_check",
        error: `Calculated ${units} units < minimum ${config.minUnits}`,
        riskPercent: config.riskPercent,
        slDistance: sizing.slDistance,
        slSource: sizing.slSource,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(
        signalId,
        `Position size ${units} below minimum ${config.minUnits} units`,
      )
      return
    }

    await logAuditEvent(signalId, "executing", {
      type: "reversal",
      direction: newDirection,
      instrument,
      closingTradeIds: existingTradeIds,
      closingCount: existingTradeIds.length,
      units,
      sizeMultiplier,
      riskPercent: config.riskPercent,
      slDistance: sizing.slDistance,
      slSource: sizing.slSource,
      confluenceScore: confluenceResult?.score ?? null,
      duration_ms: Date.now() - t0,
    })

    // Step 1: Close ALL existing positions on this instrument (always, regardless of confluence)
    const closedIds: string[] = []
    for (const tradeId of existingTradeIds) {
      try {
        await this.tradeSyncer.closeTrade(tradeId, undefined, "REVERSAL", {
          closedBy: "tv_alert_reversal",
          closedByLabel: "TradingView Reversal",
          closedByDetail: "Reversal signal — closing existing position",
        })
        this.alertsState.removeAutoTradeId(tradeId)
        closedIds.push(tradeId)
      } catch (err) {
        await logAuditEvent(signalId, "failed", {
          type: "reversal",
          step: "close_existing",
          error: (err as Error).message,
          failedTradeId: tradeId,
          closedSoFar: closedIds,
          remainingToClose: existingTradeIds.length - closedIds.length - 1,
          duration_ms: Date.now() - t0,
        })
        await this.failSignal(
          signalId,
          `Failed to close trade ${tradeId}: ${(err as Error).message} (closed ${closedIds.length}/${existingTradeIds.length})`,
        )
        return
      }
    }

    // If confluence failed for the reversal, treat as protective close (close only, don't re-enter)
    if (qc?.enabled && confluenceResult && !confluenceResult.passed) {
      const executionDetails: TVExecutionDetails = {
        isReversal: false,
        isProtectiveClose: true,
        closedTradeId: closedIds[0] ?? null,
        closedTradeIds: closedIds,
        openedTradeId: null,
        units: 0,
        fillPrice: null,
        retryAttempt: 0,
        confluenceScore: confluenceResult.score,
        confluenceBreakdown: confluenceResult.breakdown,
      }

      await updateSignalStatus(signalId, "executed", {
        executionDetails,
        processedAt: new Date(),
      })

      this.broadcastSignalUpdate(signalId)
      await logAuditEvent(signalId, "executed", {
        type: "protective_close_confluence",
        closedTradeIds: closedIds,
        confluenceScore: confluenceResult.score,
        reason: "Confluence too low to re-enter after reversal close",
        duration_ms: Date.now() - t0,
      })
      await this.emitNotification(
        "Reversal Close (Low Confluence)",
        `${instrument.replace("_", "/")} — closed ${closedIds.length} position(s). Score ${confluenceResult.score.toFixed(1)} below minimum — did not re-enter.`,
      )
      return
    }

    // Step 2: Open new trade with retries
    if (units <= 0) {
      await logAuditEvent(signalId, "failed", {
        type: "reversal",
        step: "calculate_units",
        error: `Calculated units is zero — ${sizing.slSource === "no_atr_data" ? "could not determine ATR for risk calculation" : "account balance too low for risk parameters"}`,
        riskPercent: config.riskPercent,
        slDistance: sizing.slDistance,
        slSource: sizing.slSource,
        closedTradeIds: closedIds,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, "Calculated units is zero or negative")
      return
    }

    // Calculate SL/TP using the best available ATR source
    const { stopLoss, takeProfit } = this.calculateSLTPForSignal(
      instrument,
      newDirection as "buy" | "sell",
      confluenceResult?.atr ?? null,
      sizing.atr,
    )

    const oandaDirection = newDirection === "buy" ? "long" : "short"
    const orderRequest: PlaceOrderRequest = {
      instrument,
      direction: oandaDirection as "long" | "short",
      orderType: "MARKET",
      units,
      stopLoss,
      takeProfit,
      placedVia: "ut_bot_alerts",
    }

    let lastErr: Error | null = null
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      try {
        const result = await this.tradeSyncer.placeOrder(orderRequest)

        const executionDetails: TVExecutionDetails = {
          isReversal: true,
          closedTradeId: closedIds[0] ?? null,
          closedTradeIds: closedIds,
          openedTradeId: result.sourceId ?? null,
          units,
          fillPrice: result.fillPrice ?? null,
          retryAttempt: attempt,
          confluenceScore: confluenceResult?.score,
          confluenceBreakdown: confluenceResult?.breakdown,
          stopLossPrice: stopLoss ?? undefined,
          takeProfitPrice: takeProfit ?? undefined,
          sizeMultiplier: sizeMultiplier !== 1.0 ? sizeMultiplier : undefined,
        }

        if (result.sourceId) {
          this.alertsState.addAutoTradeId(result.sourceId)
          // Start post-entry management — use fillPrice, fallback to estimated entry
          const mgmtEntry =
            result.fillPrice ??
            this.getEstimatedEntry(instrument, newDirection as "buy" | "sell") ??
            0
          if (mgmtEntry > 0) {
            this.tradeManager?.onOrderFilled(
              result.sourceId,
              instrument,
              oandaDirection as "long" | "short",
              mgmtEntry,
              units,
              stopLoss,
              takeProfit,
              sizing.atr,
            )
          }
        }

        await updateSignalStatus(signalId, "executed", {
          resultTradeId: result.sourceId ?? null,
          executionDetails,
          processedAt: new Date(),
        })

        this.broadcastSignalUpdate(signalId)
        await logAuditEvent(signalId, "executed", {
          type: "reversal",
          closedTradeIds: closedIds,
          closedCount: closedIds.length,
          openedTradeId: result.sourceId ?? null,
          fillPrice: result.fillPrice ?? null,
          units,
          stopLoss,
          takeProfit,
          retryAttempt: attempt,
          confluenceScore: confluenceResult?.score ?? null,
          duration_ms: Date.now() - t0,
        })
        await this.emitNotification(
          "Signal Executed (Reversal)",
          `${instrument.replace("_", "/")} ${newDirection.toUpperCase()} — closed ${closedIds.length} position(s), opened new @ ${result.fillPrice ?? "market"}${confluenceResult ? ` (score: ${confluenceResult.score.toFixed(1)})` : ""}`,
        )
        return
      } catch (err) {
        lastErr = err as Error
        if (attempt < RETRY_DELAYS.length - 1) {
          await sleep(RETRY_DELAYS[attempt]!)
        }
      }
    }

    // All retries failed
    await logAuditEvent(signalId, "failed", {
      type: "reversal",
      step: "open_new",
      error: lastErr?.message,
      retryAttempts: RETRY_DELAYS.length,
      closedTradeIds: closedIds,
      duration_ms: Date.now() - t0,
    })
    await this.failSignal(
      signalId,
      `Reversal: closed ${closedIds.length} position(s) but failed to open new after ${RETRY_DELAYS.length} attempts: ${lastErr?.message}`,
    )
    await this.emitNotification(
      "Signal Failed (Reversal)",
      `${instrument.replace("_", "/")} — closed ${closedIds.length} position(s) but FAILED to open new ${newDirection} position. Manual intervention may be needed.`,
      "critical",
    )
  }

  private async executeNewEntry(
    signalId: string,
    direction: string,
    instrument: string,
    config: TVAlertsConfig,
    t0: number,
    confluenceResult: ConfluenceResult | null,
  ): Promise<void> {
    await updateSignalStatus(signalId, "executing")

    // Risk-based position sizing with ATR fallback
    const sizing = await this.calculateRiskBasedUnits(
      config,
      instrument,
      direction as "buy" | "sell",
      confluenceResult?.atr ?? null,
    )
    let units = sizing.units
    let sizeMultiplier = 1.0
    const qc = this.qualityConfig
    if (qc?.enabled && confluenceResult && qc.dynamicSizing) {
      sizeMultiplier = this.confluenceEngine.getSizeMultiplier(confluenceResult.score, qc)
      units = Math.floor(units * sizeMultiplier)
    }

    await logAuditEvent(signalId, "executing", {
      type: "new_entry",
      direction,
      instrument,
      units,
      sizeMultiplier,
      riskPercent: config.riskPercent,
      slDistance: sizing.slDistance,
      slSource: sizing.slSource,
      confluenceScore: confluenceResult?.score ?? null,
      duration_ms: Date.now() - t0,
    })

    if (units <= 0) {
      await logAuditEvent(signalId, "failed", {
        type: "new_entry",
        error: `Calculated units is zero — ${sizing.slSource === "no_atr_data" ? "could not determine ATR for risk calculation" : "account balance too low for risk parameters"}`,
        riskPercent: config.riskPercent,
        slDistance: sizing.slDistance,
        slSource: sizing.slSource,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, "Calculated units is zero or negative")
      return
    }

    // Enforce minimum units floor
    if (units < config.minUnits) {
      await logAuditEvent(signalId, "failed", {
        type: "new_entry",
        step: "min_units_check",
        error: `Calculated ${units} units < minimum ${config.minUnits}`,
        riskPercent: config.riskPercent,
        slDistance: sizing.slDistance,
        slSource: sizing.slSource,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(
        signalId,
        `Position size ${units} below minimum ${config.minUnits} units`,
      )
      return
    }

    // Calculate SL/TP from confluence ATR data if quality engine is enabled
    // Calculate SL/TP using the best available ATR source
    const { stopLoss, takeProfit } = this.calculateSLTPForSignal(
      instrument,
      direction as "buy" | "sell",
      confluenceResult?.atr ?? null,
      sizing.atr,
    )

    // Reject if autoSL is enabled but SL couldn't be calculated
    if (qc?.autoSL && !stopLoss) {
      await logAuditEvent(signalId, "failed", {
        type: "new_entry",
        step: "sl_calculation",
        error: "autoSL enabled but stop loss could not be calculated",
        atrSource: sizing.slSource,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(
        signalId,
        "Stop loss calculation failed — refusing to place unprotected trade",
      )
      return
    }

    const oandaDirection = direction === "buy" ? "long" : "short"
    const orderRequest: PlaceOrderRequest = {
      instrument,
      direction: oandaDirection as "long" | "short",
      orderType: "MARKET",
      units,
      stopLoss,
      takeProfit,
      placedVia: "ut_bot_alerts",
    }

    try {
      const result = await this.tradeSyncer.placeOrder(orderRequest)
      if (result.sourceId) {
        this.alertsState.addAutoTradeId(result.sourceId)
        // Start post-entry management — use fillPrice, fallback to estimated entry
        const mgmtEntry =
          result.fillPrice ?? this.getEstimatedEntry(instrument, direction as "buy" | "sell") ?? 0
        if (mgmtEntry > 0) {
          this.tradeManager?.onOrderFilled(
            result.sourceId,
            instrument,
            oandaDirection as "long" | "short",
            mgmtEntry,
            units,
            stopLoss,
            takeProfit,
            sizing.atr,
          )
        }
      }

      const executionDetails: TVExecutionDetails = {
        isReversal: false,
        closedTradeId: null,
        openedTradeId: result.sourceId ?? null,
        units,
        fillPrice: result.fillPrice ?? null,
        retryAttempt: 0,
        confluenceScore: confluenceResult?.score,
        confluenceBreakdown: confluenceResult?.breakdown,
        stopLossPrice: stopLoss ?? undefined,
        takeProfitPrice: takeProfit ?? undefined,
        sizeMultiplier: sizeMultiplier !== 1.0 ? sizeMultiplier : undefined,
      }

      await updateSignalStatus(signalId, "executed", {
        resultTradeId: result.sourceId ?? null,
        executionDetails,
        processedAt: new Date(),
      })

      this.broadcastSignalUpdate(signalId)
      await logAuditEvent(signalId, "executed", {
        type: "new_entry",
        openedTradeId: result.sourceId ?? null,
        fillPrice: result.fillPrice ?? null,
        units,
        stopLoss,
        takeProfit,
        sizeMultiplier,
        confluenceScore: confluenceResult?.score ?? null,
        duration_ms: Date.now() - t0,
      })
      await this.emitNotification(
        "Signal Executed",
        `${instrument.replace("_", "/")} ${direction.toUpperCase()} — ${units} units @ ${result.fillPrice ?? "market"}${confluenceResult ? ` (score: ${confluenceResult.score.toFixed(1)})` : ""}`,
      )
    } catch (err) {
      await logAuditEvent(signalId, "failed", {
        type: "new_entry",
        error: (err as Error).message,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, (err as Error).message)
      await this.emitNotification(
        "Signal Failed",
        `${instrument.replace("_", "/")} ${direction.toUpperCase()} — ${(err as Error).message}`,
        "warning",
      )
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Calculate SL/TP for a signal using the best available ATR source.
   * Works whether the confluence quality engine is enabled or not.
   *
   * ATR priority: confluenceATR (from quality engine) → sizingATR (from fallback H1 fetch).
   * Uses quality config multipliers when available, otherwise fallback config values.
   */
  private calculateSLTPForSignal(
    instrument: string,
    direction: "buy" | "sell",
    confluenceATR: number | null,
    sizingATR: number,
  ): { stopLoss: number | null; takeProfit: number | null } {
    const qc = this.qualityConfig
    const config = this.config

    // Determine if auto SL/TP should be applied
    const shouldAutoSL = qc?.autoSL ?? true // default to true for safety
    const shouldAutoTP = qc?.autoTP ?? true

    if (!shouldAutoSL && !shouldAutoTP) {
      return { stopLoss: null, takeProfit: null }
    }

    // Pick the best ATR source
    const atr = (confluenceATR && confluenceATR > 0 ? confluenceATR : sizingATR) || 0
    if (atr <= 0) return { stopLoss: null, takeProfit: null }

    const estimatedEntry = this.getEstimatedEntry(instrument, direction)
    if (!estimatedEntry) return { stopLoss: null, takeProfit: null }

    const slMultiplier = qc?.slAtrMultiplier ?? config?.fallbackAtrMultiplier ?? 1.5
    const rrRatio = qc?.tpRiskRewardRatio ?? 2.0

    let stopLoss: number | null = null
    let takeProfit: number | null = null

    if (shouldAutoSL) {
      stopLoss = calculateATRStopLoss(estimatedEntry, atr, direction, slMultiplier)
    }

    if (shouldAutoTP && stopLoss !== null) {
      takeProfit = calculateRRTakeProfit(estimatedEntry, stopLoss, rrRatio, direction)
    }

    return { stopLoss, takeProfit }
  }

  /**
   * Risk-based position sizing.
   *
   * Formula: units = riskAmount / (slDistance × pipValuePerUnit)
   *
   * SL source priority:
   *   1. Confluence ATR × quality config slAtrMultiplier (when quality engine enabled)
   *   2. ATR(14) × fallbackAtrMultiplier fallback (fetched from OANDA H1 candles)
   *   3. Returns 0 if no SL can be determined (trade will be skipped)
   *
   * @returns { units, slDistance, slSource, atr } — units may be 0 if sizing fails.
   *   `atr` is the raw ATR value (before multiplier) for SL/TP calculation.
   */
  private async calculateRiskBasedUnits(
    config: TVAlertsConfig,
    instrument: string,
    direction: "buy" | "sell",
    confluenceATR: number | null,
  ): Promise<{ units: number; slDistance: number; slSource: string; atr: number }> {
    const overview = this.stateManager.getAccountOverview()
    if (!overview) return { units: 0, slDistance: 0, slSource: "no_account", atr: 0 }

    const balance = overview.summary.balance
    if (balance <= 0) return { units: 0, slDistance: 0, slSource: "zero_balance", atr: 0 }

    // Determine SL distance (in price, not pips) and raw ATR
    let slDistance = 0
    let slSource = "none"
    let rawATR = 0

    if (confluenceATR && confluenceATR > 0) {
      const multiplier = this.qualityConfig?.slAtrMultiplier ?? config.fallbackAtrMultiplier
      slDistance = confluenceATR * multiplier
      rawATR = confluenceATR
      slSource = "confluence_atr"
    } else {
      const fallbackATR = await this.fetchATRFallback(instrument)
      if (fallbackATR > 0) {
        slDistance = fallbackATR * config.fallbackAtrMultiplier
        rawATR = fallbackATR
        slSource = "fallback_atr"
      }
    }

    if (slDistance <= 0) return { units: 0, slDistance: 0, slSource: "no_atr_data", atr: 0 }

    // Risk-based formula (matches AI Trader / Trade Finder pattern)
    const pipSize = getPipSize(instrument)
    const riskAmount = balance * (config.riskPercent / 100)
    const [, quoteCcy] = instrument.split("_")
    const isUsdQuote = quoteCcy === "USD"

    // For non-USD-quoted pairs, we MUST have a live price for accurate pip value.
    // Without it, pip value calculation can be off by 100x+ (e.g. USD/JPY at 159 vs default 1).
    const estimatedEntry = this.getEstimatedEntry(instrument, direction)
    if (!isUsdQuote && !estimatedEntry) {
      console.warn(
        `[tv-alerts] No live price available for ${instrument} — cannot calculate accurate position size`,
      )
      return { units: 0, slDistance, slSource: `${slSource}_no_price`, atr: rawATR }
    }

    const pipValuePerUnit = isUsdQuote ? pipSize : pipSize / Math.max(estimatedEntry ?? 1, 0.0001)
    const riskPips = slDistance / pipSize

    if (riskPips <= 0 || pipValuePerUnit <= 0) {
      return { units: 0, slDistance, slSource, atr: rawATR }
    }

    const units = Math.floor(riskAmount / (riskPips * pipValuePerUnit))
    return { units, slDistance, slSource, atr: rawATR }
  }

  /** Fetch ATR(14) from H1 candles as fallback when confluence is not enabled. */
  private async fetchATRFallback(instrument: string): Promise<number> {
    const creds = this.stateManager.getCredentials()
    if (!creds) return 0

    try {
      const apiUrl = getRestUrl(creds.mode)
      const candles = await fetchOandaCandles(
        instrument,
        "H1",
        30, // 30 H1 candles for ATR(14) calculation
        apiUrl,
        creds.token,
        this.candleCache,
      )
      if (candles.length < 14) return 0

      const atrSeries = computeATR(candles, 14)
      return atrSeries.length > 0 ? atrSeries[atrSeries.length - 1]! : 0
    } catch (err) {
      console.warn(`[tv-alerts] ATR fallback fetch failed for ${instrument}:`, err)
      return 0
    }
  }

  /**
   * Get an estimated entry price for SL/TP pre-calculation and pip value conversion.
   * Priority: live bid/ask from PositionPriceTracker → existing position price → null.
   */
  private getEstimatedEntry(instrument: string, direction: "buy" | "sell"): number | null {
    // 1. Best source: live price from the position price tracker
    if (this.priceTracker) {
      const tick = this.priceTracker.getLatestPrice(instrument)
      if (tick) {
        // Buy orders fill at ask, sell orders fill at bid
        return direction === "buy" ? tick.ask : tick.bid
      }
    }

    // 2. Fallback: existing open position on this instrument
    const positions = this.positionManager.getPositions()
    const existing = positions.open.find((t) => t.instrument === instrument)
    if (existing?.currentPrice) return existing.currentPrice

    return null
  }

  private async rejectSignal(signalId: string, reason: TVAlertRejectionReason): Promise<void> {
    const status: TVAlertStatus = reason === "same_direction_exists" ? "skipped" : "rejected"
    await updateSignalStatus(signalId, status, {
      rejectionReason: reason,
      processedAt: new Date(),
    })
    this.broadcastSignalUpdate(signalId)
    console.log(`[signal-processor] Signal ${signalId} ${status}: ${reason}`)
  }

  private async failSignal(signalId: string, message: string): Promise<void> {
    await updateSignalStatus(signalId, "failed", {
      rejectionReason: "execution_failed",
      processedAt: new Date(),
    })
    this.broadcastSignalUpdate(signalId)
    console.error(`[signal-processor] Signal ${signalId} failed: ${message}`)
  }

  private broadcastSignalUpdate(signalId: string): void {
    // Broadcast a lightweight notification that a signal was processed
    // The web app will fetch the full signal data via API if needed
    this.broadcast({
      type: "tv_alert_signal",
      timestamp: new Date().toISOString(),
      data: { signalId } as unknown as TVAlertSignal,
    })
  }

  private async emitNotification(
    title: string,
    message: string,
    severity: "info" | "warning" | "critical" = "info",
  ): Promise<void> {
    try {
      await this.notificationEmitter.emitTVAlert(title, message, severity)
    } catch (err) {
      console.error("[signal-processor] Notification emit error:", err)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
