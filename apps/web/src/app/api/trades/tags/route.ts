import { NextResponse, type NextRequest } from "next/server"
import { getTagsForTradeIds } from "@fxflow/db"
import type { ApiResponse, TradeTagData } from "@fxflow/types"

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Record<string, TradeTagData[]>>>> {
  try {
    const ids = request.nextUrl.searchParams.get("ids")
    if (!ids) {
      return NextResponse.json({ ok: false, error: "Missing ids parameter" }, { status: 400 })
    }

    const tradeIds = ids.split(",").filter(Boolean)
    const tagsByTradeId = await getTagsForTradeIds(tradeIds)
    return NextResponse.json({ ok: true, data: tagsByTradeId })
  } catch (error) {
    console.error("[GET /api/trades/tags]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
