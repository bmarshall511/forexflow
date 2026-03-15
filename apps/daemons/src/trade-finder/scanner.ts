import type {
  TradeFinderConfigData,
  TradeFinderPairConfig,
  TradeFinderSetupData,
  TradeFinderScanStatus,
  TradeFinderScoreBreakdown,
  TradeFinderAutoTradeEvent,
  TradeFinderCapUtilization,
  TradeDirection,
  ZoneData,
  TrendData,
  CurveData,
  AnyDaemonMessage,
  PlaceOrderResponseData,
  Timeframe,
} from "@fxflow/types"
import { TIMEFRAME_SET_MAP, SCAN_INTERVAL_MAP } from "@fxflow/types"
import {
  detectZones,
  detectTrend,
  computeATR,
  getPresetConfig,
  isMarketExpectedOpen,
  getCorrelation,
  getPipSize,
} from "@fxflow/shared"
import {
  getTradeFinderConfig,
  getActiveSetups,
  createSetup,
  updateSetupStatus,
  updateSetupScores,
  findExistingSetup,
  pruneSetupHistory,
  countPendingAutoPlaced,
  countAutoPlacedToday,
  getAutoPlacedTotalRiskPips,
  findSetupByResultSourceId,
  getPlacedAutoSetups,
  updateSetupSkipReason,
  getSetup,
  type CreateSetupInput,
} from "@fxflow/db"
import type { StateManager } from "../state-manager.js"
import type { NotificationEmitter } from "../notification-emitter.js"
import { getRestUrl } from "../oanda/api-client.js"
import { CandleCache, fetchOandaCandles } from "./candle-cache.js"
import { computeQueuePositions } from "./auto-trade-queue.js"

const CANDLE_COUNT_MAP: Record<string, number> = {
  M1: 500,
  M5: 500,
  M15: 300,
  M30: 300,
  H1: 200,
  H4: 200,
  D: 120,
  W: 104,
  M: 60,
}

/** Callback for placing an order (provided by server.ts) */
export interface AutoTradePlaceOrderFn {
  (request: {
    instrument: string
    direction: TradeDirection
    orderType: "LIMIT"
    units: number
    entryPrice: number
    stopLoss: number
    takeProfit: number
    timeframe: Timeframe | null
    placedVia: "trade_finder_auto"
  }): Promise<PlaceOrderResponseData>
}

/** Callback for cancelling a pending order */
export interface AutoTradeCancelOrderFn {
  (sourceOrderId: string, reason: string): Promise<void>
}

/** Callback for checking if an instrument has an existing open trade or pending order */
export interface HasExistingPositionFn {
  (instrument: string): boolean
}

/** Callback for getting all pending order source IDs (for fill/cancel detection) */
export interface GetPendingOrderIdsFn {
  (): Set<string>
}

/** Callback for getting all open trade source IDs (for fill detection) */
export interface GetOpenTradeIdsFn {
  (): Set<string>
}

const MAX_AUTO_TRADE_EVENTS = 50

export class TradeFinderScanner {
  private stateManager: StateManager
  private broadcast: (msg: AnyDaemonMessage) => void
  private cache = new CandleCache()
  private timer: ReturnType<typeof setTimeout> | null = null
  private scanning = false
  private lastScanAt: string | null = null
  private nextScanAt: string | null = null
  private pairsScanned = 0
  private totalPairs = 0
  private activeSetupCount = 0
  private lastError: string | null = null

  // Auto-trade dependencies (set externally after construction)
  private placeOrderFn: AutoTradePlaceOrderFn | null = null
  private cancelOrderFn: AutoTradeCancelOrderFn | null = null
  private hasExistingPositionFn: HasExistingPositionFn | null = null
  private getPendingOrderIdsFn: GetPendingOrderIdsFn | null = null
  private getOpenTradeIdsFn: GetOpenTradeIdsFn | null = null

  // Notification emitter (set externally)
  private notificationEmitter: NotificationEmitter | null = null

  // Auto-trade activity event ring buffer
  private autoTradeEvents: TradeFinderAutoTradeEvent[] = []

  // Queue positions computed after each scan (setupId → 1-indexed position)
  private queuePositions = new Map<string, number>()

  constructor(stateManager: StateManager, broadcast: (msg: AnyDaemonMessage) => void) {
    this.stateManager = stateManager
    this.broadcast = broadcast
  }

  /** Set notification emitter for persisted auto-trade notifications */
  setNotificationEmitter(emitter: NotificationEmitter): void {
    this.notificationEmitter = emitter
  }

  /** Set auto-trade callbacks (called from index.ts after tradeSyncer is available) */
  setAutoTradeCallbacks(
    placeOrder: AutoTradePlaceOrderFn,
    cancelOrder: AutoTradeCancelOrderFn,
    hasExistingPosition: HasExistingPositionFn,
    getPendingOrderIds: GetPendingOrderIdsFn,
    getOpenTradeIds: GetOpenTradeIdsFn,
  ): void {
    this.placeOrderFn = placeOrder
    this.cancelOrderFn = cancelOrder
    this.hasExistingPositionFn = hasExistingPosition
    this.getPendingOrderIdsFn = getPendingOrderIds
    this.getOpenTradeIdsFn = getOpenTradeIds
  }

  async start(): Promise<void> {
    console.log("[trade-finder] Scanner started")
    // Initial scan after a short delay
    this.scheduleScan(5_000)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    console.log("[trade-finder] Scanner stopped")
  }

  private scheduleScan(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.nextScanAt = new Date(Date.now() + delayMs).toISOString()
    this.timer = setTimeout(() => void this.runScan(), delayMs)
  }

  private async runScan(): Promise<void> {
    if (this.scanning) return

    try {
      const config = await getTradeFinderConfig()
      if (!config.enabled) {
        this.scheduleScan(60_000) // Check again in 1 min
        return
      }

      // Auto-pause when market is closed
      if (!isMarketExpectedOpen(new Date())) {
        this.scheduleScan(60_000)
        return
      }

      const creds = this.stateManager.getCredentials()
      if (!creds) {
        this.scheduleScan(30_000)
        return
      }

      this.scanning = true
      this.lastError = null
      this.broadcastScanStatus()

      const enabledPairs = config.pairs.filter((p) => p.enabled)
      this.totalPairs = enabledPairs.length
      this.pairsScanned = 0

      const apiUrl = getRestUrl(creds.mode)
      const riskPercent = config.riskPercent

      // Get account balance for position sizing
      const snapshot = this.stateManager.getSnapshot()
      const balance = snapshot.accountOverview?.summary.balance ?? 0

      for (const pair of enabledPairs) {
        try {
          await this.scanPair(pair, config, apiUrl, creds.token, riskPercent, balance)
        } catch (err) {
          console.warn(`[trade-finder] Error scanning ${pair.instrument}:`, err)
        }
        this.pairsScanned++

        // Small delay between pairs to avoid rate limiting
        if (this.pairsScanned < this.totalPairs) {
          await sleep(500)
        }
      }

      // Check existing setups for invalidation
      await this.validateExistingSetups(config, apiUrl, creds.token)

      // Compute queue positions and broadcast cap utilization
      await this.computeAndBroadcastQueue()
      await this.broadcastCapUtilization()

      // Prune old history
      await pruneSetupHistory(200)

      this.lastScanAt = new Date().toISOString()
      this.activeSetupCount = (await getActiveSetups()).length

      // Determine next scan interval (use shortest TF set interval from enabled pairs)
      const minInterval =
        Math.min(...enabledPairs.map((p) => SCAN_INTERVAL_MAP[p.timeframeSet])) * 60_000

      this.scheduleScan(minInterval)
    } catch (err) {
      console.error("[trade-finder] Scan error:", err)
      this.lastError = err instanceof Error ? err.message : "Scan failed"
      this.scheduleScan(60_000) // Retry in 1 min
    } finally {
      this.scanning = false
      this.broadcastScanStatus()
    }
  }

  private async scanPair(
    pair: TradeFinderPairConfig,
    config: TradeFinderConfigData,
    apiUrl: string,
    token: string,
    riskPercent: number,
    accountBalance: number,
  ): Promise<void> {
    const { htf, mtf, ltf } = TIMEFRAME_SET_MAP[pair.timeframeSet]
    const instrument = pair.instrument
    const zoneConfig = getPresetConfig("standard")

    // 1. Fetch candles for all 3 timeframes
    const [htfCandles, mtfCandles, ltfCandles] = await Promise.all([
      fetchOandaCandles(instrument, htf, CANDLE_COUNT_MAP[htf] ?? 200, apiUrl, token, this.cache),
      fetchOandaCandles(instrument, mtf, CANDLE_COUNT_MAP[mtf] ?? 200, apiUrl, token, this.cache),
      fetchOandaCandles(instrument, ltf, CANDLE_COUNT_MAP[ltf] ?? 300, apiUrl, token, this.cache),
    ])

    if (ltfCandles.length === 0 || mtfCandles.length === 0) return

    const currentPrice = ltfCandles[ltfCandles.length - 1]!.close

    // 2. HTF: Detect zones → build curve
    let curveData: CurveData | null = null
    if (htfCandles.length > 0) {
      const htfResult = detectZones(htfCandles, instrument, htf, zoneConfig, currentPrice)
      curveData = this.buildCurve(htfResult.zones, currentPrice)
    }

    // 3. MTF: Detect trend
    const trendData = detectTrend(
      mtfCandles,
      instrument,
      mtf,
      { swingStrength: 5, minSegmentAtr: 0.5, maxSwingPoints: 20, lookbackCandles: 500 },
      currentPrice,
    )

    // 4. LTF: Detect zones
    const ltfResult = detectZones(ltfCandles, instrument, ltf, zoneConfig, currentPrice)
    if (ltfResult.zones.length === 0) return

    // 5. Fetch commodity zones if correlated
    let commodityZones: ZoneData[] | null = null
    const correlation = getCorrelation(instrument)
    if (correlation) {
      const commCandles = await fetchOandaCandles(
        correlation.commodity,
        htf,
        CANDLE_COUNT_MAP[htf] ?? 200,
        apiUrl,
        token,
        this.cache,
      )
      if (commCandles.length > 0) {
        const commPrice = commCandles[commCandles.length - 1]!.close
        const commResult = detectZones(
          commCandles,
          correlation.commodity,
          htf,
          zoneConfig,
          commPrice,
        )
        commodityZones = commResult.zones
      }
    }

    // 6. Score each LTF zone with extended scoring
    const pipSize = getPipSize(instrument)
    const atrArr = computeATR(ltfCandles, 14)
    const atr = atrArr.length > 0 ? atrArr[atrArr.length - 1]! : 0
    const spread = pipSize * 2 // Approximate spread

    for (const zone of ltfResult.zones) {
      // Only consider active, untested zones
      if (zone.status !== "active" || zone.testCount > 0) continue

      // Build direction from zone type
      const direction: TradeDirection = zone.type === "demand" ? "long" : "short"

      // Check if this setup already exists
      const existing = await findExistingSetup(instrument, direction, pair.timeframeSet)
      if (existing) continue

      // Extended scoring
      const extendedScores = this.computeExtendedScores(
        zone,
        ltfResult.zones,
        trendData,
        curveData,
        commodityZones,
      )
      if (extendedScores.total < config.minScore) continue

      // Compute SL/TP
      const slBuffer = atr * 0.02 + spread
      const stopLoss =
        zone.type === "demand" ? zone.distalLine - slBuffer : zone.distalLine + slBuffer
      const riskPips = Math.abs(zone.proximalLine - stopLoss) / pipSize

      // Find TP: opposing fresh zone or 2:1 fallback
      const opposingType = zone.type === "demand" ? "supply" : "demand"
      const freshOpposing = ltfResult.zones
        .filter((z) => z.type === opposingType && z.status === "active" && z.testCount === 0)
        .sort((a, b) => {
          if (zone.type === "demand") return a.proximalLine - b.proximalLine
          return b.proximalLine - a.proximalLine
        })

      let takeProfit: number
      if (freshOpposing.length > 0) {
        takeProfit =
          zone.type === "demand"
            ? freshOpposing[0]!.proximalLine - spread
            : freshOpposing[0]!.proximalLine + spread
      } else {
        // 2:1 fallback
        const riskDistance = Math.abs(zone.proximalLine - stopLoss)
        takeProfit =
          zone.type === "demand"
            ? zone.proximalLine + riskDistance * 2
            : zone.proximalLine - riskDistance * 2
      }

      const rewardPips = Math.abs(takeProfit - zone.proximalLine) / pipSize
      const rrRatio = riskPips > 0 ? (rewardPips / riskPips).toFixed(1) + ":1" : "0:1"

      // Position sizing: risk% of balance / risk in account currency
      const positionSize = this.calculatePositionSize(
        accountBalance,
        riskPercent,
        riskPips,
        pipSize,
        instrument,
      )

      if (positionSize <= 0) continue

      const distanceToEntry = Math.abs(currentPrice - zone.proximalLine) / pipSize

      const setupInput: CreateSetupInput = {
        instrument,
        direction,
        timeframeSet: pair.timeframeSet,
        entryPrice: zone.proximalLine,
        stopLoss,
        takeProfit,
        riskPips,
        rewardPips,
        rrRatio,
        positionSize,
        scores: extendedScores,
        zone,
        trendData,
        curveData,
        distanceToEntryPips: distanceToEntry,
      }

      const setup = await createSetup(setupInput)
      this.activeSetupCount++

      this.broadcast({
        type: "trade_finder_setup_found",
        timestamp: new Date().toISOString(),
        data: setup,
      })

      console.log(
        `[trade-finder] New setup: ${instrument} ${direction} (score: ${extendedScores.total}/12, R:R ${rrRatio})`,
      )

      // ── Auto-trade: attempt to place if eligible ──
      if (config.autoTradeEnabled && pair.autoTradeEnabled !== false) {
        await this.tryAutoPlace(setup, config, pair)
      }
    }
  }

  // ─── Auto-Trade Logic ──────────────────────────────────────────────────────

  private async tryAutoPlace(
    setup: TradeFinderSetupData,
    config: TradeFinderConfigData,
    _pair: TradeFinderPairConfig,
  ): Promise<void> {
    if (!this.placeOrderFn) {
      await this.skipAutoTrade(setup, "Trade syncer not available")
      return
    }

    // 1. Score threshold check
    if (setup.scores.total < config.autoTradeMinScore) {
      await this.skipAutoTrade(
        setup,
        `Score ${setup.scores.total} below auto-trade threshold ${config.autoTradeMinScore}`,
      )
      return
    }

    // 1b. Minimum R:R check
    const rrNum = parseFloat(setup.rrRatio) // e.g. "2.1:1" → 2.1
    if (!isNaN(rrNum) && rrNum < config.autoTradeMinRR) {
      await this.skipAutoTrade(
        setup,
        `R:R ${setup.rrRatio} below minimum ${config.autoTradeMinRR}:1`,
      )
      return
    }

    // 2. Same-instrument guard — skip if existing open trade or pending order
    if (this.hasExistingPositionFn && this.hasExistingPositionFn(setup.instrument)) {
      await this.skipAutoTrade(setup, `Existing position on ${setup.instrument}`)
      return
    }

    // 3. Max concurrent check
    const pendingCount = await countPendingAutoPlaced()
    if (pendingCount >= config.autoTradeMaxConcurrent) {
      await this.skipAutoTrade(
        setup,
        `Max concurrent auto-trades reached (${pendingCount}/${config.autoTradeMaxConcurrent})`,
      )
      return
    }

    // 4. Max daily check
    const dailyCount = await countAutoPlacedToday()
    if (dailyCount >= config.autoTradeMaxDaily) {
      await this.skipAutoTrade(
        setup,
        `Max daily auto-trades reached (${dailyCount}/${config.autoTradeMaxDaily})`,
      )
      return
    }

    // 5. Max total risk % check
    const snapshot = this.stateManager.getSnapshot()
    const balance = snapshot.accountOverview?.summary.balance ?? 0
    if (balance > 0) {
      const existingRiskEntries = await getAutoPlacedTotalRiskPips()
      let totalRiskDollars = 0
      for (const entry of existingRiskEntries) {
        const ps = getPipSize(entry.instrument)
        totalRiskDollars += entry.positionSize * entry.riskPips * ps
      }
      // Add this setup's risk
      const thisRiskDollars = setup.positionSize * setup.riskPips * getPipSize(setup.instrument)
      totalRiskDollars += thisRiskDollars
      const totalRiskPercent = (totalRiskDollars / balance) * 100
      if (totalRiskPercent > config.autoTradeMaxRiskPercent) {
        await this.skipAutoTrade(
          setup,
          `Total risk ${totalRiskPercent.toFixed(1)}% exceeds cap ${config.autoTradeMaxRiskPercent}%`,
        )
        return
      }
    }

    // All checks passed — place the order (with single retry for transient errors)
    try {
      const tfMap = TIMEFRAME_SET_MAP[setup.timeframeSet]
      const ltfTimeframe = (tfMap?.ltf ?? null) as Timeframe | null

      const orderRequest = {
        instrument: setup.instrument,
        direction: setup.direction,
        orderType: "LIMIT" as const,
        units: setup.positionSize,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        takeProfit: setup.takeProfit,
        timeframe: ltfTimeframe,
        placedVia: "trade_finder_auto" as const,
      }

      let result: PlaceOrderResponseData
      try {
        result = await this.placeOrderFn(orderRequest)
      } catch (firstErr) {
        // Retry once on transient errors (5xx, timeouts, network)
        if (isTransientError(firstErr)) {
          console.warn(
            `[trade-finder] Transient error placing ${setup.instrument}, retrying in 2s...`,
          )
          await sleep(2000)
          result = await this.placeOrderFn(orderRequest)
        } else {
          throw firstErr
        }
      }

      await updateSetupStatus(setup.id, "placed", {
        resultSourceId: result.sourceId,
        autoPlaced: true,
      })

      const now = new Date().toISOString()
      this.broadcast({
        type: "trade_finder_auto_trade_placed",
        timestamp: now,
        data: {
          setupId: setup.id,
          instrument: setup.instrument,
          direction: setup.direction,
          orderType: "LIMIT",
          entryPrice: setup.entryPrice,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          positionSize: setup.positionSize,
          score: setup.scores.total,
          sourceId: result.sourceId,
        },
      })

      this.pushAutoTradeEvent({
        type: "placed",
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        score: setup.scores.total,
        sourceId: result.sourceId,
        entryPrice: setup.entryPrice,
        timestamp: now,
      })

      console.log(
        `[trade-finder] AUTO-PLACED: ${setup.instrument} ${setup.direction} LIMIT @ ${setup.entryPrice} (score: ${setup.scores.total})`,
      )
      const pair = setup.instrument.replace("_", "/")
      const dir = setup.direction === "long" ? "Long" : "Short"
      void this.notificationEmitter?.emitTradeFinder(
        "Auto-Trade Placed",
        `${pair} ${dir} LIMIT @ ${setup.entryPrice.toFixed(5)} (score ${setup.scores.total}/12)`,
      )
    } catch (err) {
      const reason = `Placement failed: ${(err as Error).message}`
      console.error(`[trade-finder] Auto-trade placement failed for ${setup.instrument}:`, err)
      this.broadcastAutoTradeSkipped(setup, reason)
      void this.notificationEmitter?.emitTradeFinder(
        "Auto-Trade Failed",
        `${setup.instrument.replace("_", "/")} — ${(err as Error).message}`,
        "warning",
      )
      this.pushAutoTradeEvent({
        type: "failed",
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        score: setup.scores.total,
        reason,
        timestamp: new Date().toISOString(),
      })
    }
  }

  /** Broadcast skip + persist reason to DB for UI display */
  private async skipAutoTrade(setup: TradeFinderSetupData, reason: string): Promise<void> {
    this.broadcastAutoTradeSkipped(setup, reason)
    await updateSetupSkipReason(setup.id, reason).catch(() => {})
  }

  private broadcastAutoTradeSkipped(setup: TradeFinderSetupData, reason: string): void {
    const now = new Date().toISOString()
    console.log(`[trade-finder] Auto-trade skipped: ${setup.instrument} — ${reason}`)
    this.broadcast({
      type: "trade_finder_auto_trade_skipped",
      timestamp: now,
      data: {
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        score: setup.scores.total,
        reason,
      },
    })
    this.pushAutoTradeEvent({
      type: "skipped",
      setupId: setup.id,
      instrument: setup.instrument,
      direction: setup.direction,
      score: setup.scores.total,
      reason,
      timestamp: now,
    })
  }

  // ─── Scoring ───────────────────────────────────────────────────────────────

  private computeExtendedScores(
    zone: ZoneData,
    allZones: ZoneData[],
    trendData: TrendData | null,
    curveData: CurveData | null,
    commodityZones: ZoneData[] | null,
  ): TradeFinderScoreBreakdown {
    const { strength, time, freshness } = zone.scores

    const trend = this.scoreTrend(zone.type as "demand" | "supply", trendData)
    const curve = this.scoreCurve(zone.type as "demand" | "supply", curveData)
    const profitZone = this.scoreProfitZone(zone, allZones)
    const commodityCorrelation = this.scoreCommodity(
      zone.instrument,
      zone.type as "demand" | "supply",
      commodityZones,
    )

    const total =
      strength.value +
      time.value +
      freshness.value +
      trend.value +
      curve.value +
      profitZone.value +
      commodityCorrelation.value

    return {
      strength,
      time,
      freshness,
      trend,
      curve,
      profitZone,
      commodityCorrelation,
      total,
      maxPossible: 12,
    }
  }

  private scoreTrend(zoneType: "demand" | "supply", trendData: TrendData | null) {
    if (!trendData || !trendData.direction) {
      return { value: 0, max: 2, label: "Poor", explanation: "No trend detected" }
    }
    const aligned =
      (zoneType === "demand" && trendData.direction === "up") ||
      (zoneType === "supply" && trendData.direction === "down")

    if (!aligned) {
      return { value: 0, max: 2, label: "Poor", explanation: `Trend opposes ${zoneType} zone` }
    }
    if (trendData.status === "confirmed") {
      return {
        value: 2,
        max: 2,
        label: "Best",
        explanation: `Confirmed ${trendData.direction}trend aligns`,
      }
    }
    if (trendData.status === "forming") {
      return {
        value: 1,
        max: 2,
        label: "Good",
        explanation: `Forming ${trendData.direction}trend aligns`,
      }
    }
    return { value: 0, max: 2, label: "Poor", explanation: "Trend terminated" }
  }

  private scoreCurve(zoneType: "demand" | "supply", curveData: CurveData | null) {
    if (!curveData) {
      return { value: 0, max: 1, label: "Poor", explanation: "No curve data" }
    }
    const favorable =
      (zoneType === "demand" && (curveData.position === "low" || curveData.position === "below")) ||
      (zoneType === "supply" && (curveData.position === "high" || curveData.position === "above"))

    return favorable
      ? {
          value: 1,
          max: 1,
          label: "Best",
          explanation: `Price in ${curveData.position} — favorable`,
        }
      : {
          value: 0,
          max: 1,
          label: "Poor",
          explanation: `Price in ${curveData.position} — not ideal`,
        }
  }

  private scoreProfitZone(zone: ZoneData, allZones: ZoneData[]) {
    const pipSize = getPipSize(zone.instrument)
    const entry = zone.proximalLine
    const slDistance = Math.abs(entry - zone.distalLine)
    const riskPips = slDistance / pipSize
    if (riskPips === 0) return { value: 0, max: 3, label: "Poor", explanation: "Zero risk" }

    const opposingType = zone.type === "demand" ? "supply" : "demand"
    const fresh = allZones
      .filter((z) => z.type === opposingType && z.status === "active" && z.testCount === 0)
      .sort((a, b) =>
        zone.type === "demand" ? a.proximalLine - b.proximalLine : b.proximalLine - a.proximalLine,
      )

    let rewardPips: number
    let src: string
    if (fresh.length > 0) {
      rewardPips = Math.abs(fresh[0]!.proximalLine - entry) / pipSize
      src = "opposing zone"
    } else {
      rewardPips = riskPips * 2
      src = "2:1 fallback"
    }

    const rr = rewardPips / riskPips
    if (rr >= 3)
      return { value: 3, max: 3, label: "Best", explanation: `${rr.toFixed(1)}:1 to ${src}` }
    if (rr >= 2)
      return { value: 2, max: 3, label: "Good", explanation: `${rr.toFixed(1)}:1 to ${src}` }
    if (rr >= 1)
      return { value: 1, max: 3, label: "Fair", explanation: `${rr.toFixed(1)}:1 to ${src}` }
    return { value: 0, max: 3, label: "Poor", explanation: `${rr.toFixed(1)}:1 to ${src}` }
  }

  private scoreCommodity(
    instrument: string,
    zoneType: "demand" | "supply",
    commodityZones: ZoneData[] | null,
  ) {
    const correlation = getCorrelation(instrument)
    if (!correlation || !commodityZones) {
      return { value: 0, max: 1, label: "N/A", explanation: "No commodity correlation" }
    }
    const expectedType =
      correlation.direction === 1 ? zoneType : zoneType === "demand" ? "supply" : "demand"
    const aligned = commodityZones.some((z) => z.type === expectedType && z.status === "active")
    return aligned
      ? { value: 1, max: 1, label: "Best", explanation: `${correlation.commodity} confirms` }
      : { value: 0, max: 1, label: "Poor", explanation: `${correlation.commodity} not aligned` }
  }

  private buildCurve(zones: ZoneData[], currentPrice: number): CurveData | null {
    const bestSupply = zones
      .filter((z) => z.type === "supply")
      .sort((a, b) => b.scores.total - a.scores.total)[0]
    const bestDemand = zones
      .filter((z) => z.type === "demand")
      .sort((a, b) => b.scores.total - a.scores.total)[0]

    if (!bestSupply || !bestDemand) return null
    const top = bestSupply.distalLine
    const bottom = bestDemand.distalLine
    if (top <= bottom) return null

    const range = top - bottom
    const third = range / 3
    const highThreshold = top - third
    const lowThreshold = bottom + third

    type CurvePos = CurveData["position"]
    let position: CurvePos
    if (currentPrice > top) position = "above"
    else if (currentPrice < bottom) position = "below"
    else if (currentPrice >= highThreshold) position = "high"
    else if (currentPrice <= lowThreshold) position = "low"
    else position = "middle"

    return {
      supplyDistal: top,
      demandDistal: bottom,
      highThreshold,
      lowThreshold,
      position,
      supplyZone: bestSupply,
      demandZone: bestDemand,
      timeframe: bestSupply.timeframe,
      opacity: 0.15,
      showAxisLabel: false,
    }
  }

  private calculatePositionSize(
    balance: number,
    riskPercent: number,
    riskPips: number,
    pipSize: number,
    _instrument: string,
  ): number {
    if (riskPips <= 0 || balance <= 0) return 0

    const riskAmount = balance * (riskPercent / 100)
    const pipValue = pipSize * 100_000
    if (pipValue <= 0) return 0

    const units = Math.floor(riskAmount / ((riskPips * pipValue) / 100_000))
    return Math.max(0, units)
  }

  private async validateExistingSetups(
    config: TradeFinderConfigData,
    apiUrl: string,
    token: string,
  ): Promise<void> {
    // ── Phase 1: Check placed auto-trade setups for fills / external cancellations ──
    await this.checkPlacedSetups()

    // ── Phase 2: Validate active/approaching setups ──
    const setups = await getActiveSetups()

    for (const setup of setups) {
      const { ltf } = TIMEFRAME_SET_MAP[setup.timeframeSet]
      const candles = await fetchOandaCandles(
        setup.instrument,
        ltf,
        CANDLE_COUNT_MAP[ltf] ?? 300,
        apiUrl,
        token,
        this.cache,
      )
      if (candles.length === 0) continue

      const currentPrice = candles[candles.length - 1]!.close
      const pipSize = getPipSize(setup.instrument)
      const distanceToEntry = Math.abs(currentPrice - setup.entryPrice) / pipSize

      // Check if zone has been invalidated (price broke through distal)
      const zone = setup.zone
      const invalidated =
        zone.type === "demand" ? currentPrice < zone.distalLine : currentPrice > zone.distalLine

      if (invalidated) {
        // Auto-cancel pending order if this was auto-placed and config says to cancel
        if (setup.autoPlaced && setup.resultSourceId && config.autoTradeCancelOnInvalidation) {
          await this.autoCancelOrder(setup, "Zone invalidated — price broke through distal line")
        }

        await updateSetupStatus(setup.id, "invalidated")
        this.broadcast({
          type: "trade_finder_setup_removed",
          timestamp: new Date().toISOString(),
          data: { setupId: setup.id, instrument: setup.instrument, reason: "Zone invalidated" },
        })
        continue
      }

      // Check if approaching
      const atrArr2 = computeATR(candles, 14)
      const atrVal = atrArr2.length > 0 ? atrArr2[atrArr2.length - 1]! : 0
      const approachingDistance = (atrVal * config.approachingAtrMultiple) / pipSize
      const newStatus = distanceToEntry <= approachingDistance ? "approaching" : "active"

      if (newStatus !== setup.status || Math.abs(distanceToEntry - setup.distanceToEntryPips) > 1) {
        await updateSetupScores(setup.id, setup.scores, distanceToEntry, setup.positionSize)
        if (newStatus !== setup.status) {
          await updateSetupStatus(setup.id, newStatus, { distanceToEntry })

          const updatedSetup = { ...setup, status: newStatus, distanceToEntryPips: distanceToEntry }
          this.broadcast({
            type: "trade_finder_setup_updated",
            timestamp: new Date().toISOString(),
            data: updatedSetup as TradeFinderSetupData,
          })
        }
      }

      // Auto-trade: attempt to place existing setups that haven't been placed yet
      if (config.autoTradeEnabled && !setup.autoPlaced && !setup.resultSourceId) {
        const pair = config.pairs.find((p) => p.instrument === setup.instrument)
        if (pair && pair.autoTradeEnabled !== false) {
          await this.tryAutoPlace(setup, config, pair)
        }
      }
    }
  }

  /** Fallback: check "placed" auto-trade setups against live OANDA state to detect fills / external cancellations */
  private async checkPlacedSetups(): Promise<void> {
    if (!this.getPendingOrderIdsFn || !this.getOpenTradeIdsFn) return

    const placedSetups = await getPlacedAutoSetups()
    if (placedSetups.length === 0) return

    const pendingIds = this.getPendingOrderIdsFn()
    const openIds = this.getOpenTradeIdsFn()
    let slotOpened = false

    for (const setup of placedSetups) {
      const sourceId = setup.resultSourceId!

      // Still pending on OANDA — nothing to do
      if (pendingIds.has(sourceId)) continue

      // Filled — order is now an open trade
      if (openIds.has(sourceId)) {
        await this.transitionToFilled(setup)
        slotOpened = true
        continue
      }

      // Not in pending AND not in open — externally cancelled or filled & closed
      await updateSetupStatus(setup.id, "invalidated")
      slotOpened = true
      const now = new Date().toISOString()
      this.broadcast({
        type: "trade_finder_setup_removed",
        timestamp: now,
        data: {
          setupId: setup.id,
          instrument: setup.instrument,
          reason: "Order cancelled externally",
        },
      })
      this.pushAutoTradeEvent({
        type: "cancelled",
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        score: setup.scores.total,
        reason: "Order cancelled externally",
        sourceId,
        timestamp: now,
      })
      console.log(
        `[trade-finder] External cancellation detected: ${setup.instrument} order ${sourceId}`,
      )
    }

    // If a slot opened during validation, try to place the next queued setup
    // (only when not mid-scan — scan cycle handles it via validateExistingSetups)
    if (slotOpened && !this.scanning) {
      void this.tryPlaceNextQueued()
    }
  }

  /** Transition a setup from "placed" to "filled" */
  private async transitionToFilled(setup: TradeFinderSetupData): Promise<void> {
    await updateSetupStatus(setup.id, "filled")
    const now = new Date().toISOString()
    this.broadcast({
      type: "trade_finder_auto_trade_filled",
      timestamp: now,
      data: {
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        sourceId: setup.resultSourceId!,
        score: setup.scores.total,
      },
    })
    this.pushAutoTradeEvent({
      type: "filled",
      setupId: setup.id,
      instrument: setup.instrument,
      direction: setup.direction,
      score: setup.scores.total,
      sourceId: setup.resultSourceId!,
      timestamp: now,
    })
    console.log(
      `[trade-finder] AUTO-FILLED: ${setup.instrument} ${setup.direction} (order ${setup.resultSourceId})`,
    )
    const pair = setup.instrument.replace("_", "/")
    const dir = setup.direction === "long" ? "Long" : "Short"
    void this.notificationEmitter?.emitTradeFinder(
      "Auto-Trade Filled",
      `${pair} ${dir} order filled`,
    )
  }

  /** Auto-cancel a pending order on OANDA when the zone is invalidated */
  private async autoCancelOrder(setup: TradeFinderSetupData, reason: string): Promise<void> {
    if (!this.cancelOrderFn || !setup.resultSourceId) return

    try {
      await this.cancelOrderFn(setup.resultSourceId, reason)

      const now = new Date().toISOString()
      this.broadcast({
        type: "trade_finder_auto_trade_cancelled",
        timestamp: now,
        data: {
          setupId: setup.id,
          instrument: setup.instrument,
          reason,
          sourceOrderId: setup.resultSourceId,
        },
      })
      this.pushAutoTradeEvent({
        type: "cancelled",
        setupId: setup.id,
        instrument: setup.instrument,
        direction: setup.direction,
        score: setup.scores.total,
        reason,
        sourceId: setup.resultSourceId,
        timestamp: now,
      })

      console.log(
        `[trade-finder] AUTO-CANCELLED: ${setup.instrument} order ${setup.resultSourceId} — ${reason}`,
      )
      void this.notificationEmitter?.emitTradeFinder(
        "Auto-Trade Cancelled",
        `${setup.instrument.replace("_", "/")} — ${reason}`,
        "warning",
      )
      // Slot opened — try to place the next queued setup
      void this.tryPlaceNextQueued()
    } catch (err) {
      console.error(`[trade-finder] Failed to auto-cancel ${setup.resultSourceId}:`, err)
    }
  }

  // ─── Event-driven fill detection (called from daemon index.ts) ────────────

  /** Called when tradeSyncer.onOrderFilled fires — check if it's one of our setups */
  async onOrderFilled(sourceTradeId: string): Promise<void> {
    try {
      const setup = await findSetupByResultSourceId(sourceTradeId)
      if (setup && setup.status === "placed") {
        await this.transitionToFilled(setup)
        // Slot opened — try to place the next queued setup
        void this.tryPlaceNextQueued()
      }
    } catch (err) {
      console.warn("[trade-finder] Error checking order fill:", (err as Error).message)
    }
  }

  // ─── Auto-trade event ring buffer ─────────────────────────────────────────

  private pushAutoTradeEvent(event: TradeFinderAutoTradeEvent): void {
    this.autoTradeEvents.unshift(event)
    if (this.autoTradeEvents.length > MAX_AUTO_TRADE_EVENTS) {
      this.autoTradeEvents.length = MAX_AUTO_TRADE_EVENTS
    }
  }

  /** Get recent auto-trade events for the activity log */
  getAutoTradeEvents(): TradeFinderAutoTradeEvent[] {
    return this.autoTradeEvents
  }

  /** Clear auto-trade events ring buffer */
  clearAutoTradeEvents(): void {
    this.autoTradeEvents = []
  }

  getScanStatus(): TradeFinderScanStatus {
    return {
      isScanning: this.scanning,
      lastScanAt: this.lastScanAt,
      nextScanAt: this.nextScanAt,
      pairsScanned: this.pairsScanned,
      totalPairs: this.totalPairs,
      activeSetups: this.activeSetupCount,
      error: this.lastError,
    }
  }

  private broadcastScanStatus(): void {
    this.broadcast({
      type: "trade_finder_scan_status",
      timestamp: new Date().toISOString(),
      data: this.getScanStatus(),
    })
  }

  // ─── Cap Utilization ────────────────────────────────────────────────────────

  /** Get current auto-trade cap utilization snapshot */
  async getCapUtilization(): Promise<TradeFinderCapUtilization> {
    const config = await getTradeFinderConfig()
    const pendingCount = await countPendingAutoPlaced()
    const dailyCount = await countAutoPlacedToday()

    const snapshot = this.stateManager.getSnapshot()
    const balance = snapshot.accountOverview?.summary.balance ?? 0
    let usedRiskPercent = 0
    if (balance > 0) {
      const entries = await getAutoPlacedTotalRiskPips()
      let totalRiskDollars = 0
      for (const entry of entries) {
        totalRiskDollars += entry.positionSize * entry.riskPips * getPipSize(entry.instrument)
      }
      usedRiskPercent = (totalRiskDollars / balance) * 100
    }

    return {
      concurrent: { used: pendingCount, max: config.autoTradeMaxConcurrent },
      daily: { used: dailyCount, max: config.autoTradeMaxDaily },
      risk: {
        usedPercent: Math.round(usedRiskPercent * 10) / 10,
        maxPercent: config.autoTradeMaxRiskPercent,
      },
    }
  }

  /** Broadcast cap utilization to connected clients */
  private async broadcastCapUtilization(): Promise<void> {
    try {
      const caps = await this.getCapUtilization()
      this.broadcast({
        type: "trade_finder_cap_utilization",
        timestamp: new Date().toISOString(),
        data: caps,
      })
    } catch {
      // Non-critical — don't fail scan for cap broadcast
    }
  }

  // ─── Queue Position Management ─────────────────────────────────────────────

  /** Get current queue positions map */
  getQueuePositions(): Map<string, number> {
    return this.queuePositions
  }

  /** Compute queue positions for eligible-but-capped setups and broadcast updates */
  private async computeAndBroadcastQueue(): Promise<void> {
    try {
      const config = await getTradeFinderConfig()
      if (!config.autoTradeEnabled) {
        this.queuePositions.clear()
        return
      }

      const setups = await getActiveSetups()
      const newPositions = computeQueuePositions(
        setups,
        config,
        this.hasExistingPositionFn ?? undefined,
      )

      // Broadcast updates for setups whose queue position changed
      const now = new Date().toISOString()
      for (const setup of setups) {
        const oldPos = this.queuePositions.get(setup.id) ?? null
        const newPos = newPositions.get(setup.id) ?? null
        if (oldPos !== newPos) {
          this.broadcast({
            type: "trade_finder_setup_updated",
            timestamp: now,
            data: { ...setup, queuePosition: newPos },
          })
        }
      }

      this.queuePositions = newPositions
    } catch (err) {
      console.warn("[trade-finder] Error computing queue positions:", (err as Error).message)
    }
  }

  /** Try to place the highest-priority queued setup when a cap slot opens */
  private async tryPlaceNextQueued(): Promise<void> {
    if (this.scanning) return // Scan cycle will handle it

    try {
      const config = await getTradeFinderConfig()
      if (!config.autoTradeEnabled) return

      const setups = await getActiveSetups() // Sorted by score DESC
      for (const setup of setups) {
        if (setup.autoPlaced || setup.resultSourceId) continue
        if (setup.status !== "active" && setup.status !== "approaching") continue

        const pair = config.pairs.find((p) => p.instrument === setup.instrument)
        if (!pair || pair.autoTradeEnabled === false) continue

        // Try to place — tryAutoPlace will check all guards
        await this.tryAutoPlace(setup, config, pair)

        // If it succeeded (setup was placed), stop — one at a time
        const updated = await getSetup(setup.id)
        if (updated?.status === "placed") break
      }

      await this.computeAndBroadcastQueue()
      await this.broadcastCapUtilization()
    } catch (err) {
      console.warn("[trade-finder] Error placing next queued:", (err as Error).message)
    }
  }

  /** Force an immediate rescan */
  async triggerScan(): Promise<void> {
    if (this.scanning) return
    if (this.timer) clearTimeout(this.timer)
    await this.runScan()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Check if an error is transient (5xx, timeout, network) vs permanent (4xx, validation) */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /5\d{2}|timeout|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network/i.test(msg)
}
