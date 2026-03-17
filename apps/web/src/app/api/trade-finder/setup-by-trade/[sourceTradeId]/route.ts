import { NextResponse } from "next/server"
import { findSetupByResultSourceId } from "@fxflow/db"
import type { ApiResponse, TradeFinderSetupData } from "@fxflow/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sourceTradeId: string }> },
): Promise<NextResponse<ApiResponse<TradeFinderSetupData | null>>> {
  try {
    const { sourceTradeId } = await params
    const setup = await findSetupByResultSourceId(sourceTradeId)
    if (!setup) {
      return NextResponse.json({ ok: true, data: null })
    }
    return NextResponse.json({ ok: true, data: setup })
  } catch (error) {
    console.error("[GET /api/trade-finder/setup-by-trade]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
