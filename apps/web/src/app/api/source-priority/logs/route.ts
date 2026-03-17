import { NextResponse } from "next/server"
import { listPriorityLogs } from "@fxflow/db"

export async function GET() {
  try {
    const logs = await listPriorityLogs({ limit: 50 })
    return NextResponse.json({ ok: true, data: logs })
  } catch (error) {
    console.error("[GET /api/source-priority/logs]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read priority logs" },
      { status: 500 },
    )
  }
}
