/** @module analytics-service — aggregated performance stats from closed trades. */
import { db } from "./client"
import { getCurrentSession } from "@fxflow/shared"
import type {
  TradeSource, AnalyticsFilters, PerformanceSummary, InstrumentPerformance,
  SessionPerformance, DayOfWeekPerformance, HourOfDayPerformance,
  SourcePerformance, MfeMaeEntry, EquityCurvePoint,
} from "@fxflow/types" // prettier-ignore

const SRC: Record<TradeSource, string> = {
  oanda: "OANDA", manual: "FXFlow", automated: "Auto",
  ut_bot_alerts: "TradingView Alert", trade_finder: "Trade Finder (Manual)",
  trade_finder_auto: "Trade Finder (Automatic)", ai_trader: "AI Trade",
} // prettier-ignore

const PLACED_VIA_MAP: Record<string, TradeSource> = {
  ut_bot_alerts: "ut_bot_alerts",
  trade_finder: "trade_finder",
  trade_finder_auto: "trade_finder_auto",
  ai_trader: "ai_trader",
  fxflow: "manual",
}

function enrichSource(source: string, metadata?: string | null): TradeSource {
  if (metadata) {
    try {
      const pv = (JSON.parse(metadata) as Record<string, unknown>).placedVia as string
      if (pv && pv in PLACED_VIA_MAP) return PLACED_VIA_MAP[pv]!
    } catch {
      /* ignore */
    }
  }
  return source as TradeSource
}

const MAX_PF = 999
function pf(gw: number, gl: number): number { return gl === 0 ? (gw > 0 ? MAX_PF : 0) : gw / gl } // prettier-ignore

interface Row {
  id: string; source: string; instrument: string; direction: string
  realizedPL: number; mfe: number | null; mae: number | null; metadata: string | null
  openedAt: Date; closedAt: Date | null; stopLoss: number | null
  takeProfit: number | null; entryPrice: number
} // prettier-ignore

const SELECT = {
  id: true, source: true, instrument: true, direction: true, realizedPL: true,
  mfe: true, mae: true, metadata: true, openedAt: true, closedAt: true,
  stopLoss: true, takeProfit: true, entryPrice: true,
} as const // prettier-ignore

async function fetchClosed(filters?: AnalyticsFilters): Promise<Row[]> {
  const where: Record<string, unknown> = { status: "closed" }
  if (filters?.dateFrom || filters?.dateTo) {
    const d: Record<string, Date> = {}
    if (filters.dateFrom) d.gte = filters.dateFrom
    if (filters.dateTo) d.lte = filters.dateTo
    where.closedAt = d
  }
  if (filters?.instrument) where.instrument = filters.instrument
  if (filters?.direction) where.direction = filters.direction
  const rows = await db.trade.findMany({ where, orderBy: { closedAt: "asc" }, select: SELECT })
  return filters?.source
    ? rows.filter((r) => enrichSource(r.source, r.metadata) === filters.source)
    : rows
}

function holdMin(r: Row): number { return r.closedAt ? (r.closedAt.getTime() - r.openedAt.getTime()) / 60_000 : 0 } // prettier-ignore

function groupBy<K extends string | number>(rows: Row[], keyFn: (r: Row) => K): Map<K, Row[]> {
  const m = new Map<K, Row[]>()
  for (const r of rows) {
    const k = keyFn(r)
    ;(m.get(k) ?? (m.set(k, []), m.get(k)!)).push(r)
  }
  return m
}

function agg(rows: Row[]) {
  const w = rows.filter((t) => t.realizedPL > 0), l = rows.filter((t) => t.realizedPL < 0)
  const pl = rows.reduce((s, t) => s + t.realizedPL, 0)
  const gw = w.reduce((s, t) => s + t.realizedPL, 0), gl = l.reduce((s, t) => s + Math.abs(t.realizedPL), 0)
  const n = rows.length
  return { trades: n, wins: w.length, losses: l.length, winRate: n > 0 ? w.length / n : 0,
    totalPL: pl, avgPL: n > 0 ? pl / n : 0, profitFactor: pf(gw, gl) }
} // prettier-ignore

function streaks(trades: Row[]) {
  let longestWin = 0,
    longestLoss = 0,
    wRun = 0,
    lRun = 0
  for (const t of trades) {
    if (t.realizedPL > 0) {
      wRun++
      lRun = 0
      longestWin = Math.max(longestWin, wRun)
    } else if (t.realizedPL < 0) {
      lRun++
      wRun = 0
      longestLoss = Math.max(longestLoss, lRun)
    } else {
      wRun = 0
      lRun = 0
    }
  }
  let curType: "win" | "loss" = "win",
    curCount = 0
  for (let i = trades.length - 1; i >= 0; i--) {
    const pl = trades[i]!.realizedPL
    if (pl === 0) break
    const tp = pl > 0 ? ("win" as const) : ("loss" as const)
    if (i === trades.length - 1) {
      curType = tp
      curCount = 1
    } else if (tp === curType) curCount++
    else break
  }
  return { longestWin, longestLoss, current: { type: curType, count: curCount } }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// ─── Public API ──────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: PerformanceSummary = {
  totalTrades: 0, wins: 0, losses: 0, breakevens: 0, winRate: 0, totalPL: 0, avgPL: 0,
  profitFactor: 0, expectancy: 0, avgRR: 0, avgHoldTimeMinutes: 0, largestWin: 0, largestLoss: 0,
  currentStreak: { type: "win", count: 0 }, longestWinStreak: 0, longestLossStreak: 0,
} // prettier-ignore

export async function getPerformanceSummary(
  filters?: AnalyticsFilters,
): Promise<PerformanceSummary> {
  const trades = await fetchClosed(filters)
  const n = trades.length
  if (n === 0) return { ...EMPTY_SUMMARY }

  const a = agg(trades)
  const gw = trades.filter((t) => t.realizedPL > 0).reduce((s, t) => s + t.realizedPL, 0)
  const gl = trades.filter((t) => t.realizedPL < 0).reduce((s, t) => s + Math.abs(t.realizedPL), 0)
  const avgWin = a.wins > 0 ? gw / a.wins : 0
  const avgLoss = a.losses > 0 ? gl / a.losses : 0

  let rrSum = 0,
    rrN = 0
  for (const t of trades) {
    if (t.stopLoss !== null && t.takeProfit !== null && t.stopLoss !== t.entryPrice) {
      const risk = Math.abs(t.entryPrice - t.stopLoss),
        reward = Math.abs(t.takeProfit - t.entryPrice)
      if (risk > 0) {
        rrSum += reward / risk
        rrN++
      }
    }
  }

  const s = streaks(trades)
  const wPLs = trades.filter((t) => t.realizedPL > 0).map((t) => t.realizedPL)
  const lPLs = trades.filter((t) => t.realizedPL < 0).map((t) => t.realizedPL)

  return {
    totalTrades: n,
    wins: a.wins,
    losses: a.losses,
    breakevens: trades.filter((t) => t.realizedPL === 0).length,
    winRate: a.winRate,
    totalPL: a.totalPL,
    avgPL: a.avgPL,
    profitFactor: a.profitFactor,
    expectancy: a.winRate * avgWin - (a.losses / n) * avgLoss,
    avgRR: rrN > 0 ? rrSum / rrN : 0,
    avgHoldTimeMinutes: trades.reduce((s, t) => s + holdMin(t), 0) / n,
    largestWin: wPLs.length > 0 ? Math.max(...wPLs) : 0,
    largestLoss: lPLs.length > 0 ? Math.min(...lPLs) : 0,
    currentStreak: s.current,
    longestWinStreak: s.longestWin,
    longestLossStreak: s.longestLoss,
  }
}

export async function getPerformanceByInstrument(
  filters?: AnalyticsFilters,
): Promise<InstrumentPerformance[]> {
  const trades = await fetchClosed(filters)
  return Array.from(groupBy(trades, (t) => t.instrument).entries())
    .map(([instrument, rows]) => ({ instrument, ...agg(rows) }))
    .sort((a, b) => b.trades - a.trades)
}

export async function getPerformanceBySession(
  filters?: AnalyticsFilters,
): Promise<SessionPerformance[]> {
  const trades = await fetchClosed(filters)
  return Array.from(groupBy(trades, (t) => getCurrentSession(t.openedAt).session).entries())
    .map(([session, rows]) => {
      const g = agg(rows)
      return {
        session,
        trades: g.trades,
        wins: g.wins,
        winRate: g.winRate,
        totalPL: g.totalPL,
        profitFactor: g.profitFactor,
      }
    })
    .sort((a, b) => b.trades - a.trades)
}

export async function getPerformanceByDayOfWeek(
  filters?: AnalyticsFilters,
): Promise<DayOfWeekPerformance[]> {
  const trades = await fetchClosed(filters)
  return Array.from(groupBy(trades, (t) => t.openedAt.getUTCDay()).entries())
    .map(([day, rows]) => {
      const g = agg(rows)
      return {
        day,
        dayName: DAYS[day]!,
        trades: g.trades,
        wins: g.wins,
        winRate: g.winRate,
        totalPL: g.totalPL,
      }
    })
    .sort((a, b) => a.day - b.day)
}

export async function getPerformanceByHourOfDay(
  filters?: AnalyticsFilters,
): Promise<HourOfDayPerformance[]> {
  const trades = await fetchClosed(filters)
  return Array.from(groupBy(trades, (t) => t.openedAt.getUTCHours()).entries())
    .map(([hour, rows]) => {
      const g = agg(rows)
      return { hour, trades: g.trades, wins: g.wins, winRate: g.winRate, totalPL: g.totalPL }
    })
    .sort((a, b) => a.hour - b.hour)
}

export async function getPerformanceBySource(
  filters?: AnalyticsFilters,
): Promise<SourcePerformance[]> {
  const trades = await fetchClosed(filters)
  return Array.from(groupBy(trades, (t) => enrichSource(t.source, t.metadata)).entries())
    .map(([source, rows]) => {
      const g = agg(rows)
      return {
        source,
        sourceLabel: SRC[source as TradeSource] ?? source,
        trades: g.trades,
        wins: g.wins,
        winRate: g.winRate,
        totalPL: g.totalPL,
        profitFactor: g.profitFactor,
      }
    })
    .sort((a, b) => b.trades - a.trades)
}

export async function getMfeMaeDistribution(filters?: AnalyticsFilters): Promise<MfeMaeEntry[]> {
  const trades = await fetchClosed(filters)
  return trades.map((t) => ({
    tradeId: t.id,
    instrument: t.instrument,
    outcome: t.realizedPL > 0 ? "win" : t.realizedPL < 0 ? "loss" : "breakeven",
    mfePips: t.mfe,
    maePips: t.mae,
    realizedPL: t.realizedPL,
    holdTimeMinutes: holdMin(t),
  }))
}

export async function getEquityCurve(filters?: AnalyticsFilters): Promise<EquityCurvePoint[]> {
  const trades = await fetchClosed(filters)
  if (trades.length === 0) return []
  const daily = new Map<string, { pl: number; count: number }>()
  for (const t of trades) {
    const key = (t.closedAt ?? t.openedAt).toISOString().slice(0, 10)
    const e = daily.get(key) ?? { pl: 0, count: 0 }
    e.pl += t.realizedPL
    e.count++
    daily.set(key, e)
  }
  let cum = 0,
    tc = 0
  return Array.from(daily.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { pl, count }]) => {
      cum += pl
      tc += count
      return { date, cumulativePL: cum, tradeCount: tc }
    })
}
