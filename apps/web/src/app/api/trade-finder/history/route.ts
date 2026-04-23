import { NextResponse, type NextRequest } from "next/server"
import { getSetupHistory, getSettings } from "@fxflow/db"
import type { ApiResponse, TradeFinderSetupData } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TradeFinderSetupData[]>>> {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50")
    const settings = await getSettings()
    const history = await getSetupHistory(limit, settings.tradingMode)
    return NextResponse.json({ ok: true, data: history })
  } catch (error) {
    console.error("[GET /api/trade-finder/history]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
