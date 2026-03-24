import { NextResponse, type NextRequest } from "next/server"
import { listConditionsForTrade, createCondition } from "@fxflow/db"
import type { ApiResponse, TradeConditionData } from "@fxflow/types"
import { CreateConditionSchema } from "@fxflow/types"
import { parseBody, apiSuccess, apiError } from "@/lib/api-validation"
import { getServerDaemonUrl } from "@/lib/daemon-url"

const DAEMON_URL = getServerDaemonUrl()

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

    const parsed = await parseBody(request, CreateConditionSchema)
    if (!parsed.success) return parsed.response

    const body = parsed.data

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

    return apiSuccess(condition)
  } catch (error) {
    console.error("[POST /api/ai/conditions/[tradeId]]", error)
    return apiError(error instanceof Error ? error.message : "Unknown error", 500)
  }
}
