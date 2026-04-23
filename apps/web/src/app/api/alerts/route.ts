import { NextResponse, type NextRequest } from "next/server"
import { listPriceAlerts, createPriceAlert, cancelAllAlerts, getSettings } from "@fxflow/db"
import type { ApiResponse, PriceAlertData } from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"
import { z } from "zod"

const createAlertSchema = z.object({
  instrument: z.string().min(1),
  direction: z.enum(["above", "below"]),
  targetPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  label: z.string().optional(),
  repeating: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<PriceAlertData[]>>> {
  try {
    const { searchParams } = req.nextUrl
    const status = searchParams.get("status") ?? undefined
    const instrument = searchParams.get("instrument") ?? undefined
    const settings = await getSettings()
    const alerts = await listPriceAlerts({ status, instrument, account: settings.tradingMode })
    return NextResponse.json({ ok: true, data: alerts })
  } catch (error) {
    console.error("[GET /api/alerts]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<PriceAlertData>>> {
  try {
    const body: unknown = await req.json()
    const parsed = createAlertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      )
    }

    const settings = await getSettings()
    const alert = await createPriceAlert({
      ...parsed.data,
      account: settings.tradingMode,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
    })

    // Notify daemon to pick up the new alert
    try {
      const daemonUrl = getServerDaemonUrl()
      await fetch(`${daemonUrl}/actions/alerts/reload`, { method: "POST" })
    } catch {
      // Daemon might not be running — alert is persisted, will be picked up on next reload
    }

    return NextResponse.json({ ok: true, data: alert }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/alerts]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(): Promise<NextResponse<ApiResponse<{ cancelled: number }>>> {
  try {
    const cancelled = await cancelAllAlerts()

    // Notify daemon to reload
    try {
      const daemonUrl = getServerDaemonUrl()
      await fetch(`${daemonUrl}/actions/alerts/reload`, { method: "POST" })
    } catch {
      // Best-effort
    }

    return NextResponse.json({ ok: true, data: { cancelled } })
  } catch (error) {
    console.error("[DELETE /api/alerts]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
