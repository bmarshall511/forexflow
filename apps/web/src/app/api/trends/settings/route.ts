import { NextResponse, type NextRequest } from "next/server"
import { getTrendSettings, saveTrendSettings } from "@fxflow/db"
import type { TrendDisplaySettings, TrendSettingsResponse } from "@fxflow/types"

export async function GET(): Promise<NextResponse> {
  try {
    const global = await getTrendSettings()
    const response: TrendSettingsResponse = { global }
    return NextResponse.json({ ok: true, data: response })
  } catch (error) {
    console.error("[GET /api/trends/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as TrendDisplaySettings
    await saveTrendSettings(body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[PUT /api/trends/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
