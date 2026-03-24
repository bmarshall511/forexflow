import { NextResponse, type NextRequest } from "next/server"
import { getTVAlertsQualityConfig, updateTVAlertsQualityConfig } from "@fxflow/db"
import type { ApiResponse, TVAlertsQualityConfig } from "@fxflow/types"
import { TVAlertsQualityConfigUpdateSchema } from "@fxflow/types"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

export async function GET(): Promise<NextResponse<ApiResponse<TVAlertsQualityConfig>>> {
  try {
    const config = await getTVAlertsQualityConfig()
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/tv-alerts/quality-config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TVAlertsQualityConfig>>> {
  try {
    const parsed = await parseBody(request, TVAlertsQualityConfigUpdateSchema)
    if (!parsed.success) return parsed.response

    const config = await updateTVAlertsQualityConfig(parsed.data)
    return apiSuccess(config)
  } catch (error) {
    console.error("[PUT /api/tv-alerts/quality-config]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
