import { NextResponse, type NextRequest } from "next/server"
import { updateCondition, deleteCondition } from "@fxflow/db"
import type {
  ApiResponse,
  TradeConditionData,
  TradeConditionTriggerType,
  TradeConditionActionType,
} from "@fxflow/types"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

async function notifyDaemon(conditionId: string, action: "reload" | "remove") {
  try {
    await fetch(`${DAEMON_URL}/actions/ai/reload-condition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditionId, action }),
    })
  } catch {
    console.warn(`[conditions/${conditionId}] Failed to notify daemon`)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string; conditionId: string }> },
): Promise<NextResponse<ApiResponse<TradeConditionData | null>>> {
  try {
    const { tradeId, conditionId } = await params

    // Validate condition belongs to the specified trade
    const { db } = await import("@fxflow/db")
    const existing = await db.tradeCondition.findUnique({
      where: { id: conditionId },
      select: { tradeId: true },
    })
    if (!existing || existing.tradeId !== tradeId) {
      return NextResponse.json({ ok: false, error: "Condition not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      triggerType?: TradeConditionTriggerType
      triggerValue?: Record<string, unknown>
      actionType?: TradeConditionActionType
      actionParams?: Record<string, unknown>
      label?: string | null
      priority?: number
      expiresAt?: string | null
    }

    const updated = await updateCondition(conditionId, body)
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Condition not found" }, { status: 404 })
    }

    await notifyDaemon(conditionId, "reload")
    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error("[PATCH /api/ai/conditions/[tradeId]/[conditionId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string; conditionId: string }> },
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { tradeId, conditionId } = await params

    // Validate condition belongs to the specified trade
    const { db } = await import("@fxflow/db")
    const existing = await db.tradeCondition.findUnique({
      where: { id: conditionId },
      select: { tradeId: true },
    })
    if (!existing || existing.tradeId !== tradeId) {
      return NextResponse.json({ ok: false, error: "Condition not found" }, { status: 404 })
    }

    const deleted = await deleteCondition(conditionId)

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Condition not found" }, { status: 404 })
    }

    await notifyDaemon(conditionId, "remove")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/ai/conditions/[tradeId]/[conditionId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
