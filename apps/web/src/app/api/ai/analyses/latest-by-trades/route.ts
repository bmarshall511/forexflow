import { NextRequest, NextResponse } from "next/server"
import { getLatestAnalysisByTradeIds, getAnalysisCountsByTradeIds } from "@fxflow/db"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ids = req.nextUrl.searchParams.get("ids")
  if (!ids) return NextResponse.json({ ok: true, data: { latest: {}, counts: {} } })

  const tradeIds = ids.split(",").filter(Boolean)
  if (tradeIds.length === 0) return NextResponse.json({ ok: true, data: { latest: {}, counts: {} } })

  try {
    const [latest, counts] = await Promise.all([
      getLatestAnalysisByTradeIds(tradeIds),
      getAnalysisCountsByTradeIds(tradeIds),
    ])
    return NextResponse.json({ ok: true, data: { latest, counts } })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
