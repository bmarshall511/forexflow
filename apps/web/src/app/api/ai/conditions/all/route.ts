import { NextRequest, NextResponse } from "next/server"
import { getAllConditionSummaries } from "@fxflow/db"
import type { TradeConditionStatus } from "@fxflow/types"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const status = req.nextUrl.searchParams.get("status") as TradeConditionStatus | "all" | null

  try {
    const data = await getAllConditionSummaries({ status: status ?? "all" })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
