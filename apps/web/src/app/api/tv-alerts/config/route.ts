import { NextResponse, type NextRequest } from "next/server"
import { getTVAlertsConfig, updateTVAlertsConfig, generateWebhookToken } from "@fxflow/db"
import type { ApiResponse, TVAlertsConfig } from "@fxflow/types"
import { TVAlertsConfigUpdateSchema } from "@fxflow/types"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"

export async function GET(): Promise<NextResponse<ApiResponse<TVAlertsConfig>>> {
  try {
    const config = await getTVAlertsConfig()
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/tv-alerts/config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TVAlertsConfig>>> {
  try {
    const parsed = await parseBody(request, TVAlertsConfigUpdateSchema)
    if (!parsed.success) return parsed.response

    const body = parsed.data

    // Handle token regeneration (generateWebhookToken already persists the token)
    if (body.regenerateToken) {
      await generateWebhookToken()
      const config = await getTVAlertsConfig()
      return apiSuccess(config)
    }

    const config = await updateTVAlertsConfig(body)
    return apiSuccess(config)
  } catch (error) {
    console.error("[PUT /api/tv-alerts/config]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
