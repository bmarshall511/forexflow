/**
 * Dashboard aggregator — one HTTP round trip instead of five.
 *
 * The redesigned dashboard wants summary + equity + drawdown + source
 * breakdown + instrument + session in a single payload so the hero
 * renders on first paint without a cascade of requests. Each underlying
 * function is account-scoped via the shared analytics filter parser.
 *
 * Query params:
 *   - all standard `AnalyticsFilters` params (dateFrom/dateTo/instrument/source/direction)
 *   - optional `startingBalance` to anchor the balance + drawdown curves
 */
import type { NextRequest } from "next/server"
import {
  getPerformanceSummary,
  getEquityCurve,
  getDrawdownCurve,
  getSourceBreakdown,
  getPerformanceByInstrument,
  getPerformanceBySession,
} from "@fxflow/db"
import type {
  PerformanceSummary,
  EquityCurvePoint,
  DrawdownPoint,
  SourceDetailedPerformance,
  InstrumentPerformance,
  SessionPerformance,
} from "@fxflow/types"
import { apiSuccess, apiError } from "@/lib/api-validation"
import { parseAnalyticsFilters } from "../_parse-filters"

export interface DashboardAnalyticsPayload {
  summary: PerformanceSummary
  equity: EquityCurvePoint[]
  drawdown: DrawdownPoint[]
  source: SourceDetailedPerformance[]
  byInstrument: InstrumentPerformance[]
  bySession: SessionPerformance[]
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = await parseAnalyticsFilters(request.nextUrl.searchParams)
    const startingBalanceParam = request.nextUrl.searchParams.get("startingBalance")
    const startingBalance = startingBalanceParam ? Number(startingBalanceParam) : undefined
    const balanceArg = Number.isFinite(startingBalance) ? startingBalance : undefined

    const [summary, equity, drawdown, source, byInstrument, bySession] = await Promise.all([
      getPerformanceSummary(filters),
      getEquityCurve(filters, balanceArg),
      getDrawdownCurve(filters, balanceArg),
      getSourceBreakdown(filters),
      getPerformanceByInstrument(filters),
      getPerformanceBySession(filters),
    ])

    const payload: DashboardAnalyticsPayload = {
      summary,
      equity,
      drawdown,
      source,
      byInstrument,
      bySession,
    }
    return apiSuccess(payload)
  } catch (error) {
    console.error("[GET /api/analytics/dashboard]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
