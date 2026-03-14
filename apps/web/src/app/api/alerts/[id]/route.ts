import { NextResponse, type NextRequest } from "next/server"
import { getPriceAlert, updatePriceAlert, deletePriceAlert } from "@fxflow/db"
import type { ApiResponse, PriceAlertData } from "@fxflow/types"
import { z } from "zod"

type RouteParams = { params: Promise<{ id: string }> }

const updateAlertSchema = z.object({
  label: z.string().optional(),
  targetPrice: z.number().positive().optional(),
  direction: z.enum(["above", "below"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<PriceAlertData>>> {
  try {
    const { id } = await params
    const alert = await getPriceAlert(id)
    if (!alert) {
      return NextResponse.json({ ok: false, error: "Alert not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, data: alert })
  } catch (error) {
    console.error("[GET /api/alerts/:id]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<PriceAlertData>>> {
  try {
    const { id } = await params
    const body: unknown = await req.json()
    const parsed = updateAlertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 },
      )
    }

    const alert = await updatePriceAlert(id, {
      ...parsed.data,
      expiresAt:
        parsed.data.expiresAt === null
          ? null
          : parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : undefined,
    })

    // Notify daemon to reload alerts
    try {
      const daemonUrl = process.env.DAEMON_REST_URL ?? "http://localhost:4100"
      await fetch(`${daemonUrl}/actions/alerts/reload`, { method: "POST" })
    } catch {
      // Best-effort
    }

    return NextResponse.json({ ok: true, data: alert })
  } catch (error) {
    console.error("[PUT /api/alerts/:id]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<ApiResponse<void>>> {
  try {
    const { id } = await params
    await deletePriceAlert(id)

    // Notify daemon to reload alerts
    try {
      const daemonUrl = process.env.DAEMON_REST_URL ?? "http://localhost:4100"
      await fetch(`${daemonUrl}/actions/alerts/reload`, { method: "POST" })
    } catch {
      // Best-effort
    }

    return NextResponse.json({ ok: true, data: undefined })
  } catch (error) {
    console.error("[DELETE /api/alerts/:id]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
