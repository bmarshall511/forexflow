import { NextResponse, type NextRequest } from "next/server"
import { listConditionsForTrade, createCondition } from "@fxflow/db"
import type { ApiResponse, TradeConditionData, TradeConditionTriggerType, TradeConditionActionType } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<TradeConditionData[]>>> {
  try {
    const { tradeId } = await params
    const conditions = await listConditionsForTrade(tradeId)
    return NextResponse.json({ ok: true, data: conditions })
  } catch (error) {
    console.error("[GET /api/ai/conditions/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
): Promise<NextResponse<ApiResponse<TradeConditionData>>> {
  try {
    const { tradeId } = await params
    const body = await request.json() as {
      triggerType: TradeConditionTriggerType
      triggerValue: Record<string, unknown>
      actionType: TradeConditionActionType
      actionParams?: Record<string, unknown>
      label?: string
      priority?: number
      expiresAt?: string
      analysisId?: string
      parentConditionId?: string
      status?: "active" | "waiting"
    }

    if (!body.triggerType || !body.actionType || !body.triggerValue) {
      return NextResponse.json(
        { ok: false, error: "triggerType, triggerValue, and actionType are required" },
        { status: 400 },
      )
    }

    const condition = await createCondition({
      tradeId,
      triggerType: body.triggerType,
      triggerValue: body.triggerValue,
      actionType: body.actionType,
      actionParams: body.actionParams,
      label: body.label,
      createdBy: "user",
      analysisId: body.analysisId,
      priority: body.priority,
      parentConditionId: body.parentConditionId,
      status: body.status,
      expiresAt: body.expiresAt,
    })

    // Notify daemon to load the new condition into memory
    try {
      await fetch(`${DAEMON_URL}/actions/ai/reload-condition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId: condition.id }),
      })
    } catch {
      console.warn("[POST /api/ai/conditions/[tradeId]] Failed to notify daemon")
    }

    return NextResponse.json({ ok: true, data: condition })
  } catch (error) {
    console.error("[POST /api/ai/conditions/[tradeId]]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
