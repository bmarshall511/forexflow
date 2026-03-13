import { NextResponse, type NextRequest } from "next/server"
import { getAuditTrail } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"
import type { SignalAuditEventData } from "@fxflow/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ signalId: string }> },
): Promise<NextResponse<ApiResponse<SignalAuditEventData[]>>> {
  try {
    const { signalId } = await params
    if (!signalId) {
      return NextResponse.json({ ok: false, error: "Missing signalId" }, { status: 400 })
    }

    const trail = await getAuditTrail(signalId)
    return NextResponse.json({ ok: true, data: trail })
  } catch (error) {
    console.error("[GET /api/tv-alerts/signals/[signalId]/audit]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
