import { NextResponse } from "next/server"
import { getSignalPeriodPnL } from "@fxflow/db"
import type { ApiResponse, TVSignalPeriodPnLData } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<TVSignalPeriodPnLData>>> {
  try {
    const data = await getSignalPeriodPnL()
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[GET /api/tv-alerts/stats/periods]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
