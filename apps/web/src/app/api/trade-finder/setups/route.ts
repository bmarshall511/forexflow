import { NextResponse } from "next/server"
import { getActiveSetups } from "@fxflow/db"
import type { ApiResponse, TradeFinderSetupData } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<TradeFinderSetupData[]>>> {
  try {
    const setups = await getActiveSetups()
    return NextResponse.json({ ok: true, data: setups })
  } catch (error) {
    console.error("[GET /api/trade-finder/setups]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
