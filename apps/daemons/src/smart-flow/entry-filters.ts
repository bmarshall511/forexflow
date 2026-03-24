import { isAutoTradeSession } from "@fxflow/shared"
import { hasImminentHighImpactEvent } from "@fxflow/db"
import type {
  SmartFlowSettingsData,
  SmartFlowSessionRestriction,
  SmartFlowScanMode,
} from "@fxflow/types"

export interface FilterResult {
  passed: boolean
  reason?: string
}

export interface FilterResults {
  [filterName: string]: FilterResult
}

const pass = (): FilterResult => ({ passed: true })
const fail = (reason: string): FilterResult => ({ passed: false, reason })

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

export function checkSpread(
  instrument: string,
  spreadPips: number,
  riskPips: number,
  maxSpreadPercent = 0.2,
): FilterResult {
  const maxSpread = riskPips * maxSpreadPercent
  if (spreadPips > maxSpread) {
    return fail(
      `Spread ${spreadPips.toFixed(1)} pips exceeds ${(maxSpreadPercent * 100).toFixed(0)}% of SL (${maxSpread.toFixed(1)} pips)`,
    )
  }
  return pass()
}

export function checkCorrelation(
  instrument: string,
  direction: "long" | "short",
  openPositions: { instrument: string; direction: string }[],
  maxPerCurrency: number,
): FilterResult {
  const [base, quote] = instrument.split("_")
  if (!base || !quote) return pass()

  let sameDirectionCount = 0

  for (const pos of openPositions) {
    const [posBase, posQuote] = pos.instrument.split("_")
    if (!posBase || !posQuote) continue

    const sharesCurrency =
      posBase === base || posBase === quote || posQuote === base || posQuote === quote
    if (!sharesCurrency) continue

    // Same directional exposure: buying EUR_USD and buying EUR_GBP both expose long EUR
    const sameExposure =
      (posBase === base && pos.direction === direction) ||
      (posQuote === quote && pos.direction === direction) ||
      (posBase === quote && pos.direction !== direction) ||
      (posQuote === base && pos.direction !== direction)

    if (sameExposure) sameDirectionCount++
  }

  if (sameDirectionCount >= maxPerCurrency) {
    return fail(`${sameDirectionCount} correlated positions already open (max ${maxPerCurrency})`)
  }
  return pass()
}

export async function checkNews(instrument: string, bufferMinutes: number): Promise<FilterResult> {
  const result = await hasImminentHighImpactEvent(instrument, Math.ceil(bufferMinutes / 60))
  if (result.imminent) {
    return fail(`High-impact news imminent${result.event ? `: ${result.event}` : ""}`)
  }
  return pass()
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
    correlation: checkCorrelation(
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
