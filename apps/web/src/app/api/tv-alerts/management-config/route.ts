import { NextResponse, type NextRequest } from "next/server"
import { getTVAlertsManagementConfig, updateTVAlertsManagementConfig } from "@fxflow/db"
import type { ApiResponse, TVAlertsManagementConfig } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<TVAlertsManagementConfig>>> {
  try {
    const config = await getTVAlertsManagementConfig()
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/tv-alerts/management-config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TVAlertsManagementConfig>>> {
  try {
    const body = (await request.json()) as Partial<TVAlertsManagementConfig>
    const config = await updateTVAlertsManagementConfig(body)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[PUT /api/tv-alerts/management-config]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
