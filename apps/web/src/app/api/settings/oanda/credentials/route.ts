import { NextResponse } from "next/server"
import { saveCredentials, deleteCredentials } from "@fxflow/db"
import type {
  ApiResponse,
  OandaCredentials,
  SaveCredentialsRequest,
  TradingMode,
} from "@fxflow/types"
import { pokeDaemonCredentialRefresh } from "@/lib/poke-daemon-oanda"

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<OandaCredentials>>> {
  try {
    const body = (await request.json()) as SaveCredentialsRequest

    if (body.mode !== "live" && body.mode !== "practice") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode. Must be 'live' or 'practice'" },
        { status: 400 },
      )
    }

    if (!body.accountId?.trim()) {
      return NextResponse.json({ ok: false, error: "Account ID is required" }, { status: 400 })
    }

    const result = await saveCredentials(body)
    await pokeDaemonCredentialRefresh()
    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error("[PUT /api/settings/oanda/credentials]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
): Promise<NextResponse<ApiResponse<{ tradingMode: TradingMode }>>> {
  try {
    const body = (await request.json()) as { mode: TradingMode }

    if (body.mode !== "live" && body.mode !== "practice") {
      return NextResponse.json(
        { ok: false, error: "Invalid mode. Must be 'live' or 'practice'" },
        { status: 400 },
      )
    }

    const tradingMode = await deleteCredentials(body.mode)
    await pokeDaemonCredentialRefresh()
    return NextResponse.json({ ok: true, data: { tradingMode } })
  } catch (error) {
    console.error("[DELETE /api/settings/oanda/credentials]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
