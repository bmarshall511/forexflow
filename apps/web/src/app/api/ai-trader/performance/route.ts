import { NextResponse } from "next/server"
import { getPerformanceStats } from "@fxflow/db"
import type { ApiResponse, AiTraderStrategyPerformanceData } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<AiTraderStrategyPerformanceData[]>>> {
  try {
    const stats = await getPerformanceStats()
    return NextResponse.json({ ok: true, data: stats })
  } catch (error) {
    console.error("[GET /api/ai-trader/performance]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
