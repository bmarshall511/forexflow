import { type NextRequest, NextResponse } from "next/server"
import { getAllOpportunities, getSettings } from "@fxflow/db"
import type {
  AiTraderOpportunityData,
  AiTraderOpportunityStatus,
  AiTraderProfile,
  TradeDirection,
} from "@fxflow/types"

interface PaginatedResponse {
  data: AiTraderOpportunityData[]
  total: number
  page: number
  limit: number
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams

    const statusParam = params.get("status")
    const status = statusParam ? (statusParam.split(",") as AiTraderOpportunityStatus[]) : undefined

    const instrument = params.get("instrument") ?? undefined
    const profile = (params.get("profile") as AiTraderProfile | null) ?? undefined
    const direction = (params.get("direction") as TradeDirection | null) ?? undefined
    const search = params.get("search") ?? undefined
    const sort =
      (params.get("sort") as
        | "confidence"
        | "detectedAt"
        | "realizedPL"
        | "riskRewardRatio"
        | null) ?? undefined
    const sortDir = (params.get("sortDir") as "asc" | "desc" | null) ?? undefined
    const page = parseInt(params.get("page") ?? "1", 10)
    const limit = Math.min(parseInt(params.get("limit") ?? "20", 10), 100)

    const settings = await getSettings()
    const result = await getAllOpportunities({
      status,
      instrument,
      profile,
      direction,
      account: settings.tradingMode,
      search,
      sort,
      sortDir,
      page,
      limit,
    })

    return NextResponse.json<{ ok: true } & PaginatedResponse>({
      ok: true,
      data: result.data,
      total: result.total,
      page,
      limit,
    })
  } catch (error) {
    console.error("[GET /api/ai-trader/opportunities]", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
