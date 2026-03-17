import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSourcePriorityConfig, updateSourcePriorityConfig } from "@fxflow/db"

export async function GET() {
  try {
    const config = await getSourcePriorityConfig()
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[GET /api/source-priority]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read source priority config",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = await updateSourcePriorityConfig(body)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[POST /api/source-priority]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to update source priority config",
      },
      { status: 500 },
    )
  }
}
