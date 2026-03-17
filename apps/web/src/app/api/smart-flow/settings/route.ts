import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSmartFlowSettings, updateSmartFlowSettings } from "@fxflow/db"

export async function GET() {
  try {
    const settings = await getSmartFlowSettings()
    return NextResponse.json({ ok: true, data: settings })
  } catch (error) {
    console.error("[GET /api/smart-flow/settings]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read SmartFlow settings",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const settings = await updateSmartFlowSettings(body)
    return NextResponse.json({ ok: true, data: settings })
  } catch (error) {
    console.error("[POST /api/smart-flow/settings]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update SmartFlow settings",
      },
      { status: 500 },
    )
  }
}
