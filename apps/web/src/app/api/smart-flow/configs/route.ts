import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSmartFlowConfigs, createSmartFlowConfig } from "@fxflow/db"

export async function GET() {
  try {
    const configs = await getSmartFlowConfigs()
    return NextResponse.json({ ok: true, data: configs })
  } catch (error) {
    console.error("[GET /api/smart-flow/configs]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read SmartFlow configs",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = await createSmartFlowConfig(body)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[POST /api/smart-flow/configs]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create SmartFlow config",
      },
      { status: 500 },
    )
  }
}
