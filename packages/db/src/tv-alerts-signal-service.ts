/**
 * TradingView Alerts signal service — manages the lifecycle of TV alert signals.
 *
 * Handles signal creation, status updates, deduplication, performance stats,
 * period-based P&L bucketing, auto-trade tracking, and result synchronization
 * from closed OANDA trades back into signal records.
 *
 * @module tv-alerts-signal-service
 */
import { db } from "./client"
import {
  getForexDayStart,
  getForexPeriodBoundaries,
  getLastTradingSessionStart,
} from "@fxflow/shared"
import type {
  TVAlertSignal,
  TVAlertStatus,
  TVExecutionDetails,
  TVSignalDirection,
  TVWebhookPayload,
  TVSignalPerformanceStats,
  TVSignalListResponse,
  TVSignalPeriodPnL,
  TVSignalPeriodPnLData,
  TVSignalPnLBucket,
  TVSignalRecentResult,
  TVSignalPairStats,
  TradingMode,
} from "@fxflow/types"

// ─── Input Types ──────────────────────────────────────────────────────────────

/** Fields required to create a new TV alert signal record. */
export interface CreateSignalInput {
  /** OANDA account the signal was received against. */
  account: TradingMode
  source?: string
  instrument: string
  direction: string
  status: TVAlertStatus
  rejectionReason?: string | null
  rawPayload: TVWebhookPayload
  resultTradeId?: string | null
  executionDetails?: TVExecutionDetails | null
  isTest?: boolean
  receivedAt: Date
  processedAt?: Date | null
}

/** Filtering and pagination options for listing signals. */
export interface ListSignalsOptions {
  page?: number
  pageSize?: number
  status?: string
  instrument?: string
  source?: string
  account?: TradingMode
  dateFrom?: Date
  dateTo?: Date
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

/**
 * Map a Prisma signal row to the `TVAlertSignal` DTO, deserializing
 * JSON fields for rawPayload and executionDetails.
 *
 * @param row - Raw signal row from Prisma
 * @returns Serialized signal data for the API/UI
 */
function rowToSignal(row: {
  id: string
  source: string
  instrument: string
  direction: string
  status: string
  rejectionReason: string | null
  rawPayload: string
  resultTradeId: string | null
  executionDetails: string | null
  isTest: boolean
  signalTime: Date | null
  receivedAt: Date
  processedAt: Date | null
}): TVAlertSignal {
  let rawPayload: TVWebhookPayload
  try {
    rawPayload = JSON.parse(row.rawPayload) as TVWebhookPayload
  } catch {
    rawPayload = { action: row.direction as "buy" | "sell", ticker: row.instrument }
  }

  let executionDetails: TVExecutionDetails | null = null
  if (row.executionDetails) {
    try {
      executionDetails = JSON.parse(row.executionDetails) as TVExecutionDetails
    } catch {
      /* ignore parse errors */
    }
  }

  return {
    id: row.id,
    source: row.source as "ut_bot_alerts",
    instrument: row.instrument,
    direction: row.direction as "buy" | "sell",
    status: row.status as TVAlertStatus,
    rejectionReason: row.rejectionReason as TVAlertSignal["rejectionReason"],
    rawPayload,
    resultTradeId: row.resultTradeId,
    executionDetails,
    isTest: row.isTest,
    signalTime: row.signalTime?.toISOString() ?? null,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Parse the TradingView `time` field from the webhook payload into a Date, or null if missing/invalid. */
function parseSignalTime(payload: TVWebhookPayload): Date | null {
  if (!payload.time) return null
  const d = new Date(payload.time)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Create a new signal record. */
export async function createSignal(input: CreateSignalInput): Promise<TVAlertSignal> {
  const signalTime = parseSignalTime(input.rawPayload)

  const row = await db.tVAlertSignal.create({
    data: {
      account: input.account,
      source: input.source ?? "ut_bot_alerts",
      instrument: input.instrument,
      direction: input.direction,
      status: input.status,
      rejectionReason: input.rejectionReason ?? null,
      rawPayload: JSON.stringify(input.rawPayload),
      resultTradeId: input.resultTradeId ?? null,
      executionDetails: input.executionDetails ? JSON.stringify(input.executionDetails) : null,
      isTest: input.isTest ?? false,
      signalTime,
      receivedAt: input.receivedAt,
      processedAt: input.processedAt ?? null,
    },
  })

  return rowToSignal(row)
}

/** Update a signal's status and optional details. */
export async function updateSignalStatus(
  id: string,
  status: TVAlertStatus,
  details?: {
    rejectionReason?: string | null
    resultTradeId?: string | null
    executionDetails?: TVExecutionDetails | null
    processedAt?: Date | null
  },
): Promise<TVAlertSignal> {
  const updateData: Record<string, unknown> = { status }
  if (details?.rejectionReason !== undefined) updateData.rejectionReason = details.rejectionReason
  if (details?.resultTradeId !== undefined) updateData.resultTradeId = details.resultTradeId
  if (details?.executionDetails !== undefined) {
    updateData.executionDetails = details.executionDetails
      ? JSON.stringify(details.executionDetails)
      : null
  }
  if (details?.processedAt !== undefined) updateData.processedAt = details.processedAt

  const row = await db.tVAlertSignal.update({ where: { id }, data: updateData })
  return rowToSignal(row)
}

/** Find a signal by its linked OANDA sourceTradeId. */
export async function findSignalByResultTradeId(
  resultTradeId: string,
): Promise<TVAlertSignal | null> {
  const row = await db.tVAlertSignal.findFirst({ where: { resultTradeId } })
  return row ? rowToSignal(row) : null
}

/** Mark a signal as a test signal. */
export async function markSignalAsTest(id: string): Promise<void> {
  await db.tVAlertSignal.update({ where: { id }, data: { isTest: true } })
}

/** Check for a recent signal (dedup window). Returns the most recent match or null.
 *  Only considers active signals (received/executing/executed) — failed/rejected don't block retries. */
export async function getRecentSignal(
  instrument: string,
  direction: string,
  windowSeconds: number,
): Promise<TVAlertSignal | null> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000)
  const row = await db.tVAlertSignal.findFirst({
    where: {
      instrument,
      direction,
      receivedAt: { gte: cutoff },
      status: { in: ["received", "executing", "executed"] },
    },
    orderBy: { receivedAt: "desc" },
  })

  return row ? rowToSignal(row) : null
}

// ─── Listing ──────────────────────────────────────────────────────────────────

/** List signals with pagination and filtering. */
export async function listSignals(opts: ListSignalsOptions = {}): Promise<TVSignalListResponse> {
  const page = opts.page ?? 1
  const pageSize = opts.pageSize ?? 20

  const where: Record<string, unknown> = {}
  if (opts.status) where.status = opts.status
  if (opts.instrument) where.instrument = opts.instrument
  if (opts.source) where.source = opts.source
  if (opts.account) where.account = opts.account

  if (opts.dateFrom || opts.dateTo) {
    const receivedAt: Record<string, Date> = {}
    if (opts.dateFrom) receivedAt.gte = opts.dateFrom
    if (opts.dateTo) receivedAt.lte = opts.dateTo
    where.receivedAt = receivedAt
  }

  const [rows, totalCount] = await Promise.all([
    db.tVAlertSignal.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.tVAlertSignal.count({ where }),
  ])

  return {
    signals: rows.map(rowToSignal),
    totalCount,
    page,
    pageSize,
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Get aggregated performance stats for signals. */
export async function getSignalPerformanceStats(opts?: {
  source?: string
  account?: TradingMode
  from?: Date
  to?: Date
}): Promise<TVSignalPerformanceStats> {
  const where: Record<string, unknown> = {}
  if (opts?.source) where.source = opts.source
  if (opts?.account) where.account = opts.account
  if (opts?.from || opts?.to) {
    const receivedAt: Record<string, Date> = {}
    if (opts?.from) receivedAt.gte = opts.from
    if (opts?.to) receivedAt.lte = opts.to
    where.receivedAt = receivedAt
  }

  const signals = await db.tVAlertSignal.findMany({
    where,
    select: {
      status: true,
      resultTradeId: true,
      executionDetails: true,
    },
  })

  let totalSignals = 0
  let executedSignals = 0
  let rejectedSignals = 0
  let failedSignals = 0
  let wins = 0
  let losses = 0
  let breakeven = 0
  let totalWinPL = 0
  let totalLossPL = 0

  for (const sig of signals) {
    totalSignals++
    if (sig.status === "executed") {
      executedSignals++
      // Parse execution details for P&L if available
      if (sig.executionDetails) {
        try {
          const details = JSON.parse(sig.executionDetails) as TVExecutionDetails
          if (details.realizedPL !== undefined) {
            if (details.realizedPL > 0.005) {
              wins++
              totalWinPL += details.realizedPL
            } else if (details.realizedPL < -0.005) {
              losses++
              totalLossPL += Math.abs(details.realizedPL)
            } else {
              breakeven++
            }
          }
        } catch {
          /* ignore */
        }
      }
    } else if (sig.status === "rejected" || sig.status === "skipped") {
      rejectedSignals++
    } else if (sig.status === "failed") {
      failedSignals++
    }
  }

  const totalTrades = wins + losses + breakeven
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
  const averageWin = wins > 0 ? totalWinPL / wins : 0
  const averageLoss = losses > 0 ? totalLossPL / losses : 0
  const profitFactor = totalLossPL > 0 ? totalWinPL / totalLossPL : totalWinPL > 0 ? 999999 : 0
  const totalPL = totalWinPL - totalLossPL

  return {
    totalSignals,
    executedSignals,
    rejectedSignals,
    failedSignals,
    wins,
    losses,
    breakeven,
    winRate,
    totalPL,
    averageWin,
    averageLoss,
    profitFactor,
  }
}

// ─── Auto-Trade Helpers ───────────────────────────────────────────────────────

/** Count open trades opened by the signal processor (via executed signals). */
export async function getActiveAutoTradeCount(): Promise<number> {
  const signals = await db.tVAlertSignal.findMany({
    where: { status: "executed", resultTradeId: { not: null } },
    select: { resultTradeId: true },
  })

  const tradeIds = signals.map((s) => s.resultTradeId).filter(Boolean) as string[]
  if (tradeIds.length === 0) return 0

  return db.trade.count({
    where: { sourceTradeId: { in: tradeIds }, status: "open" },
  })
}

/** Sum today's realized P&L for auto-trades (via executed signals, forex day boundary). */
export async function getTodayAutoTradePL(): Promise<number> {
  const forexDayStart = getForexDayStart(new Date())
  const signals = await db.tVAlertSignal.findMany({
    where: {
      status: "executed",
      resultTradeId: { not: null },
      processedAt: { gte: forexDayStart },
    },
    select: { resultTradeId: true },
  })

  const tradeIds = signals.map((s) => s.resultTradeId).filter(Boolean) as string[]
  if (tradeIds.length === 0) return 0

  const trades = await db.trade.findMany({
    where: { sourceTradeId: { in: tradeIds }, status: "closed" },
    select: { realizedPL: true, financing: true },
  })

  return trades.reduce((sum, t) => sum + t.realizedPL + t.financing, 0)
}

/** Get OANDA source trade IDs of currently open auto-trades (for in-memory tracking). */
export async function getActiveAutoTradeIds(): Promise<string[]> {
  const signals = await db.tVAlertSignal.findMany({
    where: { status: "executed", resultTradeId: { not: null } },
    select: { resultTradeId: true },
  })

  const tradeIds = signals.map((s) => s.resultTradeId).filter(Boolean) as string[]
  if (tradeIds.length === 0) return []

  const openTrades = await db.trade.findMany({
    where: { sourceTradeId: { in: tradeIds }, status: "open" },
    select: { sourceTradeId: true },
  })

  return openTrades.map((t) => t.sourceTradeId)
}

/** Count signals received in the current/last trading session.
 *  On weekends, shows the last active trading day's count instead of 0. */
export async function getTodaySignalCount(account?: TradingMode): Promise<number> {
  const sessionStart = getLastTradingSessionStart(new Date())
  const where: Record<string, unknown> = { receivedAt: { gte: sessionStart } }
  if (account) where.account = account
  return db.tVAlertSignal.count({ where })
}

/** Batch: get all auto-trade data in a single pass (count, IDs, today P&L, signal count).
 *  Uses getLastTradingSessionStart so weekend queries show last session's data. */
export async function getAutoTradesSummary(account?: TradingMode): Promise<{
  activeAutoTradeIds: string[]
  activeAutoPositions: number
  todayAutoPL: number
  signalCountToday: number
}> {
  const forexDayStart = getLastTradingSessionStart(new Date())

  const signalWhere: Record<string, unknown> = {
    status: "executed",
    resultTradeId: { not: null },
  }
  if (account) signalWhere.account = account
  const countWhere: Record<string, unknown> = { receivedAt: { gte: forexDayStart } }
  if (account) countWhere.account = account

  // Single query for all executed signals with trade IDs
  const [executedSignals, signalCountToday] = await Promise.all([
    db.tVAlertSignal.findMany({
      where: signalWhere,
      select: { resultTradeId: true, processedAt: true },
    }),
    db.tVAlertSignal.count({ where: countWhere }),
  ])

  const allTradeIds = executedSignals.map((s) => s.resultTradeId).filter(Boolean) as string[]
  if (allTradeIds.length === 0) {
    return { activeAutoTradeIds: [], activeAutoPositions: 0, todayAutoPL: 0, signalCountToday }
  }

  // Single batch query for all related trades (account filter belongs on the
  // trade join since the trade row is the authoritative source for P&L).
  const tradeWhere: Record<string, unknown> = { sourceTradeId: { in: allTradeIds } }
  if (account) tradeWhere.account = account
  const trades = await db.trade.findMany({
    where: tradeWhere,
    select: { sourceTradeId: true, status: true, realizedPL: true, financing: true },
  })

  const openTrades = trades.filter((t) => t.status === "open")
  const activeAutoTradeIds = openTrades.map((t) => t.sourceTradeId)

  // Today's P&L: closed trades from today's signals
  const todayTradeIds = new Set(
    executedSignals
      .filter((s) => s.processedAt && s.processedAt >= forexDayStart)
      .map((s) => s.resultTradeId)
      .filter(Boolean) as string[],
  )
  const todayAutoPL = trades
    .filter((t) => t.status === "closed" && todayTradeIds.has(t.sourceTradeId))
    .reduce((sum, t) => sum + t.realizedPL + t.financing, 0)

  return {
    activeAutoTradeIds,
    activeAutoPositions: openTrades.length,
    todayAutoPL,
    signalCountToday,
  }
}

// ─── Period P&L ───────────────────────────────────────────────────────────────

/** Create an empty period P&L bucket with zeroed counters. */
function emptyPeriodPnL(): TVSignalPeriodPnL {
  return { net: 0, signalCount: 0, wins: 0, losses: 0 }
}

/** Compute period-based P&L from executed signals (single query, bucketed in memory). */
export async function getSignalPeriodPnL(): Promise<TVSignalPeriodPnLData> {
  const now = new Date()
  const boundaries = getForexPeriodBoundaries(now)
  const { todayStart, yesterdayStart, weekStart, monthStart, yearStart } = boundaries

  // Single query: all executed signals with execution details
  const signals = await db.tVAlertSignal.findMany({
    where: { status: "executed", executionDetails: { not: null } },
    select: { receivedAt: true, executionDetails: true },
  })

  const periods: TVSignalPeriodPnLData = {
    today: emptyPeriodPnL(),
    yesterday: emptyPeriodPnL(),
    thisWeek: emptyPeriodPnL(),
    thisMonth: emptyPeriodPnL(),
    thisYear: emptyPeriodPnL(),
    allTime: emptyPeriodPnL(),
  }

  for (const sig of signals) {
    let pl = 0
    try {
      const details = JSON.parse(sig.executionDetails!) as TVExecutionDetails
      if (details.realizedPL !== undefined) pl = details.realizedPL
      else continue
    } catch {
      continue
    }

    const isWin = pl > 0.005
    const isLoss = pl < -0.005
    const t = sig.receivedAt.getTime()

    // All time
    addToPeriod(periods.allTime, pl, isWin, isLoss)

    // Year
    if (t >= yearStart.getTime()) addToPeriod(periods.thisYear, pl, isWin, isLoss)

    // Month
    if (t >= monthStart.getTime()) addToPeriod(periods.thisMonth, pl, isWin, isLoss)

    // Week
    if (t >= weekStart.getTime()) addToPeriod(periods.thisWeek, pl, isWin, isLoss)

    // Today
    if (t >= todayStart.getTime()) addToPeriod(periods.today, pl, isWin, isLoss)

    // Yesterday (between yesterdayStart and todayStart)
    if (t >= yesterdayStart.getTime() && t < todayStart.getTime()) {
      addToPeriod(periods.yesterday, pl, isWin, isLoss)
    }
  }

  return periods
}

/**
 * Accumulate a single signal's P&L into a period bucket.
 *
 * @param period - The period bucket to update
 * @param pl - Realized P&L for this signal
 * @param isWin - Whether this signal was a win
 * @param isLoss - Whether this signal was a loss
 */
function addToPeriod(period: TVSignalPeriodPnL, pl: number, isWin: boolean, isLoss: boolean) {
  period.net += pl
  period.signalCount++
  if (isWin) period.wins++
  if (isLoss) period.losses++
}

// ─── Result Sync ─────────────────────────────────────────────────────────────

/**
 * Backfill realizedPL into executed signals whose trades have closed.
 * Returns count of signals updated. Should be called periodically (e.g. after reconcile).
 */
export async function syncClosedSignalResults(): Promise<number> {
  // Find executed signals that don't yet have realizedPL in their executionDetails
  const signals = await db.tVAlertSignal.findMany({
    where: { status: "executed", resultTradeId: { not: null } },
    select: { id: true, resultTradeId: true, executionDetails: true },
  })

  // Filter to signals missing realizedPL
  const needsSync = signals.filter((sig) => {
    if (!sig.executionDetails) return true
    try {
      const details = JSON.parse(sig.executionDetails) as Record<string, unknown>
      return details.realizedPL === undefined
    } catch {
      return false
    }
  })

  if (needsSync.length === 0) return 0

  // Batch lookup: single query for all closed trades
  const tradeIds = needsSync.map((s) => s.resultTradeId).filter(Boolean) as string[]
  const closedTrades = await db.trade.findMany({
    where: { sourceTradeId: { in: tradeIds }, status: "closed" },
    select: { sourceTradeId: true, realizedPL: true, financing: true },
  })
  const tradeMap = new Map(closedTrades.map((t) => [t.sourceTradeId, t]))

  // Batch update in a transaction
  const updates = needsSync
    .filter((sig) => tradeMap.has(sig.resultTradeId!))
    .map((sig) => {
      const trade = tradeMap.get(sig.resultTradeId!)!
      const pl = trade.realizedPL + trade.financing
      const existingDetails = sig.executionDetails
        ? (JSON.parse(sig.executionDetails) as Record<string, unknown>)
        : {}
      existingDetails.realizedPL = pl

      return db.tVAlertSignal.update({
        where: { id: sig.id },
        data: { executionDetails: JSON.stringify(existingDetails) },
      })
    })

  if (updates.length > 0) {
    await db.$transaction(updates)
  }

  return updates.length
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

/** Delete signals older than the given number of days, EXCEPT signals with still-open trades. */
export async function cleanupOldSignals(days: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  // Find old signals that reference a trade (may still be open)
  const oldSignalsWithTrades = await db.tVAlertSignal.findMany({
    where: { receivedAt: { lt: cutoff }, resultTradeId: { not: null } },
    select: { id: true, resultTradeId: true },
  })

  // Check which of those trades are still open — protect their signals from deletion
  let protectedSignalIds = new Set<string>()
  const tradeIds = oldSignalsWithTrades.map((s) => s.resultTradeId).filter(Boolean) as string[]
  if (tradeIds.length > 0) {
    const openTrades = await db.trade.findMany({
      where: { sourceTradeId: { in: tradeIds }, status: "open" },
      select: { sourceTradeId: true },
    })
    const openTradeIdSet = new Set(openTrades.map((t) => t.sourceTradeId))
    protectedSignalIds = new Set(
      oldSignalsWithTrades
        .filter((s) => s.resultTradeId && openTradeIdSet.has(s.resultTradeId))
        .map((s) => s.id),
    )
  }

  const result = await db.tVAlertSignal.deleteMany({
    where: {
      receivedAt: { lt: cutoff },
      ...(protectedSignalIds.size > 0 ? { id: { notIn: [...protectedSignalIds] } } : {}),
    },
  })

  if (protectedSignalIds.size > 0) {
    console.log(`[cleanup] Protected ${protectedSignalIds.size} signal(s) with still-open trades`)
  }

  return result.count
}

/** Delete all signals. Returns count deleted. */
export async function clearAllSignals(): Promise<number> {
  const { count } = await db.tVAlertSignal.deleteMany()
  return count
}

// ─── Detailed Performance ─────────────────────────────────────────────────────

/** Compute P&L distribution histogram from executed signals with realized P&L. */
export async function getSignalPnLDistribution(opts?: {
  from?: Date
  to?: Date
}): Promise<TVSignalPnLBucket[]> {
  const where: Record<string, unknown> = { status: "executed", executionDetails: { not: null } }
  if (opts?.from || opts?.to) {
    const receivedAt: Record<string, Date> = {}
    if (opts?.from) receivedAt.gte = opts.from
    if (opts?.to) receivedAt.lte = opts.to
    where.receivedAt = receivedAt
  }

  const signals = await db.tVAlertSignal.findMany({
    where,
    select: { executionDetails: true },
  })

  const pls: number[] = []
  for (const sig of signals) {
    try {
      const details = JSON.parse(sig.executionDetails!) as TVExecutionDetails
      if (details.realizedPL !== undefined) pls.push(details.realizedPL)
    } catch {
      /* ignore */
    }
  }

  if (pls.length === 0) return []

  const min = Math.min(...pls)
  const max = Math.max(...pls)
  const range = max - min
  if (range === 0) {
    return [{ min: min - 1, max: max + 1, label: `$${min.toFixed(0)}`, count: pls.length }]
  }

  const TARGET_BUCKETS = 10
  const rawStep = range / TARGET_BUCKETS
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step = Math.ceil(rawStep / mag) * mag
  const start = Math.floor(min / step) * step

  const bucketMap = new Map<number, number>()
  for (const pl of pls) {
    const bucketStart = Math.floor((pl - start) / step) * step + start
    bucketMap.set(bucketStart, (bucketMap.get(bucketStart) ?? 0) + 1)
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, count]) => ({
      min: bucketStart,
      max: bucketStart + step,
      label: `$${bucketStart.toFixed(0)}`,
      count,
    }))
}

/** Get the most recent closed signal trade results. */
export async function getSignalRecentResults(
  limit = 10,
  opts?: { from?: Date; to?: Date },
): Promise<TVSignalRecentResult[]> {
  const where: Record<string, unknown> = {
    status: "executed",
    executionDetails: { not: null },
    resultTradeId: { not: null },
  }
  if (opts?.from || opts?.to) {
    const receivedAt: Record<string, Date> = {}
    if (opts?.from) receivedAt.gte = opts.from
    if (opts?.to) receivedAt.lte = opts.to
    where.receivedAt = receivedAt
  }

  const signals = await db.tVAlertSignal.findMany({
    where,
    orderBy: { processedAt: "desc" },
    take: limit * 2,
    select: {
      id: true,
      instrument: true,
      direction: true,
      executionDetails: true,
      processedAt: true,
    },
  })

  const results: TVSignalRecentResult[] = []
  for (const sig of signals) {
    if (results.length >= limit) break
    try {
      const details = JSON.parse(sig.executionDetails!) as TVExecutionDetails
      if (details.realizedPL === undefined) continue
      results.push({
        signalId: sig.id,
        instrument: sig.instrument,
        direction: sig.direction as TVSignalDirection,
        realizedPL: details.realizedPL,
        processedAt: sig.processedAt?.toISOString() ?? new Date().toISOString(),
      })
    } catch {
      /* ignore */
    }
  }

  return results
}

/** Get signal volume and outcome breakdown grouped by instrument. */
export async function getSignalsByPair(opts?: {
  from?: Date
  to?: Date
}): Promise<TVSignalPairStats[]> {
  const where: Record<string, unknown> = {}
  if (opts?.from || opts?.to) {
    const receivedAt: Record<string, Date> = {}
    if (opts?.from) receivedAt.gte = opts.from
    if (opts?.to) receivedAt.lte = opts.to
    where.receivedAt = receivedAt
  }

  const signals = await db.tVAlertSignal.findMany({
    where,
    select: { instrument: true, status: true, direction: true },
  })

  const map = new Map<string, TVSignalPairStats>()
  for (const sig of signals) {
    let entry = map.get(sig.instrument)
    if (!entry) {
      entry = {
        instrument: sig.instrument,
        total: 0,
        executed: 0,
        rejected: 0,
        failed: 0,
        buys: 0,
        sells: 0,
      }
      map.set(sig.instrument, entry)
    }
    entry.total++
    if (sig.status === "executed") entry.executed++
    else if (sig.status === "rejected" || sig.status === "skipped") entry.rejected++
    else if (sig.status === "failed") entry.failed++
    if (sig.direction === "buy") entry.buys++
    else if (sig.direction === "sell") entry.sells++
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}
