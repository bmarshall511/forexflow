import { NextResponse, type NextRequest } from "next/server"
import { assignTagToTrade, removeTagFromTrade } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { tradeId } = await params
    const { tagId } = (await request.json()) as { tagId: string }
    if (!tagId) {
      return NextResponse.json({ ok: false, error: "tagId is required" }, { status: 400 })
    }
    await assignTagToTrade(tradeId, tagId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/trades/[tradeId]/tags]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { tradeId } = await params
    const { tagId } = (await request.json()) as { tagId: string }
    if (!tagId) {
      return NextResponse.json({ ok: false, error: "tagId is required" }, { status: 400 })
    }
    await removeTagFromTrade(tradeId, tagId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/trades/[tradeId]/tags]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
