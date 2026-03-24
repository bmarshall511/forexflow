import type {
  SmartFlowScanProgress,
  SmartFlowScanLogEntry,
  SmartFlowSettingsData,
  SmartFlowPreset,
  AnyDaemonMessage,
} from "@fxflow/types"
import { SMART_FLOW_DEFAULT_PAIRS, SMART_FLOW_DEFAULT_SCAN_MODES } from "@fxflow/types"
import { isMarketExpectedOpen, detectRegime, computeRSI, getPipSize } from "@fxflow/shared"
import {
  getSmartFlowSettings,
  createSmartFlowConfig,
  createSmartFlowOpportunity,
  countTodaySmartFlowOpportunities,
  updateSmartFlowOpportunityStatus,
} from "@fxflow/db"
import { CandleCache, fetchOandaCandles } from "../trade-finder/candle-cache.js"
import { analyzeAllModes } from "./scan-modes.js"
import { runAllFilters } from "./entry-filters.js"
import { SmartFlowScannerCircuitBreaker } from "./scanner-circuit-breaker.js"
import { applyPresetToConfig } from "./preset-defaults.js"
import { emitActivity } from "./activity-feed.js"

const LOG = "[smart-flow-scanner]"

// Regime-to-preset mapping
const REGIME_PRESET_MAP: Record<string, SmartFlowPreset> = {
  trending: "trend_rider",
  ranging: "momentum_catch",
  volatile: "steady_growth",
  low_volatility: "momentum_catch",
}

// Timeframes for primary / secondary / HTF analysis
const SCAN_TIMEFRAMES = {
  primary: "H1" as const,
  secondary: "H4" as const,
  htf: "D" as const,
}
const CANDLE_COUNTS = { primary: 200, secondary: 100, htf: 50 }

export class SmartFlowMarketScanner {
  private readonly broadcast: (msg: AnyDaemonMessage) => void
  private readonly cache = new CandleCache()
  private readonly circuitBreaker = new SmartFlowScannerCircuitBreaker()
  private readonly scanLog: SmartFlowScanLogEntry[] = []
  private readonly maxScanLog = 100

  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private scanning = false
  private enabled = false
  private scanCount = 0
  private lastScanAt: string | null = null
  private nextScanAt: string | null = null
  private progress: SmartFlowScanProgress = {
    phase: "idle",
    message: "Scanner not started",
    pairsTotal: 0,
    pairsScanned: 0,
    opportunitiesFound: 0,
    opportunitiesPlaced: 0,
    scanMode: null,
    elapsedMs: 0,
    lastScanAt: null,
    nextScanAt: null,
  }

  // Late-bound dependencies
  private apiUrl = ""
  private token = ""
  private getBalance: (() => number) | null = null
  private getRiskPercent: (() => number) | null = null
  private getOpenPositions: (() => { instrument: string; direction: string }[]) | null = null
  private getOpenTradeCount: (() => number) | null = null
  private getSpreadForInstrument: ((instrument: string) => number | null) | null = null
  private onOpportunityApproved: ((configId: string) => Promise<void>) | null = null

  constructor(broadcast: (msg: AnyDaemonMessage) => void) {
    this.broadcast = broadcast
  }

  // ─── Late Binding ─────────────────────────────────────────────────────

  setOandaCredentials(apiUrl: string, token: string): void {
    this.apiUrl = apiUrl
    this.token = token
  }

  setBalanceFn(fn: () => number): void {
    this.getBalance = fn
  }
  setRiskPercentFn(fn: () => number): void {
    this.getRiskPercent = fn
  }
  setOpenPositionsFn(fn: () => { instrument: string; direction: string }[]): void {
    this.getOpenPositions = fn
  }
  setOpenTradeCountFn(fn: () => number): void {
    this.getOpenTradeCount = fn
  }
  setSpreadFn(fn: (instrument: string) => number | null): void {
    this.getSpreadForInstrument = fn
  }
  setOnOpportunityApproved(fn: (configId: string) => Promise<void>): void {
    this.onOpportunityApproved = fn
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  async start(): Promise<void> {
    const settings = await getSmartFlowSettings()
    this.enabled = settings.scannerEnabled

    this.circuitBreaker.updateThresholds({
      maxConsecLosses: settings.circuitBreakerConsecLosses,
      consecPauseMinutes: settings.circuitBreakerConsecPause,
      maxDailyLosses: settings.circuitBreakerDailyLosses,
      maxDailyDD: settings.circuitBreakerDailyDD,
    })

    if (this.getBalance) {
      this.circuitBreaker.setStartingBalance(this.getBalance())
    }

    if (!this.enabled) {
      console.log(LOG, "Scanner disabled — skipping startup")
      return
    }

    console.log(LOG, "Scanner started")
    emitActivity("engine_started", "SmartFlow scanner started — scanning for opportunities")
    this.scheduleScan(10_000) // First scan after 10s delay
  }

  stop(): void {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
    this.enabled = false
    this.updateProgress("idle", "Scanner stopped")
  }

  /** Trigger a manual scan (from REST endpoint). */
  async triggerManualScan(): Promise<void> {
    if (this.scanning) return
    await this.runScan()
  }

  /** Record a trade outcome for circuit breaker. */
  recordTradeOutcome(pl: number): void {
    this.circuitBreaker.recordOutcome(pl)
  }

  /** Reload settings (on config change). */
  async reloadSettings(): Promise<void> {
    const settings = await getSmartFlowSettings()
    this.enabled = settings.scannerEnabled
    this.circuitBreaker.updateThresholds({
      maxConsecLosses: settings.circuitBreakerConsecLosses,
      consecPauseMinutes: settings.circuitBreakerConsecPause,
      maxDailyLosses: settings.circuitBreakerDailyLosses,
      maxDailyDD: settings.circuitBreakerDailyDD,
    })
    if (!this.enabled && this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
      this.updateProgress("idle", "Scanner disabled")
    } else if (this.enabled && !this.scanTimer && !this.scanning) {
      this.scheduleScan(5_000)
    }
  }

  // ─── Getters ──────────────────────────────────────────────────────────

  getProgress(): SmartFlowScanProgress {
    return { ...this.progress }
  }
  getScanLog(): SmartFlowScanLogEntry[] {
    return [...this.scanLog]
  }
  getCircuitBreakerState() {
    return this.circuitBreaker.getState()
  }
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }

  // ─── Scan Loop ────────────────────────────────────────────────────────

  private scheduleScan(delayMs: number): void {
    if (this.scanTimer) clearTimeout(this.scanTimer)
    this.nextScanAt = new Date(Date.now() + delayMs).toISOString()
    this.scanTimer = setTimeout(() => void this.runScan(), delayMs)
  }

  private async runScan(): Promise<void> {
    if (this.scanning) return
    this.scanning = true
    const startTime = Date.now()

    try {
      const settings = await getSmartFlowSettings()
      if (!settings.scannerEnabled) {
        this.enabled = false
        this.updateProgress("idle", "Scanner disabled")
        return
      }

      // Shadow mode check
      const isShadow = settings.shadowMode

      // Market check
      if (!isMarketExpectedOpen(new Date())) {
        this.updateProgress("idle", "Market closed")
        this.scheduleScan(60_000)
        return
      }

      // Circuit breaker check
      const cbCheck = this.circuitBreaker.isAllowed()
      if (!cbCheck.allowed) {
        this.updateProgress("idle", `Paused: ${cbCheck.reason}`)
        this.scheduleScan(60_000)
        return
      }

      // Daily scan cap
      this.scanCount++
      if (this.scanCount > settings.maxDailyScans) {
        this.updateProgress("idle", "Daily scan limit reached")
        this.scheduleScan(300_000) // Check again in 5 min in case day rolls over
        return
      }

      // Determine pairs to scan
      const pairs =
        settings.pairWhitelist.length > 0 ? settings.pairWhitelist : SMART_FLOW_DEFAULT_PAIRS

      // Determine enabled scan modes
      const enabledModes = { ...SMART_FLOW_DEFAULT_SCAN_MODES, ...settings.scanModes }

      this.updateProgress("scanning", `Scanning ${pairs.length} pairs...`, {
        pairsTotal: pairs.length,
      })
      this.addScanLog("scan_start", `Scan #${this.scanCount} started — ${pairs.length} pairs`)

      const allSignals: Array<{
        signal: ReturnType<typeof analyzeAllModes>[number]
        regime: string | null
        rsi: number | null
      }> = []

      // Scan each pair
      for (let i = 0; i < pairs.length; i++) {
        const instrument = pairs[i]!
        this.updateProgress("scanning", `Scanning ${instrument.replace("_", "/")}...`, {
          pairsScanned: i + 1,
        })

        try {
          // Fetch candles for all 3 timeframes
          const [primary, secondary, htf] = await Promise.all([
            fetchOandaCandles(
              instrument,
              SCAN_TIMEFRAMES.primary,
              CANDLE_COUNTS.primary,
              this.apiUrl,
              this.token,
              this.cache,
            ),
            fetchOandaCandles(
              instrument,
              SCAN_TIMEFRAMES.secondary,
              CANDLE_COUNTS.secondary,
              this.apiUrl,
              this.token,
              this.cache,
            ),
            fetchOandaCandles(
              instrument,
              SCAN_TIMEFRAMES.htf,
              CANDLE_COUNTS.htf,
              this.apiUrl,
              this.token,
              this.cache,
            ),
          ])

          if (primary.length < 30 || secondary.length < 30) continue

          // Detect regime for entry filter
          // ZoneCandle lacks volume — map to Candle with volume: 0 for indicator functions
          const primaryCandles = primary.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: 0,
          }))
          const regime = primaryCandles.length >= 50 ? detectRegime(primaryCandles).regime : null
          const rsi = computeRSI(primaryCandles) ?? null

          // Run all enabled scan modes
          const signals = analyzeAllModes(instrument, primary, secondary, htf, enabledModes)

          for (const signal of signals) {
            allSignals.push({ signal, regime, rsi })
          }
        } catch (err) {
          console.warn(LOG, `Error scanning ${instrument}:`, (err as Error).message)
        }
      }

      // Sort by score descending, take top 10
      allSignals.sort((a, b) => b.signal.score - a.signal.score)
      const candidates = allSignals.slice(0, 10)

      this.updateProgress("analyzing", `Found ${candidates.length} candidates — filtering...`, {
        opportunitiesFound: candidates.length,
      })

      // Run filters and process each candidate
      const openPositions = this.getOpenPositions?.() ?? []
      const openCount = this.getOpenTradeCount?.() ?? 0
      let todayCount = await countTodaySmartFlowOpportunities()
      let placedCount = 0

      for (const { signal, regime, rsi } of candidates) {
        // Get live spread
        const spreadPips = this.getSpreadForInstrument
          ? (this.getSpreadForInstrument(signal.instrument) ??
            (getPipSize(signal.instrument) * 2) / getPipSize(signal.instrument))
          : 2

        const { allPassed, results } = await runAllFilters(
          signal.instrument,
          signal.direction,
          signal.scanMode,
          regime,
          rsi,
          spreadPips,
          signal.riskPips,
          settings,
          openPositions,
          todayCount,
          openCount + placedCount,
        )

        // Create opportunity record (always, even if filtered)
        const opportunity = await createSmartFlowOpportunity({
          instrument: signal.instrument,
          direction: signal.direction,
          scanMode: signal.scanMode,
          score: signal.score,
          scores: signal.scores,
          regime,
          session: signal.session,
          preset: this.selectPreset(settings, regime),
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          riskPips: signal.riskPips,
          rewardPips: signal.rewardPips,
          riskRewardRatio: signal.riskRewardRatio,
          positionSize: this.calculatePositionSize(signal.riskPips, signal.instrument),
          reasons: signal.reasons,
          filterResults: results,
        })

        if (!allPassed) {
          await updateSmartFlowOpportunityStatus(opportunity.id, "filtered")
          const failedFilter = Object.entries(results).find(([, r]) => !r.passed)
          this.addScanLog(
            "opportunity_filtered",
            `${signal.instrument} ${signal.direction} filtered: ${failedFilter?.[1]?.reason ?? "unknown"}`,
            { instrument: signal.instrument, score: signal.score, scanMode: signal.scanMode },
          )
          continue
        }

        // Score threshold for semi-auto
        if (settings.operatingMode === "semi_auto" && signal.score < settings.autoTradeMinScore) {
          await updateSmartFlowOpportunityStatus(opportunity.id, "suggested")
          this.addScanLog(
            "opportunity_found",
            `${signal.instrument} ${signal.direction} suggested (score ${signal.score} < ${settings.autoTradeMinScore})`,
            { instrument: signal.instrument, score: signal.score },
          )

          emitActivity(
            "entry_watching",
            `${isShadow ? "[SIMULATION] " : ""}Scanner found opportunity: ${signal.instrument.replace("_", "/")} ${signal.direction} (score: ${signal.score})`,
            { instrument: signal.instrument, severity: "info" },
          )
          continue
        }

        // Manual mode — suggest only
        if (settings.operatingMode === "manual") {
          await updateSmartFlowOpportunityStatus(opportunity.id, "suggested")
          emitActivity(
            "entry_watching",
            `${isShadow ? "[SIMULATION] " : ""}Scanner suggests: ${signal.instrument.replace("_", "/")} ${signal.direction} (score: ${signal.score})`,
            { instrument: signal.instrument, severity: "info" },
          )
          continue
        }

        // Shadow mode — don't place real trades
        if (isShadow) {
          await updateSmartFlowOpportunityStatus(opportunity.id, "suggested")
          emitActivity(
            "entry_watching",
            `[SIMULATION] Would place: ${signal.instrument.replace("_", "/")} ${signal.direction} (score: ${signal.score}, R:R ${signal.riskRewardRatio.toFixed(1)})`,
            { instrument: signal.instrument, severity: "info", detail: signal.reasons.join("; ") },
          )
          continue
        }

        // Auto-place: create SmartFlowConfig and trigger placement
        try {
          const preset = this.selectPreset(settings, regime)
          const presetConfig = applyPresetToConfig(preset)
          // presetConfig is typed as Partial<SmartFlowConfigData> but never contains
          // id/createdAt/updatedAt — safe to cast for the create input
          const {
            id: _id,
            createdAt: _ca,
            updatedAt: _ua,
            ...presetFields
          } = presetConfig as Record<string, unknown>

          const config = await createSmartFlowConfig({
            instrument: signal.instrument,
            name: `Scanner: ${signal.scanMode.replace("_", " ")} — ${signal.instrument.replace("_", "/")}`,
            direction: signal.direction,
            isActive: true,
            entryMode: settings.scannerEntryMode === "optimal" ? "smart_entry" : "market",
            entryPrice: settings.scannerEntryMode === "optimal" ? signal.entryPrice : null,
            entryExpireHours: settings.scannerEntryMode === "optimal" ? 4 : null,
            positionSizeMode: "risk_percent",
            positionSizeValue: this.getRiskPercent?.() ?? 1.0,
            stopLossPips: signal.riskPips,
            takeProfitPips: signal.rewardPips,
            ...presetFields,
            preset,
          } as Parameters<typeof createSmartFlowConfig>[0])

          await updateSmartFlowOpportunityStatus(opportunity.id, "approved", {
            resultConfigId: config.id,
          })

          // Trigger the manager to place the trade
          if (this.onOpportunityApproved) {
            await this.onOpportunityApproved(config.id)
          }

          await updateSmartFlowOpportunityStatus(opportunity.id, "placed", {
            placedAt: new Date(),
          })

          placedCount++
          todayCount++

          emitActivity(
            "entry_placed",
            `Scanner placed: ${signal.instrument.replace("_", "/")} ${signal.direction} (${signal.scanMode.replace("_", " ")}, score: ${signal.score})`,
            {
              instrument: signal.instrument,
              configId: config.id,
              severity: "success",
              detail: `R:R ${signal.riskRewardRatio.toFixed(1)}:1 — ${signal.reasons.slice(0, 3).join("; ")}`,
            },
          )

          this.addScanLog(
            "opportunity_placed",
            `${signal.instrument} ${signal.direction} placed (${signal.scanMode}, score ${signal.score})`,
            { instrument: signal.instrument, score: signal.score, configId: config.id },
          )
        } catch (err) {
          console.error(LOG, `Failed to place ${signal.instrument}:`, (err as Error).message)
          await updateSmartFlowOpportunityStatus(opportunity.id, "rejected")
          this.addScanLog(
            "error",
            `Failed to place ${signal.instrument}: ${(err as Error).message}`,
          )
        }
      }

      // Complete
      const elapsedMs = Date.now() - startTime
      this.lastScanAt = new Date().toISOString()
      this.updateProgress(
        "complete",
        `Scan complete: ${candidates.length} found, ${placedCount} placed (${elapsedMs}ms)`,
        { opportunitiesPlaced: placedCount, elapsedMs },
      )

      this.addScanLog(
        "scan_complete",
        `Scan #${this.scanCount} complete: ${pairs.length} pairs, ${allSignals.length} signals, ${candidates.length} candidates, ${placedCount} placed`,
        { elapsed: elapsedMs, signals: allSignals.length, placed: placedCount },
      )

      // Schedule next scan
      this.scheduleScan(settings.scanIntervalMinutes * 60_000)
    } catch (err) {
      console.error(LOG, "Scan error:", (err as Error).message)
      this.updateProgress("error", `Scan error: ${(err as Error).message}`)
      this.addScanLog("error", `Scan failed: ${(err as Error).message}`)
      this.scheduleScan(60_000) // Retry in 1 min
    } finally {
      this.scanning = false
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private selectPreset(settings: SmartFlowSettingsData, regime: string | null): SmartFlowPreset {
    if (settings.preferredPreset !== "auto") {
      return settings.preferredPreset as SmartFlowPreset
    }
    if (regime && regime in REGIME_PRESET_MAP) {
      return REGIME_PRESET_MAP[regime]!
    }
    return "steady_growth"
  }

  private calculatePositionSize(riskPips: number, instrument: string): number {
    const balance = this.getBalance?.() ?? 0
    const riskPct = this.getRiskPercent?.() ?? 1.0
    if (balance <= 0 || riskPips <= 0) return 0
    const riskAmount = balance * (riskPct / 100)
    const pipSize = getPipSize(instrument)
    return Math.floor(riskAmount / (riskPips * pipSize))
  }

  private updateProgress(
    phase: SmartFlowScanProgress["phase"],
    message: string,
    extra?: Partial<SmartFlowScanProgress>,
  ): void {
    this.progress = {
      ...this.progress,
      phase,
      message,
      lastScanAt: this.lastScanAt,
      nextScanAt: this.nextScanAt,
      ...extra,
    }
    this.broadcast({
      type: "smart_flow_scan_progress",
      timestamp: new Date().toISOString(),
      data: this.progress,
    } as unknown as AnyDaemonMessage)
  }

  private addScanLog(
    type: SmartFlowScanLogEntry["type"],
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: SmartFlowScanLogEntry = {
      id: `sfl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      metadata,
    }
    this.scanLog.push(entry)
    if (this.scanLog.length > this.maxScanLog) this.scanLog.shift()
  }
}
