import { NextResponse, type NextRequest } from "next/server"
import { removeTagFromTrade } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

interface BulkUntagRequest {
  tradeIds: string[]
  tagId: string
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ succeeded: number; failed: number }>>> {
  try {
    const body = (await request.json()) as BulkUntagRequest
    const { tradeIds, tagId } = body

    if (!Array.isArray(tradeIds) || tradeIds.length === 0 || !tagId) {
      return NextResponse.json(
        { ok: false, error: "tradeIds (non-empty array) and tagId are required" },
        { status: 400 },
      )
    }

    let succeeded = 0
    let failed = 0

    for (const tradeId of tradeIds) {
      try {
        await removeTagFromTrade(tradeId, tagId)
        succeeded++
      } catch {
        failed++
      }
    }

    return NextResponse.json({ ok: true, data: { succeeded, failed } })
  } catch (error) {
    console.error("[POST /api/trades/bulk-untag]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
