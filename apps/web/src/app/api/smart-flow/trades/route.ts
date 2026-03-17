import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
  getActiveSmartFlowTrades,
  getSmartFlowTradesByStatus,
  getSmartFlowTradeHistory,
} from "@fxflow/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const history = searchParams.get("history")
    const status = searchParams.get("status")

    if (history === "true") {
      const trades = await getSmartFlowTradeHistory()
      return NextResponse.json({ ok: true, data: trades })
    }

    if (status) {
      const trades = await getSmartFlowTradesByStatus(
        status as import("@fxflow/types").SmartFlowTradeStatus,
      )
      return NextResponse.json({ ok: true, data: trades })
    }

    const trades = await getActiveSmartFlowTrades()
    return NextResponse.json({ ok: true, data: trades })
  } catch (error) {
    console.error("[GET /api/smart-flow/trades]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to read SmartFlow trades",
      },
      { status: 500 },
    )
  }
}
