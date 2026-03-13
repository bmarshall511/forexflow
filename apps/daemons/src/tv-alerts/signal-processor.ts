import type {
  TVWebhookPayload,
  TVAlertStatus,
  TVAlertRejectionReason,
  TVAlertsConfig,
  TVAlertSignal,
  TVExecutionDetails,
  AnyDaemonMessage,
  PlaceOrderRequest,
} from "@fxflow/types"
import { isMarketExpectedOpen } from "@fxflow/shared"
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
  logAuditEvent,
  cleanupOldAuditEvents,
  getOpenTradeIdsByPlacedVia,
} from "@fxflow/db"
import type { StateManager } from "../state-manager.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import type { TVAlertsState } from "./alerts-state.js"

const RETRY_DELAYS = [1000, 2000, 4000] // ms

/**
 * Central signal processing engine for TV Alerts.
 * Processes signals through a sequential validation pipeline, then executes trades.
 * Per-instrument mutex prevents concurrent execution on the same pair.
 */
export class SignalProcessor {
  private config: TVAlertsConfig | null = null
  private instrumentMutex = new Map<string, Promise<void>>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private selfHealTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private stateManager: StateManager,
    private positionManager: PositionManager,
    private tradeSyncer: OandaTradeSyncer,
    private notificationEmitter: NotificationEmitter,
    private broadcast: (msg: AnyDaemonMessage) => void,
    private alertsState: TVAlertsState,
  ) {}

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
    this.cleanupTimer = setInterval(() => {
      void cleanupOldSignals(30).catch((err) => {
        console.error("[signal-processor] Cleanup error:", err)
      })
      void cleanupOldAuditEvents(30).catch((err) => {
        console.error("[signal-processor] Audit cleanup error:", err)
      })
    }, 24 * 60 * 60 * 1000)

    // Initial cleanup + sync closed signal results for P&L tracking
    void cleanupOldSignals(30).catch(() => {})
    void cleanupOldAuditEvents(30).catch(() => {})
    void syncClosedSignalResults().catch(() => {})

    // Periodically sync closed signal results (catches SL/TP hits between signals)
    this.syncTimer = setInterval(() => {
      void syncClosedSignalResults()
        .then((count) => {
          if (count > 0) {
            // Update daily P&L after syncing new results
            void getTodayAutoTradePL().then((pl) => this.alertsState.updateDailyPL(pl))
          }
        })
        .catch(() => {})
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
    this.alertsState.loadFromConfig(this.config)
  }

  /**
   * Process an incoming signal. Acquires per-instrument mutex to prevent
   * concurrent execution on the same pair.
   */
  async processSignal(payload: TVWebhookPayload, instrument: string): Promise<void> {
    // Serialize per instrument
    const prev = this.instrumentMutex.get(instrument) ?? Promise.resolve()
    const current = prev.then(() => this.processSignalInner(payload, instrument)).catch((err) => {
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
        console.log(`[signal-processor] Signal ${dup.id} rejected: duplicate_signal (within ${config.dedupWindowSeconds}s of ${recent.id})`)
        return
      }
    }

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
      positionSizePercent: config.positionSizePercent,
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

    const currentStatus = this.alertsState.getStatus()
    await logAuditEvent(signal.id, "validated", {
      result: "passed",
      isReversal,
      tradeIdsToClose: isReversal ? tradeIdsToClose : [],
      activeAutoPositions: currentStatus.activeAutoPositions,
      dailyPL: currentStatus.todayAutoPL,
      duration_ms: Date.now() - t0,
    })

    // Execute: reversal, same-direction skip, or new entry
    if (isReversal) {
      await this.executeReversal(signal.id, tradeIdsToClose, direction, instrument, config, t0)
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
      await this.executeNewEntry(signal.id, direction, instrument, config, t0)
    }

    await this.postExecution(instrument, config, signal.id, t0)
  }

  /** Shared post-execution housekeeping: sync P&L, update position count, start cooldown. */
  private async postExecution(instrument: string, config: TVAlertsConfig, signalId?: string, t0?: number): Promise<void> {
    await syncClosedSignalResults().catch(() => {})

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
      const autoTrades = this.positionManager.getPositions().open.filter(
        (t) => this.alertsState.isAutoTrade(t.sourceTradeId),
      )
      if (autoTrades.length >= config.maxOpenPositions) return "max_positions_reached"
    }

    // 6. Circuit breaker / daily loss limit
    // (Reversal + circuit breaker is handled before validate() via executeProtectiveClose)
    if (this.alertsState.isCircuitBreakerTripped()) return "daily_loss_limit"

    // 7. Pair whitelist check
    const whitelist: string[] = typeof config.pairWhitelist === "string"
      ? JSON.parse(config.pairWhitelist || "[]")
      : config.pairWhitelist
    if (whitelist.length > 0 && !whitelist.includes(instrument)) return "pair_not_whitelisted"

    // 8. Manual position conflict (any non-auto trade on this instrument)
    // Bypassed for reversals: reversals close ALL positions on the pair (auto + manual)
    // then open a new auto-trade position.
    if (!isReversal) {
      const manualPosition = this.positionManager.getPositions().open.find(
        (t) => t.instrument === instrument && !this.alertsState.isAutoTrade(t.sourceTradeId),
      )
      if (manualPosition) return "manual_position_conflict"
    }

    // 9. OANDA connectivity
    const oanda = this.stateManager.getOanda()
    if (!oanda.apiReachable) return "execution_failed"

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
        await this.tradeSyncer.closeTrade(tradeId, undefined, "REVERSAL")
        this.alertsState.removeAutoTradeId(tradeId)
        closedIds.push(tradeId)
      } catch (err) {
        failedIds.push(tradeId)
        console.error(`[signal-processor] Protective close failed for ${tradeId}:`, (err as Error).message)
      }
    }

    if (closedIds.length === 0) {
      await logAuditEvent(signalId, "failed", {
        type: "protective_close",
        error: "All close attempts failed",
        failedTradeIds: failedIds,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, `Protective close failed for all ${failedIds.length} position(s)`)
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
  ): Promise<void> {
    await updateSignalStatus(signalId, "executing")

    const units = this.calculateUnits(config)
    await logAuditEvent(signalId, "executing", {
      type: "reversal",
      direction: newDirection,
      instrument,
      closingTradeIds: existingTradeIds,
      closingCount: existingTradeIds.length,
      units,
      positionSizePercent: config.positionSizePercent,
      duration_ms: Date.now() - t0,
    })

    // Step 1: Close ALL existing positions on this instrument
    const closedIds: string[] = []
    for (const tradeId of existingTradeIds) {
      try {
        await this.tradeSyncer.closeTrade(tradeId, undefined, "REVERSAL")
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
        // If we failed to close a position, abort — don't open a new one
        await this.failSignal(
          signalId,
          `Failed to close trade ${tradeId}: ${(err as Error).message} (closed ${closedIds.length}/${existingTradeIds.length})`,
        )
        return
      }
    }

    // Step 2: Open new trade with retries
    if (units <= 0) {
      await logAuditEvent(signalId, "failed", {
        type: "reversal",
        step: "calculate_units",
        error: "Calculated units is zero or negative",
        closedTradeIds: closedIds,
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, "Calculated units is zero or negative")
      return
    }

    const oandaDirection = newDirection === "buy" ? "long" : "short"
    const orderRequest: PlaceOrderRequest = {
      instrument,
      direction: oandaDirection as "long" | "short",
      orderType: "MARKET",
      units,
      stopLoss: null,
      takeProfit: null,
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
        }

        if (result.sourceId) this.alertsState.addAutoTradeId(result.sourceId)

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
          retryAttempt: attempt,
          duration_ms: Date.now() - t0,
        })
        await this.emitNotification(
          "Signal Executed (Reversal)",
          `${instrument.replace("_", "/")} ${newDirection.toUpperCase()} — closed ${closedIds.length} position(s), opened new @ ${result.fillPrice ?? "market"}`,
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
  ): Promise<void> {
    await updateSignalStatus(signalId, "executing")

    const units = this.calculateUnits(config)
    await logAuditEvent(signalId, "executing", {
      type: "new_entry",
      direction,
      instrument,
      units,
      positionSizePercent: config.positionSizePercent,
      duration_ms: Date.now() - t0,
    })

    if (units <= 0) {
      await logAuditEvent(signalId, "failed", {
        type: "new_entry",
        error: "Calculated units is zero or negative",
        duration_ms: Date.now() - t0,
      })
      await this.failSignal(signalId, "Calculated units is zero or negative")
      return
    }

    const oandaDirection = direction === "buy" ? "long" : "short"
    const orderRequest: PlaceOrderRequest = {
      instrument,
      direction: oandaDirection as "long" | "short",
      orderType: "MARKET",
      units,
      stopLoss: null,
      takeProfit: null,
      placedVia: "ut_bot_alerts",
    }

    try {
      const result = await this.tradeSyncer.placeOrder(orderRequest)
      if (result.sourceId) this.alertsState.addAutoTradeId(result.sourceId)

      const executionDetails: TVExecutionDetails = {
        isReversal: false,
        closedTradeId: null,
        openedTradeId: result.sourceId ?? null,
        units,
        fillPrice: result.fillPrice ?? null,
        retryAttempt: 0,
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
        duration_ms: Date.now() - t0,
      })
      await this.emitNotification(
        "Signal Executed",
        `${instrument.replace("_", "/")} ${direction.toUpperCase()} — ${units} units @ ${result.fillPrice ?? "market"}`,
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

  private calculateUnits(config: TVAlertsConfig): number {
    const overview = this.stateManager.getAccountOverview()
    if (!overview) return 0
    const balance = overview.summary.balance
    return Math.floor(balance * (config.positionSizePercent / 100))
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
