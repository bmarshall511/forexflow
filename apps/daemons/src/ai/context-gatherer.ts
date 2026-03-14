import type { AiAnalysisDepth, TradeConditionData } from "@fxflow/types"
import type { StateManager } from "../state-manager.js"
import type { OandaTradeSyncer } from "../oanda/trade-syncer.js"

const CANDLE_COUNTS: Record<AiAnalysisDepth, { M15: number; H1: number; H4: number }> = {
  quick: { M15: 30, H1: 20, H4: 10 },
  standard: { M15: 60, H1: 50, H4: 30 },
  deep: { M15: 100, H1: 100, H4: 60 },
}

const HISTORY_COUNTS: Record<AiAnalysisDepth, number> = {
  quick: 10,
  standard: 20,
  deep: 40,
}

const CORRELATED_PAIRS: Record<string, string[]> = {
  EUR_USD: ["GBP_USD", "USD_CHF"],
  GBP_USD: ["EUR_USD", "EUR_GBP"],
  USD_JPY: ["EUR_JPY", "GBP_JPY"],
  AUD_USD: ["NZD_USD", "AUD_NZD"],
  USD_CAD: ["CAD_JPY", "EUR_CAD"],
  NZD_USD: ["AUD_USD", "AUD_NZD"],
  EUR_GBP: ["GBP_USD", "EUR_USD"],
  EUR_JPY: ["USD_JPY", "EUR_USD"],
  GBP_JPY: ["USD_JPY", "GBP_USD"],
  AUD_NZD: ["AUD_USD", "NZD_USD"],
  CAD_JPY: ["USD_JPY", "USD_CAD"],
  EUR_CAD: ["USD_CAD", "EUR_USD"],
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradeContextSnapshot {
  trade: TradeInfo
  account: AccountInfo
  livePrice: LivePrice | null
  candles: CandleData
  indicators: TechnicalIndicators
  history: TradeHistorySummary
  conditions: TradeConditionData[]
  newsEvents: NewsEvent[]
  forexNews: NewsHeadline[]
  previousAnalyses: PreviousAnalysisSummary[]
  marketSession: string
  correlatedPairs: Array<{ instrument: string; h1Trend: string; lastClose: number }>
  openPositions: Array<{
    instrument: string
    direction: string
    units: number
    unrealizedPL: number
  }>
  gatheringErrors: string[]
}

interface TradeInfo {
  id: string
  instrument: string
  direction: string
  status: string
  entryPrice: number
  exitPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  trailingStopDistance: number | null
  initialUnits: number
  currentUnits: number
  realizedPL: number
  unrealizedPL: number
  financing: number
  closeReason: string | null
  timeframe: string | null
  notes: string | null
  tags: string[]
  openedAt: string
  closedAt: string | null
  events: Array<{ eventType: string; detail: unknown; createdAt: string }>
  source: string
  orderType: string | null
  timeInForce: string | null
  gtdTime: string | null
  mfe: number | null
  mae: number | null
}

interface AccountInfo {
  balance: number
  nav: number
  unrealizedPL: number
  marginUsed: number
  marginAvailable: number
  openTradeCount: number
  pendingOrderCount: number
  todayPL: number
}

interface LivePrice {
  bid: number
  ask: number
  mid: number
  pipSize: number
  distanceToSL: number | null
  distanceToTP: number | null
  currentPL: number
}

interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandleData {
  M15: Candle[]
  H1: Candle[]
  H4: Candle[]
}

interface TechnicalIndicators {
  rsi14: number | null
  atr14: number | null
  ema20: number | null
  ema50: number | null
  trend: "bullish" | "bearish" | "sideways"
  keySupportLevels: number[]
  keyResistanceLevels: number[]
}

interface TradeHistorySummary {
  totalTrades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  avgWinPips: number
  avgLossPips: number
  avgDurationHours: number
  recentTrades: Array<{
    direction: string
    entryPrice: number
    exitPrice: number | null
    realizedPL: number
    outcome: string
    duration: string
    openedAt: string
    closedAt: string | null
  }>
}

export interface NewsEvent {
  title: string
  country: string
  currency: string
  impact: "low" | "medium" | "high"
  time: string
  forecast: string | null
  previous: string | null
}

export interface NewsHeadline {
  headline: string
  source: string
  datetime: number
  summary: string
}

interface PreviousAnalysisSummary {
  model: string
  depth: string
  createdAt: string
  winProbability: number | null
  tradeQualityScore: number | null
  summaryText: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrenciesFromPair(instrument: string): string[] {
  const parts = instrument.replace("_", "/").split("/")
  return parts.filter(Boolean)
}

function getPipSize(instrument: string): number {
  if (instrument.includes("JPY")) return 0.01
  return 0.0001
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  const slice = closes.slice(-(period + 1))
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = slice[i]! - slice[i - 1]!
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round(100 - 100 / (1 + rs))
}

function calcATR(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!
    const curr = candles[i]!
    trs.push(
      Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close),
      ),
    )
  }
  const slice = trs.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = closes[i]! * k + ema * (1 - k)
  }
  return Math.round(ema * 100000) / 100000
}

function calculateEMA(data: number[], period: number): number {
  const k = 2 / (period + 1)
  let ema = data[0]!
  for (let i = 1; i < data.length; i++) {
    ema = data[i]! * k + ema * (1 - k)
  }
  return ema
}

// ─── OANDA Candle Fetch ───────────────────────────────────────────────────────

async function fetchCandles(
  instrument: string,
  granularity: string,
  count: number,
  apiUrl: string,
  token: string,
  _accountId: string,
): Promise<Candle[]> {
  try {
    const url = `${apiUrl}/v3/instruments/${instrument}/candles?granularity=${granularity}&count=${count}&price=M`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      console.warn(
        `[context-gatherer] Candle fetch failed for ${instrument} ${granularity}: HTTP ${response.status}`,
      )
      return []
    }
    const data = (await response.json()) as {
      candles?: Array<{
        time: string
        mid?: { o: string; h: string; l: string; c: string }
        volume: number
        complete: boolean
      }>
    }
    return (data.candles ?? [])
      .filter((c) => c.complete)
      .map((c) => ({
        time: c.time,
        open: parseFloat(c.mid?.o ?? "0"),
        high: parseFloat(c.mid?.h ?? "0"),
        low: parseFloat(c.mid?.l ?? "0"),
        close: parseFloat(c.mid?.c ?? "0"),
        volume: c.volume,
      }))
  } catch (err) {
    console.warn(
      `[context-gatherer] Candle fetch error for ${instrument} ${granularity}:`,
      (err as Error).message,
    )
    return []
  }
}

// ─── FinnHub Economic Calendar ────────────────────────────────────────────────

async function fetchEconomicCalendar(
  currencies: string[],
  finnhubKey: string,
): Promise<NewsEvent[]> {
  try {
    const from = new Date()
    const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().split("T")[0]!
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${fmt(from)}&to=${fmt(to)}&token=${finnhubKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`[context-gatherer] Economic calendar fetch failed: HTTP ${res.status}`)
      return []
    }
    const data = (await res.json()) as {
      economicCalendar?: Array<{
        event: string
        country: string
        impact: string
        time: string
        estimate: string | null
        prev: string | null
      }>
    }

    const currencyCountryMap: Record<string, string> = {
      USD: "US",
      EUR: "EU",
      GBP: "GB",
      JPY: "JP",
      AUD: "AU",
      CAD: "CA",
      CHF: "CH",
      NZD: "NZ",
    }

    const relevantCountries = currencies
      .map((c) => currencyCountryMap[c])
      .filter(Boolean) as string[]

    return (data.economicCalendar ?? [])
      .filter((e) => relevantCountries.includes(e.country) && e.impact !== "low")
      .slice(0, 15)
      .map((e) => ({
        title: e.event,
        country: e.country,
        currency:
          Object.entries(currencyCountryMap).find(([, v]) => v === e.country)?.[0] ?? e.country,
        impact: (e.impact as "low" | "medium" | "high") ?? "low",
        time: e.time,
        forecast: e.estimate,
        previous: e.prev,
      }))
  } catch (err) {
    console.warn("[context-gatherer] Economic calendar fetch error:", (err as Error).message)
    return []
  }
}

// ─── FinnHub Forex News ────────────────────────────────────────────────────────

async function fetchForexNews(currencies: string[], finnhubKey: string): Promise<NewsHeadline[]> {
  try {
    const url = `https://finnhub.io/api/v1/news?category=forex&token=${finnhubKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`[context-gatherer] Forex news fetch failed: HTTP ${res.status}`)
      return []
    }
    const data = (await res.json()) as Array<{
      headline: string
      source: string
      datetime: number
      summary: string
    }>

    const lowerCurrencies = currencies.map((c) => c.toLowerCase())
    return data
      .filter((n) => {
        const text = (n.headline + " " + n.summary).toLowerCase()
        return lowerCurrencies.some((c) => text.includes(c))
      })
      .slice(0, 8)
      .map((n) => ({
        headline: n.headline,
        source: n.source,
        datetime: n.datetime,
        summary: n.summary.slice(0, 300),
      }))
  } catch (err) {
    console.warn("[context-gatherer] Forex news fetch error:", (err as Error).message)
    return []
  }
}

// ─── Main Context Gatherer ────────────────────────────────────────────────────

export async function gatherTradeContext(opts: {
  tradeId: string
  depth: AiAnalysisDepth
  stateManager: StateManager
  tradeSyncer: OandaTradeSyncer
}): Promise<TradeContextSnapshot> {
  return Promise.race([
    gatherTradeContextInner(opts),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Context gathering timed out after 30s")), 30_000),
    ),
  ])
}

async function gatherTradeContextInner(opts: {
  tradeId: string
  depth: AiAnalysisDepth
  stateManager: StateManager
  tradeSyncer: OandaTradeSyncer
}): Promise<TradeContextSnapshot> {
  const { tradeId, depth, stateManager } = opts
  const errors: string[] = []

  const { db, getTradeWithDetails, getAnalysisHistory, listConditionsForTrade } =
    await import("@fxflow/db")
  const { getDecryptedFinnhubKey, getSettings } = await import("@fxflow/db")

  // ─── 1. Trade Details ───────────────────────────────────────────────────
  const tradeDetail = await getTradeWithDetails(tradeId)
  if (!tradeDetail) throw new Error(`Trade ${tradeId} not found`)

  const tradeInfo: TradeInfo = {
    id: tradeDetail.id,
    instrument: tradeDetail.instrument,
    direction: tradeDetail.direction,
    status: tradeDetail.status,
    entryPrice: tradeDetail.entryPrice,
    exitPrice: tradeDetail.exitPrice,
    stopLoss: tradeDetail.stopLoss,
    takeProfit: tradeDetail.takeProfit,
    trailingStopDistance: tradeDetail.trailingStopDistance,
    initialUnits: tradeDetail.initialUnits,
    currentUnits: tradeDetail.currentUnits,
    realizedPL: tradeDetail.realizedPL,
    unrealizedPL: tradeDetail.unrealizedPL,
    financing: tradeDetail.financing,
    closeReason: tradeDetail.closeReason,
    timeframe: tradeDetail.timeframe,
    notes: tradeDetail.notes,
    tags: tradeDetail.tags.map((t) => t.tag.name),
    openedAt: tradeDetail.openedAt,
    closedAt: tradeDetail.closedAt,
    events: tradeDetail.events.map((e) => ({
      eventType: e.eventType,
      detail: JSON.parse(e.detail) as unknown,
      createdAt: e.createdAt,
    })),
    source: tradeDetail.source,
    orderType: tradeDetail.orderType,
    timeInForce: tradeDetail.timeInForce,
    gtdTime: tradeDetail.gtdTime,
    mfe: tradeDetail.mfe,
    mae: tradeDetail.mae,
  }

  // ─── 2. Account Context ─────────────────────────────────────────────────
  const snapshot = stateManager.getSnapshot()
  const acct = snapshot.accountOverview?.summary
  const todayPL = snapshot.accountOverview?.pnl.today?.net ?? 0
  const accountInfo: AccountInfo = {
    balance: acct?.balance ?? 0,
    nav: acct?.nav ?? 0,
    unrealizedPL: acct?.unrealizedPL ?? 0,
    marginUsed: acct?.marginUsed ?? 0,
    marginAvailable: acct?.marginAvailable ?? 0,
    openTradeCount: acct?.openTradeCount ?? 0,
    pendingOrderCount: acct?.pendingOrderCount ?? 0,
    todayPL,
  }

  // ─── 3. Live Price ─────────────────────────────────────────────────────
  let livePrice: LivePrice | null = null
  const positions = stateManager.getPositions()
  if (!positions) {
    console.warn(
      `[context-gatherer] No positions data available for live price lookup (trade ${tradeId})`,
    )
  }
  if (positions) {
    const openTrade = positions.open.find((t) => t.id === tradeId)
    if (openTrade?.currentPrice) {
      const pip = getPipSize(tradeInfo.instrument)
      const mid = openTrade.currentPrice
      const slDist = tradeInfo.stopLoss ? Math.abs(mid - tradeInfo.stopLoss) / pip : null
      const tpDist = tradeInfo.takeProfit ? Math.abs(mid - tradeInfo.takeProfit) / pip : null
      livePrice = {
        bid: mid - pip / 2,
        ask: mid + pip / 2,
        mid,
        pipSize: pip,
        distanceToSL: slDist ? Math.round(slDist * 10) / 10 : null,
        distanceToTP: tpDist ? Math.round(tpDist * 10) / 10 : null,
        currentPL: openTrade.unrealizedPL,
      }
    }
  }

  // ─── 4. Candles + Indicators ───────────────────────────────────────────
  const _settings = await getSettings()
  const mode = snapshot.tradingMode ?? "practice"
  const apiUrl =
    mode === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com"

  let token = ""
  try {
    const { revealToken } = await import("@fxflow/db")
    token = await revealToken(mode)
  } catch {
    errors.push("Could not retrieve OANDA token for candle data")
  }

  const counts = CANDLE_COUNTS[depth]
  const [m15Candles, h1Candles, h4Candles] = await Promise.all([
    token
      ? fetchCandles(tradeInfo.instrument, "M15", counts.M15, apiUrl, token, "")
      : Promise.resolve([]),
    token
      ? fetchCandles(tradeInfo.instrument, "H1", counts.H1, apiUrl, token, "")
      : Promise.resolve([]),
    token
      ? fetchCandles(tradeInfo.instrument, "H4", counts.H4, apiUrl, token, "")
      : Promise.resolve([]),
  ])

  if (!m15Candles.length) errors.push("Could not fetch M15 candle data")
  if (!h1Candles.length) errors.push("Could not fetch H1 candle data")

  const candleData: CandleData = { M15: m15Candles, H1: h1Candles, H4: h4Candles }

  // Calculate indicators from H1 candles (most reliable timeframe for indicators)
  const h1Closes = h1Candles.map((c) => c.close)
  const h1Highs = h1Candles.map((c) => c.high)
  const h1Lows = h1Candles.map((c) => c.low)

  const rsi14 = calcRSI(h1Closes)
  const atr14 = calcATR(h1Candles)
  const ema20 = calcEMA(h1Closes, 20)
  const ema50 = calcEMA(h1Closes, 50)

  // Detect S/R levels from recent H1 highs/lows
  const recentHighs = h1Highs
    .slice(-20)
    .sort((a, b) => b - a)
    .slice(0, 3)
  const recentLows = h1Lows
    .slice(-20)
    .sort((a, b) => a - b)
    .slice(0, 3)

  // Trend determination
  let trend: "bullish" | "bearish" | "sideways" = "sideways"
  if (ema20 && ema50) {
    if (ema20 > ema50 * 1.0002) trend = "bullish"
    else if (ema20 < ema50 * 0.9998) trend = "bearish"
  }

  const indicators: TechnicalIndicators = {
    rsi14,
    atr14: atr14 ? Math.round(atr14 * 100000) / 100000 : null,
    ema20,
    ema50,
    trend,
    keyResistanceLevels: recentHighs,
    keySupportLevels: recentLows,
  }

  // ─── 4b. Correlated Pairs ──────────────────────────────────────────────
  const correlatedInstruments = CORRELATED_PAIRS[tradeInfo.instrument] ?? []
  const correlatedPairs: Array<{ instrument: string; h1Trend: string; lastClose: number }> = []

  if (token && correlatedInstruments.length > 0) {
    const pairsToFetch = correlatedInstruments.slice(0, 2)
    const correlatedResults = await Promise.allSettled(
      pairsToFetch.map(async (inst) => {
        const candles = await fetchCandles(inst, "H1", 20, apiUrl, token, "")
        if (candles.length < 10) return null
        const closes = candles.map((c) => c.close)
        const lastClose = closes[closes.length - 1]!
        const ema10 = calculateEMA(closes, 10)
        const ema20 = calculateEMA(closes, 20)
        const trend = ema10 > ema20 ? "bullish" : ema10 < ema20 ? "bearish" : "sideways"
        return { instrument: inst, h1Trend: trend, lastClose }
      }),
    )
    for (const result of correlatedResults) {
      if (result.status === "fulfilled" && result.value) {
        correlatedPairs.push(result.value)
      }
    }
  }

  // ─── 4c. Portfolio Context ────────────────────────────────────────────
  const openPositions: Array<{
    instrument: string
    direction: string
    units: number
    unrealizedPL: number
  }> = []
  if (positions) {
    for (const pos of positions.open) {
      if (pos.instrument !== tradeInfo.instrument) {
        openPositions.push({
          instrument: pos.instrument,
          direction: pos.direction,
          units: Math.abs(pos.currentUnits),
          unrealizedPL: pos.unrealizedPL,
        })
      }
    }
  }

  // ─── 5. Trade History ──────────────────────────────────────────────────
  const historyCount = HISTORY_COUNTS[depth]
  const historicalTrades = await db.trade.findMany({
    where: {
      instrument: tradeInfo.instrument,
      status: "closed",
      id: { not: tradeId },
    },
    orderBy: { closedAt: "desc" },
    take: historyCount,
    select: {
      direction: true,
      entryPrice: true,
      exitPrice: true,
      realizedPL: true,
      mfe: true,
      mae: true,
      openedAt: true,
      closedAt: true,
    },
  })

  const wins = historicalTrades.filter((t) => t.realizedPL > 0).length
  const losses = historicalTrades.filter((t) => t.realizedPL < 0).length
  const breakeven = historicalTrades.length - wins - losses
  const pip = getPipSize(tradeInfo.instrument)

  const winPLs = historicalTrades
    .filter((t) => t.realizedPL > 0)
    .map((t) => Math.abs(t.realizedPL) / pip)
  const lossPLs = historicalTrades
    .filter((t) => t.realizedPL < 0)
    .map((t) => Math.abs(t.realizedPL) / pip)

  const tradeHistorySummary: TradeHistorySummary = {
    totalTrades: historicalTrades.length,
    wins,
    losses,
    breakeven,
    winRate: historicalTrades.length > 0 ? Math.round((wins / historicalTrades.length) * 100) : 0,
    avgWinPips: winPLs.length ? Math.round(winPLs.reduce((a, b) => a + b, 0) / winPLs.length) : 0,
    avgLossPips: lossPLs.length
      ? Math.round(lossPLs.reduce((a, b) => a + b, 0) / lossPLs.length)
      : 0,
    avgDurationHours:
      historicalTrades.length > 0
        ? Math.round(
            historicalTrades
              .filter((t) => t.closedAt)
              .reduce(
                (sum, t) =>
                  sum +
                  (new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime()) / 3600000,
                0,
              ) / historicalTrades.filter((t) => t.closedAt).length,
          )
        : 0,
    recentTrades: historicalTrades.slice(0, 10).map((t) => ({
      direction: t.direction,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      realizedPL: t.realizedPL,
      outcome: t.realizedPL > 0 ? "win" : t.realizedPL < 0 ? "loss" : "breakeven",
      duration: t.closedAt
        ? `${Math.round((new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()) / 3600000)}h`
        : "ongoing",
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    })),
  }

  // ─── 6. Active Conditions ──────────────────────────────────────────────
  const conditions = await listConditionsForTrade(tradeId)

  // ─── 7. External Data (news, calendar) ────────────────────────────────
  const finnhubKey = await getDecryptedFinnhubKey()
  const currencies = getCurrenciesFromPair(tradeInfo.instrument)

  const [newsEvents, forexNews] = finnhubKey
    ? await Promise.all([
        fetchEconomicCalendar(currencies, finnhubKey),
        fetchForexNews(currencies, finnhubKey),
      ])
    : [[], []]

  if (!finnhubKey) errors.push("FinnHub API key not configured — no news/calendar data")

  // ─── 8. Previous Analyses ──────────────────────────────────────────────
  const prevAnalyses = await getAnalysisHistory(tradeId, 3)
  const previousAnalyses: PreviousAnalysisSummary[] = prevAnalyses
    .filter((a) => a.status === "completed" && a.sections)
    .map((a) => ({
      model: a.model,
      depth: a.depth,
      createdAt: a.createdAt,
      winProbability: a.sections?.winProbability ?? null,
      tradeQualityScore: a.sections?.tradeQualityScore ?? null,
      summaryText: a.sections?.summary ?? "",
    }))

  // ─── 9. Market Session ────────────────────────────────────────────────
  const market = stateManager.getSnapshot().market
  const currentSessionHour = new Date().getUTCHours()
  let marketSession = "Unknown"
  if (currentSessionHour >= 22 || currentSessionHour < 8) marketSession = "Asian Session"
  else if (currentSessionHour >= 8 && currentSessionHour < 12) marketSession = "London Open"
  else if (currentSessionHour >= 12 && currentSessionHour < 17)
    marketSession = "London/New York Overlap"
  else if (currentSessionHour >= 17 && currentSessionHour < 22) marketSession = "New York Session"
  if (!market.isOpen) marketSession = `Market Closed (${market.closeReason ?? "unknown reason"})`

  return {
    trade: tradeInfo,
    account: accountInfo,
    livePrice,
    candles: candleData,
    indicators,
    history: tradeHistorySummary,
    conditions,
    newsEvents,
    forexNews,
    previousAnalyses,
    marketSession,
    correlatedPairs,
    openPositions,
    gatheringErrors: errors,
  }
}
