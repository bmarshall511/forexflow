import { randomUUID } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import type {
  AiTraderConfigData,
  AiTraderScanStatus,
  AiTraderScanProgressData,
  AiTraderScanLogEntry,
  AiTraderScanPhase,
  AiTraderOpportunityData,
  AiTraderProfile,
  AiTraderMarketRegime,
  AiTraderSession,
  AiTraderTechnique,
  AnyDaemonMessage,
} from "@fxflow/types"
import {
  getAiTraderConfig,
  getDecryptedClaudeKey,
  createOpportunity,
  updateOpportunityStatus,
  expireOldOpportunities,
  cleanupOldOpportunities,
  countOpenAiTrades,
  findOpportunityByResultTradeId,
  getTradeBySourceId,
  getRiskPercent,
} from "@fxflow/db"
import { ALL_FOREX_PAIRS, getPipSize, priceToPips, classifyAiError } from "@fxflow/shared"
import type { StateManager } from "../state-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import { CandleCache, fetchOandaCandles } from "../trade-finder/candle-cache.js"
import { CostTracker } from "./cost-tracker.js"
import { DataAggregator } from "./data-aggregator.js"
import { ExecutionGate } from "./execution-gate.js"
import { PerformanceTracker } from "./performance-tracker.js"
import { TradeManager } from "./trade-manager.js"
import {
  analyzeTier1,
  getProfileConfig,
  type Tier1Signal,
  type Tier1FilterStats,
} from "./strategy-engine.js"
import { buildTier2Prompt, buildTier3Prompt, type Tier3Context } from "./prompt-builder.js"

const MAX_SCAN_LOG_ENTRIES = 100

/**
 * Limit correlated signals: max N positions with the same currency in the same direction.
 * E.g., EUR_USD long + EUR_GBP long = 2 EUR long exposure. Prevents over-concentration.
 */
function filterCorrelatedSignals(signals: Tier1Signal[], maxPerCurrency: number): Tier1Signal[] {
  const exposure = new Map<string, number>() // "EUR_long" → count
  const result: Tier1Signal[] = []

  for (const sig of signals) {
    const [base, quote] = sig.instrument.split("_") as [string, string]
    // Long EUR_USD = long EUR, short USD
    const baseKey = `${base}_${sig.direction}`
    const quoteKey = `${quote}_${sig.direction === "long" ? "short" : "long"}`

    const baseCount = exposure.get(baseKey) ?? 0
    const quoteCount = exposure.get(quoteKey) ?? 0

    if (baseCount >= maxPerCurrency || quoteCount >= maxPerCurrency) continue

    exposure.set(baseKey, baseCount + 1)
    exposure.set(quoteKey, quoteCount + 1)
    result.push(sig)
  }

  return result
}

/** Extract JSON from a model response that may be wrapped in markdown code blocks.
 *  Also handles truncated responses where the closing brace/fence is missing. */
function extractJSON<T>(text: string): T {
  // Try raw parse first
  try {
    return JSON.parse(text)
  } catch {
    // Strip markdown code blocks: ```json ... ``` or ``` ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch?.[1]) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch {
        // Code block content may itself be truncated — fall through to brace matching
      }
    }
    // Try to find first { ... } in the text
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      return JSON.parse(braceMatch[0])
    }
    // Handle truncated responses: find opening { and attempt to close it
    // This handles cases where max_tokens cut off the response mid-JSON
    const openBrace = text.indexOf("{")
    if (openBrace >= 0) {
      let partial = text.slice(openBrace)
      // Strip trailing markdown fence if present but unclosed
      partial = partial.replace(/```\s*$/, "")
      // Try to salvage by truncating the last incomplete string value and closing
      // Common pattern: { "pass": true, "confidence": 62, "reason": "text cut off here
      const lastQuote = partial.lastIndexOf('"')
      if (lastQuote > 0) {
        const truncated = partial.slice(0, lastQuote + 1) + "}"
        try {
          return JSON.parse(truncated)
        } catch {
          // Try closing with extra brackets for nested structures
          try {
            return JSON.parse(truncated + "}")
          } catch {
            // fall through
          }
        }
      }
    }
    throw new Error(`No valid JSON found in response: ${text.slice(0, 200)}`)
  }
}

// ─── AI Trader Scanner ───────────────────────────────────────────────────────

export class AiTraderScanner {
  private stateManager: StateManager
  private tradeSyncer: OandaTradeSyncer
  private positionManager: PositionManager
  private broadcast: (msg: AnyDaemonMessage) => void
  private notificationEmitter: NotificationEmitter | null = null

  private timer: ReturnType<typeof setTimeout> | null = null
  private scanning = false
  private lastScanAt: string | null = null
  private nextScanAt: string | null = null
  private lastError: string | null = null
  private paused = false

  // Cool-down after consecutive losses
  private consecutiveLosses = 0
  private cooldownUntil: number | null = null

  // Scan progress tracking
  private scanProgress: AiTraderScanProgressData | null = null
  private scanLog: AiTraderScanLogEntry[] = []

  // Sub-modules
  private candleCache = new CandleCache()
  private costTracker = new CostTracker()
  private dataAggregator = new DataAggregator()
  private executionGate: ExecutionGate
  private performanceTracker = new PerformanceTracker()
  private tradeManager: TradeManager

  constructor(
    stateManager: StateManager,
    tradeSyncer: OandaTradeSyncer,
    positionManager: PositionManager,
    broadcast: (msg: AnyDaemonMessage) => void,
  ) {
    this.stateManager = stateManager
    this.tradeSyncer = tradeSyncer
    this.positionManager = positionManager
    this.broadcast = broadcast
    this.executionGate = new ExecutionGate(this.costTracker)
    this.tradeManager = new TradeManager(
      tradeSyncer,
      positionManager,
      broadcast,
      null,
      this.dataAggregator,
      this.performanceTracker,
    )
  }

  setNotificationEmitter(emitter: NotificationEmitter): void {
    this.notificationEmitter = emitter
    this.tradeManager = new TradeManager(
      this.tradeSyncer,
      this.positionManager,
      this.broadcast,
      emitter,
      this.dataAggregator,
      this.performanceTracker,
    )
  }

  async start(): Promise<void> {
    console.log("[ai-trader] Scanner started")
    await this.tradeManager.start()
    await expireOldOpportunities(4)
    await cleanupOldOpportunities(90)
    this.scheduleScan(10_000)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.tradeManager.stop()
    console.log("[ai-trader] Scanner stopped")
  }

  /** Pause the scan timer without stopping trade management. */
  pause(): void {
    if (this.paused) return
    this.paused = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.nextScanAt = null
    console.log("[ai-trader] Scanner paused")
    this.addLogEntry("scan_skip", "Scanner paused by user")
    this.broadcastScanStatus()
  }

  /** Resume the scan timer. */
  resume(): void {
    if (!this.paused) return
    this.paused = false
    console.log("[ai-trader] Scanner resumed")
    this.addLogEntry("scan_start", "Scanner resumed by user")
    this.scheduleScan(5_000) // Start a scan in 5s
    this.broadcastScanStatus()
  }

  isPaused(): boolean {
    return this.paused
  }

  // ─── Public API ──────────────────────────────────────────────────

  getScanStatus(): AiTraderScanStatus {
    return {
      scanning: this.scanning,
      enabled: true,
      lastScanAt: this.lastScanAt,
      nextScanAt: this.nextScanAt,
      candidateCount: 0,
      activePairCount: 0,
      openAiTradeCount: 0,
      todayBudgetUsed: 0,
      monthlyBudgetUsed: 0,
      error: this.lastError,
    }
  }

  async getFullScanStatus(): Promise<AiTraderScanStatus> {
    const config = await getAiTraderConfig()
    const openCount = await countOpenAiTrades()
    const dailyCost = await this.costTracker.getDailyCost()
    const monthlyCost = await this.costTracker.getMonthlyCost()

    return {
      scanning: this.scanning,
      enabled: (config?.enabled ?? false) && !this.paused,
      lastScanAt: this.lastScanAt,
      nextScanAt: this.nextScanAt,
      candidateCount: 0,
      activePairCount: 0,
      openAiTradeCount: openCount,
      todayBudgetUsed: dailyCost,
      monthlyBudgetUsed: monthlyCost,
      error: this.lastError,
    }
  }

  getScanProgress(): AiTraderScanProgressData | null {
    return this.scanProgress
  }

  getScanLog(): AiTraderScanLogEntry[] {
    return [...this.scanLog]
  }

  async triggerScan(): Promise<void> {
    if (this.scanning) return
    if (this.timer) clearTimeout(this.timer)
    await this.runScan()
  }

  async onOrderFilled(tradeId: string): Promise<void> {
    const opp = await findOpportunityByResultTradeId(tradeId)
    if (opp && opp.status === "placed") {
      await updateOpportunityStatus(opp.id, "filled", { filledAt: new Date() })
      this.tradeManager.trackOpportunity({
        ...opp,
        status: "filled" as const,
        filledAt: new Date().toISOString(),
      })

      this.broadcast({
        type: "ai_trader_opportunity_updated",
        timestamp: new Date().toISOString(),
        data: { ...opp, status: "filled" as const, filledAt: new Date().toISOString() },
      })
    }
  }

  async onTradeClosed(tradeId: string, realizedPL: number): Promise<void> {
    // Check BEFORE tradeManager processes (which deletes from managed set)
    const isAi = this.isAiTrade(tradeId)
    await this.tradeManager.onTradeClosed(tradeId, realizedPL)

    // Only track consecutive losses for AI Trader trades (not Trade Finder, TV Alerts, etc.)
    if (!isAi) return

    if (realizedPL < 0) {
      this.consecutiveLosses++
      if (this.consecutiveLosses >= 2) {
        const COOLDOWN_MS = 30 * 60_000 // 30 minutes
        this.cooldownUntil = Date.now() + COOLDOWN_MS
        this.addLogEntry(
          "scan_skip",
          `Cooldown activated: ${this.consecutiveLosses} consecutive AI Trader losses — pausing for 30 minutes`,
        )
      }
    } else if (realizedPL > 0) {
      this.consecutiveLosses = 0
      this.cooldownUntil = null
    }
  }

  isAiTrade(tradeId: string): boolean {
    return this.tradeManager.isAiTrade(tradeId)
  }

  onPriceTick(instrument: string, mid: number): void {
    this.tradeManager.onPriceTick(instrument, mid)
  }

  // ─── Scan Log ─────────────────────────────────────────────────────

  private addLogEntry(
    type: AiTraderScanLogEntry["type"],
    message: string,
    detail?: string,
    metadata?: AiTraderScanLogEntry["metadata"],
  ): void {
    const entry: AiTraderScanLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      detail,
      metadata,
    }
    this.scanLog.push(entry)
    if (this.scanLog.length > MAX_SCAN_LOG_ENTRIES) {
      this.scanLog = this.scanLog.slice(-MAX_SCAN_LOG_ENTRIES)
    }
    this.broadcast({
      type: "ai_trader_scan_log_entry",
      timestamp: entry.timestamp,
      data: entry,
    })
  }

  // ─── Scan Progress ───────────────────────────────────────────────

  private updateProgress(
    phase: AiTraderScanPhase,
    message: string,
    updates?: Partial<AiTraderScanProgressData>,
  ): void {
    if (!this.scanProgress) return
    this.scanProgress = {
      ...this.scanProgress,
      phase,
      message,
      elapsedMs: Date.now() - new Date(this.scanProgress.startedAt).getTime(),
      ...updates,
    }
    this.broadcastScanProgress()
  }

  private broadcastScanProgress(): void {
    if (!this.scanProgress) return
    this.broadcast({
      type: "ai_trader_scan_progress",
      timestamp: new Date().toISOString(),
      data: this.scanProgress,
    })
  }

  // ─── Scan Loop ─────────────────────────────────────────────────────

  private scheduleScan(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.nextScanAt = new Date(Date.now() + delayMs).toISOString()
    this.timer = setTimeout(() => void this.runScan(), delayMs)
  }

  private async runScan(): Promise<void> {
    if (this.scanning || this.paused) return

    // Cool-down check after consecutive losses
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      const remaining = Math.ceil((this.cooldownUntil - Date.now()) / 60_000)
      this.addLogEntry(
        "scan_skip",
        `Cooling down after ${this.consecutiveLosses} consecutive losses (${remaining} min remaining)`,
      )
      this.scheduleScan(60_000) // Re-check in 1 minute
      return
    }
    // Clear expired cooldown
    if (this.cooldownUntil && Date.now() >= this.cooldownUntil) {
      this.cooldownUntil = null
    }

    const startedAt = new Date().toISOString()
    this.scanProgress = {
      phase: "starting",
      message: "Starting scan...",
      pairsTotal: 0,
      pairsScanned: 0,
      candidatesFound: 0,
      candidatesAnalyzed: 0,
      candidatesTotal: 0,
      startedAt,
      elapsedMs: 0,
    }

    try {
      this.scanning = true
      this.lastError = null
      this.broadcastScanStatus()
      this.addLogEntry("scan_start", "Scan started")
      this.broadcastScanProgress()

      // ─── Check config ────────────────────────────────────────
      this.updateProgress("checking_config", "Checking configuration...")
      const config = await getAiTraderConfig()
      if (!config) {
        this.updateProgress("skipped", "No configuration found")
        this.addLogEntry("scan_skip", "No configuration found")
        this.scheduleScan(60_000)
        return
      }

      // ─── Check market hours ──────────────────────────────────
      this.updateProgress("checking_market", "Checking if market is open...")
      const canScan = await this.executionGate.canScan(config)
      if (!canScan.allowed) {
        const reason = canScan.reason ?? "Unknown"
        console.log(`[ai-trader] Scan skipped: ${reason}`)
        this.updateProgress("skipped", reason)
        this.addLogEntry("scan_skip", `Scan skipped: ${reason}`)
        this.scheduleScan(config.scanIntervalMinutes * 60_000)
        return
      }

      if (await this.executionGate.isKillSwitchEngaged()) {
        console.log("[ai-trader] Scan skipped: kill switch engaged")
        this.updateProgress("skipped", "Kill switch is on (TV Alerts disabled)")
        this.addLogEntry("scan_skip", "Kill switch engaged")
        this.scheduleScan(config.scanIntervalMinutes * 60_000)
        return
      }

      // ─── Check credentials ──────────────────────────────────
      this.updateProgress("checking_config", "Verifying OANDA credentials...")
      const creds = this.stateManager.getCredentials()
      if (!creds) {
        console.log("[ai-trader] Scan skipped: no OANDA credentials")
        this.updateProgress("skipped", "No OANDA credentials configured")
        this.addLogEntry("scan_skip", "No OANDA credentials")
        this.scheduleScan(60_000)
        return
      }

      // ─── Check budget ───────────────────────────────────────
      this.updateProgress("checking_budget", "Checking AI budget...")

      const apiUrl =
        creds.mode === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com"

      const pairs =
        config.pairWhitelist.length > 0 ? config.pairWhitelist : ALL_FOREX_PAIRS.map((p) => p.value)

      const enabledProfiles = (
        Object.entries(config.enabledProfiles) as [AiTraderProfile, boolean][]
      )
        .filter(([, enabled]) => enabled)
        .map(([profile]) => profile)

      if (enabledProfiles.length === 0) {
        console.log("[ai-trader] No profiles enabled, skipping scan")
        this.updateProgress("skipped", "No trading profiles enabled")
        this.addLogEntry("scan_skip", "No profiles enabled")
        this.scheduleScan(config.scanIntervalMinutes * 60_000)
        return
      }

      // ─── Scan pairs ─────────────────────────────────────────
      this.updateProgress(
        "scanning_pairs",
        `Scanning ${pairs.length} pairs across ${enabledProfiles.length} profiles...`,
        {
          pairsTotal: pairs.length,
        },
      )
      console.log(
        `[ai-trader] Scanning ${pairs.length} pairs across ${enabledProfiles.length} profiles`,
      )

      const allSignals: Tier1Signal[] = []
      const filterStats: Tier1FilterStats = {
        lowVolatility: 0,
        noReasons: 0,
        lowConfluence: 0,
        spreadTooWide: 0,
        rrTooLow: 0,
        htfPenalized: 0,
        secondaryRsiPenalized: 0,
        passed: 0,
      }

      // Get current session for profile filtering
      const { getCurrentSession } = await import("@fxflow/shared")
      const currentSession = getCurrentSession()
      const sessionName = currentSession.session

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]!
        for (const profile of enabledProfiles) {
          // ─── Smart session/profile filtering ───────────────────────
          const isActiveSession =
            sessionName === "london" || sessionName === "ny" || sessionName === "london_ny_overlap"
          if (profile === "scalper" && !isActiveSession) continue

          try {
            const profileConfig = getProfileConfig(profile)
            const tf = profileConfig.scanTimeframes
            const counts = profileConfig.candleCounts

            const [primaryCandles, secondaryCandles, htfCandles] = await Promise.all([
              fetchOandaCandles(
                pair,
                tf.primary,
                counts.primary,
                apiUrl,
                creds.token,
                this.candleCache,
              ),
              fetchOandaCandles(
                pair,
                tf.secondary,
                counts.secondary,
                apiUrl,
                creds.token,
                this.candleCache,
              ),
              fetchOandaCandles(pair, tf.htf, counts.htf, apiUrl, creds.token, this.candleCache),
            ])

            if (primaryCandles.length < 30) continue

            const signals = analyzeTier1(
              pair,
              primaryCandles,
              secondaryCandles,
              htfCandles,
              profile,
              config.enabledTechniques as Record<AiTraderTechnique, boolean>,
              filterStats,
            )

            if (signals.length > 0) {
              allSignals.push(...signals)
              const best = signals.reduce((a, b) => (b.confidence > a.confidence ? b : a))
              const confluent = Object.entries(best.confluenceBreakdown)
                .filter(([, v]) => v.present)
                .map(([k]) => k)
              this.addLogEntry(
                "candidate_found",
                `${pair.replace("_", "/")} (${profile}): ${signals.length} signal(s)`,
                `Confidence: ${signals.map((s) => s.confidence + "%").join(", ")}`,
                {
                  instrument: pair,
                  direction: best.direction,
                  profile,
                  signalCount: signals.length,
                  confidence: best.confidence,
                  entryPrice: best.entryPrice,
                  stopLoss: best.suggestedSL,
                  takeProfit: best.suggestedTP,
                  riskRewardRatio: best.riskRewardRatio,
                  tier: 1,
                  primaryTechnique: best.primaryTechnique,
                  techniques: confluent,
                  reasons: best.reasons,
                },
              )
            }
          } catch (err) {
            console.warn(`[ai-trader] Error scanning ${pair}/${profile}:`, (err as Error).message)
          }
        }

        // Update progress every pair
        this.updateProgress(
          "scanning_pairs",
          `Scanning pairs... ${i + 1}/${pairs.length} (${pair.replace("_", "/")})`,
          {
            pairsScanned: i + 1,
            candidatesFound: allSignals.length,
          },
        )

        await sleep(200)
      }

      // Build filter diagnostic summary
      const filterParts: string[] = []
      if (filterStats.lowVolatility > 0) filterParts.push(`${filterStats.lowVolatility} low-vol`)
      if (filterStats.noReasons > 0) filterParts.push(`${filterStats.noReasons} no-signal`)
      if (filterStats.lowConfluence > 0)
        filterParts.push(`${filterStats.lowConfluence} low-confluence`)
      if (filterStats.spreadTooWide > 0) filterParts.push(`${filterStats.spreadTooWide} spread`)
      if (filterStats.rrTooLow > 0) filterParts.push(`${filterStats.rrTooLow} low-R:R`)
      if (filterStats.htfPenalized > 0)
        filterParts.push(`${filterStats.htfPenalized} HTF-penalized`)
      if (filterStats.secondaryRsiPenalized > 0)
        filterParts.push(`${filterStats.secondaryRsiPenalized} RSI-penalized`)
      const filterSummary = filterParts.length > 0 ? ` [filters: ${filterParts.join(", ")}]` : ""

      this.addLogEntry(
        "pair_scanned",
        `Scanned ${pairs.length} pairs, found ${allSignals.length} Tier 1 signals${filterSummary}`,
        filterParts.length > 0 ? `Filter breakdown: ${filterParts.join(", ")}` : undefined,
        {
          pairsScanned: pairs.length,
          candidatesFound: allSignals.length,
          tier: 1,
        },
      )
      console.log(`[ai-trader] Tier 1 found ${allSignals.length} candidates`)

      allSignals.sort((a, b) => b.confidence - a.confidence)

      // ─── Correlation guard: limit same-currency same-direction ──
      const filtered = filterCorrelatedSignals(allSignals, 2)
      const topCandidates = filtered.slice(0, 10)

      // ─── Analyze candidates with AI ─────────────────────────
      let tier2Passed = 0
      let tier3Passed = 0
      let tradesPlaced = 0
      let gateBlocked = 0

      if (topCandidates.length > 0) {
        this.updateProgress(
          "analyzing_candidates",
          `Analyzing top ${topCandidates.length} candidates with AI...`,
          {
            candidatesTotal: topCandidates.length,
            candidatesAnalyzed: 0,
          },
        )

        for (let i = 0; i < topCandidates.length; i++) {
          const signal = topCandidates[i]!
          try {
            const result = await this.processTier2And3(signal, config)
            if (result === "tier2_pass" || result === "tier3_pass" || result === "placed")
              tier2Passed++
            if (result === "tier3_pass" || result === "placed") tier3Passed++
            if (result === "placed") tradesPlaced++
            if (result === "gate_blocked") gateBlocked++
          } catch (err) {
            const errMsg = (err as Error).message
            console.warn(`[ai-trader] Tier 2/3 error for ${signal.instrument}:`, errMsg)
            // Classify and broadcast actionable AI API errors
            const classified = classifyAiError(err)
            if (classified.category !== "unknown") {
              this.broadcast({
                type: "ai_error_alert",
                timestamp: new Date().toISOString(),
                data: {
                  category: classified.category,
                  message: classified.message,
                  detail: classified.detail,
                  source: "ai_trader",
                  retryable: classified.retryable,
                },
              })
            }
            this.addLogEntry(
              "tier2_fail",
              `${signal.instrument.replace("_", "/")}: ${classified.category !== "unknown" ? classified.message : "Tier 2/3 error"}`,
              errMsg,
              {
                instrument: signal.instrument,
                direction: signal.direction,
                profile: signal.profile,
                confidence: signal.confidence,
                error: errMsg,
                tier: 1,
              },
            )
          }
          this.updateProgress(
            "analyzing_candidates",
            `Analyzing candidates... ${i + 1}/${topCandidates.length} (${signal.instrument.replace("_", "/")})`,
            {
              candidatesAnalyzed: i + 1,
            },
          )
        }
      }

      this.lastScanAt = new Date().toISOString()
      this.scheduleScan(config.scanIntervalMinutes * 60_000)

      const elapsed = Date.now() - new Date(startedAt).getTime()

      // Build pipeline funnel summary
      const funnelParts = [`${allSignals.length} signals found`]
      if (topCandidates.length > 0) {
        funnelParts.push(`${topCandidates.length} sent to AI`)
        funnelParts.push(`${tier2Passed} passed Tier 2`)
        if (tier2Passed > 0) funnelParts.push(`${tier3Passed} passed Tier 3`)
        if (gateBlocked > 0) funnelParts.push(`${gateBlocked} blocked by gates`)
        funnelParts.push(`${tradesPlaced} trade(s) placed`)
      }
      const funnelSummary = funnelParts.join(" → ")

      this.updateProgress(
        "complete",
        `Scan complete in ${Math.round(elapsed / 1000)}s. ${funnelSummary}`,
      )
      this.addLogEntry(
        "scan_complete",
        `Scan finished in ${Math.round(elapsed / 1000)}s`,
        funnelSummary,
        {
          pairsScanned: pairs.length,
          candidatesFound: allSignals.length,
          candidatesAnalyzed: topCandidates.length,
          tier2Passed,
          tier3Passed,
          tradesPlaced,
          gateBlocked,
          elapsedMs: elapsed,
        },
      )
      console.log(`[ai-trader] Scan complete: ${funnelSummary}. Next scan at ${this.nextScanAt}`)
    } catch (err) {
      this.lastError = (err as Error).message
      console.error("[ai-trader] Scan error:", this.lastError)
      // Classify and broadcast actionable AI API errors
      const classified = classifyAiError(err)
      if (classified.category !== "unknown") {
        this.broadcast({
          type: "ai_error_alert",
          timestamp: new Date().toISOString(),
          data: {
            category: classified.category,
            message: classified.message,
            detail: classified.detail,
            source: "ai_trader",
            retryable: classified.retryable,
          },
        })
      }
      const displayError = classified.category !== "unknown" ? classified.message : this.lastError
      this.updateProgress("error", `Scan error: ${displayError}`)
      this.addLogEntry("scan_error", `Scan error: ${displayError}`, this.lastError)
      this.scheduleScan(60_000)
    } finally {
      this.scanning = false
      this.broadcastScanStatus()
    }
  }

  // ─── Tier 2/3 Processing ───────────────────────────────────────────

  private async processTier2And3(
    signal: Tier1Signal,
    config: AiTraderConfigData,
  ): Promise<
    "tier2_fail" | "tier2_pass" | "tier3_fail" | "tier3_pass" | "gate_blocked" | "placed"
  > {
    const pairLabel = signal.instrument.replace("_", "/")
    const tier2Prompt = buildTier2Prompt(signal)

    const apiKey = await getDecryptedClaudeKey()
    if (!apiKey) throw new Error("Claude API key not configured — set it in Settings > AI")
    const anthropic = new Anthropic({ apiKey })
    const tier2Response = await anthropic.messages.create({
      model: config.scanModel || "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: tier2Prompt.system,
      messages: [{ role: "user", content: tier2Prompt.user }],
    })

    const tier2Text = tier2Response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const tier2InputTokens = tier2Response.usage.input_tokens
    const tier2OutputTokens = tier2Response.usage.output_tokens
    const tier2Model = config.scanModel || "claude-haiku-4-5-20251001"
    // Haiku pricing: $0.80/M input, $4/M output
    const tier2Cost = (tier2InputTokens * 0.8 + tier2OutputTokens * 4) / 1_000_000

    this.costTracker.invalidateCache()

    // Helper to persist tier2 cost on any exit path
    const recordTier2Only = async (status: "rejected" | "detected") => {
      const opp = await createOpportunity({
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: signal.confidence,
        scores: {
          technical: signal.confidence,
          fundamental: 0,
          sentiment: 0,
          session: 0,
          historical: 0,
          confluence: signal.confidence,
        },
        entryPrice: signal.entryPrice,
        stopLoss: signal.suggestedSL,
        takeProfit: signal.suggestedTP,
        riskPips: signal.riskPips,
        rewardPips: signal.rewardPips,
        riskRewardRatio: signal.riskRewardRatio,
        positionSize: 0,
        regime: castRegime(signal.technicalSnapshot.regime),
        session: castSession(signal.technicalSnapshot.session),
        primaryTechnique: signal.primaryTechnique,
        technicalSnapshot: signal.technicalSnapshot,
      })
      await updateOpportunityStatus(opp.id, status, {
        tier2Response: tier2Text,
        tier2Model,
        tier2InputTokens,
        tier2OutputTokens,
        tier2Cost,
      })
    }

    let tier2Result: { pass: boolean; confidence: number; reason: string }
    try {
      tier2Result = extractJSON(tier2Text)
    } catch {
      console.warn(
        `[ai-trader] Tier 2 invalid JSON for ${signal.instrument}: ${tier2Text.slice(0, 200)}`,
      )
      this.addLogEntry("tier2_fail", `${pairLabel}: Tier 2 returned invalid response`, undefined, {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: signal.confidence,
        error: `Could not parse response: ${tier2Text.slice(0, 150)}`,
        tier: 1,
      })
      await recordTier2Only("rejected")
      return "tier2_fail"
    }

    if (!tier2Result.pass) {
      this.addLogEntry(
        "tier2_fail",
        `${pairLabel}: Tier 2 rejected (${tier2Result.confidence}%)`,
        tier2Result.reason,
        {
          instrument: signal.instrument,
          direction: signal.direction,
          profile: signal.profile,
          confidence: tier2Result.confidence,
          reason: tier2Result.reason,
          tier: 2,
        },
      )
      await recordTier2Only("rejected")
      return "tier2_fail"
    }

    this.addLogEntry(
      "tier2_pass",
      `${pairLabel}: Tier 2 passed (${tier2Result.confidence}%)`,
      tier2Result.reason,
      {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: tier2Result.confidence,
        reason: tier2Result.reason,
        tier: 2,
      },
    )

    // ─── Pre-Tier-3 Gate: check constraints (not confidence) ──────────
    const hasExistingPosition = (inst: string) => {
      const positions = this.positionManager.getPositions()
      return positions.open.some((t) => t.instrument === inst)
    }

    const preTier3 = await this.executionGate.preTier3Check(
      config,
      signal.instrument,
      hasExistingPosition,
      signal.technicalSnapshot.regime,
      signal.confidence,
    )

    if (!preTier3.allowed) {
      this.addLogEntry(
        "gate_blocked",
        `${pairLabel}: Blocked by risk gate`,
        preTier3.reason ?? undefined,
        {
          instrument: signal.instrument,
          direction: signal.direction,
          profile: signal.profile,
          confidence: tier2Result.confidence,
          reason: preTier3.reason ?? undefined,
          tier: 2,
        },
      )
      const gateOpp = await createOpportunity({
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: tier2Result.confidence,
        scores: {
          technical: signal.confidence,
          fundamental: 0,
          sentiment: 0,
          session: 0,
          historical: 0,
          confluence: signal.confidence,
        },
        entryPrice: signal.entryPrice,
        stopLoss: signal.suggestedSL,
        takeProfit: signal.suggestedTP,
        riskPips: signal.riskPips,
        rewardPips: signal.rewardPips,
        riskRewardRatio: signal.riskRewardRatio,
        positionSize: 0,
        regime: castRegime(signal.technicalSnapshot.regime),
        session: castSession(signal.technicalSnapshot.session),
        primaryTechnique: signal.primaryTechnique,
        entryRationale: preTier3.reason ?? undefined,
        technicalSnapshot: signal.technicalSnapshot,
      })
      // Record tier2 cost on gate-blocked opportunities
      await updateOpportunityStatus(gateOpp.id, "rejected", {
        tier2Response: tier2Text,
        tier2Model,
        tier2InputTokens,
        tier2OutputTokens,
        tier2Cost,
      })
      return "gate_blocked"
    }

    // ─── Tier 3: Deep decision ───────────────────────────────────────
    const fundamentalData = await this.dataAggregator.buildFundamentalSnapshot(signal.instrument)
    const performanceHistory = await this.performanceTracker.getHistoricalStats(
      signal.profile,
      signal.instrument,
    )

    const overview = this.stateManager.getAccountOverview()
    const accountBalance = overview?.summary.balance ?? 10000
    const openTradeCount = await countOpenAiTrades()
    const riskPercent = await getRiskPercent()

    // Extract pair+profile win rate for self-awareness
    const pairPerfMatch = performanceHistory.find(
      (s) => s.instrument === signal.instrument && s.profile === signal.profile,
    )
    const pairProfileWinRate =
      pairPerfMatch && pairPerfMatch.totalTrades > 0
        ? pairPerfMatch.wins / pairPerfMatch.totalTrades
        : null

    const tier3Ctx: Tier3Context = {
      signal,
      tier2Response: tier2Text,
      fundamentalData,
      performanceHistory,
      config,
      accountBalance,
      openTradeCount,
      riskPercent,
      consecutiveLosses: this.consecutiveLosses,
      pairProfileWinRate,
    }

    const tier3Prompt = buildTier3Prompt(tier3Ctx)

    const tier3Response = await anthropic.messages.create({
      model: config.decisionModel || "claude-sonnet-4-5-20241022",
      max_tokens: 1500,
      system: tier3Prompt.system,
      messages: [{ role: "user", content: tier3Prompt.user }],
    })

    const tier3Text = tier3Response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const tier3InputTokens = tier3Response.usage.input_tokens
    const tier3OutputTokens = tier3Response.usage.output_tokens
    const tier3Cost = (tier3InputTokens * 3 + tier3OutputTokens * 15) / 1_000_000

    this.costTracker.invalidateCache()

    let tier3Result: {
      execute: boolean
      confidence: number
      adjustedEntry: number | null
      adjustedSL: number | null
      adjustedTP: number | null
      positionSizeUnits?: number // Legacy field — ignored, calculated deterministically
      scores: {
        technical: number
        fundamental: number
        sentiment: number
        session: number
        historical: number
        confluence: number
      }
      entryRationale: string
      riskAssessment: string
      managementPlan: string
    }
    try {
      tier3Result = extractJSON(tier3Text)
    } catch {
      console.warn(
        `[ai-trader] Tier 3 invalid JSON for ${signal.instrument}: ${tier3Text.slice(0, 200)}`,
      )
      this.addLogEntry("tier3_fail", `${pairLabel}: Tier 3 returned invalid response`, undefined, {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: tier2Result.confidence,
        error: `Could not parse response: ${tier3Text.slice(0, 150)}`,
        tier: 2,
      })
      return "tier3_fail"
    }

    // ─── Create opportunity + update with tier data ────────────────────
    const entryPrice = tier3Result.adjustedEntry ?? signal.entryPrice
    const stopLoss = tier3Result.adjustedSL ?? signal.suggestedSL
    const takeProfit = tier3Result.adjustedTP ?? signal.suggestedTP

    // Recalculate R:R using final (potentially Tier 3-adjusted) levels
    const finalRiskPips = priceToPips(signal.instrument, Math.abs(entryPrice - stopLoss))
    const finalRewardPips = priceToPips(signal.instrument, Math.abs(takeProfit - entryPrice))
    const finalRR = finalRiskPips > 0 ? finalRewardPips / finalRiskPips : 0

    // Re-validate R:R against profile minimum after Tier 3 adjustments
    const profileConfig = getProfileConfig(signal.profile)
    if (finalRR < profileConfig.minRR) {
      console.warn(
        `[ai-trader] R:R dropped below minimum after Tier 3: ${finalRR.toFixed(1)} < ${profileConfig.minRR} for ${signal.instrument}`,
      )
      this.addLogEntry(
        "tier3_fail",
        `${pairLabel}: R:R ${finalRR.toFixed(1)}:1 below minimum ${profileConfig.minRR}:1 after Tier 3 adjustments`,
        undefined,
        {
          instrument: signal.instrument,
          direction: signal.direction,
          profile: signal.profile,
          confidence: tier3Result.confidence,
          entryPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: finalRR,
          reason: `R:R ${finalRR.toFixed(1)}:1 < min ${profileConfig.minRR}:1`,
          tier: 3,
        },
      )
      return "tier3_fail"
    }

    // Deterministic position sizing — calculated from account settings, never from LLM
    const pipSize = getPipSize(signal.instrument)
    const riskPipsForSizing = Math.abs(entryPrice - stopLoss) / pipSize
    const riskAmount = accountBalance * (riskPercent / 100)
    const positionSize =
      riskPipsForSizing > 0
        ? Math.max(1, Math.floor(riskAmount / (riskPipsForSizing * pipSize)))
        : 0

    if (positionSize <= 0) {
      console.warn(`[ai-trader] Position size calculated as 0 for ${signal.instrument} — skipping`)
      this.addLogEntry("gate_blocked", `${pairLabel}: Position size is 0 (risk calculation issue)`)
      return "gate_blocked"
    }

    const opportunity = await createOpportunity({
      instrument: signal.instrument,
      direction: signal.direction,
      profile: signal.profile,
      confidence: tier3Result.confidence,
      scores: tier3Result.scores,
      entryPrice,
      stopLoss,
      takeProfit,
      riskPips: finalRiskPips,
      rewardPips: finalRewardPips,
      riskRewardRatio: finalRR,
      positionSize,
      regime: castRegime(signal.technicalSnapshot.regime),
      session: castSession(signal.technicalSnapshot.session),
      primaryTechnique: signal.primaryTechnique,
      entryRationale: tier3Result.entryRationale,
      technicalSnapshot: signal.technicalSnapshot,
      fundamentalSnapshot: fundamentalData,
      sentimentSnapshot: fundamentalData.sentiment,
    })

    // Update with tier data and final status
    await updateOpportunityStatus(opportunity.id, tier3Result.execute ? "suggested" : "rejected", {
      tier2Response: tier2Text,
      tier2Model: tier2Model,
      tier2InputTokens,
      tier2OutputTokens,
      tier2Cost,
      tier3Response: tier3Text,
      tier3Model: config.decisionModel || "claude-sonnet-4-5-20241022",
      tier3InputTokens,
      tier3OutputTokens,
      tier3Cost,
      suggestedAt: tier3Result.execute ? new Date() : undefined,
    })

    if (!tier3Result.execute) {
      this.addLogEntry(
        "tier3_fail",
        `${pairLabel}: Tier 3 rejected (${tier3Result.confidence}%)`,
        tier3Result.entryRationale,
        {
          instrument: signal.instrument,
          direction: signal.direction,
          profile: signal.profile,
          confidence: tier3Result.confidence,
          entryPrice,
          stopLoss,
          takeProfit,
          reason: tier3Result.entryRationale,
          tier: 3,
        },
      )
      return "tier3_fail"
    }

    // ─── Post-Tier-3 Gate: check final confidence + auto-execute ─────
    const postTier3 = this.executionGate.postTier3Check(config, tier3Result.confidence)
    if (!postTier3.allowed) {
      this.addLogEntry(
        "gate_blocked",
        `${pairLabel}: Below minimum confidence after Tier 3`,
        postTier3.reason ?? undefined,
        {
          instrument: signal.instrument,
          direction: signal.direction,
          profile: signal.profile,
          confidence: tier3Result.confidence,
          reason: postTier3.reason ?? undefined,
          tier: 3,
        },
      )
      await updateOpportunityStatus(opportunity.id, "rejected", {
        tier2Response: tier2Text,
        tier2Model: tier2Model,
        tier2InputTokens,
        tier2OutputTokens,
        tier2Cost,
        tier3Response: tier3Text,
        tier3Model: config.decisionModel || "claude-sonnet-4-5-20241022",
        tier3InputTokens,
        tier3OutputTokens,
        tier3Cost,
      })
      return "gate_blocked"
    }

    this.addLogEntry(
      "tier3_pass",
      `${pairLabel}: Tier 3 approved (${tier3Result.confidence}%)`,
      `${signal.direction.toUpperCase()} @ ${entryPrice}`,
      {
        instrument: signal.instrument,
        direction: signal.direction,
        profile: signal.profile,
        confidence: tier3Result.confidence,
        entryPrice,
        stopLoss,
        takeProfit,
        riskRewardRatio: signal.riskRewardRatio,
        tier: 3,
      },
    )

    const updatedOpp: AiTraderOpportunityData = {
      ...opportunity,
      status: "suggested",
      tier2Response: tier2Text,
      tier3Response: tier3Text,
      tier3Model: config.decisionModel || "claude-sonnet-4-5-20241022",
      tier3InputTokens,
      tier3OutputTokens,
      tier3Cost,
      suggestedAt: new Date().toISOString(),
    }

    this.broadcast({
      type: "ai_trader_opportunity_found",
      timestamp: new Date().toISOString(),
      data: updatedOpp,
    })

    await this.notificationEmitter?.emitAiTrader(
      "AI Trade Opportunity",
      `${pairLabel} ${signal.direction.toUpperCase()} — Confidence: ${tier3Result.confidence}%`,
    )

    if (postTier3.autoExecute) {
      await this.executeOpportunity(updatedOpp)
      return "placed"
    }

    return "tier3_pass"
  }

  // ─── Execute Trade ─────────────────────────────────────────────────

  private async executeOpportunity(opp: AiTraderOpportunityData): Promise<void> {
    const pairLabel = opp.instrument.replace("_", "/")
    try {
      const result = await this.tradeSyncer.placeOrder({
        instrument: opp.instrument,
        direction: opp.direction,
        orderType: "LIMIT",
        units: opp.positionSize,
        entryPrice: opp.entryPrice,
        stopLoss: opp.stopLoss,
        takeProfit: opp.takeProfit,
        placedVia: "ai_trader",
        notes: `AI Trade | Profile: ${opp.profile} | Confidence: ${opp.confidence}% | ${opp.entryRationale?.slice(0, 100) ?? ""}`,
      })

      await updateOpportunityStatus(opp.id, "placed", {
        resultSourceId: result.sourceId,
        placedAt: new Date(),
      })

      if (result.filled) {
        await sleep(2000)
        const dbTrade = await getTradeBySourceId("oanda", result.sourceId)
        if (dbTrade) {
          await updateOpportunityStatus(opp.id, "filled", {
            resultTradeId: dbTrade.id,
            filledAt: new Date(),
          })
          this.tradeManager.trackOpportunity({
            ...opp,
            status: "filled" as const,
            resultTradeId: dbTrade.id,
            resultSourceId: result.sourceId,
            filledAt: new Date().toISOString(),
          })
        }
      }

      this.broadcast({
        type: "ai_trader_trade_placed",
        timestamp: new Date().toISOString(),
        data: {
          opportunityId: opp.id,
          tradeId: opp.resultTradeId ?? "",
          instrument: opp.instrument,
          direction: opp.direction,
          confidence: opp.confidence,
          entryPrice: opp.entryPrice,
        },
      })

      this.addLogEntry(
        "trade_placed",
        `${pairLabel}: Trade placed (${opp.direction.toUpperCase()})`,
        `${opp.positionSize} units @ ${opp.entryPrice}`,
        {
          instrument: opp.instrument,
          direction: opp.direction,
          profile: opp.profile,
          confidence: opp.confidence,
          entryPrice: opp.entryPrice,
          stopLoss: opp.stopLoss,
          takeProfit: opp.takeProfit,
          riskRewardRatio: opp.riskRewardRatio,
        },
      )

      await this.notificationEmitter?.emitAiTrader(
        "AI Trade Placed",
        `${pairLabel} ${opp.direction.toUpperCase()} — ${opp.positionSize} units @ ${opp.entryPrice}`,
      )
    } catch (err) {
      console.error(
        `[ai-trader] Failed to place trade for ${opp.instrument}:`,
        (err as Error).message,
      )
      this.addLogEntry(
        "trade_rejected",
        `${pairLabel}: Trade placement failed`,
        (err as Error).message,
        {
          instrument: opp.instrument,
          direction: opp.direction,
          profile: opp.profile,
          reason: (err as Error).message,
        },
      )
      await updateOpportunityStatus(opp.id, "rejected")
    }
  }

  // ─── Broadcasting ──────────────────────────────────────────────────

  private broadcastScanStatus(): void {
    void this.getFullScanStatus().then((status) => {
      this.broadcast({
        type: "ai_trader_scan_status",
        timestamp: new Date().toISOString(),
        data: status,
      })
    })
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const VALID_REGIMES = new Set<AiTraderMarketRegime>([
  "trending",
  "ranging",
  "volatile",
  "low_volatility",
])
const VALID_SESSIONS = new Set<AiTraderSession>([
  "asian",
  "london",
  "ny",
  "london_ny_overlap",
  "london_close",
  "off_session",
])

function castRegime(val: string | null): AiTraderMarketRegime | undefined {
  if (val && VALID_REGIMES.has(val as AiTraderMarketRegime)) return val as AiTraderMarketRegime
  return undefined
}

function castSession(val: string | null): AiTraderSession | undefined {
  if (val && VALID_SESSIONS.has(val as AiTraderSession)) return val as AiTraderSession
  return undefined
}
