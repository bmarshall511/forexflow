import { NextResponse } from "next/server"
import { getSettings } from "@fxflow/db"
import type { ApiResponse, SettingsResponse } from "@fxflow/types"

export async function GET(): Promise<NextResponse<ApiResponse<SettingsResponse>>> {
  try {
    const settings = await getSettings()
    return NextResponse.json({ ok: true, data: settings })
  } catch (error) {
    console.error("[GET /api/settings]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
