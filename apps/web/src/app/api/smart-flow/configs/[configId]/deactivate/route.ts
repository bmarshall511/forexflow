import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { deactivateSmartFlowConfig } from "@fxflow/db"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ configId: string }> },
) {
  try {
    const { configId } = await params
    const config = await deactivateSmartFlowConfig(configId)
    return NextResponse.json({ ok: true, data: config })
  } catch (error) {
    console.error("[POST /api/smart-flow/configs/:id/deactivate]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to deactivate SmartFlow config",
      },
      { status: 500 },
    )
  }
}
