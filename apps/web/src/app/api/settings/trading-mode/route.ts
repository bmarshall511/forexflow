import { NextResponse } from "next/server"
import { setTradingMode } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"
import { UpdateTradingModeSchema } from "@fxflow/types"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

export async function PUT(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const parsed = await parseBody(request, UpdateTradingModeSchema)
    if (!parsed.success) return parsed.response

    await setTradingMode(parsed.data.mode)
    return apiSuccess(undefined)
  } catch (error) {
    console.error("[PUT /api/settings/trading-mode]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
