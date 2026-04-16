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
import { AI_MODEL_OPTIONS } from "@fxflow/types"
import {
  getAiTraderConfig,
  updateAiTraderConfig,
  getDecryptedClaudeKey,
  createOpportunity,
  updateOpportunityStatus,
  expireOldOpportunities,
  cleanupOldOpportunities,
  reconcileStaleOpportunities,
  countOpenAiTrades,
  findOpportunityByResultTradeId,
  getTradeBySourceId,
  getRiskPercent,
  createNearMiss,
} from "@fxflow/db"
import {
  ALL_FOREX_PAIRS,
  getPipSize,
  getTypicalSpread,
  priceToPips,
  classifyAiError,
  CircuitBreaker,
  filterCorrelatedCandidates,
  calculatePositionSize,
} from "@fxflow/shared"
import type { StateManager } from "../state-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"
import type { PositionManager } from "../positions/position-manager.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import type { PositionPriceTracker } from "../positions/position-price-tracker.js"
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
  type Tier1NearMiss,
} from "./strategy-engine.js"
import { buildTier2Prompt, buildTier3Prompt, type Tier3Context } from "./prompt-builder.js"

const MAX_SCAN_LOG_ENTRIES = 100

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
  private priceTracker: PositionPriceTracker | null = null

  private timer: ReturnType<typeof setTimeout> | null = null
  private scanning = false
  private lastScanAt: string | null = null
  private nextScanAt: string | null = null
  private lastError: string | null = null
  private paused = false

  /**
   * Shared circuit breaker. EdgeFinder historically used tighter thresholds
   * than SmartFlow (2 consecutive losses / 30 min pause vs. 3 / 120 min)
   * because it's more aggressive per scan. Thresholds preserved as-is.
   */
  private readonly circuitBreaker = new CircuitBreaker({
    maxConsecLosses: 2,
    consecPauseMinutes: 30,
    maxDailyLosses: 4,
    maxDailyDrawdownPercent: 3.0,
  })

  // Scan progress tracking
  private scanProgress: AiTraderScanProgressData | null = null
  private scanLog: AiTraderScanLogEntry[] = []

  // ATR cache from previous scans — used for pre-scan viability checks
  private atrCache = new Map<string, number>() // "EUR_USD:M5" → ATR in price terms

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
    // Enable AI re-evaluation. Disabled by default in config — harmless to
    // wire up here since the evaluator short-circuits on disabled mode.
    this.tradeManager.setCostTracker(this.costTracker)
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
    this.tradeManager.setCostTracker(this.costTracker)
  }

  setPriceTracker(tracker: PositionPriceTracker): void {
    this.priceTracker = tracker
  }

  /**
   * Get live spread in pips from the pricing stream. Falls back to static typical spreads
   * when live data is unavailable (e.g. pair not currently streamed).
   */
  getLiveSpread(instrument: string): { spreadPips: number; source: "live" | "typical" } {
    const tick = this.priceTracker?.getLatestPrice(instrument)
    if (tick && tick.bid > 0 && tick.ask > 0) {
      const pipSize = getPipSize(instrument)
      const rawSpread = tick.ask - tick.bid
      return { spreadPips: rawSpread / pipSize, source: "live" }
    }
    return { spreadPips: getTypicalSpread(instrument), source: "typical" }
  }

  async start(): Promise<void> {
    await this.repairDangerousConfig()
    console.log("[ai-trader] Scanner started")
    await this.tradeManager.start()
    await expireOldOpportunities(4)
    await this.reconcileOpportunitiesOnStartup()
    await cleanupOldOpportunities(90)
    this.scheduleScan(10_000)
  }

  /** Repair dangerous config values on startup */
  private async repairDangerousConfig(): Promise<void> {
    const config = await getAiTraderConfig()
    if (!config) return

    const repairs: Record<string, unknown> = {}

    // Cap maxConcurrentTrades to 5 (20 is dangerously high)
    if (config.maxConcurrentTrades > 5) repairs.maxConcurrentTrades = 5

    // Fix Tier 2 model: should be Haiku for cheap quick filter, not Sonnet/Opus
    const haiku = "claude-haiku-4-5-20251001"
    const tier2IsExpensive =
      config.scanModel.includes("sonnet") || config.scanModel.includes("opus")
    if (tier2IsExpensive) repairs.scanModel = haiku

    // Fix Tier 3 model: should be Sonnet for deep analysis, not Opus (5x cost)
    const sonnet = "claude-sonnet-4-6"
    if (config.decisionModel.includes("opus")) repairs.decisionModel = sonnet

    // Floor minimumConfidence at 40 (below that is too permissive)
    if (config.minimumConfidence < 40) repairs.minimumConfidence = 40

    if (Object.keys(repairs).length > 0) {
      await updateAiTraderConfig(repairs as Parameters<typeof updateAiTraderConfig>[0])
      console.log(`[ai-trader] SAFETY: Repaired dangerous config values:`, repairs)
    }
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

  /**
   * On startup, reconcile "placed"/"filled"/"managed" opportunities against
   * actual OANDA open trades. Any opportunity whose trade no longer exists
   * is marked as expired/cancelled.
   */
  private async reconcileOpportunitiesOnStartup(): Promise<void> {
    try {
      const positions = this.positionManager.getPositions()
      const openSourceIds = new Set(positions.open.map((t) => t.sourceTradeId))
      const cleaned = await reconcileStaleOpportunities(openSourceIds)
      if (cleaned > 0) {
        console.log(`[ai-trader] Reconciled ${cleaned} stale opportunity/ies on startup`)
      }
    } catch (err) {
      console.warn("[ai-trader] Opportunity reconciliation error:", err)
    }
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

    // Report enabled based on config alone — paused is a separate transient state.
    // The UI should show "enabled but paused" differently from "disabled in settings".
    const configEnabled = config?.enabled ?? false

    return {
      scanning: this.scanning,
      enabled: configEnabled,
      paused: this.paused,
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

    const overview = this.stateManager.getAccountOverview()
    const balance = overview?.summary.balance ?? 0
    if (balance > 0) this.circuitBreaker.setStartingBalance(balance)

    const before = this.circuitBreaker.getState()
    this.circuitBreaker.recordOutcome(realizedPL)
    const after = this.circuitBreaker.getState()

    // Narrate state transitions into the scan log. Only log when a new pause
    // was activated or when the consecutive-loss count crosses the threshold.
    if (!before.paused && after.paused && after.reason) {
      this.addLogEntry("scan_skip", `EdgeFinder circuit breaker: ${after.reason}`)
    }
  }

  isAiTrade(tradeId: string): boolean {
    return this.tradeManager.isAiTrade(tradeId)
  }

  /**
   * Get viability status for each pair/profile combo based on cached ATR and live spreads.
   * Returns "viable", "marginal", or "blocked" per combo, plus supporting data.
   */
  getPairViability(): Array<{
    pair: string
    profile: string
    status: "viable" | "marginal" | "blocked" | "unknown"
    spreadPips: number
    atrPips: number | null
    rawRR: number | null
    spreadPercent: number | null
  }> {
    const results: Array<{
      pair: string
      profile: string
      status: "viable" | "marginal" | "blocked" | "unknown"
      spreadPips: number
      atrPips: number | null
      rawRR: number | null
      spreadPercent: number | null
    }> = []

    const profiles: AiTraderProfile[] = ["scalper", "intraday", "swing", "news"]
    const pairs = ALL_FOREX_PAIRS.map((p) => p.value)

    for (const pair of pairs) {
      const { spreadPips } = this.getLiveSpread(pair)
      for (const profile of profiles) {
        const cfg = getProfileConfig(profile)
        const cacheKey = `${pair}:${cfg.scanTimeframes.primary}`
        const cachedAtr = this.atrCache.get(cacheKey)

        if (cachedAtr === undefined) {
          results.push({
            pair,
            profile,
            status: "unknown",
            spreadPips,
            atrPips: null,
            rawRR: null,
            spreadPercent: null,
          })
          continue
        }

        const pipSize = getPipSize(pair)
        const atrPips = cachedAtr / pipSize
        const riskPips = atrPips * cfg.atrSlMultiplier
        const rewardPips = atrPips * cfg.atrTpMultiplier
        const rawRR = riskPips > 0 ? rewardPips / riskPips : 0
        const spreadPercent = riskPips > 0 ? spreadPips / riskPips : 1

        let status: "viable" | "marginal" | "blocked"
        if (spreadPercent > 0.3 || rawRR < cfg.minRR) {
          status = "blocked"
        } else if (spreadPercent > 0.2 || rawRR < cfg.minRR * 1.2) {
          status = "marginal"
        } else {
          status = "viable"
        }

        results.push({ pair, profile, status, spreadPips, atrPips, rawRR, spreadPercent })
      }
    }

    return results
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

    // Shared circuit breaker check (covers consecutive losses, daily losses,
    // and daily drawdown — with automatic reset at UTC midnight).
    const cbCheck = this.circuitBreaker.isAllowed()
    if (!cbCheck.allowed) {
      this.addLogEntry(
        "scan_skip",
        `EdgeFinder paused by circuit breaker: ${cbCheck.reason ?? "unknown"}`,
      )
      this.scheduleScan(60_000)
      return
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
      const allNearMisses: Tier1NearMiss[] = []
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

            // Pre-scan viability: skip pair/profile combos where spread makes R:R impossible
            const { spreadPips } = this.getLiveSpread(pair)
            const cachedAtrKey = `${pair}:${tf.primary}`
            const cachedAtr = this.atrCache.get(cachedAtrKey)
            if (cachedAtr !== undefined) {
              const cachedAtrPips = cachedAtr / getPipSize(pair)
              const riskPips = cachedAtrPips * profileConfig.atrSlMultiplier
              if (riskPips > 0 && spreadPips > riskPips * 0.3) {
                // This combo will always fail the spread gate — skip API call
                if (filterStats) filterStats.spreadTooWide++
                continue
              }
            }

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

            // Update ATR cache from fresh candle data
            {
              const { computeATR } = await import("@fxflow/shared")
              const atrArr = computeATR(primaryCandles, 14)
              if (atrArr.length > 0) this.atrCache.set(cachedAtrKey, atrArr[atrArr.length - 1]!)
            }

            const signals = analyzeTier1(
              pair,
              primaryCandles,
              secondaryCandles,
              htfCandles,
              profile,
              config.enabledTechniques as Record<AiTraderTechnique, boolean>,
              filterStats,
              (inst) => this.getLiveSpread(inst),
              allNearMisses,
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
          // Persist filter diagnostics so we can analyze why signals are being filtered
          filterLowVol: filterStats.lowVolatility,
          filterNoSignal: filterStats.noReasons,
          filterLowConfluence: filterStats.lowConfluence,
          filterSpread: filterStats.spreadTooWide,
          filterRR: filterStats.rrTooLow,
          filterHTF: filterStats.htfPenalized,
          filterRSI: filterStats.secondaryRsiPenalized,
          filterPassed: filterStats.passed,
          // Top 5 near-misses (closest to passing): helps diagnose why signals are filtered
          nearMisses: allNearMisses
            .sort((a, b) => b.rawRR - a.rawRR)
            .slice(0, 5)
            .map((nm) => ({
              pair: nm.instrument.replace("_", "/"),
              profile: nm.profile,
              dir: nm.direction,
              reason: nm.reason,
              rr: +nm.rawRR.toFixed(2),
              spread: +nm.spreadPips.toFixed(1),
              risk: +nm.riskPips.toFixed(1),
              atr: +nm.atrPips.toFixed(1),
            })),
        },
      )
      console.log(`[ai-trader] Tier 1 found ${allSignals.length} candidates`)

      // Persist the top-20 near-misses (closest to passing by raw R:R) to
      // AiTraderNearMiss so we can tune thresholds from historical data
      // instead of the in-memory ring buffer that evaporates on restart.
      // Fire-and-forget — never blocks the scan cycle.
      const topNearMisses = [...allNearMisses].sort((a, b) => b.rawRR - a.rawRR).slice(0, 20)
      if (topNearMisses.length > 0) {
        void (async () => {
          for (const nm of topNearMisses) {
            await createNearMiss({
              instrument: nm.instrument,
              direction: nm.direction,
              profile: nm.profile,
              confidence: nm.confidence,
              blockingFilter: nm.reason,
              reason: `${nm.reason} (R:R ${nm.rawRR.toFixed(2)}, spread ${nm.spreadPips.toFixed(1)}p)`,
              metadata: nm,
            })
          }
        })().catch((err) =>
          console.warn("[ai-trader] near-miss persistence failed:", (err as Error).message),
        )
      }

      allSignals.sort((a, b) => b.confidence - a.confidence)

      // ─── Technique diversity: cap how many candidates from the same
      // primaryTechnique can advance to Tier 2. Post-mortem showed 14/15
      // trades used smc_structure — zero diversity. Cap at 3 per technique
      // so other techniques get a chance even when SMC scores highest.
      const MAX_PER_TECHNIQUE = 3
      const techniqueCounts = new Map<string, number>()
      const diversified = allSignals.filter((sig) => {
        const count = techniqueCounts.get(sig.primaryTechnique) ?? 0
        if (count >= MAX_PER_TECHNIQUE) return false
        techniqueCounts.set(sig.primaryTechnique, count + 1)
        return true
      })

      // ─── Correlation guard: limit same-currency same-direction ──
      const filtered = filterCorrelatedCandidates(diversified, 2)
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
    // Tier 2 with prompt caching. The TIER2 system prompt is stable across
    // every scan (only the user message varies per candidate), so marking it
    // as a cacheable content block gives ~90% discount on cached input.
    // Within a single scan we call Tier 2 many times back-to-back — the
    // second and later calls should hit the cache.
    const tier2Response = await anthropic.messages.create({
      model: config.scanModel || "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: [
        {
          type: "text" as const,
          text: tier2Prompt.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: tier2Prompt.user }],
    })

    const tier2Text = tier2Response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const tier2InputTokens = tier2Response.usage.input_tokens
    const tier2OutputTokens = tier2Response.usage.output_tokens
    const tier2UsageWithCache = tier2Response.usage as typeof tier2Response.usage & {
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    const tier2CacheRead = tier2UsageWithCache.cache_read_input_tokens ?? 0
    const tier2CacheWrite = tier2UsageWithCache.cache_creation_input_tokens ?? 0
    const tier2Model = config.scanModel || "claude-haiku-4-5-20251001"
    const tier2Cost = getModelCost(tier2Model, tier2InputTokens, tier2OutputTokens)

    this.costTracker.invalidateCache()

    // Helper to persist tier2 cost on any exit path. Every rejection row MUST
    // carry an `entryRationale` explaining WHY so post-mortem analysis can
    // distinguish prompt-bias rejections from legitimate filter blocks.
    //
    // `tier2Confidence` / `tier2Passed` come from the parsed Tier 2 response
    // when available. The parse-error path has neither (Haiku returned garbage),
    // so both are undefined there.
    const recordTier2Only = async (
      status: "rejected" | "detected",
      rationale: string,
      tier2Info?: { confidence: number; passed: boolean },
    ) => {
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
        entryRationale: rationale,
        technicalSnapshot: signal.technicalSnapshot,
      })
      await updateOpportunityStatus(opp.id, status, {
        tier2Response: tier2Text,
        tier2Model,
        tier2InputTokens,
        tier2OutputTokens,
        tier2Cost,
        tier2Confidence: tier2Info?.confidence,
        tier2Passed: tier2Info?.passed,
        tier2DecidedAt: new Date(),
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
      await recordTier2Only("rejected", `Tier 2 returned invalid JSON: ${tier2Text.slice(0, 150)}`)
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
      await recordTier2Only(
        "rejected",
        `Tier 2 rejected (${tier2Result.confidence}%): ${tier2Result.reason}`,
        { confidence: tier2Result.confidence, passed: false },
      )
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
      // Check both open trades AND pending orders to prevent duplicate placements
      return (
        positions.open.some((t) => t.instrument === inst) ||
        positions.pending.some((o) => o.instrument === inst)
      )
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
        entryRationale: preTier3.reason ?? "Pre-Tier-3 gate blocked (unspecified)",
        technicalSnapshot: signal.technicalSnapshot,
      })
      // Record tier2 cost on gate-blocked opportunities. Note that Tier 2
      // itself passed here — it's only the Pre-Tier-3 risk gate that blocked.
      await updateOpportunityStatus(gateOpp.id, "rejected", {
        tier2Response: tier2Text,
        tier2Model,
        tier2InputTokens,
        tier2OutputTokens,
        tier2Cost,
        tier2Confidence: tier2Result.confidence,
        tier2Passed: true,
        tier2DecidedAt: new Date(),
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
      consecutiveLosses: this.circuitBreaker.getState().consecutiveLosses,
      pairProfileWinRate,
    }

    const tier3Prompt = buildTier3Prompt(tier3Ctx)

    // Tier 3 with prompt caching — same pattern as Tier 2.
    const tier3Response = await anthropic.messages.create({
      model: config.decisionModel || "claude-sonnet-4-6",
      max_tokens: 1500,
      system: [
        {
          type: "text" as const,
          text: tier3Prompt.system,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: tier3Prompt.user }],
    })

    const tier3Text = tier3Response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const tier3InputTokens = tier3Response.usage.input_tokens
    const tier3OutputTokens = tier3Response.usage.output_tokens
    const tier3UsageWithCache = tier3Response.usage as typeof tier3Response.usage & {
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    const tier3CacheRead = tier3UsageWithCache.cache_read_input_tokens ?? 0
    const tier3CacheWrite = tier3UsageWithCache.cache_creation_input_tokens ?? 0
    const tier3Model = config.decisionModel || "claude-sonnet-4-6"
    if (tier2CacheRead > 0 || tier3CacheRead > 0) {
      this.addLogEntry(
        "tier3_pass",
        `${pairLabel}: cache hits — T2 ${tier2CacheRead}r/${tier2CacheWrite}w, T3 ${tier3CacheRead}r/${tier3CacheWrite}w tokens`,
      )
    }
    const tier3Cost = getModelCost(tier3Model, tier3InputTokens, tier3OutputTokens)

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

    // ─── Validate Tier 3 adjustments are within reasonable bounds ───────
    const atr = signal.technicalSnapshot.atr ?? getPipSize(signal.instrument) * 20
    const maxAdjustmentDistance = atr * 3 // Max 3x ATR from original levels

    let entryPrice = tier3Result.adjustedEntry ?? signal.entryPrice
    let stopLoss = tier3Result.adjustedSL ?? signal.suggestedSL
    let takeProfit = tier3Result.adjustedTP ?? signal.suggestedTP

    // Reject unreasonable Tier 3 adjustments and fall back to Tier 1 levels
    if (tier3Result.adjustedEntry !== null) {
      if (Math.abs(tier3Result.adjustedEntry - signal.entryPrice) > maxAdjustmentDistance) {
        console.warn(`[ai-trader] Tier 3 adjusted entry too far from original — ignoring`)
        entryPrice = signal.entryPrice
      }
    }
    if (tier3Result.adjustedSL !== null) {
      const slDistance = Math.abs(entryPrice - tier3Result.adjustedSL)
      if (slDistance < atr * 0.3 || slDistance > atr * 5) {
        console.warn(
          `[ai-trader] Tier 3 adjusted SL unreasonable (${slDistance.toFixed(5)} vs ATR ${atr.toFixed(5)}) — ignoring`,
        )
        stopLoss = signal.suggestedSL
      }
    }
    if (tier3Result.adjustedTP !== null) {
      if (Math.abs(tier3Result.adjustedTP - entryPrice) > maxAdjustmentDistance * 3) {
        console.warn(`[ai-trader] Tier 3 adjusted TP too far — ignoring`)
        takeProfit = signal.suggestedTP
      }
    }

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

    // Deterministic position sizing — shared helper from @fxflow/shared/trading-core.
    // Handles USD-quoted + non-USD-quoted pip value conversion uniformly.
    //
    // Volatility-adjusted scaling: swing/intraday in ranging/volatile regimes
    // get smaller position sizes because wider SLs mean more absolute $$$ at
    // risk. Without this, a 100-pip swing SL and a 15-pip scalp SL both risk
    // 1% of account — but the swing trade's loss is 6× larger in dollars.
    const REGIME_SIZE_SCALE: Record<string, number> = {
      trending: 1.0,
      ranging: 0.75,
      volatile: 0.7,
      low_volatility: 0.8,
    }
    const regimeScale = REGIME_SIZE_SCALE[signal.technicalSnapshot.regime ?? ""] ?? 1.0
    const adjustedRiskPercent = riskPercent * regimeScale

    const pipSize = getPipSize(signal.instrument)
    const riskPipsForSizing = Math.abs(entryPrice - stopLoss) / pipSize
    const positionSize = calculatePositionSize({
      mode: "risk_percent",
      riskPercent: adjustedRiskPercent,
      accountBalance,
      instrument: signal.instrument,
      riskPips: riskPipsForSizing,
      entryPrice,
    })

    if (positionSize <= 1) {
      console.warn(`[ai-trader] Position size at floor for ${signal.instrument} — skipping`)
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

    // Update with tier data and final status. Tier 2 passed (otherwise we
    // wouldn't have gotten here), so `tier2Passed: true` is always correct.
    await updateOpportunityStatus(opportunity.id, tier3Result.execute ? "suggested" : "rejected", {
      tier2Response: tier2Text,
      tier2Model: tier2Model,
      tier2InputTokens,
      tier2OutputTokens,
      tier2Cost,
      tier2Confidence: tier2Result.confidence,
      tier2Passed: true,
      tier2DecidedAt: new Date(),
      tier3Response: tier3Text,
      tier3Model: config.decisionModel || "claude-sonnet-4-6",
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
    const postTier3 = this.executionGate.postTier3Check(
      config,
      tier3Result.confidence,
      signal.technicalSnapshot.regime,
    )
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
        tier3Model: config.decisionModel || "claude-sonnet-4-6",
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
      tier3Model: config.decisionModel || "claude-sonnet-4-6",
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
      "EdgeFinder Opportunity",
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

    // Re-validate live spread before placement — reject if spread has widened excessively
    const { spreadPips, source } = this.getLiveSpread(opp.instrument)
    const riskPips = opp.riskPips
    if (riskPips > 0 && spreadPips > riskPips * 0.5) {
      console.warn(
        `[ai-trader] Spread widened before placement: ${spreadPips.toFixed(1)} pips (${source}) > 50% of ${riskPips.toFixed(1)} pip risk — aborting ${pairLabel}`,
      )
      this.addLogEntry(
        "trade_rejected",
        `${pairLabel}: Spread widened to ${spreadPips.toFixed(1)} pips before placement — order aborted`,
        `Spread source: ${source}, risk: ${riskPips.toFixed(1)} pips`,
      )
      await updateOpportunityStatus(opp.id, "rejected")
      return
    }

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
        notes: `EdgeFinder Trade | Profile: ${opp.profile} | Confidence: ${opp.confidence}% | ${opp.entryRationale?.slice(0, 100) ?? ""}`,
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
        "EdgeFinder Trade Placed",
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

/** Look up per-model token pricing from AI_MODEL_OPTIONS. Falls back to Sonnet pricing if unknown. */
function getModelCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = AI_MODEL_OPTIONS.find((m) => modelId.includes(m.id) || m.id.includes(modelId))
  const inputCost = model?.inputCostPer1M ?? 3 // Sonnet fallback
  const outputCost = model?.outputCostPer1M ?? 15
  return (inputTokens * inputCost + outputTokens * outputCost) / 1_000_000
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
