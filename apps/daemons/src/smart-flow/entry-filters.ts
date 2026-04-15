/**
 * SmartFlow entry filters.
 *
 * Thin orchestration layer on top of `@fxflow/shared/trading-core`. The
 * cross-system primitives (correlation, spread, news, R:R multipliers) live
 * in trading-core so EdgeFinder and Trade Finder can share the same logic.
 * Only SmartFlow-specific filters (regime-to-scan-mode matching, RSI extreme,
 * session restriction, concurrent/daily caps) live here.
 */
import { isAutoTradeSession } from "@fxflow/shared"
import { hasImminentHighImpactEvent } from "@fxflow/db"
import type {
  SmartFlowSettingsData,
  SmartFlowSessionRestriction,
  SmartFlowScanMode,
} from "@fxflow/types"
import {
  checkCorrelation as checkCorrelationShared,
  checkSpread as checkSpreadShared,
  checkNewsGate,
  getAdaptiveMinRR as getAdaptiveMinRRShared,
  type GateResult,
  type NewsCalendarSource,
} from "@fxflow/shared"

// Re-export the shared R:R helper under SmartFlow's existing import name.
export const getAdaptiveMinRR = getAdaptiveMinRRShared

// Re-export the shared correlation guard for backwards compatibility with
// existing SmartFlow callers (manager.placeMarketEntry imports checkCorrelation).
export const checkCorrelation = checkCorrelationShared

export interface FilterResult {
  passed: boolean
  reason?: string
}
export interface FilterResults {
  [filterName: string]: FilterResult
}

const pass = (): FilterResult => ({ passed: true })
const fail = (reason: string): FilterResult => ({ passed: false, reason })

// Adapter: the DB news source into the shared NewsCalendarSource contract.
const dbNewsSource: NewsCalendarSource = {
  async hasImminentEvent(instrument, bufferHours) {
    const result = await hasImminentHighImpactEvent(instrument, Math.ceil(bufferHours))
    return { imminent: result.imminent, event: result.event ?? null }
  },
}

export function checkSession(
  instrument: string,
  restriction: SmartFlowSessionRestriction,
): FilterResult {
  if (restriction === "any") return pass()

  if (restriction === "kill_zones") {
    const session = isAutoTradeSession(instrument)
    return session.allowed ? pass() : fail(`Outside kill zone: ${session.reason}`)
  }

  // "extended" — London + NY full sessions (07:00–21:00 UTC)
  const hour = new Date().getUTCHours()
  if (hour >= 7 && hour < 21) return pass()
  return fail("Outside extended session hours (07:00–21:00 UTC)")
}

/** Legacy wrapper — delegates to shared `checkSpread`. */
export function checkSpread(
  _instrument: string,
  spreadPips: number,
  riskPips: number,
  maxSpreadPercent = 0.2,
): FilterResult {
  return checkSpreadShared({ spreadPips, riskPips, maxPercent: maxSpreadPercent })
}

export async function checkNews(instrument: string, bufferMinutes: number): Promise<GateResult> {
  return checkNewsGate({ instrument, bufferMinutes, source: dbNewsSource })
}

type RegimeRating = "best" | "ok" | "bad"
const REGIME_MAP: Record<SmartFlowScanMode, Record<string, RegimeRating>> = {
  trend_following: { trending: "best", volatile: "ok", ranging: "bad", low_volatility: "bad" },
  mean_reversion: { ranging: "best", low_volatility: "ok", trending: "bad", volatile: "bad" },
  breakout: { trending: "ok", volatile: "ok", ranging: "ok", low_volatility: "bad" },
  session_momentum: { volatile: "best", trending: "ok", ranging: "bad", low_volatility: "bad" },
}

export function checkRegimeMatch(scanMode: SmartFlowScanMode, regime: string | null): FilterResult {
  if (!regime) return pass()
  const ratings = REGIME_MAP[scanMode]
  if (!ratings) return pass()
  const rating = ratings[regime] ?? "ok"
  if (rating === "bad") return fail(`${scanMode} unsuitable in ${regime} regime`)
  if (rating === "ok")
    return { passed: true, reason: `Suboptimal: ${scanMode} in ${regime} regime` }
  return pass()
}

export function checkRsiExtreme(
  direction: "long" | "short",
  rsiValue: number | null,
): FilterResult {
  if (rsiValue === null) return pass()
  if (direction === "long" && rsiValue > 70) return fail(`RSI overbought at ${rsiValue.toFixed(1)}`)
  if (direction === "short" && rsiValue < 30) return fail(`RSI oversold at ${rsiValue.toFixed(1)}`)
  return pass()
}

export function checkExistingPosition(
  instrument: string,
  openPositions: { instrument: string }[],
): FilterResult {
  if (openPositions.some((p) => p.instrument === instrument)) {
    return fail(`Already have an open position on ${instrument}`)
  }
  return pass()
}

export function checkMaxConcurrent(openCount: number, maxConcurrent: number): FilterResult {
  if (openCount >= maxConcurrent) {
    return fail(`${openCount} open trades (max ${maxConcurrent})`)
  }
  return pass()
}

export function checkDailyCap(todayCount: number, maxDaily: number): FilterResult {
  if (todayCount >= maxDaily) {
    return fail(`${todayCount} trades today (max ${maxDaily})`)
  }
  return pass()
}

export async function runAllFilters(
  instrument: string,
  direction: "long" | "short",
  scanMode: SmartFlowScanMode,
  regime: string | null,
  rsiValue: number | null,
  spreadPips: number,
  riskPips: number,
  settings: SmartFlowSettingsData,
  openPositions: { instrument: string; direction: string }[],
  todayTradeCount: number,
  openTradeCount: number,
): Promise<{ allPassed: boolean; results: FilterResults }> {
  const results: FilterResults = {
    session: checkSession(instrument, settings.sessionRestriction),
    spread: checkSpread(instrument, spreadPips, riskPips),
    correlation: checkCorrelationShared(
      instrument,
      direction,
      openPositions,
      settings.maxCorrelatedPairs,
    ),
    news: await checkNews(instrument, settings.newsBufferMinutes),
    regime: checkRegimeMatch(scanMode, regime),
    rsiExtreme: checkRsiExtreme(direction, rsiValue),
    existingPosition: checkExistingPosition(instrument, openPositions),
    maxConcurrent: checkMaxConcurrent(openTradeCount, settings.maxConcurrentTrades),
    dailyCap: checkDailyCap(todayTradeCount, settings.maxDailyAutoTrades),
  }

  const allPassed = Object.values(results).every((r) => r.passed)
  return { allPassed, results }
}
