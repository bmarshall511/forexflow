import { NextResponse, type NextRequest } from "next/server"
import {
  getSmartFlowTradeByTradeId,
  getSmartFlowTradeBySourceId,
  getSmartFlowConfig,
} from "@fxflow/db"
import type {
  ApiResponse,
  SmartFlowTradeData,
  SmartFlowConfigData,
  SmartFlowOpportunityData,
} from "@fxflow/types"

export interface SmartFlowTradeContext {
  trade: SmartFlowTradeData
  config: SmartFlowConfigData | null
  opportunity: SmartFlowOpportunityData | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<SmartFlowTradeContext>>> {
  try {
    const { tradeId } = await params

    // Look up SmartFlow trade by the Trade.id (DB ID) or sourceTradeId (OANDA ID)
    const sfTrade =
      (await getSmartFlowTradeByTradeId(tradeId)) ?? (await getSmartFlowTradeBySourceId(tradeId))

    if (!sfTrade) {
      return NextResponse.json({ ok: false, error: "Not a SmartFlow trade" }, { status: 404 })
    }

    // Fetch the config that generated this trade
    const config = sfTrade.configId ? await getSmartFlowConfig(sfTrade.configId) : null

    // TODO: fetch scanner opportunity by configId once getSmartFlowOpportunityByConfigId is implemented
    const opportunity: SmartFlowOpportunityData | null = null

    return NextResponse.json({
      ok: true,
      data: { trade: sfTrade, config, opportunity },
    })
  } catch (error) {
    console.error("[GET /api/smart-flow/trades/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
