import { NextResponse } from "next/server"
import { listPriorityLogs, getSettings } from "@fxflow/db"

export async function GET() {
  try {
    const settings = await getSettings()
    const logs = await listPriorityLogs({ limit: 50, account: settings.tradingMode })
    return NextResponse.json({ ok: true, data: logs })
  } catch (error) {
    console.error("[GET /api/source-priority/logs]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to read priority logs" },
      { status: 500 },
    )
  }
}
