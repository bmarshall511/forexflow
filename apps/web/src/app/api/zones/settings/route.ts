import { NextResponse, type NextRequest } from "next/server"
import { getZoneSettings, saveZoneSettings } from "@fxflow/db"
import type { ZoneDisplaySettings, ZoneSettingsResponse } from "@fxflow/types"

export async function GET(): Promise<NextResponse> {
  try {
    const global = await getZoneSettings()
    const response: ZoneSettingsResponse = { global }
    return NextResponse.json({ ok: true, data: response })
  } catch (error) {
    console.error("[GET /api/zones/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ZoneDisplaySettings
    await saveZoneSettings(body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[PUT /api/zones/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
