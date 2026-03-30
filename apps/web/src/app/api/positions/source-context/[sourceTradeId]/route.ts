import { NextRequest } from "next/server"
import {
  findSetupByResultSourceId,
  findOpportunityByResultSourceId,
  findSignalByResultTradeId,
  getSmartFlowTradeByTradeId,
} from "@fxflow/db"
import { apiSuccess, apiError } from "@/lib/api-validation"

/**
 * GET /api/positions/source-context/[sourceTradeId]?source=trade_finder_auto&tradeId=xxx
 *
 * Looks up source-specific context for a trade based on its enriched source type.
 * Returns score breakdowns, confidence, rationale, phase, etc. depending on source.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceTradeId: string }> },
) {
  try {
    const { sourceTradeId } = await params
    const source = request.nextUrl.searchParams.get("source")
    const tradeId = request.nextUrl.searchParams.get("tradeId")

    if (!source) return apiError("source query param required")

    // Trade Finder (auto or manual)
    if (source === "trade_finder_auto" || source === "trade_finder") {
      const setup = await findSetupByResultSourceId(sourceTradeId)
      if (!setup) return apiSuccess({ source, found: false })
      return apiSuccess({
        source,
        found: true,
        data: {
          scoreTotal: setup.scores.total,
          maxPossible: setup.scores.maxPossible,
          scores: setup.scores,
          zone: setup.zone,
          rrRatio: setup.rrRatio,
          autoPlaced: setup.autoPlaced,
          confirmationPattern: setup.confirmationPattern,
          breakevenMoved: setup.breakevenMoved,
          partialTaken: setup.partialTaken,
          detectedAt: setup.detectedAt,
          placedAt: setup.placedAt,
          distanceToEntryPips: setup.distanceToEntryPips,
          timeframeSet: setup.timeframeSet,
        },
      })
    }

    // EdgeFinder (AI Trader)
    if (source === "ai_trader" || source === "ai_trader_manual") {
      const opp = await findOpportunityByResultSourceId(sourceTradeId)
      if (!opp) return apiSuccess({ source, found: false })
      return apiSuccess({
        source,
        found: true,
        data: {
          confidence: opp.confidence,
          scores: opp.scores,
          profile: opp.profile,
          regime: opp.regime,
          session: opp.session,
          primaryTechnique: opp.primaryTechnique,
          entryRationale: opp.entryRationale,
          tier2Model: opp.tier2Model,
          tier2Cost: opp.tier2Cost,
          tier3Model: opp.tier3Model,
          tier3Cost: opp.tier3Cost,
          riskRewardRatio: opp.riskRewardRatio,
          detectedAt: opp.detectedAt,
        },
      })
    }

    // TV Alerts
    if (source === "ut_bot_alerts") {
      const signal = await findSignalByResultTradeId(sourceTradeId)
      if (!signal) return apiSuccess({ source, found: false })
      return apiSuccess({
        source,
        found: true,
        data: {
          status: signal.status,
          direction: signal.direction,
          rejectionReason: signal.rejectionReason,
          executionDetails: signal.executionDetails,
          signalTime: signal.signalTime,
          receivedAt: signal.receivedAt,
          processedAt: signal.processedAt,
        },
      })
    }

    // SmartFlow
    if (source === "smart_flow" && tradeId) {
      const sfTrade = await getSmartFlowTradeByTradeId(tradeId)
      if (!sfTrade) return apiSuccess({ source, found: false })
      return apiSuccess({
        source,
        found: true,
        data: {
          currentPhase: sfTrade.currentPhase,
          breakevenTriggered: sfTrade.breakevenTriggered,
          trailingActivated: sfTrade.trailingActivated,
          recoveryLevel: sfTrade.recoveryLevel,
          financingAccumulated: sfTrade.financingAccumulated,
          safetyNetTriggered: sfTrade.safetyNetTriggered,
          partialCloseLog: sfTrade.partialCloseLog,
          managementLog: sfTrade.managementLog.slice(-5), // Last 5 entries
          preset: sfTrade.preset,
          configName: sfTrade.configName,
        },
      })
    }

    // No context available for oanda/manual sources
    return apiSuccess({ source, found: false })
  } catch (error) {
    console.error("[GET /api/positions/source-context]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
