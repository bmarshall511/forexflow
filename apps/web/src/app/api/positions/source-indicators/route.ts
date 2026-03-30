import { NextRequest } from "next/server"
import {
  findSetupByResultSourceId,
  findOpportunityByResultSourceId,
  getSmartFlowTradeByTradeId,
} from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

interface IndicatorRequest {
  id: string // trade DB id
  sourceTradeId: string
  source: string
}

interface IndicatorResult {
  id: string
  indicator: string | null
}

/**
 * POST /api/positions/source-indicators
 *
 * Batch-fetches source-specific indicator values (score, confidence, phase)
 * for multiple trades at once. Returns a map of tradeId -> indicator string.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { trades: IndicatorRequest[] }
    if (!body.trades || !Array.isArray(body.trades)) {
      return apiError("trades array required")
    }

    // Limit batch size
    const trades = body.trades.slice(0, 50)

    const results: IndicatorResult[] = await Promise.all(
      trades.map(async (t) => {
        try {
          if (t.source === "trade_finder_auto" || t.source === "trade_finder") {
            const setup = await findSetupByResultSourceId(t.sourceTradeId)
            if (setup)
              return { id: t.id, indicator: `${setup.scores.total}/${setup.scores.maxPossible}` }
          }
          if (t.source === "ai_trader" || t.source === "ai_trader_manual") {
            const opp = await findOpportunityByResultSourceId(t.sourceTradeId)
            if (opp) return { id: t.id, indicator: `${opp.confidence}%` }
          }
          if (t.source === "smart_flow") {
            const sf = await getSmartFlowTradeByTradeId(t.id)
            if (sf) return { id: t.id, indicator: sf.currentPhase }
          }
          // TV Alerts and others don't have a meaningful single indicator
        } catch {
          // Best-effort per trade
        }
        return { id: t.id, indicator: null }
      }),
    )

    const indicatorMap: Record<string, string | null> = {}
    for (const r of results) indicatorMap[r.id] = r.indicator
    return apiSuccess(indicatorMap)
  } catch (error) {
    console.error("[POST /api/positions/source-indicators]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
