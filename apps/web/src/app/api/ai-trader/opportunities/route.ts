import { NextResponse } from "next/server"
import { getOpportunityHistory } from "@fxflow/db"
import type { ApiResponse, AiTraderOpportunityData } from "@fxflow/types"

export async function GET() {
  try {
    const opportunities = await getOpportunityHistory(50)
    return NextResponse.json<ApiResponse<AiTraderOpportunityData[]>>({
      ok: true,
      data: opportunities,
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/opportunities]", error)
    return NextResponse.json<ApiResponse<AiTraderOpportunityData[]>>(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
