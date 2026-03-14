import { NextResponse, type NextRequest } from "next/server"
import { getTradeFinderConfig, updateTradeFinderConfig } from "@fxflow/db"
import type { ApiResponse, TradeFinderConfigData } from "@fxflow/types"
import { TradeFinderConfigUpdateSchema } from "@fxflow/types"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

export async function GET(): Promise<NextResponse<ApiResponse<TradeFinderConfigData>>> {
  try {
    const config = await getTradeFinderConfig()
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/trade-finder/config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TradeFinderConfigData>>> {
  try {
    const parsed = await parseBody(request, TradeFinderConfigUpdateSchema)
    if (!parsed.success) return parsed.response

    const config = await updateTradeFinderConfig(parsed.data)
    return apiSuccess(config)
  } catch (error) {
    console.error("[PUT /api/trade-finder/config]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
