import { NextRequest, NextResponse } from "next/server"
import { getSignalPnLDistribution, getSignalRecentResults, getSignalsByPair } from "@fxflow/db"
import type { ApiResponse, TVAlertsDetailedStats } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TVAlertsDetailedStats>>> {
  try {
    const sp = request.nextUrl.searchParams
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined
    const opts = from || to ? { from, to } : undefined

    const [distribution, recentResults, signalsByPair] = await Promise.all([
      getSignalPnLDistribution(opts),
      getSignalRecentResults(10, opts),
      getSignalsByPair(opts),
    ])

    return NextResponse.json({ ok: true, data: { distribution, recentResults, signalsByPair } })
  } catch (error) {
    console.error("[GET /api/tv-alerts/stats/detailed]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
