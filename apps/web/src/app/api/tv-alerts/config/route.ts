import { NextResponse, type NextRequest } from "next/server"
import { getTVAlertsConfig, updateTVAlertsConfig, generateWebhookToken } from "@fxflow/db"
import type { ApiResponse, TVAlertsConfig } from "@fxflow/types"

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
    const body = await request.json()

    // Handle token regeneration (generateWebhookToken already persists the token)
    if (body.regenerateToken) {
      await generateWebhookToken()
      const config = await getTVAlertsConfig()
      return NextResponse.json({ ok: true, data: config })
    }

    // Validate numeric fields if provided
    if (body.positionSizePercent !== undefined) {
      const v = Number(body.positionSizePercent)
      if (isNaN(v) || v < 0.1 || v > 100) {
        return NextResponse.json(
          { ok: false, error: "positionSizePercent must be between 0.1 and 100" },
          { status: 400 },
        )
      }
    }
    if (body.cooldownSeconds !== undefined) {
      const v = Number(body.cooldownSeconds)
      if (isNaN(v) || v < 0) {
        return NextResponse.json(
          { ok: false, error: "cooldownSeconds must be >= 0" },
          { status: 400 },
        )
      }
    }
    if (body.maxOpenPositions !== undefined) {
      const v = Number(body.maxOpenPositions)
      if (isNaN(v) || v < 1) {
        return NextResponse.json(
          { ok: false, error: "maxOpenPositions must be >= 1" },
          { status: 400 },
        )
      }
    }
    if (body.dailyLossLimit !== undefined) {
      const v = Number(body.dailyLossLimit)
      if (isNaN(v) || v < 0) {
        return NextResponse.json(
          { ok: false, error: "dailyLossLimit must be >= 0" },
          { status: 400 },
        )
      }
    }
    if (body.dedupWindowSeconds !== undefined) {
      const v = Number(body.dedupWindowSeconds)
      if (isNaN(v) || v < 1 || v > 60) {
        return NextResponse.json(
          { ok: false, error: "dedupWindowSeconds must be between 1 and 60" },
          { status: 400 },
        )
      }
    }

    const config = await updateTVAlertsConfig(body)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[PUT /api/tv-alerts/config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
