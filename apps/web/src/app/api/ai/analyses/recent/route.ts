import { NextRequest, NextResponse } from "next/server"
import { getRecentAnalysesWithTrade } from "@fxflow/db"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const limitParam = req.nextUrl.searchParams.get("limit")
  const limit = Math.min(Math.max(parseInt(limitParam ?? "3", 10) || 3, 1), 20)

  try {
    const data = await getRecentAnalysesWithTrade(limit)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
